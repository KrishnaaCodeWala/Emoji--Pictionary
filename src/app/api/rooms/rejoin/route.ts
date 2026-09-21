import { jsonOk, jsonError, HttpError, handleApiError } from '@/lib/http';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { RejoinReq, RejoinRes } from '@/lib/types';
import { getRoomByCode } from '@/lib/game';

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, 'Invalid JSON body');
    }

    const { roomCode, nickname } = (body ?? {}) as Partial<RejoinReq>;

    if (typeof roomCode !== 'string' || roomCode.trim().length === 0) {
      throw new HttpError(400, 'roomCode is required');
    }
    if (typeof nickname !== 'string' || nickname.trim().length === 0) {
      throw new HttpError(400, 'nickname is required');
    }

    const room = await getRoomByCode(roomCode.trim().toUpperCase());
    const admin = getSupabaseAdmin();

    const { data: player, error: playerError } = await admin
      .from('players')
      .select('*')
      .eq('room_id', room.id)
      .ilike('nickname', nickname.trim())
      .maybeSingle();

    if (playerError) throw new HttpError(500, playerError.message);
    if (!player) {
      return jsonOk<RejoinRes>({ success: false, status: 'not_found' });
    }

    // Auto-approve: just give them their ID back and clear left_at if they were soft-deleted.
    // If we wanted host approval, we would broadcast a request and return 'pending', but
    // for seamless recovery we auto-approve.
    if (player.left_at) {
      await admin.from('players').update({ left_at: null }).eq('id', player.id);
    }

    return jsonOk<RejoinRes>({ success: true, status: 'approved', playerId: player.id, roomCode: room.room_code });
  } catch (err) {
    return handleApiError(err);
  }
}
