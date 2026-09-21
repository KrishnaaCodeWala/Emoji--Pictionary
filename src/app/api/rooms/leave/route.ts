// v5 Wave 1 Track A: /api/rooms/leave — self-leave.
// Lobby: deletes the player row and cleans up host if needed.
// Mid-game: sets left_at and keeps score intact; rotation will skip them.
import { jsonOk, jsonError, HttpError, handleApiError } from '@/lib/http';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getRoomByCode } from '@/lib/game';
import type { LeaveReq, OkRes } from '@/lib/types';

export async function POST(req: Request) {
  try {
    let body: unknown;
    try { body = await req.json(); } catch { return jsonError(400, 'Invalid JSON body'); }

    const { roomCode, playerId } = (body ?? {}) as Partial<LeaveReq>;
    if (typeof roomCode !== 'string' || roomCode.trim().length === 0) return jsonError(400, 'roomCode is required');
    if (typeof playerId !== 'string' || playerId.trim().length === 0) return jsonError(400, 'playerId is required');

    const admin = getSupabaseAdmin();
    const room = await getRoomByCode(roomCode.trim().toUpperCase());

    // Confirm player is in the room
    const { data: player, error: playerErr } = await admin
      .from('players')
      .select('id, nickname, turn_order')
      .eq('id', playerId)
      .eq('room_id', room.id)
      .maybeSingle();
    if (playerErr) throw new HttpError(500, playerErr.message);
    if (!player) return jsonError(404, 'Player not found in room');

    if (room.status === 'lobby' || room.status === 'finished') {
      // Hard delete in lobby / after game
      const { error: delErr } = await admin.from('players').delete().eq('id', playerId);
      if (delErr) throw new HttpError(500, delErr.message);

      // If the leaver was host, promote the next player
      if (room.host_player_id === playerId) {
        const { data: remaining } = await admin
          .from('players')
          .select('id')
          .eq('room_id', room.id)
          .order('turn_order', { ascending: true })
          .limit(1);
        const newHost = remaining?.[0] ?? null;
        if (newHost) {
          await admin.from('rooms').update({ host_player_id: newHost.id }).eq('id', room.id);
        }
      }
    } else {
      // Mid-game: soft delete — mark left_at
      const { error: leftErr } = await admin
        .from('players')
        .update({ left_at: new Date().toISOString() })
        .eq('id', playerId);
      if (leftErr) throw new HttpError(500, leftErr.message);

      // Insert a system message so other clients refetch
      await admin.from('messages').insert({
        room_id: room.id,
        player_id: null,
        content: `${(player as { nickname: string }).nickname} left the game`,
        type: 'system',
      });
    }

    return jsonOk<OkRes>({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
