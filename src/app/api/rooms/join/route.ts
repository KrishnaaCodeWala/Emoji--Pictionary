import { jsonOk, jsonError, HttpError, handleApiError } from '@/lib/http';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { MAX_NICKNAME_LENGTH, MAX_PLAYERS } from '@/lib/constants';
import type { JoinRoomReq, JoinRoomRes } from '@/lib/types';

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, 'Invalid JSON body');
    }

    const { roomCode, nickname, avatar, spectate } = (body ?? {}) as Partial<JoinRoomReq>;

    if (typeof roomCode !== 'string' || roomCode.trim().length === 0) {
      return jsonError(400, 'roomCode is required');
    }
    if (typeof nickname !== 'string' || nickname.trim().length < 1 || nickname.length > MAX_NICKNAME_LENGTH) {
      return jsonError(400, `nickname must be 1-${MAX_NICKNAME_LENGTH} characters`);
    }
    const safeAvatar = typeof avatar === 'string' && avatar.length <= 8 ? avatar : null;

    const admin = getSupabaseAdmin();
    const normalizedCode = roomCode.trim().toUpperCase();

    const { data: room, error: roomError } = await admin
      .from('rooms')
      .select('*')
      .eq('room_code', normalizedCode)
      .maybeSingle();

    if (roomError) throw new HttpError(500, roomError.message);
    if (!room) return jsonError(404, 'Room not found');

    const { count, error: countError } = await admin
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.id);

    if (countError) throw new HttpError(500, countError.message);

    let role = 'player';
    if (spectate || room.status !== 'lobby' || (count ?? 0) >= MAX_PLAYERS) {
      role = 'spectator';
    }

    const { data: player, error: playerError } = await admin
      .from('players')
      .insert({ room_id: room.id, nickname: nickname.trim(), turn_order: count ?? 0, avatar: safeAvatar, role, auth_uid: (body as JoinRoomReq).authUid })
      .select()
      .single();

    if (playerError || !player) {
      throw new HttpError(500, playerError?.message ?? 'Could not join room');
    }

    return jsonOk<JoinRoomRes>({ roomId: room.id as string, playerId: player.id as string });
  } catch (err) {
    return handleApiError(err);
  }
}
