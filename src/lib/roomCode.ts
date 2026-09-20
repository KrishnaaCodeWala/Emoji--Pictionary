import { ROOM_CODE_LENGTH } from './constants';

// Exclude ambiguous letters: I (looks like 1/l), O (looks like 0).
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/** 4 uppercase letters, no ambiguous I/O. Caller retries on unique-constraint violation. */
export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    const idx = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
    code += ROOM_CODE_ALPHABET[idx];
  }
  return code;
}
