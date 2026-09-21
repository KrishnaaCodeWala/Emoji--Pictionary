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

// ---- v3: Canvas Relay ----
export const RELAY_TIMERS = { write: 45, draw: 60, guess: 45 } as const;
export const RELAY_TIMER_PRESETS = {
  quick: { write: 30, draw: 40, guess: 30 },
  normal: { write: 45, draw: 60, guess: 45 },
  relaxed: { write: 60, draw: 90, guess: 60 },
} as const;
export const RELAY_MIN_PLAYERS_HINT = 3;
export const RELAY_PHRASE_MAX = 80;
/** shrug emoji, used when a draw step times out */
export const RELAY_DEFAULT_DRAW = '\u{1F937}';
export const RELAY_DEFAULT_GUESS = '...';
export const SYS_RELAY_PREFIX = 'relay:';
export const SYS_CHAIN_PREFIX = 'chain:';

export const CANVAS_W = 480;
export const CANVAS_H = 360;
export const CANVAS_BRUSHES = [4, 10, 22] as const;
export const CANVAS_COLORS = ['#111111', '#e11d48', '#f97316', '#eab308', '#16a34a', '#2563eb', '#7c3aed', '#ffffff'] as const;
export const CANVAS_BG = '#ffffff';
export const MAX_CANVAS_DATA_URL_LENGTH = 200_000;
export const CANVAS_SNAPSHOT_DEBOUNCE_MS = 300;
export const STROKE_BATCH_MAX_POINTS = 64;
export const EMOJI_RECENTS_MAX = 24;
export const HOME_CYCLE_MS = 6000;
export const THEMES = ['studio', 'theatre', 'sketchbook'] as const;
export const THEME_FOR_MODE = { classic: 'studio', charades: 'theatre', relay: 'sketchbook' } as const;

// ---- v5 Wave 1: party polish + reliability ----
/** Duration of the 3-2-1 round intro overlay before the timer starts. */
export const ROUND_INTRO_MS = 3000;
/** ms a host must be absent from Presence before migration triggers. */
export const HOST_ABSENT_MS = 8000;
/** Max streak bonus points added to correct-guess score. */
export const STREAK_BONUS_MAX = 3;
/** Prefix for structured score events broadcast as system messages. */
export const SYS_SCORE_PREFIX = 'score:';
/** 48 curated emojis for the avatar picker. */
export const AVATARS = [
  '😀','😎','🤩','🥳','😜','🤓','😇','🥸',
  '🐶','🐱','🐻','🐼','🦊','🐸','🐧','🦄',
  '🦁','🐯','🐮','🐷','🐙','🦋','🦖','🐲',
  '🍕','🍔','🌮','🍩','🍦','🎂','🍣','🍜',
  '⚽','🏀','🎸','🎮','🎲','🎭','🎨','🎯',
  '🚀','🌈','⚡','🔥','💎','👑','🎉','🌟',
] as const;

// ---- v5 Wave 2: Content ----
export const PACKS = [
  { id: 'everyday', name: 'Everyday Words' },
  { id: 'animals', name: 'Animals & Nature' },
  { id: 'food', name: 'Food & Drink' },
  { id: 'objects', name: 'Objects & Places' },
  { id: 'movies', name: 'Movies (Lite)' },
  { id: 'indian', name: 'Indian Pop Culture' },
  { id: 'party', name: 'Party Words' },
] as const;

