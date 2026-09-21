// Track B. localStorage helpers. Wrap every access in try/catch; safe during SSR.

function playerKey(roomCode: string): string {
  return `ep:player:${roomCode.toUpperCase()}`;
}

const NICKNAME_KEY = 'ep:nickname';
const AVATAR_KEY = 'ep:avatar';

export function getPlayerId(roomCode: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(playerKey(roomCode));
  } catch {
    return null;
  }
}

export function setPlayerId(roomCode: string, id: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(playerKey(roomCode), id);
  } catch {
    // ignore (localStorage unavailable)
  }
}

export function getNickname(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(NICKNAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setNickname(nickname: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(NICKNAME_KEY, nickname);
  } catch {
    // ignore (localStorage unavailable)
  }
}

/** v5 Wave 1: remembered emoji avatar. */
export function getAvatar(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(AVATAR_KEY);
  } catch {
    return null;
  }
}

export function setAvatar(avatar: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AVATAR_KEY, avatar);
  } catch {
    // ignore
  }
}
