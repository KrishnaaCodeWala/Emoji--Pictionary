'use client';
// TODO (Track D)
import type { Player, RoomPublic } from '@/lib/types';
export interface LobbyProps {
  room: RoomPublic; players: Player[]; me: Player | null; isHost: boolean;
  onlineIds: Set<string>; onStart: () => void; starting?: boolean; error?: string | null;
}
export default function Lobby(_p: LobbyProps) { return null; }
