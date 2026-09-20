'use client';
// TODO (Track C)
import type { Message, Player, PublicHints } from '@/lib/types';
export interface GuesserPanelProps {
  canvas: string;
  hints: PublicHints | null;
  messages: Message[];
  players: Player[];
  actorNickname: string | null;
  onGuess: (guess: string) => void;
  /** increments on each near miss; show a brief "Close!" flash */
  closeFlash: number;
}
export default function GuesserPanel(_p: GuesserPanelProps) { return null; }
