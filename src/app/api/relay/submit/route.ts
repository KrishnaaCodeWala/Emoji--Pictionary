import { jsonOk, jsonError, handleApiError } from '@/lib/http';
import { getRoomByCode } from '@/lib/game';
import { submitStep } from '@/lib/relay';
import type { RelaySubmitReq, OkRes } from '@/lib/types';

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, 'Invalid JSON body');
    }

    const { roomCode, playerId, step, content } = (body ?? {}) as Partial<RelaySubmitReq>;

    if (typeof roomCode !== 'string' || roomCode.trim().length === 0) {
      return jsonError(400, 'roomCode is required');
    }
    if (typeof playerId !== 'string' || playerId.trim().length === 0) {
      return jsonError(400, 'playerId is required');
    }
    if (typeof step !== 'number' || !Number.isInteger(step) || step < 0) {
      return jsonError(400, 'step is required');
    }
    if (typeof content !== 'string') {
      return jsonError(400, 'content is required');
    }

    const room = await getRoomByCode(roomCode.trim().toUpperCase());
    await submitStep(room.id, playerId, step, content);

    return jsonOk<OkRes>({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
