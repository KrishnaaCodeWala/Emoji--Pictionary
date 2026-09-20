import { NextRequest } from 'next/server';
import { jsonOk, jsonError, HttpError, handleApiError } from '@/lib/http';
import { getRoomByCode } from '@/lib/game';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getAlbum } from '@/lib/relay';
import type { AlbumChainRes } from '@/lib/types';

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

    const admin = getSupabaseAdmin();
    const { data: player, error: playerError } = await admin
      .from('players')
      .select('id')
      .eq('room_id', room.id)
      .eq('id', playerId)
      .maybeSingle();
    if (playerError) throw new HttpError(500, playerError.message);
    if (!player) return jsonError(403, 'Not a player in this room');

    const album = await getAlbum(room.id);

    return jsonOk<AlbumChainRes>(album);
  } catch (err) {
    return handleApiError(err);
  }
}
