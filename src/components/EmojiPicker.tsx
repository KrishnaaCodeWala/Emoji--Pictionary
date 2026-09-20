'use client';

import { useEffect, useRef, useState } from 'react';
import { EMOJI_CATEGORIES } from '@/lib/emojis';
import { MAX_EMOJI_LENGTH } from '@/lib/constants';

export interface EmojiPickerProps {
  value: string;
  onChange: (emojis: string) => void;
  disabled?: boolean;
}

export default function EmojiPicker({ value, onChange, disabled }: EmojiPickerProps) {
  const [local, setLocal] = useState(value);
  const [trackedValue, setTrackedValue] = useState(value);
  const [activeCategory, setActiveCategory] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local state in sync if the parent value changes externally (e.g. reset for a new
  // round). Adjusting state during render (instead of an effect) avoids an extra render pass.
  if (value !== trackedValue) {
    setTrackedValue(value);
    setLocal(value);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function emit(next: string) {
    setLocal(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange(next);
    }, 150);
  }

  function addEmoji(emoji: string) {
    if (disabled) return;
    const chars = Array.from(local);
    if (chars.length >= MAX_EMOJI_LENGTH) return;
    emit(local + emoji);
  }

  function backspace() {
    if (disabled) return;
    const chars = Array.from(local);
    chars.pop();
    emit(chars.join(''));
  }

  function clear() {
    if (disabled) return;
    emit('');
  }

  const category = EMOJI_CATEGORIES[activeCategory];

  return (
    <div className="w-full flex flex-col gap-3">
      <div
        className="min-h-14 w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-2xl break-all"
        aria-label="Current drawing preview"
      >
        {local || <span className="text-sm text-white/40">Tap emojis below to draw...</span>}
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button
            key={cat.name}
            type="button"
            disabled={disabled}
            onClick={() => setActiveCategory(i)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm capitalize transition-colors ${
              i === activeCategory
                ? 'bg-indigo-500 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            } disabled:opacity-40`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-6 gap-1 sm:grid-cols-8">
        {category.emojis.map((emoji, i) => (
          <button
            key={`${emoji}-${i}`}
            type="button"
            disabled={disabled}
            onClick={() => addEmoji(emoji)}
            className="flex aspect-square items-center justify-center rounded-lg bg-white/5 text-2xl active:scale-95 hover:bg-white/15 disabled:opacity-40 disabled:active:scale-100"
          >
            {emoji}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={backspace}
          className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium hover:bg-white/20 disabled:opacity-40"
        >
          Backspace
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={clear}
          className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium hover:bg-white/20 disabled:opacity-40"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
