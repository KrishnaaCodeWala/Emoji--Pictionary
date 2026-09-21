import { jsonOk, jsonError, HttpError, handleApiError } from '@/lib/http';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { SpectateReq, OkRes } from '@/lib/types';
import { getRoomByCode } from '@/lib/game';

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, 'Invalid JSON body');
    }

    const { roomCode, playerId } = (body ?? {}) as Partial<SpectateReq>;

    if (typeof roomCode !== 'string' || roomCode.trim().length === 0) {
      throw new HttpError(400, 'roomCode is required');
    }
    if (typeof playerId !== 'string' || playerId.trim().length === 0) {
      throw new HttpError(400, 'playerId is required');
    }

    const room = await getRoomByCode(roomCode.trim().toUpperCase());
    const admin = getSupabaseAdmin();

    const { data: player, error: playerError } = await admin
      .from('players')
      .select('*')
      .eq('id', playerId)
      .eq('room_id', room.id)
      .maybeSingle();

    if (playerError) throw new HttpError(500, playerError.message);
    if (!player) throw new HttpError(404, 'Player not found in room');
    
    // Only allow becoming spectator if they are a player
    if (player.role !== 'player') {
      return jsonOk<OkRes>({ ok: true });
    }

    // A host cannot become a spectator if they are the host.
    // They would need to leave or wait for host absent migration.
    // Let's just say host can't do it.
    if (room.host_player_id === playerId) {
      throw new HttpError(400, 'Host cannot become a spectator directly');
    }

    const { error: updateError } = await admin
      .from('players')
      .update({ role: 'spectator' })
      .eq('id', playerId);

    if (updateError) throw new HttpError(500, updateError.message);

    return jsonOk<OkRes>({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
