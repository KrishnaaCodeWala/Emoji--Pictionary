import { jsonOk, jsonError, HttpError, handleApiError } from '@/lib/http';
import { getRoomByCode } from '@/lib/game';
import { getPromptById, publicHints } from '@/lib/prompts';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { HINT_KEYS, SYS_HINTS_PREFIX } from '@/lib/constants';
import type { RevealHintReq, OkRes, HintKey } from '@/lib/types';

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, 'Invalid JSON body');
    }

    const { roomCode, playerId, hint } = (body ?? {}) as Partial<RevealHintReq>;

    if (typeof roomCode !== 'string' || roomCode.trim().length === 0) {
      throw new HttpError(400, 'roomCode is required');
    }
    if (typeof playerId !== 'string' || playerId.trim().length === 0) {
      throw new HttpError(400, 'playerId is required');
    }
    if (typeof hint !== 'string' || !(HINT_KEYS as readonly string[]).includes(hint)) {
      throw new HttpError(400, 'Invalid hint');
    }

    const room = await getRoomByCode(roomCode.trim().toUpperCase());

    if (room.status !== 'playing' || room.mode !== 'charades') {
      throw new HttpError(400, 'Hints are only available during a charades round');
    }
    if (playerId !== room.current_drawer_id) {
      throw new HttpError(403, 'Only the current actor can reveal hints');
    }
    if (!room.current_prompt_id) {
      throw new HttpError(400, 'No active prompt');
    }

    const revealed = room.revealed_hints ?? [];
    if (revealed.includes(hint as HintKey)) {
      return jsonOk<OkRes>({ ok: true });
    }

    const prompt = await getPromptById(room.current_prompt_id);
    if (!prompt) throw new HttpError(500, 'Prompt not found');

    const newRevealed = [...revealed, hint as HintKey];

    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from('rooms')
      .update({ revealed_hints: newRevealed })
      .eq('id', room.id);
    if (error) throw new HttpError(500, error.message);

    const hints = { ...publicHints(prompt, newRevealed), roundNumber: room.round_number };
    const { error: msgError } = await admin.from('messages').insert({
      room_id: room.id,
      player_id: null,
      content: SYS_HINTS_PREFIX + JSON.stringify(hints),
      type: 'system',
    });
    if (msgError) throw new HttpError(500, msgError.message);

    return jsonOk<OkRes>({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
