'use client';
// TODO (Track B). Read-only canvas: draws `value` snapshot and replays live strokes.
import type { StrokeEvent } from '@/lib/types';
export interface CanvasViewProps { value: string; strokes: StrokeEvent[]; className?: string }
export default function CanvasView(_p: CanvasViewProps) { return null; }
