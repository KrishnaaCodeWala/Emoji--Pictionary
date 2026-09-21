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
  ROUND_INTRO_MS,
  STREAK_BONUS_MAX,
  SYS_SCORE_PREFIX,
} from './constants';
import { pickPrompt, getPromptById } from './prompts';
import { SYS_REVEAL_PREFIX, SYS_HINTS_PREFIX } from './constants';
import { publicHints } from './prompts';
import type { RevealPayload, ScoreEvent } from './types';

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

/** Returns only active (not left) non-spectator players. */
function activePlayers(players: Player[]): Player[] {
  return players.filter((p) => p.left_at == null && p.role !== 'spectator');
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
 * Also sets round_intro_until so all clients show the 3-2-1 overlay before the timer starts.
 */
export async function startNextTurn(roomId: string): Promise<void> {
  const admin = getSupabaseAdmin();

  const [room, allPlayers] = await Promise.all([getRoomById(roomId), getPlayersOrdered(roomId)]);
  const players = activePlayers(allPlayers);

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
        round_intro_until: null,
      })
      .eq('id', roomId);
    if (error) throw new HttpError(500, error.message);

    // Write to game_results for players with auth_uid
    const authPlayers = players.filter(p => p.auth_uid != null);
    if (authPlayers.length > 0) {
      // Sort to get placement
      const sorted = [...players].sort((a, b) => b.score - a.score);
      const results = authPlayers.map(p => ({
        room_id: roomId,
        user_id: p.auth_uid,
        mode: room.mode,
        placement: sorted.findIndex(sp => sp.id === p.id) + 1,
        points: p.score
      }));
      await admin.from('game_results').insert(results);
    }

    await insertSystemMessage(roomId, 'Game over');
    return;
  }

  const nextDrawer = players[room.round_number % players.length];
  const { answer, promptId } = await pickPrompt(room);
  const nextRoundNumber = room.round_number + 1;

  // Round intro: 3-2-1 overlay; timer starts after intro ends.
  const introEnd = new Date(Date.now() + ROUND_INTRO_MS);
  const roundEndTime = new Date(introEnd.getTime() + ROUND_SECONDS * 1000).toISOString();
  const roundStartedAt = introEnd.toISOString(); // treat intro-end as round start for speed bonus

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
      round_intro_until: introEnd.toISOString(),
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
 * Tracks streaks: guesser's streak increments; drawer and all others reset to 0.
 * Emits a score: structured message for each scorer.
 * Returns false if the race guard rejected.
 */
export async function awardAndAdvance(
  roomId: string,
  guesserId: string,
  roundNumber: number,
  word: string,
): Promise<boolean> {
  const admin = getSupabaseAdmin();

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
    const hintCost = room.settings?.difficulty === 'hard' ? 3 : HINT_COST;
    guesserPoints = Math.max(MIN_GUESSER_POINTS, POINTS_GUESSER - hintCost * revealedCount);
    if (room.round_started_at) {
      const elapsedS = (Date.now() - new Date(room.round_started_at).getTime()) / 1000;
      if (elapsedS <= SPEED_BONUS_WINDOW_S) {
        guesserPoints += SPEED_BONUS_POINTS;
      }
    }
    drawerPoints = POINTS_DRAWER;
  }

  // ---- Streaks ----
  const guesserStreak = guesser ? Math.min((guesser.streak ?? 0) + 1, 99) : 0;
  const streakBonus = Math.min(Math.floor(guesserStreak / 2), STREAK_BONUS_MAX);
  guesserPoints += streakBonus;

  if (guesser) {
    const { error } = await admin
      .from('players')
      .update({ score: guesser.score + guesserPoints, streak: guesserStreak })
      .eq('id', guesser.id);
    if (error) throw new HttpError(500, error.message);

    // Broadcast score event for the guesser
    const ev: ScoreEvent = { playerId: guesser.id, delta: guesserPoints, reason: 'guess', streak: guesserStreak };
    await insertSystemMessage(roomId, SYS_SCORE_PREFIX + JSON.stringify(ev));
  }

  if (drawer) {
    const { error } = await admin
      .from('players')
      .update({ score: drawer.score + drawerPoints, streak: 0 })
      .eq('id', drawer.id);
    if (error) throw new HttpError(500, error.message);

    const ev: ScoreEvent = { playerId: drawer.id, delta: drawerPoints, reason: 'draw', streak: 0 };
    await insertSystemMessage(roomId, SYS_SCORE_PREFIX + JSON.stringify(ev));
  }

  // Reset streaks for all other active players
  const otherIds = players
    .filter((p) => p.id !== guesserId && p.id !== drawerId && p.left_at == null && p.streak > 0)
    .map((p) => p.id);
  if (otherIds.length > 0) {
    await admin.from('players').update({ streak: 0 }).in('id', otherIds);
  }

  await resolveRoundReveal(roomId, guesser ? guesser.nickname : null);

  await insertSystemMessage(
    roomId,
    `${guesser ? guesser.nickname : 'Someone'} guessed it! The word was ${word}`,
  );

  await startNextTurn(roomId);

  return true;
}
