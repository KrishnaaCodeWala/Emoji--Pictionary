import { jsonOk, jsonError, handleApiError, HttpError } from '@/lib/http';
import { getRoomByCode } from '@/lib/game';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { MAX_CANVAS_DATA_URL_LENGTH, MAX_EMOJI_LENGTH } from '@/lib/constants';
import { isImageContent } from '@/lib/canvasContent';
import { checkRateLimit } from '@/lib/rateLimit';
import type { DrawReq, OkRes } from '@/lib/types';

// Safety cap on the raw string length regardless of codepoint counting, so a
// pathological input (e.g. huge combining-character sequences) can't get far
// before being rejected.
const MAX_EMOJI_RAW_LENGTH = 200;

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
    if (isImageContent(emojis)) {
      // v4: canvas snapshot (data:image/png or data:image/webp). Skip the emoji
      // code-point rule; only the overall data URL length is bounded.
      if (emojis.length > MAX_CANVAS_DATA_URL_LENGTH) {
        throw new HttpError(400, `emojis must be at most ${MAX_CANVAS_DATA_URL_LENGTH} characters`);
      }
    } else {
      if (emojis.length > MAX_EMOJI_RAW_LENGTH) {
        throw new HttpError(400, `emojis must be at most ${MAX_EMOJI_RAW_LENGTH} characters`);
      }
      if (Array.from(emojis).length > MAX_EMOJI_LENGTH) {
        throw new HttpError(400, `emojis must be at most ${MAX_EMOJI_LENGTH} characters`);
      }
    }

    if (!checkRateLimit(`draw:${playerId}`, 5, 1000)) {
      return jsonError(429, 'Too many requests');
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
