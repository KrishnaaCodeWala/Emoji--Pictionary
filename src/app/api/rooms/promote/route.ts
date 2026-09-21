import { jsonOk, jsonError, HttpError, handleApiError } from '@/lib/http';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { PromoteReq, OkRes } from '@/lib/types';
import { getRoomByCode } from '@/lib/game';
import { MAX_PLAYERS } from '@/lib/constants';

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, 'Invalid JSON body');
    }

    const { roomCode, playerId, targetPlayerId } = (body ?? {}) as Partial<PromoteReq>;

    if (typeof roomCode !== 'string' || roomCode.trim().length === 0) {
      throw new HttpError(400, 'roomCode is required');
    }
    if (typeof playerId !== 'string' || playerId.trim().length === 0) {
      throw new HttpError(400, 'playerId is required');
    }
    if (typeof targetPlayerId !== 'string' || targetPlayerId.trim().length === 0) {
      throw new HttpError(400, 'targetPlayerId is required');
    }

    const room = await getRoomByCode(roomCode.trim().toUpperCase());
    if (room.host_player_id !== playerId) {
      throw new HttpError(403, 'Only host can promote players');
    }
    if (room.status !== 'lobby') {
      throw new HttpError(400, 'Can only promote players in lobby');
    }

    const admin = getSupabaseAdmin();

    const { count, error: countError } = await admin
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.id)
      .eq('role', 'player');

    if (countError) throw new HttpError(500, countError.message);
    if ((count ?? 0) >= MAX_PLAYERS) {
      throw new HttpError(403, 'Room is full, cannot promote spectator');
    }

    const { error: updateError } = await admin
      .from('players')
      .update({ role: 'player' })
      .eq('id', targetPlayerId)
      .eq('room_id', room.id);

    if (updateError) throw new HttpError(500, updateError.message);

    return jsonOk<OkRes>({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
