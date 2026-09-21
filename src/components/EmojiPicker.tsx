'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { EMOJI_CATEGORIES, searchEmojis } from '@/lib/emojis';
import { getRecentEmojis, pushRecentEmoji } from '@/lib/recentEmojis';
import { MAX_EMOJI_LENGTH } from '@/lib/constants';

export interface EmojiPickerProps {
  value: string;
  onChange: (emojis: string) => void;
  disabled?: boolean;
}

interface EmojiCellProps {
  emoji: string;
  disabled?: boolean;
  onPick: (emoji: string) => void;
}

const EmojiCell = memo(function EmojiCell({ emoji, disabled, onPick }: EmojiCellProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(emoji)}
      className="flex aspect-square min-h-10 min-w-10 items-center justify-center rounded-lg bg-surface border border-border text-2xl active:scale-95 hover:bg-surface-muted disabled:opacity-40 disabled:active:scale-100"
    >
      {emoji}
    </button>
  );
});

export default function EmojiPicker({ value, onChange, disabled }: EmojiPickerProps) {
  const [local, setLocal] = useState(value);
  const [trackedValue, setTrackedValue] = useState(value);
  // Keyed by name so inserting the Recent tab never shifts the active category.
  const [activeCategory, setActiveCategory] = useState<string>(EMOJI_CATEGORIES[0]?.name ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // SSR-safe lazy initializer: getRecentEmojis() itself guards `typeof window`, so this
  // reads [] on the server and the real list on the client without a synchronous setState
  // inside an effect body.
  const [recents, setRecents] = useState<string[]>(() => getRecentEmojis());

  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local state in sync if the parent value changes externally (e.g. reset for a new
  // round). Adjusting state during render (instead of an effect) avoids an extra render pass.
  if (value !== trackedValue) {
    setTrackedValue(value);
    setLocal(value);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
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
    pushRecentEmoji(emoji);
    setRecents(getRecentEmojis());
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

  function handleSearchChange(next: string) {
    setSearchInput(next);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setQuery(next);
    }, 100);
  }

  const searchResults = useMemo(
    () => (query.trim() ? searchEmojis(query, 60) : []),
    [query]
  );
  const isSearching = query.trim().length > 0;

  const tabs = useMemo(() => {
    const base = EMOJI_CATEGORIES;
    if (recents.length > 0) {
      return [{ name: 'Recent', emojis: recents }, ...base];
    }
    return base;
  }, [recents]);

  const activeTabIndex = Math.max(0, tabs.findIndex((t) => t.name === activeCategory));
  const clampedActiveCategory = activeTabIndex;
  const category = tabs[clampedActiveCategory];
  const gridEmojis = isSearching ? searchResults : (category?.emojis ?? []);

  return (
    <div className="w-full flex flex-col gap-3">
      <div
        className="min-h-14 w-full rounded-lg border border-border bg-surface px-3 py-2 text-2xl break-all"
        aria-label="Current drawing preview"
      >
        {local || <span className="text-sm text-muted-foreground">Tap emojis below to draw...</span>}
      </div>

      <input
        type="text"
        value={searchInput}
        disabled={disabled}
        onChange={(e) => handleSearchChange(e.target.value)}
        placeholder="Search emojis..."
        aria-label="Search emojis"
        className="min-h-10 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted-foreground disabled:opacity-40"
      />

      {!isSearching && (
        <div className="flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Emoji categories">
          {tabs.map((cat, i) => (
            <button
              key={cat.name}
              type="button"
              role="tab"
              aria-selected={i === clampedActiveCategory}
              disabled={disabled}
              onClick={() => setActiveCategory(cat.name)}
              className={`min-h-10 shrink-0 rounded-full px-3 py-2 text-sm capitalize transition-colors ${
                i === clampedActiveCategory
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-surface-muted text-muted-foreground hover:bg-border'
              } disabled:opacity-40`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid max-h-56 grid-cols-6 gap-1.5 overflow-y-auto sm:max-h-64 sm:grid-cols-8">
        {gridEmojis.length === 0 && isSearching ? (
          <div className="col-span-full py-4 text-center text-sm text-muted-foreground">
            No emojis found.
          </div>
        ) : (
          gridEmojis.map((emoji, i) => (
            <EmojiCell key={`${emoji}-${i}`} emoji={emoji} disabled={disabled} onPick={addEmoji} />
          ))
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={backspace}
          className="min-h-10 flex-1 rounded-lg bg-surface-muted px-3 py-2 text-sm font-medium hover:bg-border disabled:opacity-40"
        >
          Backspace
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={clear}
          className="min-h-10 flex-1 rounded-lg bg-surface-muted px-3 py-2 text-sm font-medium hover:bg-border disabled:opacity-40"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
