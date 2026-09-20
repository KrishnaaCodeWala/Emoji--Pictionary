'use client';

import { useState, type FormEvent } from 'react';

export interface GuessInputProps {
  onSubmit: (guess: string) => void;
  disabled?: boolean;
}

export default function GuessInput({ onSubmit, disabled }: GuessInputProps) {
  const [text, setText] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setText('');
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full gap-2">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
        placeholder="Type your guess..."
        className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary disabled:opacity-40"
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
      >
        Send
      </button>
    </form>
  );
}
