'use client';
import { useState } from 'react';
import EmojiCanvas from '@/components/EmojiCanvas';
import EmojiPicker from '@/components/EmojiPicker';

export interface DrawPanelProps {
  /** v4: 'canvas' renders DrawCanvas; submit sends the snapshot data URL */
  inputMode?: import('@/lib/types').InputMode;
  playerId?: string;
  round?: number;
  onStroke?: (s: import('@/lib/types').StrokeEvent) => void;
  phrase: string;
  onSubmit: (emojis: string) => void;
  submitted: boolean;
}

export default function DrawPanel({ phrase, onSubmit, submitted }: DrawPanelProps) {
  const [emojis, setEmojis] = useState('');

  const phraseCard = (
    <div className="w-full rounded-xl border border-border bg-surface-muted p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Draw this:</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{phrase}</p>
    </div>
  );

  if (submitted) {
    return (
      <div className="flex w-full flex-col gap-3">
        {phraseCard}
        <EmojiCanvas emojis={emojis} />
        <p className="text-center text-sm text-muted-foreground">Sent! Waiting for others...</p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {phraseCard}
      <EmojiCanvas emojis={emojis} />
      <EmojiPicker value={emojis} onChange={setEmojis} />
      <button
        type="button"
        disabled={emojis.length === 0}
        onClick={() => onSubmit(emojis)}
        className="min-h-10 w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
      >
        Submit
      </button>
    </div>
  );
}
