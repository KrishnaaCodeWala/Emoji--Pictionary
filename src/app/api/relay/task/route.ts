import { NextRequest } from 'next/server';
import { jsonOk, jsonError, handleApiError } from '@/lib/http';
import { getRoomByCode } from '@/lib/game';
import { getTask } from '@/lib/relay';
import type { RelayTaskRes } from '@/lib/types';

export async function GET(req: NextRequest) {
  try {
    const roomCode = req.nextUrl.searchParams.get('roomCode');
    const playerId = req.nextUrl.searchParams.get('playerId');

    if (!roomCode || roomCode.trim().length === 0) {
      return jsonError(400, 'roomCode is required');
    }
    if (!playerId || playerId.trim().length === 0) {
      return jsonError(400, 'playerId is required');
    }

    const room = await getRoomByCode(roomCode.trim().toUpperCase());
    const task = await getTask(room.id, playerId);

    return jsonOk<RelayTaskRes>(task);
  } catch (err) {
    return handleApiError(err);
  }
}
