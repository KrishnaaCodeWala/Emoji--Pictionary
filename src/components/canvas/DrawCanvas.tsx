'use client';
// TODO (Track B)
import type { StrokeEvent } from '@/lib/types';
export interface DrawCanvasProps {
  /** snapshot data URL to restore from (e.g. after reload); '' = blank */
  value: string;
  /** identity used in broadcast events */
  playerId: string;
  round: number;
  onStroke?: (s: StrokeEvent) => void;
  /** called with a PNG data URL on pointer-up (debounced), fill, undo and clear */
  onSnapshot: (dataUrl: string) => void;
  disabled?: boolean;
  className?: string;
}
export default function DrawCanvas(_p: DrawCanvasProps) { return null; }
