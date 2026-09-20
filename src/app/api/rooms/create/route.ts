import { jsonOk, jsonError, HttpError, handleApiError } from '@/lib/http';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { generateRoomCode } from '@/lib/roomCode';
import { MAX_NICKNAME_LENGTH } from '@/lib/constants';
import type { CreateRoomReq, CreateRoomRes } from '@/lib/types';

const MAX_CODE_ATTEMPTS = 10;

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, 'Invalid JSON body');
    }

    const { nickname } = (body ?? {}) as Partial<CreateRoomReq>;
    if (typeof nickname !== 'string' || nickname.trim().length < 1 || nickname.length > MAX_NICKNAME_LENGTH) {
      return jsonError(400, `nickname must be 1-${MAX_NICKNAME_LENGTH} characters`);
    }

    const admin = getSupabaseAdmin();

    let roomId: string | null = null;
    let roomCode: string | null = null;

    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const candidate = generateRoomCode();
      const { data, error } = await admin
        .from('rooms')
        .insert({ room_code: candidate, status: 'lobby', round_number: 0 })
        .select()
        .single();

      if (!error && data) {
        roomId = data.id as string;
        roomCode = candidate;
        break;
      }

      // 23505 = unique_violation; retry with a new code. Any other error is fatal.
      if (error && error.code !== '23505') {
        throw new HttpError(500, error.message);
      }
    }

    if (!roomId || !roomCode) {
      throw new HttpError(500, 'Could not generate a unique room code');
    }

    const { data: player, error: playerError } = await admin
      .from('players')
      .insert({ room_id: roomId, nickname: nickname.trim(), turn_order: 0 })
      .select()
      .single();

    if (playerError || !player) {
      throw new HttpError(500, playerError?.message ?? 'Could not create host player');
    }

    const { error: hostError } = await admin
      .from('rooms')
      .update({ host_player_id: player.id })
      .eq('id', roomId);

    if (hostError) {
      throw new HttpError(500, hostError.message);
    }

    return jsonOk<CreateRoomRes>({ roomCode, roomId, playerId: player.id as string });
  } catch (err) {
    return handleApiError(err);
  }
}
