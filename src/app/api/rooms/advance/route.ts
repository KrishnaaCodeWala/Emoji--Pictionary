import { jsonOk, jsonError, HttpError, handleApiError } from '@/lib/http';
import { getRoomByCode, startNextTurn } from '@/lib/game';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { AdvanceReq, OkRes } from '@/lib/types';

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, 'Invalid JSON body');
    }

    const { roomCode, playerId, reason } = (body ?? {}) as Partial<AdvanceReq>;
    if (typeof roomCode !== 'string' || roomCode.trim().length === 0) {
      return jsonError(400, 'roomCode is required');
    }
    if (typeof playerId !== 'string' || playerId.trim().length === 0) {
      return jsonError(400, 'playerId is required');
    }
    if (reason !== undefined && reason !== 'timeout' && reason !== 'drawer_left') {
      return jsonError(400, 'Invalid reason');
    }

    const room = await getRoomByCode(roomCode.trim().toUpperCase());

    if (room.status !== 'playing') {
      return jsonError(400, 'Room is not currently playing');
    }

    if (reason !== 'drawer_left') {
      const now = Date.now();
      const endTime = room.round_end_time ? new Date(room.round_end_time).getTime() : 0;
      if (now < endTime) {
        return jsonError(400, 'Round has not ended yet');
      }
    }

    const admin = getSupabaseAdmin();

    // Idempotency / race guard: only one caller for a given round_number actually advances.
    // Clearing current_word makes a concurrent second call's filter no longer match.
    const { data: claimedRows, error: claimError } = await admin
      .from('rooms')
      .update({ current_word: null })
      .eq('id', room.id)
      .eq('round_number', room.round_number)
      .eq('current_word', room.current_word)
      .select();

    if (claimError) throw new HttpError(500, claimError.message);

    if (!claimedRows || claimedRows.length !== 1) {
      // Someone else already advanced this round; treat as a success (idempotent no-op).
      return jsonOk<OkRes>({ ok: true });
    }

    const { error: msgError } = await admin.from('messages').insert({
      room_id: room.id,
      player_id: null,
      content: `Time's up! The word was ${room.current_word}`,
      type: 'system',
    });
    if (msgError) throw new HttpError(500, msgError.message);

    await startNextTurn(room.id);

    return jsonOk<OkRes>({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
