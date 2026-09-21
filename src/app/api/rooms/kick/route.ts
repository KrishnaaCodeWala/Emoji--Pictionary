// v5 Wave 1 Track A: /api/rooms/kick — host kicks another player.
// Lobby: hard delete. Mid-game: soft delete (left_at). Kicked player's
// client detects the "kicked:" system message and redirects home.
import { jsonOk, jsonError, HttpError, handleApiError } from '@/lib/http';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getRoomByCode } from '@/lib/game';
import type { KickReq, OkRes } from '@/lib/types';

export async function POST(req: Request) {
  try {
    let body: unknown;
    try { body = await req.json(); } catch { return jsonError(400, 'Invalid JSON body'); }

    const { roomCode, playerId, targetPlayerId } = (body ?? {}) as Partial<KickReq>;
    if (typeof roomCode !== 'string' || roomCode.trim().length === 0) return jsonError(400, 'roomCode is required');
    if (typeof playerId !== 'string' || playerId.trim().length === 0) return jsonError(400, 'playerId is required');
    if (typeof targetPlayerId !== 'string' || targetPlayerId.trim().length === 0) return jsonError(400, 'targetPlayerId is required');
    if (playerId === targetPlayerId) return jsonError(400, 'Cannot kick yourself — use leave instead');

    const admin = getSupabaseAdmin();
    const room = await getRoomByCode(roomCode.trim().toUpperCase());

    // Caller must be the host
    if (room.host_player_id !== playerId) return jsonError(403, 'Only the host can kick players');

    // Target must be in the room
    const { data: target, error: targetErr } = await admin
      .from('players')
      .select('id, nickname')
      .eq('id', targetPlayerId)
      .eq('room_id', room.id)
      .maybeSingle();
    if (targetErr) throw new HttpError(500, targetErr.message);
    if (!target) return jsonError(404, 'Target player not found in room');

    if (room.status === 'lobby' || room.status === 'finished') {
      const { error: delErr } = await admin.from('players').delete().eq('id', targetPlayerId);
      if (delErr) throw new HttpError(500, delErr.message);
    } else {
      const { error: leftErr } = await admin
        .from('players')
        .update({ left_at: new Date().toISOString() })
        .eq('id', targetPlayerId);
      if (leftErr) throw new HttpError(500, leftErr.message);
    }

    // Structured kick message so the target's client can detect it
    const { error: msgErr } = await admin.from('messages').insert({
      room_id: room.id,
      player_id: null,
      content: `kicked:${targetPlayerId}`,
      type: 'system',
    });
    if (msgErr) throw new HttpError(500, msgErr.message);

    return jsonOk<OkRes>({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
