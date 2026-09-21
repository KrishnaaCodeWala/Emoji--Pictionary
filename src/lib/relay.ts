import 'server-only';
// Canvas Relay server loop. Signatures are the contract.
import { getSupabaseAdmin } from './supabase/admin';
import { HttpError } from './http';
import { isImageContent } from './canvasContent';
import { MAX_CANVAS_DATA_URL_LENGTH } from './constants';
import { pickWord } from './words';
import {
  RELAY_TIMERS,
  RELAY_PHRASE_MAX,
  RELAY_DEFAULT_DRAW,
  RELAY_DEFAULT_GUESS,
  SYS_RELAY_PREFIX,
  SYS_CHAIN_PREFIX,
  MAX_EMOJI_LENGTH,
} from './constants';
import type {
  AlbumChainRes,
  AlbumStep,
  ChainSummary,
  Player,
  RelayStepKind,
  RelayTaskRes,
  RoomRow,
} from './types';

/** Chain index that `seat` works on at `step`, for `n` players. Never their own chain for 0 < step < n. */
export function assignment(seat: number, step: number, n: number): number {
  return (seat + step) % n;
}

/** step 0 = write, odd steps = draw, even steps > 0 = guess. */
function kindForStep(step: number): RelayStepKind {
  if (step === 0) return 'write';
  return step % 2 === 1 ? 'draw' : 'guess';
}

interface ChainRow {
  id: string;
  room_id: string;
  game_no: number;
  chain_index: number;
  origin_player_id: string | null;
}

interface ChainStepRow {
  id: string;
  chain_id: string;
  step: number;
  kind: RelayStepKind;
  author_player_id: string | null;
  content: string;
  submitted: boolean;
}

async function getRoomById(roomId: string): Promise<RoomRow> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from('rooms').select('*').eq('id', roomId).maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, 'Room not found');
  return data as RoomRow;
}

async function getPlayersOrdered(roomId: string): Promise<Player[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('players')
    .select('*')
    .eq('room_id', roomId)
    .order('turn_order', { ascending: true });
  if (error) throw new HttpError(500, error.message);
  return (data ?? []) as Player[];
}

async function getChainsForGame(roomId: string, gameNo: number): Promise<ChainRow[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('chains')
    .select('*')
    .eq('room_id', roomId)
    .eq('game_no', gameNo)
    .order('chain_index', { ascending: true });
  if (error) throw new HttpError(500, error.message);
  return (data ?? []) as ChainRow[];
}

async function insertSystemMessage(roomId: string, content: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from('messages').insert({
    room_id: roomId,
    player_id: null,
    content,
    type: 'system',
  });
  if (error) throw new HttpError(500, error.message);
}

/** Create chains + step-0 rows, set relay_phase='write', relay_step=0, status='playing', timer. */
export async function startRelay(roomId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const [room, players] = await Promise.all([getRoomById(roomId), getPlayersOrdered(roomId)]);

  if (players.length === 0) {
    throw new HttpError(400, 'No players in room');
  }

  const nextGameNo = (room.game_no ?? 0) + 1;
  const timers = room.settings?.relayTimers ?? RELAY_TIMERS;

  const { data: insertedChains, error: chainsError } = await admin
    .from('chains')
    .insert(
      players.map((p, seat) => ({
        room_id: roomId,
        game_no: nextGameNo,
        chain_index: seat,
        origin_player_id: p.id,
      })),
    )
    .select();
  if (chainsError) throw new HttpError(500, chainsError.message);
  const chains = (insertedChains ?? []) as ChainRow[];

  const { error: stepsError } = await admin.from('chain_steps').insert(
    chains.map((chain) => ({
      chain_id: chain.id,
      step: 0,
      kind: 'write' as const,
      author_player_id: chain.origin_player_id,
      content: '',
      submitted: false,
    })),
  );
  if (stepsError) throw new HttpError(500, stepsError.message);

  const now = Date.now();
  const roundEndTime = new Date(now + timers.write * 1000).toISOString();
  const roundStartedAt = new Date(now).toISOString();

  const { error: roomError } = await admin
    .from('rooms')
    .update({
      game_no: nextGameNo,
      relay_phase: 'write',
      relay_step: 0,
      status: 'playing',
      round_number: 1,
      round_started_at: roundStartedAt,
      round_end_time: roundEndTime,
      current_drawer_id: null,
      current_word: null,
    })
    .eq('id', roomId);
  if (roomError) throw new HttpError(500, roomError.message);

  await insertSystemMessage(roomId, 'Canvas Relay: write a phrase for someone to draw!');
}

