import { jsonOk, jsonError, handleApiError } from '@/lib/http';
import { getRoomByCode } from '@/lib/game';
import { albumAdvance } from '@/lib/relay';
import type { AlbumAdvanceReq, OkRes } from '@/lib/types';

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, 'Invalid JSON body');
    }

    const { roomCode, playerId } = (body ?? {}) as Partial<AlbumAdvanceReq>;
    if (typeof roomCode !== 'string' || roomCode.trim().length === 0) {
      return jsonError(400, 'roomCode is required');
    }
    if (typeof playerId !== 'string' || playerId.trim().length === 0) {
      return jsonError(400, 'playerId is required');
    }

    const room = await getRoomByCode(roomCode.trim().toUpperCase());

    if (playerId !== room.host_player_id) {
      return jsonError(403, 'Only the host can advance the album');
    }

    await albumAdvance(room.id);

    return jsonOk<OkRes>({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
