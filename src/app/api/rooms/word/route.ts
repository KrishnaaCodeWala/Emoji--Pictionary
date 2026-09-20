import { NextRequest } from 'next/server';
import { jsonOk, jsonError, handleApiError } from '@/lib/http';
import { getRoomByCode } from '@/lib/game';
import { getPromptById } from '@/lib/prompts';
import type { WordRes } from '@/lib/types';

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

    if (playerId !== room.current_drawer_id) {
      return jsonError(403, 'Only the current drawer can see the word');
    }
    if (!room.current_word) {
      return jsonError(400, 'No active word');
    }

    if (room.mode === 'charades' && room.current_prompt_id) {
      const prompt = await getPromptById(room.current_prompt_id);
      return jsonOk<WordRes>({ word: room.current_word, prompt: prompt ?? undefined });
    }

    return jsonOk<WordRes>({ word: room.current_word });
  } catch (err) {
    return handleApiError(err);
  }
}
