'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { getNickname, setNickname as storeNickname, setPlayerId } from '@/lib/player';
import { MAX_NICKNAME_LENGTH, ROOM_CODE_LENGTH } from '@/lib/constants';

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [nickname, setNicknameInput] = useState(() => getNickname());
  const [roomCode, setRoomCode] = useState(() => (searchParams.get('join') ?? '').toUpperCase());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<'create' | 'join' | null>(null);

  const trimmedNickname = nickname.trim();
  const disabled = pending !== null || trimmedNickname.length === 0;

  async function handleCreate() {
    setError(null);
    setPending('create');
    try {
      const res = await api.createRoom({ nickname: trimmedNickname });
      storeNickname(trimmedNickname);
      setPlayerId(res.roomCode, res.playerId);
      router.push(`/room/${res.roomCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setPending(null);
    }
  }

  async function handleJoin() {
    setError(null);
    const code = roomCode.trim().toUpperCase();
    if (code.length !== ROOM_CODE_LENGTH) {
      setError(`Room code must be ${ROOM_CODE_LENGTH} characters`);
      return;
    }
    setPending('join');
    try {
      const res = await api.joinRoom({ roomCode: code, nickname: trimmedNickname });
      storeNickname(trimmedNickname);
      setPlayerId(code, res.playerId);
      router.push(`/room/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setPending(null);
    }
  }

  return (
    <main className="gutter mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 py-10">
      <div className="text-center">
        <h1 className="text-3xl font-bold">🎨 Emoji Pictionary</h1>
        <p className="mt-1 text-[var(--muted-foreground)]">Draw with emoji. Guess with friends.</p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="nickname" className="text-sm font-medium">
          Your nickname
        </label>
        <input
          id="nickname"
          type="text"
          value={nickname}
          maxLength={MAX_NICKNAME_LENGTH}
          onChange={(e) => setNicknameInput(e.target.value)}
          placeholder="e.g. Pixel"
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 outline-none focus:border-[var(--primary)]"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleCreate}
        disabled={disabled}
        className="w-full rounded-full bg-[var(--primary)] px-4 py-3 font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)] disabled:opacity-50"
      >
        {pending === 'create' ? 'Creating…' : 'Create room'}
      </button>

      <div className="flex items-center gap-3 text-[var(--muted-foreground)]">
        <div className="h-px flex-1 bg-[var(--border)]" />
        <span className="text-xs uppercase tracking-wide">or join</span>
        <div className="h-px flex-1 bg-[var(--border)]" />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="roomCode" className="text-sm font-medium">
          Room code
        </label>
        <input
          id="roomCode"
          type="text"
          value={roomCode}
          maxLength={ROOM_CODE_LENGTH}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          placeholder="ABCD"
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-center text-lg font-semibold tracking-[0.3em] outline-none focus:border-[var(--primary)]"
        />
      </div>

      <button
        type="button"
        onClick={handleJoin}
        disabled={disabled || roomCode.trim().length !== ROOM_CODE_LENGTH}
        className="w-full rounded-full border border-[var(--primary)] px-4 py-3 font-semibold text-[var(--primary)] transition hover:bg-[var(--primary)]/10 disabled:opacity-50"
      >
        {pending === 'join' ? 'Joining…' : 'Join room'}
      </button>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<main className="gutter flex-1" />}>
      <HomeContent />
    </Suspense>
  );
}
