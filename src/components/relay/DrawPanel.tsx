'use client';
import { useState } from 'react';
import EmojiCanvas from '@/components/EmojiCanvas';
import EmojiPicker from '@/components/EmojiPicker';
import DrawCanvas from '@/components/canvas/DrawCanvas';
import type { InputMode, StrokeEvent } from '@/lib/types';

export interface DrawPanelProps {
  /** v4: 'canvas' renders DrawCanvas; submit sends the snapshot data URL */
  inputMode?: InputMode;
  playerId?: string;
  round?: number;
  onStroke?: (s: StrokeEvent) => void;
  phrase: string;
  onSubmit: (emojis: string) => void;
  submitted: boolean;
}

export default function DrawPanel({ inputMode, playerId, round, onStroke, phrase, onSubmit, submitted }: DrawPanelProps) {
  const [emojis, setEmojis] = useState('');
  const [snapshot, setSnapshot] = useState('');
  const isCanvas = inputMode === 'canvas';

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
        <EmojiCanvas emojis={isCanvas ? snapshot : emojis} />
        <p className="text-center text-sm text-muted-foreground">Sent! Waiting for others...</p>
      </div>
    );
  }

  if (isCanvas) {
    return (
      <div className="flex w-full flex-col gap-3">
        {phraseCard}
        <DrawCanvas
          value=""
          playerId={playerId ?? ''}
          round={round ?? 0}
          onStroke={onStroke}
          onSnapshot={setSnapshot}
        />
        <button
          type="button"
          disabled={!snapshot}
          onClick={() => onSubmit(snapshot)}
          className="min-h-10 w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          Submit
        </button>
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