export async function getTask(roomId: string, playerId: string): Promise<RelayTaskRes> {
  const [room, players] = await Promise.all([getRoomById(roomId), getPlayersOrdered(roomId)]);

  const seat = players.findIndex((p) => p.id === playerId);
  if (seat === -1) {
    throw new HttpError(403, 'Not a player in this room');
  }

  if (room.relay_phase === 'album' || room.relay_phase === null) {
    return {
      phase: 'album',
      step: room.relay_step,
      kind: null,
      input: null,
      submitted: false,
      endsAt: null,
    };
  }

  const n = players.length;
  const step = room.relay_step;
  const chainIndex = assignment(seat, step, n);

  const admin = getSupabaseAdmin();
  const { data: chain, error: chainError } = await admin
    .from('chains')
    .select('*')
    .eq('room_id', roomId)
    .eq('game_no', room.game_no)
    .eq('chain_index', chainIndex)
    .maybeSingle();
  if (chainError) throw new HttpError(500, chainError.message);
  if (!chain) throw new HttpError(500, 'Chain not found');

  const { data: existingRow, error: rowError } = await admin
    .from('chain_steps')
    .select('*')
    .eq('chain_id', chain.id)
    .eq('step', step)
    .maybeSingle();
  if (rowError) throw new HttpError(500, rowError.message);
  let row = existingRow;

  if (!row) {
    const { data: created, error: createError } = await admin
      .from('chain_steps')
      .insert({
        chain_id: chain.id,
        step,
        kind: kindForStep(step),
        author_player_id: playerId,
        content: '',
        submitted: false,
      })
      .select()
      .single();
    if (createError) throw new HttpError(500, createError.message);
    row = created;
  }
  const stepRow = row as ChainStepRow;

  let input: RelayTaskRes['input'] = null;
  if (step > 0) {
    const { data: prevRow, error: prevError } = await admin
      .from('chain_steps')
      .select('*')
      .eq('chain_id', chain.id)
      .eq('step', step - 1)
      .maybeSingle();
    if (prevError) throw new HttpError(500, prevError.message);
    if (prevRow) {
      const prev = prevRow as ChainStepRow;
      input = { kind: prev.kind, content: prev.content };
    }
  }

  return {
    phase: room.relay_phase,
    step,
    kind: kindForStep(step),
    input,
    submitted: stepRow.submitted,
    endsAt: room.round_end_time,
  };
}

function validateContent(kind: RelayStepKind, content: string): string {
  if (kind === 'write' || kind === 'guess') {
    const trimmed = content.trim();
    if (trimmed.length < 1 || trimmed.length > RELAY_PHRASE_MAX) {
      throw new HttpError(400, `content must be 1-${RELAY_PHRASE_MAX} characters`);
    }
    return trimmed;
  }
  // draw: canvas snapshots are data URLs, everything else is an emoji string
  if (isImageContent(content)) {
    if (content.length > MAX_CANVAS_DATA_URL_LENGTH) {
      throw new HttpError(400, 'drawing is too large');
    }
    return content;
  }
  const codepoints = Array.from(content);
  if (codepoints.length > MAX_EMOJI_LENGTH) {
    throw new HttpError(400, `content must be at most ${MAX_EMOJI_LENGTH} characters`);
  }
  return codepoints.length === 0 ? RELAY_DEFAULT_DRAW : content;
}

