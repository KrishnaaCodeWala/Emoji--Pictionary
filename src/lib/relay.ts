import 'server-only';
// TODO (Track A). Canvas Relay server loop. Signatures are the contract.
import type { AlbumChainRes, RelayTaskRes } from './types';

/** Chain index that `seat` works on at `step`, for `n` players. Never their own chain for 0 < step < n. */
export function assignment(seat: number, step: number, n: number): number {
  return (seat + step) % n;
}

/** Create chains + step-0 rows, set relay_phase='write', relay_step=0, status='playing', timer. */
export async function startRelay(_roomId: string): Promise<void> {
  throw new Error('Not implemented');
}

export async function getTask(_roomId: string, _playerId: string): Promise<RelayTaskRes> {
  throw new Error('Not implemented');
}

/** Upsert the caller's row for the current step, mark submitted, then tryAdvanceStep(roomId, false). */
export async function submitStep(_roomId: string, _playerId: string, _step: number, _content: string): Promise<void> {
  throw new Error('Not implemented');
}

/**
 * Advance when every row for relay_step is submitted, or when `force` and the timer is over.
 * Uses a conditional update on relay_step as a race guard. Returns true if it advanced.
 */
export async function tryAdvanceStep(_roomId: string, _force: boolean): Promise<boolean> {
  throw new Error('Not implemented');
}

/** Current album chain with only the steps revealed so far (never unrevealed steps). */
export async function getAlbum(_roomId: string): Promise<AlbumChainRes> {
  throw new Error('Not implemented');
}

/** Host: reveal next step; wrap to next chain; at the end finish the game and emit chain summaries. */
export async function albumAdvance(_roomId: string): Promise<void> {
  throw new Error('Not implemented');
}
