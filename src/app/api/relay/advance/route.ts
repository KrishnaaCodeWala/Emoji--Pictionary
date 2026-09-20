import { jsonOk, jsonError, HttpError, handleApiError } from '@/lib/http';
import { getRoomByCode } from '@/lib/game';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { tryAdvanceStep } from '@/lib/relay';
import type { RelayAdvanceReq, OkRes } from '@/lib/types';

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, 'Invalid JSON body');
    }

    const { roomCode, playerId } = (body ?? {}) as Partial<RelayAdvanceReq>;
    if (typeof roomCode !== 'string' || roomCode.trim().length === 0) {
      return jsonError(400, 'roomCode is required');
    }
    if (typeof playerId !== 'string' || playerId.trim().length === 0) {
      return jsonError(400, 'playerId is required');
    }

    const room = await getRoomByCode(roomCode.trim().toUpperCase());

    const admin = getSupabaseAdmin();
    const { data: player, error: playerError } = await admin
      .from('players')
      .select('id')
      .eq('room_id', room.id)
      .eq('id', playerId)
      .maybeSingle();
    if (playerError) throw new HttpError(500, playerError.message);
    if (!player) return jsonError(403, 'Not a player in this room');

    if (room.status !== 'playing' || !room.relay_phase || room.relay_phase === 'album') {
      return jsonError(400, 'Room is not currently in relay');
    }

    const originalStep = room.relay_step;
    const advanced = await tryAdvanceStep(room.id, true);

    if (advanced) {
      return jsonOk<OkRes>({ ok: true });
    }

    // Idempotency: if someone else already advanced this step, treat as success.
    const latest = await getRoomByCode(roomCode.trim().toUpperCase());
    if (latest.relay_step > originalStep || latest.relay_phase === 'album' || latest.status === 'finished') {
      return jsonOk<OkRes>({ ok: true });
    }

    return jsonError(400, 'Step has not ended yet');
  } catch (err) {
    return handleApiError(err);
  }
}
