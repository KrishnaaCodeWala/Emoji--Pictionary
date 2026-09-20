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

// ---- v2: charades ----
export const HINT_COST = 2;
export const MIN_GUESSER_POINTS = 4;
export const SPEED_BONUS_POINTS = 2;
export const SPEED_BONUS_WINDOW_S = 20;
export const REVEAL_DURATION_MS = 4000;
export const FUZZY_MIN_TITLE_LENGTH = 6;
export const FUZZY_MAX_DISTANCE = 2;
export const ALL_PROMPT_KINDS = ['movie', 'series', 'game'] as const;
export const HINT_KEYS = ['year', 'genre', 'wordCount', 'firstLetters'] as const;
/** Prefixes for structured system messages. Client parses these. */
export const SYS_HINTS_PREFIX = 'hints:';
export const SYS_REVEAL_PREFIX = 'reveal:';
