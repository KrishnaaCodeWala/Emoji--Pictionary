import 'server-only';
import { getSupabaseAdmin } from './supabase/admin';
import { HttpError } from './http';
import type { RoomRow, Player, RoomSettings } from './types';
import {
  ROUNDS_PER_PLAYER,
  ROUND_SECONDS,
  POINTS_GUESSER,
  POINTS_DRAWER,
  HINT_COST,
  MIN_GUESSER_POINTS,
  SPEED_BONUS_POINTS,
  SPEED_BONUS_WINDOW_S,
} from './constants';
import { pickPrompt, getPromptById } from './prompts';
import { SYS_REVEAL_PREFIX, SYS_HINTS_PREFIX } from './constants';
import { publicHints } from './prompts';
import type { RevealPayload } from './types';

/** Full room row (incl. current_word). Throws HttpError(404) if missing. */
export async function getRoomByCode(code: string): Promise<RoomRow> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('rooms')
    .select('*')
    .eq('room_code', code)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, 'Room not found');
  return data as RoomRow;
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

async function insertSystemMessage(roomId: string, content: string) {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from('messages').insert({
    room_id: roomId,
    player_id: null,
    content,
    type: 'system',
  });
  if (error) throw new HttpError(500, error.message);
}

/**
 * Rotate drawer, pick prompt (classic word or charades prompt), bump round, or finish the game.
 */
export async function startNextTurn(roomId: string): Promise<void> {
  const admin = getSupabaseAdmin();

  const [room, players] = await Promise.all([getRoomById(roomId), getPlayersOrdered(roomId)]);

  if (players.length === 0) {
    throw new HttpError(400, 'No players in room');
  }

  const roundsPerPlayer = room.settings?.rounds ?? ROUNDS_PER_PLAYER;
  const totalRounds = players.length * roundsPerPlayer;

  if (room.round_number >= totalRounds) {
    const { error } = await admin
      .from('rooms')
      .update({
        status: 'finished',
        current_drawer_id: null,
        current_word: null,
        current_prompt_id: null,
        round_end_time: null,
      })
      .eq('id', roomId);
    if (error) throw new HttpError(500, error.message);
    await insertSystemMessage(roomId, 'Game over');
    return;
  }

  const nextDrawer = players[room.round_number % players.length];
  const { answer, promptId } = await pickPrompt(room);
  const nextRoundNumber = room.round_number + 1;
  const roundEndTime = new Date(Date.now() + ROUND_SECONDS * 1000).toISOString();
  const roundStartedAt = new Date().toISOString();

  const nextSettings: RoomSettings = { ...room.settings };
  if (promptId) {
    nextSettings.usedPromptIds = [...(room.settings?.usedPromptIds ?? []), promptId];
  }

  const { error } = await admin
    .from('rooms')
    .update({
      status: 'playing',
      current_drawer_id: nextDrawer.id,
      current_word: answer,
      current_prompt_id: promptId,
      revealed_hints: [],
      round_started_at: roundStartedAt,
      round_number: nextRoundNumber,
      round_end_time: roundEndTime,
      settings: nextSettings,
    })
    .eq('id', roomId);
  if (error) throw new HttpError(500, error.message);

  await insertSystemMessage(
    roomId,
    `Round ${nextRoundNumber} — ${nextDrawer.nickname} is drawing`,
  );

  // Charades: guessers see the category from the start.
  if (room.mode === 'charades' && promptId) {
    const prompt = await getPromptById(promptId);
    if (prompt) {
      await insertSystemMessage(
        roomId,
        SYS_HINTS_PREFIX + JSON.stringify({ ...publicHints(prompt, []), roundNumber: nextRoundNumber }),
      );
    }
  }
}

/**
 * Resolve the round for charades (correct guess or timeout): insert the 'reveal:' system
 * message (RevealPayload) before the round-summary message and before startNextTurn.
 * No-op in classic mode.
 */
export async function resolveRoundReveal(roomId: string, guesserNickname: string | null): Promise<void> {
  const room = await getRoomById(roomId);
  if (room.mode !== 'charades' || !room.current_prompt_id) return;

  const prompt = await getPromptById(room.current_prompt_id);
  if (!prompt) return;

  const payload: RevealPayload = {
    title: prompt.title,
    year: prompt.year,
    kind: prompt.kind,
    poster_url: prompt.poster_url,
    guesserNickname,
    roundNumber: room.round_number,
  };

  await insertSystemMessage(roomId, SYS_REVEAL_PREFIX + JSON.stringify(payload));
}

/**
 * Award points for a correct guess and advance the turn.
 * Returns false if the race guard rejected (round already advanced / someone else scored).
 */
export async function awardAndAdvance(
  roomId: string,
  guesserId: string,
  roundNumber: number,
  word: string,
): Promise<boolean> {
  const admin = getSupabaseAdmin();

  // Conditional update: only proceed if the round hasn't already been resolved.
  // Clearing current_word here (rather than rewriting the same value) is what makes this
  // a real race guard: a concurrent second call's `.eq('current_word', word)` filter will
  // no longer match once this update commits, so it gets 0 rows back and returns false.
  const { data: updatedRows, error: updateError } = await admin
    .from('rooms')
    .update({ current_word: null })
    .eq('id', roomId)
    .eq('round_number', roundNumber)
    .eq('current_word', word)
    .select();

  if (updateError) throw new HttpError(500, updateError.message);
  if (!updatedRows || updatedRows.length !== 1) {
    return false;
  }

  const room = updatedRows[0] as RoomRow;
  const drawerId = room.current_drawer_id;

  const players = await getPlayersOrdered(roomId);
  const guesser = players.find((p) => p.id === guesserId);
  const drawer = drawerId ? players.find((p) => p.id === drawerId) : undefined;

  let guesserPoints = POINTS_GUESSER;
  let drawerPoints = POINTS_DRAWER;

  if (room.mode === 'charades') {
    const revealedCount = room.revealed_hints?.length ?? 0;
    guesserPoints = Math.max(MIN_GUESSER_POINTS, POINTS_GUESSER - HINT_COST * revealedCount);
    if (room.round_started_at) {
      const elapsedS = (Date.now() - new Date(room.round_started_at).getTime()) / 1000;
      if (elapsedS <= SPEED_BONUS_WINDOW_S) {
        guesserPoints += SPEED_BONUS_POINTS;
      }
    }
    drawerPoints = POINTS_DRAWER;
  }

  if (guesser) {
    const { error } = await admin
      .from('players')
      .update({ score: guesser.score + guesserPoints })
      .eq('id', guesser.id);
    if (error) throw new HttpError(500, error.message);
  }

  if (drawer) {
    const { error } = await admin
      .from('players')
      .update({ score: drawer.score + drawerPoints })
      .eq('id', drawer.id);
    if (error) throw new HttpError(500, error.message);
  }

  await resolveRoundReveal(roomId, guesser ? guesser.nickname : null);

  await insertSystemMessage(
    roomId,
    `${guesser ? guesser.nickname : 'Someone'} guessed it! The word was ${word}`,
  );

  await startNextTurn(roomId);

  return true;
}
