'use client';
// TODO (Track C)
import type { HintKey, Prompt } from '@/lib/types';
export interface ActorPanelProps {
  prompt: Prompt | null;
  canvas: string;
  revealed: HintKey[];
  onDraw: (emojis: string) => void;
  onRevealHint: (hint: HintKey) => void;
}
export default function ActorPanel(_p: ActorPanelProps) { return null; }
