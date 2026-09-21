'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { setNickname as storeNickname, setPlayerId } from '@/lib/player';
import { ROOM_CODE_LENGTH } from '@/lib/constants';
import type { GameMode } from '@/lib/types';
import HomeHero from '@/components/home/HomeHero';

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<'create' | 'join' | null>(null);
  const initialJoinCode = (searchParams.get('join') ?? '').toUpperCase();

  async function handleCreate(nickname: string, mode: GameMode) {
    setError(null);
    setPending('create');
    try {
      const res = await api.createRoom({ nickname, mode });
      storeNickname(nickname);
      setPlayerId(res.roomCode, res.playerId);
      router.push(`/room/${res.roomCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setPending(null);
    }
  }

  async function handleJoin(nickname: string, code: string) {
    setError(null);
    if (code.length !== ROOM_CODE_LENGTH) {
      setError(`Room code must be ${ROOM_CODE_LENGTH} characters`);
      return;
    }
    setPending('join');
    try {
      const res = await api.joinRoom({ roomCode: code, nickname });
      storeNickname(nickname);
      setPlayerId(code, res.playerId);
      router.push(`/room/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setPending(null);
    }
  }

  return (
    <HomeHero
      onCreate={handleCreate}
      onJoin={handleJoin}
      initialJoinCode={initialJoinCode}
      pending={pending}
      error={error}
    />
  );
}

export default function Home() {
  return (
    <Suspense fallback={<main className="gutter flex-1" />}>
      <HomeContent />
    </Suspense>
  );
}
