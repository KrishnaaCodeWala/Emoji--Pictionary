import { jsonOk, jsonError, handleApiError } from '@/lib/http';
import { getRoomByCode, startNextTurn } from '@/lib/game';
import { startRelay } from '@/lib/relay';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { MIN_PLAYERS, MAX_PLAYERS } from '@/lib/constants';
import type { StartRoomReq, OkRes } from '@/lib/types';

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, 'Invalid JSON body');
    }

    const { roomCode, playerId } = (body ?? {}) as Partial<StartRoomReq>;
    if (typeof roomCode !== 'string' || roomCode.trim().length === 0) {
      return jsonError(400, 'roomCode is required');
    }
    if (typeof playerId !== 'string' || playerId.trim().length === 0) {
      return jsonError(400, 'playerId is required');
    }

    const room = await getRoomByCode(roomCode.trim().toUpperCase());

    if (playerId !== room.host_player_id) {
      return jsonError(403, 'Only the host can start the game');
    }
    if (room.status !== 'lobby') {
      return jsonError(400, 'Room is not in the lobby');
    }

    const admin = getSupabaseAdmin();
    const { count, error: countError } = await admin
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.id);

    if (countError) return jsonError(500, countError.message);
    if ((count ?? 0) < MIN_PLAYERS) {
      return jsonError(400, `Need at least ${MIN_PLAYERS} players`);
    }
    if ((count ?? 0) > MAX_PLAYERS) {
      return jsonError(400, `Room may have at most ${MAX_PLAYERS} players`);
    }

    if (room.mode === 'relay') {
      await startRelay(room.id);
    } else {
      await startNextTurn(room.id);
    }

    return jsonOk<OkRes>({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
