import { EMOJI_GROUPS } from '@/lib/emojis.generated';

export interface EmojiCategory {
  name: string;
  emojis: string[];
}

// Derived from the generated full Unicode set (see scripts/gen-emojis.ts) so existing
// imports of EMOJI_CATEGORIES keep working unchanged.
export const EMOJI_CATEGORIES: EmojiCategory[] = EMOJI_GROUPS.map((group) => ({
  name: group.name,
  emojis: group.emojis.map((entry) => entry.e),
}));

export const ALL_EMOJIS: string[] = EMOJI_GROUPS.flatMap((group) =>
  group.emojis.map((entry) => entry.e)
);

interface SearchEntry {
  emoji: string;
  lowerName: string;
  words: string[];
}

let searchIndex: SearchEntry[] | null = null;

function getSearchIndex(): SearchEntry[] {
  if (searchIndex) return searchIndex;
  searchIndex = EMOJI_GROUPS.flatMap((group) =>
    group.emojis.map((entry) => {
      const lowerName = entry.n.toLowerCase();
      return {
        emoji: entry.e,
        lowerName,
        words: lowerName.split(/\s+/),
      };
    })
  );
  return searchIndex;
}

/**
 * Search emoji names for a query, ranking word-prefix matches (e.g. "cat" matching the
 * word "cat" in "cat face") ahead of plain substring matches, and returning up to `limit`
 * results. Returns an empty array for an empty/whitespace query.
 */
export function searchEmojis(query: string, limit = 60): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const index = getSearchIndex();
  const wordPrefixMatches: string[] = [];
  const substringMatches: string[] = [];

  for (const entry of index) {
    if (entry.words.some((w) => w.startsWith(q))) {
      wordPrefixMatches.push(entry.emoji);
    } else if (entry.lowerName.includes(q)) {
      substringMatches.push(entry.emoji);
    }
    if (wordPrefixMatches.length >= limit) break;
  }

  const results = wordPrefixMatches.concat(substringMatches);
  return results.slice(0, limit);
}
