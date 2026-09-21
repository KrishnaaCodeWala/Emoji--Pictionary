export type RoomStatus = 'lobby' | 'playing' | 'finished';
export type MessageType = 'guess' | 'emoji_update' | 'system';
export type GameMode = 'classic' | 'charades' | 'relay';
export type RelayPhase = 'write' | 'draw' | 'guess' | 'album';
export type RelayStepKind = 'write' | 'draw' | 'guess';
/** v4: how the drawer draws. Applies to classic, charades and relay draw steps. */
export type InputMode = 'emoji' | 'canvas';
export type ThemeName = 'studio' | 'theatre' | 'sketchbook';
export type PromptKind = 'movie' | 'series' | 'game';
export type HintKey = 'year' | 'genre' | 'wordCount' | 'firstLetters';

export interface RoomSettings {
  /** Rounds per player; default ROUNDS_PER_PLAYER. */
  rounds?: number;
  /** Charades only: allowed prompt kinds; default all three. */
  kinds?: PromptKind[];
  /** Server-managed: prompt ids already used in this room (avoid repeats). */
  usedPromptIds?: string[];
  /** Relay only: seconds per phase. Defaults in constants (RELAY_TIMERS). */
  relayTimers?: { write: number; draw: number; guess: number };
  /** v4: 'emoji' (default) or 'canvas'. */
  input?: InputMode;
  // ---- v5 Wave 2 ----
  packs?: string[];
  customWords?: string[];
  difficulty?: 'easy' | 'normal' | 'hard';
}

/**
 * v4: one batch of freehand drawing, broadcast live over the room channel (event 'stroke').
 * Coordinates are in logical canvas pixels (CANVAS_W x CANVAS_H).
 */
export interface StrokeEvent {
  /** drawer's player id; receivers ignore strokes from anyone but current_drawer_id */
  playerId: string;
  /** round_number (classic/charades) or relay_step; receivers drop strokes from other rounds */
  round: number;
  /** stroke id so batches of the same stroke can be joined */
  id: string;
  tool: 'brush' | 'eraser';
  color: string;
  size: number;
  points: { x: number; y: number }[];
  /** 'fill' events carry a single point and color */
  kind?: 'segment' | 'fill' | 'clear' | 'undo';
}

/** v5: Realtime channel connection state exposed by useRoom. */
export type ConnectionState = 'connected' | 'reconnecting' | 'offline';

/** Row of the `rooms_public` view (no current_word). This is what clients see. */
export interface RoomPublic {
  id: string;
  room_code: string;
  status: RoomStatus;
  host_player_id: string | null;
  current_drawer_id: string | null;
  round_number: number;
  round_end_time: string | null;
  round_started_at: string | null;
  created_at: string;
  mode: GameMode;
  settings: RoomSettings;
  revealed_hints: HintKey[];
  // ---- v3: relay ----
  relay_phase: RelayPhase | null;
  relay_step: number;
  album_chain: number | null;
  album_step: number | null;
  game_no: number;
  // ---- v5 Wave 1 ----
  /** ISO timestamp while the 3-2-1 round intro overlay is shown. Null otherwise. */
  round_intro_until: string | null;
}

// ---- v3: Canvas Relay ----
/** GET /api/relay/task?roomCode=&playerId= : the one thing the caller must do right now. */
export interface RelayTaskRes {
  phase: RelayPhase;
  step: number;
  /** null during album */
  kind: RelayStepKind | null;
  /** previous step of the chain you are working on (null at step 0 / album) */
  input: { kind: RelayStepKind; content: string } | null;
  submitted: boolean;
  endsAt: string | null;
}
export interface RelaySubmitReq { roomCode: string; playerId: string; step: number; content: string }
/** Broadcast as a system message: SYS_RELAY_PREFIX + JSON. */
export interface RelayProgress { step: number; submitted: number; total: number }
export interface RelayAdvanceReq { roomCode: string; playerId: string }

export interface AlbumStep { step: number; kind: RelayStepKind; content: string; authorNickname: string | null }
/** GET /api/relay/album?roomCode=&playerId= : current chain, only steps revealed so far. */
export interface AlbumChainRes {
  chainIndex: number;
  totalChains: number;
  originNickname: string | null;
  steps: AlbumStep[];
  /** index of the last revealed step (steps.length - 1) */
  revealedUpTo: number;
  /** total steps in this chain (= players at start) */
  totalSteps: number;
  finished: boolean;
}
export interface AlbumAdvanceReq { roomCode: string; playerId: string }
/** Per-chain summary for Results, sent as system message SYS_CHAIN_PREFIX + JSON at game end. */
export interface ChainSummary { chainIndex: number; originNickname: string | null; firstPhrase: string; lastGuess: string }

