import { jsonOk, handleApiError, HttpError } from '@/lib/http';
import { getRoomByCode, awardAndAdvance } from '@/lib/game';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { GuessReq, GuessRes } from '@/lib/types';

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

    const normalizedWord = room.current_word ? normalize(room.current_word) : '';

    if (normalizedGuess !== normalizedWord) {
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