/** Upsert the caller's row for the current step, mark submitted, then tryAdvanceStep(roomId, false). */
export async function submitStep(
  roomId: string,
  playerId: string,
  step: number,
  content: string,
): Promise<void> {
  const [room, players] = await Promise.all([getRoomById(roomId), getPlayersOrdered(roomId)]);

  if (room.status !== 'playing' || !room.relay_phase || room.relay_phase === 'album') {
    throw new HttpError(400, 'Room is not currently in relay');
  }
  if (step !== room.relay_step) {
    throw new HttpError(400, 'That step is no longer active');
  }

  const seat = players.findIndex((p) => p.id === playerId);
  if (seat === -1) {
    throw new HttpError(403, 'Not a player in this room');
  }

  const n = players.length;
  const chainIndex = assignment(seat, step, n);
  const kind = kindForStep(step);
  const finalContent = validateContent(kind, content);

  const admin = getSupabaseAdmin();
  const { data: chain, error: chainError } = await admin
    .from('chains')
    .select('*')
    .eq('room_id', roomId)
    .eq('game_no', room.game_no)
    .eq('chain_index', chainIndex)
    .maybeSingle();
  if (chainError) throw new HttpError(500, chainError.message);
  if (!chain) throw new HttpError(500, 'Chain not found');

  const { error: upsertError } = await admin.from('chain_steps').upsert(
    {
      chain_id: chain.id,
      step,
      kind,
      author_player_id: playerId,
      content: finalContent,
      submitted: true,
    },
    { onConflict: 'chain_id,step' },
  );
  if (upsertError) throw new HttpError(500, upsertError.message);

  const chains = await getChainsForGame(roomId, room.game_no);
  const chainIds = chains.map((c) => c.id);
  const { count, error: countError } = await admin
    .from('chain_steps')
    .select('*', { count: 'exact', head: true })
    .in('chain_id', chainIds)
    .eq('step', step)
    .eq('submitted', true);
  if (countError) throw new HttpError(500, countError.message);

  await insertSystemMessage(
    roomId,
    SYS_RELAY_PREFIX + JSON.stringify({ step, submitted: count ?? 0, total: n }),
  );

  await tryAdvanceStep(roomId, false);
}

const PHASE_START_MESSAGE: Record<RelayStepKind, string> = {
  write: 'Write a phrase for someone to draw!',
  draw: 'Draw what you were given!',
  guess: 'Guess what this is!',
};

/**
 * Advance when every row for relay_step is submitted, or when `force` and the timer is over.
 * Uses a conditional update on relay_step as a race guard. Returns true if it advanced.
 */
