import { jsonOk, jsonError, handleApiError, HttpError } from '@/lib/http';
import { getRoomByCode, awardAndAdvance } from '@/lib/game';
import { getPromptById } from '@/lib/prompts';
import { matchGuess } from '@/lib/matching';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rateLimit';
import type { GuessReq, GuessRes } from '@/lib/types';

// Safety cap on the raw string length before normalization/trimming.
const MAX_GUESS_RAW_LENGTH = 200;

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<GuessReq>;
    const { roomCode, playerId, guess } = body;

    if (!roomCode || typeof roomCode !== 'string') {
      throw new HttpError(400, 'roomCode is required');
    }
    if (!playerId || typeof playerId !== 'string') {
      throw new HttpError(400, 'playerId is required');
    }
    if (typeof guess !== 'string') {
      throw new HttpError(400, 'guess is required');
    }
    if (guess.length > MAX_GUESS_RAW_LENGTH) {
      throw new HttpError(400, 'Guess must be between 1 and 60 characters');
    }

    if (!checkRateLimit(`guess:${playerId}`, 5, 1000)) {
      return jsonError(429, 'Too many requests');
    }

    const room = await getRoomByCode(roomCode);

    if (room.status !== 'playing' || !room.round_end_time || Date.now() >= new Date(room.round_end_time).getTime()) {
      throw new HttpError(400, 'Room is not currently accepting guesses');
    }
    if (playerId === room.current_drawer_id) {
      throw new HttpError(403, 'The drawer may not guess');
    }

    const admin = getSupabaseAdmin();
    const { data: player, error: playerErr } = await admin
      .from('players')
      .select('id, room_id, nickname')
      .eq('id', playerId)
      .eq('room_id', room.id)
      .maybeSingle();
    if (playerErr) throw new HttpError(500, playerErr.message);
    if (!player) throw new HttpError(400, 'You are not a player in this room');

    const trimmed = guess.trim();
    const normalizedGuess = normalize(guess);
    if (!normalizedGuess || normalizedGuess.length > 60) {
      throw new HttpError(400, 'Guess must be between 1 and 60 characters');
    }

    let aliases: string[] = [];
    if (room.mode === 'charades' && room.current_prompt_id) {
      const prompt = await getPromptById(room.current_prompt_id);
      aliases = prompt?.aliases ?? [];
    }

    const matchResult = matchGuess(trimmed, room.current_word ?? '', aliases);

    if (matchResult === 'close') {
      return jsonOk<GuessRes>({ correct: false, close: true });
    }

    if (matchResult === 'miss') {
      const { error: insertErr } = await admin.from('messages').insert({
        room_id: room.id,
        player_id: playerId,
        content: trimmed,
        type: 'guess',
      });
      if (insertErr) throw new HttpError(500, insertErr.message);
      return jsonOk<GuessRes>({ correct: false });
    }

    const result = await awardAndAdvance(room.id, playerId, room.round_number, room.current_word ?? '');
    return jsonOk<GuessRes>({ correct: result });
  } catch (err) {
    return handleApiError(err);
  }
}