/** Full `rooms` row. Server only. */
export interface RoomRow extends RoomPublic {
  current_word: string | null;
  current_prompt_id: string | null;
}

export interface Prompt {
  id: string;
  kind: PromptKind;
  title: string;
  aliases: string[];
  year: number | null;
  genres: string[];
  poster_url: string | null;
  popularity: number;
}

/** Hints visible to guessers, computed server-side from revealed_hints. */
export interface PublicHints {
  kind: PromptKind;
  /** Round these hints belong to; clients ignore hints from other rounds. */
  roundNumber?: number;
  year?: number;
  genre?: string;
  wordCount?: number;
  firstLetters?: string;
}

/** Public reveal after a round resolves. Sent as a system message: 'reveal:' + JSON. */
export interface RevealPayload {
  title: string;
  year: number | null;
  kind: PromptKind;
  poster_url: string | null;
  guesserNickname: string | null;
  roundNumber: number;
}

export interface Player {
  id: string;
  room_id: string;
  nickname: string;
  score: number;
  turn_order: number;
  joined_at: string;
  // ---- v5 Wave 1 ----
  /** Emoji avatar chosen on the home page. */
  avatar: string | null;
  /** Consecutive correct guesses; resets on a miss or end of turn as drawer. */
  streak: number;
  /** Set when a player leaves mid-game; null while still active. */
  left_at: string | null;
  // ---- v5 Wave 3 ----
  role: 'player' | 'spectator';
  auth_uid: string | null;
}

export interface Message {
  id: string;
  room_id: string;
  player_id: string | null;
  content: string;
  type: MessageType;
  created_at: string;
}

// ---- API contracts (all POST unless noted; JSON in/out) ----
export interface CreateRoomReq { nickname: string; mode?: GameMode; avatar?: string; authUid?: string }
export interface CreateRoomRes { roomCode: string; roomId: string; playerId: string }

export interface JoinRoomReq { roomCode: string; nickname: string; avatar?: string; authUid?: string; spectate?: boolean }
export interface JoinRoomRes { roomId: string; playerId: string }

// ---- v5 Wave 1 ----
export interface ClaimHostReq { roomCode: string; playerId: string }
export interface LeaveReq { roomCode: string; playerId: string }
export interface KickReq { roomCode: string; playerId: string; targetPlayerId: string }
/** Structured system message emitted on correct guess: 'score:' + JSON. */
export interface ScoreEvent { playerId: string; delta: number; reason: 'guess' | 'draw'; streak: number }

export interface StartRoomReq { roomCode: string; playerId: string }
export interface AdvanceReq { roomCode: string; playerId: string; reason?: 'timeout' | 'drawer_left' }
export interface ResetRoomReq { roomCode: string; playerId: string }

/** GET /api/rooms/word?roomCode=&playerId= */
export interface WordRes {
  word: string;
  /** Charades only: full prompt for the actor. */
  prompt?: Prompt;
}

export interface SetModeReq { roomCode: string; playerId: string; mode: GameMode; settings?: RoomSettings }
export interface RevealHintReq { roomCode: string; playerId: string; hint: HintKey }

/** `emojis` is an emoji string, or (canvas input) a `data:image/png;base64,...` snapshot. */
export interface DrawReq { roomCode: string; playerId: string; emojis: string }
export interface GuessReq { roomCode: string; playerId: string; guess: string }
export interface GuessRes {
  correct: boolean;
  /** Near miss (charades). Private to the guesser; nothing is broadcast. */
  close?: boolean;
}

/** Body of every non-2xx response. */
export interface ApiError { error: string }

/** Empty success body for start/advance/reset/draw. */
export interface OkRes { ok: true }

// ---- v5 Wave 3 ----
export interface ReactionEvent {
  gameNo: number;
  chainIndex: number;
  step: number;
  playerId: string;
  emoji: string;
}

export interface SpectateReq { roomCode: string; playerId: string }
export interface PromoteReq { roomCode: string; playerId: string; targetPlayerId: string }
export interface RejoinReq { roomCode: string; nickname: string }
export interface RejoinRes { success: boolean; status: 'approved' | 'pending' | 'rejected' | 'not_found'; playerId?: string; roomCode?: string }
export interface ApproveRejoinReq { roomCode: string; playerId: string; targetNickname: string; approve: boolean }

export interface Profile {
  id: string;
  display_name: string | null;
  avatar: string | null;
  stats: Record<string, unknown>;
  created_at: string;
}

export interface GameResult {
  id: string;
  room_id: string;
  user_id: string;
  mode: GameMode;
  placement: number;
  points: number;
  created_at: string;
}
