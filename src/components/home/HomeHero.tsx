'use client';
// TODO (Track D)
import type { GameMode } from '@/lib/types';
export interface HomeHeroProps {
  /** called with the mode of the panel that was visible when the user created a room */
  onCreate: (nickname: string, mode: GameMode) => void;
  onJoin: (nickname: string, code: string) => void;
  initialJoinCode?: string;
  pending?: 'create' | 'join' | null;
  error?: string | null;
}
export default function HomeHero(_p: HomeHeroProps) { return null; }
