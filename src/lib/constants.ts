export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 5;
export const ROUNDS_PER_PLAYER = 2;
export const ROUND_SECONDS = 60;
export const POINTS_GUESSER = 10;
export const POINTS_DRAWER = 5;
export const MAX_EMOJI_LENGTH = 40;
export const MAX_NICKNAME_LENGTH = 16;
export const ROOM_CODE_LENGTH = 4;
/** ms after the timer hits 0 before a non-drawer client may call /api/rooms/advance */
export const ADVANCE_GRACE_MS = 3000;
/** ms a drawer may be absent from Presence before the turn is skipped */
export const DRAWER_ABSENT_MS = 5000;
/** fallback poll interval for rooms_public while a game is not finished */
export const ROOM_POLL_MS = 5000;