export async function tryAdvanceStep(roomId: string, force: boolean): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const room = await getRoomById(roomId);

  if (room.status !== 'playing' || !room.relay_phase || room.relay_phase === 'album') {
    return false;
  }

  const step = room.relay_step;
  const chains = await getChainsForGame(roomId, room.game_no);
  const n = chains.length;
  if (n === 0) return false;
  const chainIds = chains.map((c) => c.id);

  const { count, error: countError } = await admin
    .from('chain_steps')
    .select('*', { count: 'exact', head: true })
    .in('chain_id', chainIds)
    .eq('step', step)
    .eq('submitted', true);
  if (countError) throw new HttpError(500, countError.message);

  const submittedCount = count ?? 0;
  const timerOver = room.round_end_time ? Date.now() >= new Date(room.round_end_time).getTime() : true;
  if (submittedCount < n && !(force && timerOver)) {
    return false;
  }

  // Claim: conditional update on relay_step guards against double-advance.
  const { data: claimedRows, error: claimError } = await admin
    .from('rooms')
    .update({ relay_step: step + 1 })
    .eq('id', roomId)
    .eq('relay_step', step)
    .select();
  if (claimError) throw new HttpError(500, claimError.message);
  if (!claimedRows || claimedRows.length !== 1) {
    return false;
  }

  // Fill missing/unsubmitted rows for this step with defaults.
  const { data: existingRows, error: existingError } = await admin
    .from('chain_steps')
    .select('*')
    .in('chain_id', chainIds)
    .eq('step', step);
  if (existingError) throw new HttpError(500, existingError.message);
  const submittedChainIds = new Set(
    ((existingRows ?? []) as ChainStepRow[]).filter((r) => r.submitted).map((r) => r.chain_id),
  );
  const kind = kindForStep(step);
  const defaultsToFill = chainIds.filter((id) => !submittedChainIds.has(id));
  if (defaultsToFill.length > 0) {
    const rows = defaultsToFill.map((chainId) => ({
      chain_id: chainId,
      step,
      kind,
      author_player_id: null,
      content: kind === 'write' ? pickWord() : kind === 'draw' ? RELAY_DEFAULT_DRAW : RELAY_DEFAULT_GUESS,
      submitted: true,
    }));
    const { error: fillError } = await admin
      .from('chain_steps')
      .upsert(rows, { onConflict: 'chain_id,step' });
    if (fillError) throw new HttpError(500, fillError.message);
  }

  const nextStep = step + 1;

  if (nextStep >= n) {
    const { error: albumError } = await admin
      .from('rooms')
      .update({
        relay_phase: 'album',
        album_chain: 0,
        album_step: 0,
        round_end_time: null,
      })
      .eq('id', roomId);
    if (albumError) throw new HttpError(500, albumError.message);
    await insertSystemMessage(roomId, 'Album time! The host reveals the chains.');
    return true;
  }

  const players = await getPlayersOrdered(roomId);
  const nextKind = kindForStep(nextStep);
  const nextRows = chains.map((chain) => {
    // seat such that assignment(seat, nextStep, n) === chain.chain_index
    const seat = ((chain.chain_index - nextStep) % n + n) % n;
    const author = players[seat] ?? null;
    return {
      chain_id: chain.id,
      step: nextStep,
      kind: nextKind,
      author_player_id: author ? author.id : null,
      content: '',
      submitted: false,
    };
  });
  const { error: nextStepsError } = await admin
    .from('chain_steps')
    .upsert(nextRows, { onConflict: 'chain_id,step', ignoreDuplicates: true });
  if (nextStepsError) throw new HttpError(500, nextStepsError.message);

  const timers = room.settings?.relayTimers ?? RELAY_TIMERS;
  const roundEndTime = new Date(Date.now() + timers[nextKind] * 1000).toISOString();

  const { error: phaseError } = await admin
    .from('rooms')
    .update({
      relay_phase: nextKind,
      round_end_time: roundEndTime,
      // spec: round_number = step + 2 (step = the just-completed step, i.e. nextStep - 1)
      round_number: step + 2,
    })
    .eq('id', roomId);
  if (phaseError) throw new HttpError(500, phaseError.message);

  await insertSystemMessage(roomId, PHASE_START_MESSAGE[nextKind]);

  return true;
}

/** Current album chain with only the steps revealed so far (never unrevealed steps). */
export async function getAlbum(roomId: string): Promise<AlbumChainRes> {
  const room = await getRoomById(roomId);
  if (room.relay_phase !== 'album') {
    throw new HttpError(400, 'Album is not available yet');
  }

  const [chains, players] = await Promise.all([
    getChainsForGame(roomId, room.game_no),
    getPlayersOrdered(roomId),
  ]);
  const n = chains.length;
  const nicknameById = new Map(players.map((p) => [p.id, p.nickname]));

  const albumChainIndex = room.album_chain ?? 0;
  const albumStep = room.album_step ?? 0;

  const chain = chains.find((c) => c.chain_index === albumChainIndex);
  if (!chain) throw new HttpError(500, 'Chain not found');

  const admin = getSupabaseAdmin();
  const { data: stepRows, error: stepsError } = await admin
    .from('chain_steps')
    .select('*')
    .eq('chain_id', chain.id)
    .lte('step', albumStep)
    .order('step', { ascending: true });
  if (stepsError) throw new HttpError(500, stepsError.message);

  const steps: AlbumStep[] = ((stepRows ?? []) as ChainStepRow[]).map((r) => ({
    step: r.step,
    kind: r.kind,
    content: r.content,
    authorNickname: r.author_player_id ? (nicknameById.get(r.author_player_id) ?? null) : null,
  }));

  const originNickname = chain.origin_player_id
    ? (nicknameById.get(chain.origin_player_id) ?? null)
    : null;

  return {
    chainIndex: albumChainIndex,
    totalChains: n,
    originNickname,
    steps,
    revealedUpTo: albumStep,
    totalSteps: n,
    finished: room.status === 'finished',
  };
}

