'use client';
// TODO (Track B)
import type { AlbumChainRes, Player, RelayProgress, RelayTaskRes, RoomPublic } from '@/lib/types';

export interface UseRelayResult {
  task: RelayTaskRes | null;
  progress: RelayProgress | null;
  album: AlbumChainRes | null;
  loading: boolean;
  error: string | null;
  submit: (content: string) => Promise<void>;
  albumAdvance: () => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Relay-mode client state. `messages` is the room's message stream (from useRoom) so this
 * hook can parse 'relay:' progress without a second subscription.
 */
export function useRelay(
  _roomCode: string,
  _room: RoomPublic | null,
  _me: Player | null,
  _messages: { type: string; content: string }[],
): UseRelayResult {
  return {
    task: null, progress: null, album: null, loading: true, error: null,
    submit: async () => {}, albumAdvance: async () => {}, refetch: async () => {},
  };
}
