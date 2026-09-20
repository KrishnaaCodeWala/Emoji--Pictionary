import { jsonOk, handleApiError, HttpError } from '@/lib/http';
import { getRoomByCode } from '@/lib/game';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { MAX_EMOJI_LENGTH } from '@/lib/constants';
import type { DrawReq, OkRes } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<DrawReq>;
    const { roomCode, playerId, emojis } = body;

    if (!roomCode || typeof roomCode !== 'string') {
      throw new HttpError(400, 'roomCode is required');
    }
    if (!playerId || typeof playerId !== 'string') {
      throw new HttpError(400, 'playerId is required');
    }
    if (typeof emojis !== 'string') {
      throw new HttpError(400, 'emojis is required');
    }
    if (emojis.length > MAX_EMOJI_LENGTH) {
      throw new HttpError(400, `emojis must be at most ${MAX_EMOJI_LENGTH} characters`);
    }

    const room = await getRoomByCode(roomCode);

    if (room.status !== 'playing') {
      throw new HttpError(400, 'Room is not currently playing');
    }
    if (playerId !== room.current_drawer_id) {
      throw new HttpError(403, 'Only the current drawer may draw');
    }

    const admin = getSupabaseAdmin();
    const { error } = await admin.from('messages').insert({
      room_id: room.id,
      player_id: playerId,
      content: emojis,
      type: 'emoji_update',
    });
    if (error) throw new HttpError(500, error.message);

    return jsonOk<OkRes>({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
