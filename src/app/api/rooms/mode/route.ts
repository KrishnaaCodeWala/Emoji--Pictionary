import { jsonOk, jsonError, HttpError, handleApiError } from '@/lib/http';
import { getRoomByCode } from '@/lib/game';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { ALL_PROMPT_KINDS } from '@/lib/constants';
import type { InputMode, SetModeReq, OkRes, RoomSettings, PromptKind } from '@/lib/types';

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

    let input: InputMode | undefined;
    if (settings?.input !== undefined) {
      if (settings.input !== 'emoji' && settings.input !== 'canvas') {
        throw new HttpError(400, 'Invalid settings.input');
      }
      input = settings.input;
    }

    let packs: string[] | undefined;
    if (settings?.packs !== undefined) {
      if (!Array.isArray(settings.packs) || !settings.packs.every((p) => typeof p === 'string')) {
        throw new HttpError(400, 'Invalid settings.packs');
      }
      packs = settings.packs;
    }

    let customWords: string[] | undefined;
    if (settings?.customWords !== undefined) {
      if (!Array.isArray(settings.customWords) || !settings.customWords.every((w) => typeof w === 'string')) {
        throw new HttpError(400, 'Invalid settings.customWords');
      }
      const words = Array.from(new Set(settings.customWords.map((w) => w.trim()).filter((w) => w.length > 0 && w.length <= 40)));
      if (words.length > 0 && words.length < 3) {
        throw new HttpError(400, 'Minimum 3 custom words required (or 0 to disable)');
      }
      if (words.length > 60) {
        throw new HttpError(400, 'Maximum 60 custom words allowed');
      }
      customWords = words;
    }

    let difficulty: RoomSettings['difficulty'];
    if (settings?.difficulty !== undefined) {
      if (settings.difficulty !== 'easy' && settings.difficulty !== 'normal' && settings.difficulty !== 'hard') {
        throw new HttpError(400, 'Invalid settings.difficulty');
      }
      difficulty = settings.difficulty;
    }

    const room = await getRoomByCode(roomCode.trim().toUpperCase());

    if (room.status !== 'lobby') {
      throw new HttpError(400, 'Mode can only be changed in the lobby');
    }
    if (playerId !== room.host_player_id) {
      throw new HttpError(403, 'Only the host can change the mode');
    }

    // v4: `input` is preserved across mode switches; the request may omit it, in which
    // case the room's existing value carries over (undefined if never set, i.e. default).
    const preservedInput = input ?? room.settings?.input;

    const nextSettings: RoomSettings = {};
    if (rounds !== undefined) nextSettings.rounds = rounds;
    if (mode === 'charades' && kinds !== undefined) nextSettings.kinds = kinds;
    if (mode === 'charades' && difficulty !== undefined) nextSettings.difficulty = difficulty;
    if (mode === 'relay' && relayTimers !== undefined) nextSettings.relayTimers = relayTimers;
    if (mode === 'classic' && packs !== undefined) nextSettings.packs = packs;
    if (mode === 'classic' && customWords !== undefined) nextSettings.customWords = customWords;
    if (preservedInput !== undefined) nextSettings.input = preservedInput;

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
