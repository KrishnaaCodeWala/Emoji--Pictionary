'use client';
import { useState } from 'react';
import { RELAY_PHRASE_MAX } from '@/lib/constants';

export interface WritePanelProps {
  onSubmit: (phrase: string) => void;
  submitted: boolean;
  onInspire?: () => string;
}

export default function WritePanel({ onSubmit, submitted, onInspire }: WritePanelProps) {
  const [phrase, setPhrase] = useState('');

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface p-6 text-center">
        <p className="text-lg font-semibold text-foreground">Sent! Waiting for others...</p>
        <p className="max-w-sm break-words text-muted-foreground">&ldquo;{phrase}&rdquo;</p>
      </div>
    );
  }

  const remaining = RELAY_PHRASE_MAX - phrase.length;
  const canSubmit = phrase.trim().length > 0 && phrase.length <= RELAY_PHRASE_MAX;

  function handleInspire() {
    const suggestion = onInspire?.();
    if (suggestion) setPhrase(suggestion.slice(0, RELAY_PHRASE_MAX));
  }

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(phrase.trim());
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <h2 className="text-lg font-semibold text-foreground">Write a phrase for someone to draw</h2>
      <textarea
        value={phrase}
        onChange={(e) => setPhrase(e.target.value.slice(0, RELAY_PHRASE_MAX))}
        placeholder="a cat stealing pizza on the moon"
        rows={3}
        maxLength={RELAY_PHRASE_MAX}
        className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{remaining} characters left</span>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleInspire}
          className="min-h-10 flex-1 rounded-lg bg-surface-muted px-3 py-2 text-sm font-medium text-foreground hover:bg-border"
        >
          Inspire me
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="min-h-10 flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          Submit
        </button>
      </div>
    </div>
  );
}
