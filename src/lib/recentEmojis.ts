import { EMOJI_RECENTS_MAX } from '@/lib/constants';

const STORAGE_KEY = 'ep:recent-emojis';

export function getRecentEmojis(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is string => typeof e === 'string');
  } catch {
    return [];
  }
}

export function pushRecentEmoji(e: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getRecentEmojis();
    const deduped = [e, ...current.filter((existing) => existing !== e)];
    const capped = deduped.slice(0, EMOJI_RECENTS_MAX);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
  } catch {
    // ignore (private browsing, storage full, etc.)
  }
}
