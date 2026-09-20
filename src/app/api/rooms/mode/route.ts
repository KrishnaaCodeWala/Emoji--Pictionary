import { jsonOk, jsonError, HttpError, handleApiError } from '@/lib/http';
import { getRoomByCode } from '@/lib/game';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { ALL_PROMPT_KINDS } from '@/lib/constants';
import type { SetModeReq, OkRes, RoomSettings, PromptKind } from '@/lib/types';

function isValidTimer(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 15 && value <= 180;
}

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, 'Invalid JSON body');
    }

    const { roomCode, playerId, mode, settings } = (body ?? {}) as Partial<SetModeReq>;

    if (typeof roomCode !== 'string' || roomCode.trim().length === 0) {
      throw new HttpError(400, 'roomCode is required');
    }
    if (typeof playerId !== 'string' || playerId.trim().length === 0) {
      throw new HttpError(400, 'playerId is required');
    }
    if (mode !== 'classic' && mode !== 'charades' && mode !== 'relay') {
      throw new HttpError(400, 'Invalid mode');
    }

    let kinds: PromptKind[] | undefined;
    if (settings?.kinds !== undefined) {
      if (
        !Array.isArray(settings.kinds) ||
        settings.kinds.length === 0 ||
        !settings.kinds.every((k) => (ALL_PROMPT_KINDS as readonly string[]).includes(k))
      ) {
        throw new HttpError(400, 'Invalid settings.kinds');
      }
      kinds = settings.kinds;
    }

    let rounds: number | undefined;
    if (settings?.rounds !== undefined) {
      if (
        typeof settings.rounds !== 'number' ||
        !Number.isInteger(settings.rounds) ||
        settings.rounds < 1 ||
        settings.rounds > 5
      ) {
        throw new HttpError(400, 'Invalid settings.rounds');
      }
      rounds = settings.rounds;
    }

    let relayTimers: RoomSettings['relayTimers'] | undefined;
    if (settings?.relayTimers !== undefined) {
      const t = settings.relayTimers;
      if (
        typeof t !== 'object' ||
        t === null ||
        !isValidTimer(t.write) ||
        !isValidTimer(t.draw) ||
        !isValidTimer(t.guess)
      ) {
        throw new HttpError(400, 'Invalid settings.relayTimers');
      }
      relayTimers = { write: t.write, draw: t.draw, guess: t.guess };
    }

    const room = await getRoomByCode(roomCode.trim().toUpperCase());

    if (room.status !== 'lobby') {
      throw new HttpError(400, 'Mode can only be changed in the lobby');
    }
    if (playerId !== room.host_player_id) {
      throw new HttpError(403, 'Only the host can change the mode');
    }

    const nextSettings: RoomSettings = {};
    if (rounds !== undefined) nextSettings.rounds = rounds;
    if (mode === 'charades' && kinds !== undefined) nextSettings.kinds = kinds;
    if (mode === 'relay' && relayTimers !== undefined) nextSettings.relayTimers = relayTimers;

    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from('rooms')
      .update({ mode, settings: nextSettings })
      .eq('id', room.id);
    if (error) throw new HttpError(500, error.message);

    const plural: Record<PromptKind, string> = { movie: 'movies', series: 'series', game: 'games' };
    const kindsLabel =
      mode === 'charades'
        ? ` (${(kinds ?? [...ALL_PROMPT_KINDS]).map((k) => plural[k]).join(', ')})`
        : '';
    const label = mode === 'charades' ? `Charades${kindsLabel}` : mode === 'relay' ? 'Canvas Relay' : 'Classic';

    const { error: msgError } = await admin.from('messages').insert({
      room_id: room.id,
      player_id: null,
      content: `Mode: ${label}`,
      type: 'system',
    });
    if (msgError) throw new HttpError(500, msgError.message);

    return jsonOk<OkRes>({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
