import 'server-only';
import { getSupabaseAdmin } from './supabase/admin';
import { HttpError } from './http';
import type { RoomRow, Player } from './types';
import { ROUNDS_PER_PLAYER, ROUND_SECONDS, POINTS_GUESSER, POINTS_DRAWER } from './constants';
import { pickWord } from './words';

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
 * Rotate drawer, pick word, bump round, or finish the game.
 * TODO (Track A, v2): use pickPrompt() from ./prompts for both modes, store current_prompt_id,
 * reset revealed_hints, set round_started_at, and push the prompt id into settings.usedPromptIds.
 */
export async function startNextTurn(roomId: string): Promise<void> {
  const admin = getSupabaseAdmin();

  const [room, players] = await Promise.all([
    (async () => {
      const { data, error } = await admin.from('rooms').select('*').eq('id', roomId).maybeSingle();
      if (error) throw new HttpError(500, error.message);
      if (!data) throw new HttpError(404, 'Room not found');
      return data as RoomRow;
    })(),
    getPlayersOrdered(roomId),
  ]);

  if (players.length === 0) {
    throw new HttpError(400, 'No players in room');
  }

  const totalRounds = players.length * ROUNDS_PER_PLAYER;

  if (room.round_number >= totalRounds) {
    const { error } = await admin
      .from('rooms')
      .update({
        status: 'finished',
        current_drawer_id: null,
        current_word: null,
        round_end_time: null,
      })
      .eq('id', roomId);
    if (error) throw new HttpError(500, error.message);
    await insertSystemMessage(roomId, 'Game over');
    return;
  }

  const nextDrawer = players[room.round_number % players.length];
  const nextWord = pickWord(room.current_word);
  const nextRoundNumber = room.round_number + 1;
  const roundEndTime = new Date(Date.now() + ROUND_SECONDS * 1000).toISOString();

  const { error } = await admin
    .from('rooms')
    .update({
      status: 'playing',
      current_drawer_id: nextDrawer.id,
      current_word: nextWord,
      round_number: nextRoundNumber,
      round_end_time: roundEndTime,
    })
    .eq('id', roomId);
  if (error) throw new HttpError(500, error.message);

  await insertSystemMessage(
    roomId,
    `Round ${nextRoundNumber} — ${nextDrawer.nickname} is drawing`,
  );
}

/**
 * TODO (Track A, v2): resolve the round for charades (correct guess or timeout): insert the
 * 'reveal:' system message (RevealPayload) before startNextTurn. Scoring per BUILD_PLAN_V2.
 */
export async function resolveRoundReveal(_roomId: string, _guesserNickname: string | null): Promise<void> {
  // no-op until Track A implements it
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

  if (guesser) {
    const { error } = await admin
      .from('players')
      .update({ score: guesser.score + POINTS_GUESSER })
      .eq('id', guesser.id);
    if (error) throw new HttpError(500, error.message);
  }

  if (drawer) {
    const { error } = await admin
      .from('players')
      .update({ score: drawer.score + POINTS_DRAWER })
      .eq('id', drawer.id);
    if (error) throw new HttpError(500, error.message);
  }

  await insertSystemMessage(
    roomId,
    `${guesser ? guesser.nickname : 'Someone'} guessed it! The word was ${word}`,
  );

  await startNextTurn(roomId);

  return true;
}