/** Host: reveal next step; wrap to next chain; at the end finish the game and emit chain summaries. */
export async function albumAdvance(roomId: string): Promise<void> {
  const room = await getRoomById(roomId);
  if (room.relay_phase !== 'album') {
    throw new HttpError(400, 'Album is not available yet');
  }

  const chains = await getChainsForGame(roomId, room.game_no);
  const n = chains.length;
  const albumChainIndex = room.album_chain ?? 0;
  const albumStep = room.album_step ?? 0;

  const admin = getSupabaseAdmin();

  if (albumStep + 1 < n) {
    const newStep = albumStep + 1;
    // Conditional update: a second overlapping call (double tap) becomes a no-op.
    const { data, error } = await admin
      .from('rooms')
      .update({ album_step: newStep })
      .eq('id', roomId)
      .eq('album_chain', albumChainIndex)
      .eq('album_step', albumStep)
      .select('id');
    if (error) throw new HttpError(500, error.message);
    if (!data || data.length !== 1) return;
    await insertSystemMessage(roomId, `Album: chain ${albumChainIndex + 1}, card ${newStep + 1}`);
    return;
  }

  if (albumChainIndex + 1 < n) {
    const newChain = albumChainIndex + 1;
    const { data, error } = await admin
      .from('rooms')
      .update({ album_chain: newChain, album_step: 0 })
      .eq('id', roomId)
      .eq('album_chain', albumChainIndex)
      .eq('album_step', albumStep)
      .select('id');
    if (error) throw new HttpError(500, error.message);
    if (!data || data.length !== 1) return;
    await insertSystemMessage(roomId, `Album: chain ${newChain + 1}, card 1`);
    return;
  }

  // Finish: emit per-chain summaries then close the game.
  const players = await getPlayersOrdered(roomId);
  const nicknameById = new Map(players.map((p) => [p.id, p.nickname]));

  for (const chain of chains) {
    const { data: stepRows, error: stepsError } = await admin
      .from('chain_steps')
      .select('*')
      .eq('chain_id', chain.id)
      .order('step', { ascending: true });
    if (stepsError) throw new HttpError(500, stepsError.message);
    const steps = (stepRows ?? []) as ChainStepRow[];
    const first = steps.find((s) => s.step === 0);
    const lastGuessStep = [...steps].reverse().find((s) => s.kind === 'guess');
    const lastStep = steps[steps.length - 1];
    const originNickname = chain.origin_player_id
      ? (nicknameById.get(chain.origin_player_id) ?? null)
      : null;

    const summary: ChainSummary = {
      chainIndex: chain.chain_index,
      originNickname,
      firstPhrase: first?.content ?? '',
      lastGuess: (lastGuessStep ?? lastStep)?.content ?? '',
    };
    await insertSystemMessage(roomId, SYS_CHAIN_PREFIX + JSON.stringify(summary));
  }

  const { error: finishError } = await admin
    .from('rooms')
    .update({ status: 'finished', relay_phase: null, round_end_time: null })
    .eq('id', roomId);
  if (finishError) throw new HttpError(500, finishError.message);

  await insertSystemMessage(roomId, 'Album: complete');
}
