import { jsonOk, jsonError, HttpError, handleApiError } from '@/lib/http';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { generateRoomCode } from '@/lib/roomCode';
import { ALL_PROMPT_KINDS, MAX_NICKNAME_LENGTH, RELAY_TIMER_PRESETS, ROUNDS_PER_PLAYER } from '@/lib/constants';
import type { CreateRoomReq, CreateRoomRes, GameMode, RoomSettings } from '@/lib/types';

const MAX_CODE_ATTEMPTS = 10;

/** Default settings for a freshly created room in the given mode, mirroring /api/rooms/mode. */
function defaultSettingsForMode(mode: GameMode): RoomSettings {
  if (mode === 'charades') {
    return { kinds: [...ALL_PROMPT_KINDS], rounds: ROUNDS_PER_PLAYER };
  }
  if (mode === 'relay') {
    return { relayTimers: RELAY_TIMER_PRESETS.normal };
  }
  return {};
}

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, 'Invalid JSON body');
    }

    const { nickname, mode: requestedMode, avatar, authUid } = (body ?? {}) as Partial<CreateRoomReq>;
    if (typeof nickname !== 'string' || nickname.trim().length < 1 || nickname.length > MAX_NICKNAME_LENGTH) {
      return jsonError(400, `nickname must be 1-${MAX_NICKNAME_LENGTH} characters`);
    }
    // avatar is optional; validate it's a single emoji or skip
    const safeAvatar = typeof avatar === 'string' && avatar.length <= 8 ? avatar : null;

    let mode: GameMode = 'classic';
    if (requestedMode !== undefined) {
      if (requestedMode !== 'classic' && requestedMode !== 'charades' && requestedMode !== 'relay') {
        return jsonError(400, 'Invalid mode');
      }
      mode = requestedMode;
    }
    const settings = defaultSettingsForMode(mode);

    const admin = getSupabaseAdmin();

    let roomId: string | null = null;
    let roomCode: string | null = null;

    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const candidate = generateRoomCode();
      const { data, error } = await admin
        .from('rooms')
        .insert({ room_code: candidate, status: 'lobby', round_number: 0, mode, settings })
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
      .insert({ room_id: roomId, nickname: nickname.trim(), turn_order: 0, avatar: safeAvatar, auth_uid: authUid })
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
