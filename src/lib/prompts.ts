import 'server-only';
// TODO (Track A). Prompt selection and public hints for charades.
import type { HintKey, Prompt, PublicHints, RoomRow } from './types';

/** Classic -> word from words.ts, promptId null. Charades -> random prompt of an allowed kind, weighted by popularity, excluding settings.usedPromptIds. */
export async function pickPrompt(_room: RoomRow): Promise<{ answer: string; promptId: string | null }> {
  throw new Error('Not implemented');
}

export async function getPromptById(_id: string): Promise<Prompt | null> {
  throw new Error('Not implemented');
}

/** Hints safe to show guessers given what the actor has revealed. kind is always included. */
export function publicHints(_prompt: Prompt, _revealed: HintKey[]): PublicHints {
  throw new Error('Not implemented');
}
