// TODO (Track A). Fuzzy title matching for charades.

/** lowercase, strip punctuation and leading articles (the/a/an), collapse whitespace. */
export function normalizeTitle(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function damerauLevenshtein(_a: string, _b: string): number {
  return 0;
}

/**
 * 'exact' if guess matches title or any alias after normalisation;
 * 'close' if within FUZZY_MAX_DISTANCE for titles >= FUZZY_MIN_TITLE_LENGTH;
 * otherwise 'miss'.
 */
export function matchGuess(_guess: string, _answer: string, _aliases: string[]): 'exact' | 'close' | 'miss' {
  return 'miss';
}
