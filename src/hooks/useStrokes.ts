'use client';
// TODO (Track B). Broadcast strokes over the room channel; buffer received strokes per round.
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { StrokeEvent } from '@/lib/types';

export interface UseStrokesResult {
  /** strokes received this round (receivers) */
  strokes: StrokeEvent[];
  /** send a stroke (drawer) */
  send: (s: StrokeEvent) => void;
}

export function useStrokes(
  _channel: RealtimeChannel | null,
  _roundKey: string | number,
  _acceptFrom: string | null,
): UseStrokesResult {
  return { strokes: [], send: () => {} };
}
