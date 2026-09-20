import 'server-only';
import type { RoomRow } from './types';

// TODO (Track A). Signatures are the contract; Track C imports these.

/** Full room row (incl. current_word). Throws HttpError(404) if missing. */
export async function getRoomByCode(_code: string): Promise<RoomRow> {
  throw new Error('Not implemented');
}

/** Rotate drawer, pick word, bump round, or finish the game. */
export async function startNextTurn(_roomId: string): Promise<void> {
  throw new Error('Not implemented');
}

/**
 * Award points for a correct guess and advance the turn.
 * Returns false if the race guard rejected (round already advanced / someone else scored).
 */
export async function awardAndAdvance(
  _roomId: string,
  _guesserId: string,
  _roundNumber: number,
  _word: string,
): Promise<boolean> {
  throw new Error('Not implemented');
}
