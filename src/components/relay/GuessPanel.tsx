'use client';
import { useState } from 'react';
import EmojiCanvas from '@/components/EmojiCanvas';
import { RELAY_PHRASE_MAX } from '@/lib/constants';

export interface GuessPanelProps {
  canvas: string;
  onSubmit: (guess: string) => void;
  submitted: boolean;
}

export default function GuessPanel({ canvas, onSubmit, submitted }: GuessPanelProps) {
  const [guess, setGuess] = useState('');

  if (submitted) {
    return (
      <div className="flex w-full flex-col gap-3">
        <EmojiCanvas emojis={canvas} />
        <div className="rounded-xl border border-border bg-surface p-4 text-center">
          <p className="text-sm text-muted-foreground">Sent! Waiting for others...</p>
          <p className="mt-1 break-words text-foreground">&ldquo;{guess}&rdquo;</p>
        </div>
      </div>
    );
  }

  const canSubmit = guess.trim().length > 0 && guess.length <= RELAY_PHRASE_MAX;

  return (
    <div className="flex w-full flex-col gap-3">
      <h2 className="text-lg font-semibold text-foreground">What is this?</h2>
      <EmojiCanvas emojis={canvas} />
      <input
        type="text"
        value={guess}
        onChange={(e) => setGuess(e.target.value.slice(0, RELAY_PHRASE_MAX))}
        placeholder="Type your guess"
        maxLength={RELAY_PHRASE_MAX}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => onSubmit(guess.trim())}
        className="min-h-10 w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
      >
        Submit
      </button>
    </div>
  );
}
