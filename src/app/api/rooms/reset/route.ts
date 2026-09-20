import { jsonOk, jsonError, HttpError, handleApiError } from '@/lib/http';
import { getRoomByCode } from '@/lib/game';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { ResetRoomReq, OkRes } from '@/lib/types';

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, 'Invalid JSON body');
    }

    const { roomCode, playerId } = (body ?? {}) as Partial<ResetRoomReq>;
    if (typeof roomCode !== 'string' || roomCode.trim().length === 0) {
      return jsonError(400, 'roomCode is required');
    }
    if (typeof playerId !== 'string' || playerId.trim().length === 0) {
      return jsonError(400, 'playerId is required');
    }

    const room = await getRoomByCode(roomCode.trim().toUpperCase());

    if (playerId !== room.host_player_id) {
      return jsonError(403, 'Only the host can reset the game');
    }

    const admin = getSupabaseAdmin();

    const { error: deleteError } = await admin.from('messages').delete().eq('room_id', room.id);
    if (deleteError) throw new HttpError(500, deleteError.message);

    const { error: scoreError } = await admin.from('players').update({ score: 0 }).eq('room_id', room.id);
    if (scoreError) throw new HttpError(500, scoreError.message);

    const { error: roomError } = await admin
      .from('rooms')
      .update({
        status: 'lobby',
        round_number: 0,
        current_drawer_id: null,
        current_word: null,
        round_end_time: null,
      })
      .eq('id', room.id);
    if (roomError) throw new HttpError(500, roomError.message);

    return jsonOk<OkRes>({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
