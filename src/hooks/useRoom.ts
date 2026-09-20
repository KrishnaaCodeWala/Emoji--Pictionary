'use client';
// TODO (Track B)
import type { Message, Player, RoomPublic } from '@/lib/types';

export interface UseRoomResult {
  room: RoomPublic | null;
  players: Player[];
  messages: Message[];
  /** Latest emoji_update content for the current round (empty string if none). */
  canvas: string;
  me: Player | null;
  isHost: boolean;
  isDrawer: boolean;
  onlineIds: Set<string>;
  loading: boolean;
  error: string | null;
  refetchRoom: () => Promise<void>;
}

export function useRoom(_roomCode: string): UseRoomResult {
  return {
    room: null, players: [], messages: [], canvas: '', me: null,
    isHost: false, isDrawer: false, onlineIds: new Set(),
    loading: true, error: null, refetchRoom: async () => {},
  };
}
