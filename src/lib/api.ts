// Track B. Typed fetch wrappers. Throw Error(body.error) on non-2xx.
import type {
  AdvanceReq, ApiError, CreateRoomReq, CreateRoomRes, DrawReq, GuessReq, GuessRes,
  JoinRoomReq, JoinRoomRes, OkRes, ResetRoomReq, StartRoomReq, WordRes,
  RevealHintReq, SetModeReq,
  AlbumAdvanceReq, AlbumChainRes, RelayAdvanceReq, RelaySubmitReq, RelayTaskRes,
} from './types';

async function parseJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function postJson<TRes>(url: string, body: unknown): Promise<TRes> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    const message = (data as ApiError | null)?.error ?? 'Request failed';
    throw new Error(message);
  }
  return data as TRes;
}

async function getJson<TRes>(url: string): Promise<TRes> {
  const res = await fetch(url, { method: 'GET' });
  const data = await parseJson(res);
  if (!res.ok) {
    const message = (data as ApiError | null)?.error ?? 'Request failed';
    throw new Error(message);
  }
  return data as TRes;
}

export const api = {
  // v3 relay
  relayTask: (roomCode: string, playerId: string): Promise<RelayTaskRes> =>
    getJson<RelayTaskRes>(
      `/api/relay/task?roomCode=${encodeURIComponent(roomCode)}&playerId=${encodeURIComponent(playerId)}`,
    ),
  relaySubmit: (b: RelaySubmitReq): Promise<OkRes> =>
    postJson<OkRes>('/api/relay/submit', b),
  relayAdvance: (b: RelayAdvanceReq): Promise<OkRes> =>
    postJson<OkRes>('/api/relay/advance', b),
  relayAlbum: (roomCode: string, playerId: string): Promise<AlbumChainRes> =>
    getJson<AlbumChainRes>(
      `/api/relay/album?roomCode=${encodeURIComponent(roomCode)}&playerId=${encodeURIComponent(playerId)}`,
    ),
  albumAdvance: (b: AlbumAdvanceReq): Promise<OkRes> =>
    postJson<OkRes>('/api/relay/album-advance', b),
  setMode: (b: SetModeReq): Promise<OkRes> =>
    postJson<OkRes>('/api/rooms/mode', b),
  revealHint: (b: RevealHintReq): Promise<OkRes> =>
    postJson<OkRes>('/api/rooms/hint', b),
  createRoom: (b: CreateRoomReq): Promise<CreateRoomRes> =>
    postJson<CreateRoomRes>('/api/rooms/create', b),
  joinRoom: (b: JoinRoomReq): Promise<JoinRoomRes> =>
    postJson<JoinRoomRes>('/api/rooms/join', b),
  startRoom: (b: StartRoomReq): Promise<OkRes> =>
    postJson<OkRes>('/api/rooms/start', b),
  advance: (b: AdvanceReq): Promise<OkRes> =>
    postJson<OkRes>('/api/rooms/advance', b),
  resetRoom: (b: ResetRoomReq): Promise<OkRes> =>
    postJson<OkRes>('/api/rooms/reset', b),
  getWord: (roomCode: string, playerId: string): Promise<WordRes> =>
    getJson<WordRes>(
      `/api/rooms/word?roomCode=${encodeURIComponent(roomCode)}&playerId=${encodeURIComponent(playerId)}`,
    ),
  draw: (b: DrawReq): Promise<OkRes> =>
    postJson<OkRes>('/api/draw', b),
  guess: (b: GuessReq): Promise<GuessRes> =>
    postJson<GuessRes>('/api/guess', b),
};
