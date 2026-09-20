'use client';
// TODO (Track D)
import type { Message, Player, RoomPublic } from '@/lib/types';
export interface GameProps {
  room: RoomPublic; players: Player[]; me: Player | null; isDrawer: boolean;
  canvas: string; messages: Message[];
  /** Secret word; only provided when isDrawer. */
  word: string | null;
  onDraw: (emojis: string) => void;
  onGuess: (guess: string) => void;
  onExpire: () => void;
}
export default function Game(_p: GameProps) { return null; }
