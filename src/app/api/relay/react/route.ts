import { jsonOk, jsonError, HttpError, handleApiError } from '@/lib/http';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { ReactionEvent, OkRes } from '@/lib/types';
import { getRoomByCode } from '@/lib/game';

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, 'Invalid JSON body');
    }

    const { roomCode, gameNo, chainIndex, step, playerId, emoji } = (body ?? {}) as Partial<{ roomCode: string } & ReactionEvent>;

    if (!roomCode || typeof gameNo !== 'number' || typeof chainIndex !== 'number' || typeof step !== 'number' || !playerId || !emoji) {
      throw new HttpError(400, 'Missing required fields');
    }

    const room = await getRoomByCode(roomCode.trim().toUpperCase());
    const admin = getSupabaseAdmin();

    // Upsert reaction. If we were toggling, we could check if it exists and delete it, 
    // but the spec says "toggle reaction". Let's do a select then insert/delete.
    const { data: existing, error: fetchError } = await admin
      .from('reactions')
      .select('id')
      .eq('room_id', room.id)
      .eq('game_no', gameNo)
      .eq('chain_index', chainIndex)
      .eq('step', step)
      .eq('player_id', playerId)
      .eq('emoji', emoji)
      .maybeSingle();

    if (fetchError) throw new HttpError(500, fetchError.message);

    if (existing) {
      // Toggle off
      await admin.from('reactions').delete().eq('id', existing.id);
    } else {
      // Toggle on
      await admin.from('reactions').insert({
        room_id: room.id,
        game_no: gameNo,
        chain_index: chainIndex,
        step,
        player_id: playerId,
        emoji,
      });
    }

    // Broadcast the reaction event so clients can update optimistically.
    const event: ReactionEvent = { gameNo, chainIndex, step, playerId, emoji };
    await admin.from('messages').insert({
      room_id: room.id,
      player_id: null,
      content: `reaction:${JSON.stringify(event)}`,
      type: 'system',
    });

    return jsonOk<OkRes>({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
