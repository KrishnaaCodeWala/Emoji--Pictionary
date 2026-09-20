export type RoomStatus = 'lobby' | 'playing' | 'finished';
export type MessageType = 'guess' | 'emoji_update' | 'system';

/** Row of the `rooms_public` view (no current_word). This is what clients see. */
export interface RoomPublic {
  id: string;
  room_code: string;
  status: RoomStatus;
  host_player_id: string | null;
  current_drawer_id: string | null;
  round_number: number;
  round_end_time: string | null;
  created_at: string;
}

/** Full `rooms` row. Server only. */
export interface RoomRow extends RoomPublic {
  current_word: string | null;
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
export interface WordRes { word: string }

export interface DrawReq { roomCode: string; playerId: string; emojis: string }
export interface GuessReq { roomCode: string; playerId: string; guess: string }
export interface GuessRes { correct: boolean }

/** Body of every non-2xx response. */
export interface ApiError { error: string }

/** Empty success body for start/advance/reset/draw. */
export interface OkRes { ok: true }
