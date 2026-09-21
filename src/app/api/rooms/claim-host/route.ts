// v5 Wave 1 Track A: /api/rooms/claim-host — migrate host when current host is absent.
// Only succeeds if the current host is NOT the caller (prevents double-claim)
// and the caller is a valid player in that room.
import { jsonOk, jsonError, HttpError, handleApiError } from '@/lib/http';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getRoomByCode } from '@/lib/game';
import type { ClaimHostReq, OkRes } from '@/lib/types';

export async function POST(req: Request) {
  try {
    let body: unknown;
    try { body = await req.json(); } catch { return jsonError(400, 'Invalid JSON body'); }

    const { roomCode, playerId } = (body ?? {}) as Partial<ClaimHostReq>;
    if (typeof roomCode !== 'string' || roomCode.trim().length === 0) return jsonError(400, 'roomCode is required');
    if (typeof playerId !== 'string' || playerId.trim().length === 0) return jsonError(400, 'playerId is required');

    const admin = getSupabaseAdmin();
    const room = await getRoomByCode(roomCode.trim().toUpperCase());

    // Guard: caller must be in the room
    const { data: caller, error: callerErr } = await admin
      .from('players')
      .select('id, nickname, turn_order')
      .eq('id', playerId)
      .eq('room_id', room.id)
      .maybeSingle();
    if (callerErr) throw new HttpError(500, callerErr.message);
    if (!caller) return jsonError(403, 'You are not in this room');

    // Guard: caller must not already be host
    if (room.host_player_id === playerId) return jsonError(409, 'You are already the host');

    // Promote
    const { error: updateErr } = await admin
      .from('rooms')
      .update({ host_player_id: playerId })
      .eq('id', room.id);
    if (updateErr) throw new HttpError(500, updateErr.message);

    // Announce
    const { error: msgErr } = await admin.from('messages').insert({
      room_id: room.id,
      player_id: null,
      content: `${(caller as { nickname: string }).nickname} is now the host`,
      type: 'system',
    });
    if (msgErr) throw new HttpError(500, msgErr.message);

    return jsonOk<OkRes>({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
