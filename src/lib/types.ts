export type RoomStatus = 'lobby' | 'playing' | 'finished';
export type MessageType = 'guess' | 'emoji_update' | 'system';
export type GameMode = 'classic' | 'charades';
export type PromptKind = 'movie' | 'series' | 'game';
export type HintKey = 'year' | 'genre' | 'wordCount' | 'firstLetters';

export interface RoomSettings {
  /** Rounds per player; default ROUNDS_PER_PLAYER. */
  rounds?: number;
  /** Charades only: allowed prompt kinds; default all three. */
  kinds?: PromptKind[];
  /** Server-managed: prompt ids already used in this room (avoid repeats). */
  usedPromptIds?: string[];
}

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
}

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
export interface CreateRoomReq { nickname: string }
export interface CreateRoomRes { roomCode: string; roomId: string; playerId: string }

export interface JoinRoomReq { roomCode: string; nickname: string }
export interface JoinRoomRes { roomId: string; playerId: string }

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
