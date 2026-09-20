// Fuzzy title matching for charades.
import { FUZZY_MAX_DISTANCE, FUZZY_MIN_TITLE_LENGTH } from './constants';

const LEADING_ARTICLES = /^(the|a|an)\s+/;

/** lowercase, strip diacritics/punctuation, strip leading articles, map '&' to 'and', collapse whitespace. */
export function normalizeTitle(s: string): string {
  let out = s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ') // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
  out = out.replace(LEADING_ARTICLES, '');
  out = out.replace(/\s+/g, ' ').trim();
  return out;
}

/** Damerau-Levenshtein edit distance (optimal string alignment variant). */
export function damerauLevenshtein(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;

  const d: number[][] = Array.from({ length: la + 1 }, () => new Array<number>(lb + 1).fill(0));

  for (let i = 0; i <= la; i++) d[i][0] = i;
  for (let j = 0; j <= lb; j++) d[0][j] = j;

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let val = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost, // substitution
      );
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        val = Math.min(val, d[i - 2][j - 2] + cost); // transposition
      }
      d[i][j] = val;
    }
  }

  return d[la][lb];
}

/**
 * 'exact' if guess matches title or any alias after normalisation;
 * 'close' if within FUZZY_MAX_DISTANCE for titles >= FUZZY_MIN_TITLE_LENGTH;
 * otherwise 'miss'.
 */
export function matchGuess(guess: string, answer: string, aliases: string[]): 'exact' | 'close' | 'miss' {
  const normGuess = normalizeTitle(guess);
  const candidates = [answer, ...aliases].map(normalizeTitle);

  if (candidates.some((c) => c === normGuess)) return 'exact';

  if (normGuess.length >= FUZZY_MIN_TITLE_LENGTH) {
    for (const c of candidates) {
      if (c.length === 0) continue;
      if (damerauLevenshtein(normGuess, c) <= FUZZY_MAX_DISTANCE) return 'close';
    }
  }

  return 'miss';
}
