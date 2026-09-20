// TODO (Track B). Typed fetch wrappers. Throw Error(body.error) on non-2xx.
import type {
  AdvanceReq, CreateRoomReq, CreateRoomRes, DrawReq, GuessReq, GuessRes,
  JoinRoomReq, JoinRoomRes, OkRes, ResetRoomReq, StartRoomReq, WordRes,
} from './types';

const notImpl = () => Promise.reject(new Error('Not implemented'));

export const api = {
  createRoom: (_b: CreateRoomReq): Promise<CreateRoomRes> => notImpl(),
  joinRoom: (_b: JoinRoomReq): Promise<JoinRoomRes> => notImpl(),
  startRoom: (_b: StartRoomReq): Promise<OkRes> => notImpl(),
  advance: (_b: AdvanceReq): Promise<OkRes> => notImpl(),
  resetRoom: (_b: ResetRoomReq): Promise<OkRes> => notImpl(),
  getWord: (_roomCode: string, _playerId: string): Promise<WordRes> => notImpl(),
  draw: (_b: DrawReq): Promise<OkRes> => notImpl(),
  guess: (_b: GuessReq): Promise<GuessRes> => notImpl(),
};
