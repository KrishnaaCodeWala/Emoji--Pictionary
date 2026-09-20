import 'server-only';
// Prompt selection and public hints for charades.
import { getSupabaseAdmin } from './supabase/admin';
import { HttpError } from './http';
import type { HintKey, Prompt, PublicHints, RoomRow } from './types';
import { ALL_PROMPT_KINDS } from './constants';
import { pickWord } from './words';

const CANDIDATE_POOL_LIMIT = 60;

function rowToPrompt(row: Record<string, unknown>): Prompt {
  return {
    id: row.id as string,
    kind: row.kind as Prompt['kind'],
    title: row.title as string,
    aliases: (row.aliases as string[] | null) ?? [],
    year: (row.year as number | null) ?? null,
    genres: (row.genres as string[] | null) ?? [],
    poster_url: (row.poster_url as string | null) ?? null,
    popularity: (row.popularity as number | null) ?? 0,
  };
}

/** Weighted-random pick from candidates, weight = popularity (minimum weight 1). */
function weightedPick(candidates: Prompt[]): Prompt {
  const weights = candidates.map((c) => Math.max(1, c.popularity));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

async function queryCandidates(kinds: string[], excludeIds: string[]): Promise<Prompt[]> {
  const admin = getSupabaseAdmin();
  let query = admin
    .from('prompts')
    .select('*')
    .in('kind', kinds)
    .order('popularity', { ascending: false })
    .limit(CANDIDATE_POOL_LIMIT);

  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.join(',')})`);
  }

  const { data, error } = await query;
  if (error) throw new HttpError(500, error.message);
  return (data ?? []).map(rowToPrompt);
}

/**
 * Classic -> word from words.ts, promptId null.
 * Charades -> random prompt of an allowed kind, weighted by popularity, excluding
 * settings.usedPromptIds (if that exclusion empties the pool, it is ignored).
 */
export async function pickPrompt(room: RoomRow): Promise<{ answer: string; promptId: string | null }> {
  if (room.mode !== 'charades') {
    return { answer: pickWord(room.current_word), promptId: null };
  }

  const kinds = room.settings?.kinds && room.settings.kinds.length > 0
    ? room.settings.kinds
    : [...ALL_PROMPT_KINDS];
  const usedIds = room.settings?.usedPromptIds ?? [];

  let candidates = await queryCandidates(kinds, usedIds);
  if (candidates.length === 0 && usedIds.length > 0) {
    candidates = await queryCandidates(kinds, []);
  }
  if (candidates.length === 0) {
    throw new HttpError(500, 'No prompts available for selected kinds');
  }

  const chosen = weightedPick(candidates);
  return { answer: chosen.title, promptId: chosen.id };
}

export async function getPromptById(id: string): Promise<Prompt | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from('prompts').select('*').eq('id', id).maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data) return null;
  return rowToPrompt(data);
}

/** Hints safe to show guessers given what the actor has revealed. kind is always included. */
export function publicHints(prompt: Prompt, revealed: HintKey[]): PublicHints {
  const hints: PublicHints = { kind: prompt.kind };

  if (revealed.includes('year') && prompt.year !== null) {
    hints.year = prompt.year;
  }
  if (revealed.includes('genre') && prompt.genres.length > 0) {
    hints.genre = prompt.genres[0];
  }
  if (revealed.includes('wordCount')) {
    hints.wordCount = prompt.title.trim().split(/\s+/).filter(Boolean).length;
  }
  if (revealed.includes('firstLetters')) {
    hints.firstLetters = prompt.title
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join(' ');
  }

  return hints;
}
