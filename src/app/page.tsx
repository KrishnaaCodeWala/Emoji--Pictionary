'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { setNickname as storeNickname, setPlayerId, setAvatar as storeAvatar } from '@/lib/player';
import { getCurrentUser } from '@/lib/supabase/auth';
import { ROOM_CODE_LENGTH } from '@/lib/constants';
import type { GameMode } from '@/lib/types';
import HomeHero from '@/components/home/HomeHero';

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<'create' | 'join' | null>(null);
  const initialJoinCode = (searchParams.get('join') ?? '').toUpperCase();
  const wasKicked = searchParams.get('kicked') === '1';

  async function handleCreate(nickname: string, mode: GameMode, avatar: string) {
    setError(null);
    setPending('create');
    try {
      const user = await getCurrentUser();
      const res = await api.createRoom({ nickname, mode, avatar, authUid: user?.id });
      storeNickname(nickname);
      storeAvatar(avatar);
      setPlayerId(res.roomCode, res.playerId);
      router.push(`/room/${res.roomCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setPending(null);
    }
  }

  async function handleJoin(nickname: string, code: string, avatar: string, spectate: boolean) {
    setError(null);
    if (code.length !== ROOM_CODE_LENGTH) {
      setError(`Room code must be ${ROOM_CODE_LENGTH} characters`);
      return;
    }
    setPending('join');
    try {
      const user = await getCurrentUser();
      const res = await api.joinRoom({ roomCode: code, nickname, avatar, spectate, authUid: user?.id });
      storeNickname(nickname);
      storeAvatar(avatar);
      setPlayerId(code, res.playerId);
      router.push(`/room/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setPending(null);
    }
  }

  async function handleRejoin(nickname: string, code: string) {
    setError(null);
    setPending('join');
    try {
      const res = await api.rejoinRoom({ roomCode: code, nickname });
      if (res.success && res.playerId) {
        setPlayerId(code, res.playerId);
        router.push(`/room/${code}`);
      } else {
        setError('Could not find that player in the room.');
        setPending(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rejoin failed');
      setPending(null);
    }
  }

  return (
    <HomeHero
      onCreate={handleCreate}
      onJoin={handleJoin}
      onRejoin={handleRejoin}
      initialJoinCode={initialJoinCode}
      pending={pending}
      error={wasKicked ? 'You were removed from the room.' : error}
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
