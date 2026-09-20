'use client';
// Track B.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRoom } from '@/hooks/useRoom';
import { api } from '@/lib/api';
import { getPlayerId } from '@/lib/player';
import { ADVANCE_GRACE_MS } from '@/lib/constants';
import Lobby from '@/components/Lobby';
import Game from '@/components/Game';
import Results from '@/components/Results';

export default function RoomClient({ code }: { code: string }) {
  const router = useRouter();
  const {
    room, players, messages, canvas, me, isHost, isDrawer, onlineIds, loading, error,
  } = useRoom(code);

  const [actionError, setActionError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [word, setWord] = useState<string | null>(null);

  const hasStoredPlayer = getPlayerId(code) !== null;

  useEffect(() => {
    if (!hasStoredPlayer) {
      router.replace('/?join=' + code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStoredPlayer, code]);

  // Drawer word fetch, keyed on round_number.
  useEffect(() => {
    if (!isDrawer || !room || !me) {
      return;
    }
    let cancelled = false;
    api
      .getWord(code, me.id)
      .then((res) => {
        if (!cancelled) setWord(res.word);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setWord(null);
          setActionError(err instanceof Error ? err.message : 'Failed to fetch word');
        }
      });
    return () => {
      cancelled = true;
    };
    // Re-fetch only when the round changes, not on every room/player object refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDrawer, room?.round_number, me?.id, code]);

  const handleStart = () => {
    if (!me) return;
    setStarting(true);
    setActionError(null);
    api
      .startRoom({ roomCode: code, playerId: me.id })
      .catch((err: unknown) => {
        setActionError(err instanceof Error ? err.message : 'Failed to start game');
      })
      .finally(() => setStarting(false));
  };

  const handleDraw = (emojis: string) => {
    if (!me) return;
    api.draw({ roomCode: code, playerId: me.id, emojis }).catch((err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Failed to update drawing');
    });
  };

  const handleGuess = (guess: string) => {
    if (!me) return;
    api.guess({ roomCode: code, playerId: me.id, guess }).catch((err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Failed to submit guess');
    });
  };

  const handlePlayAgain = () => {
    if (!me) return;
    api.resetRoom({ roomCode: code, playerId: me.id }).catch((err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Failed to reset room');
    });
  };

  // Always holds the latest round number so the grace-period check below is not stale.
  const latestRoundRef = useRef<number | null>(null);
  const currentRound = room?.round_number ?? null;
  useEffect(() => {
    latestRoundRef.current = currentRound;
  }, [currentRound]);

  const handleExpire = () => {
    if (!me || !room) return;
    const callAdvance = () => {
      api.advance({ roomCode: code, playerId: me.id, reason: 'timeout' }).catch(() => {
        // Expected to fail if someone else already advanced; swallow.
      });
    };
    if (isDrawer) {
      callAdvance();
      return;
    }
    const roundAtExpire = room.round_number;
    setTimeout(() => {
      if (latestRoundRef.current === roundAtExpire) {
        callAdvance();
      }
    }, ADVANCE_GRACE_MS);
  };

  if (loading) {
    return <main className="gutter flex min-h-screen items-center justify-center text-lg opacity-70">Loading room...</main>;
  }

  if (error || !room) {
    return (
      <main className="gutter flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-lg">{error ?? 'Room not found'}</p>
        <button className="rounded-xl border px-4 py-2" onClick={() => router.push('/')}>Back home</button>
      </main>
    );
  }

  return (
    <div>
      {actionError && room.status !== 'lobby' && (
        <div role="alert" className="gutter mt-3 rounded-xl border border-red-400/50 bg-red-500/10 px-4 py-2 text-sm text-red-600 dark:text-red-300">
          {actionError}
        </div>
      )}
      {room.status === 'lobby' && (
        <Lobby
          room={room}
          players={players}
          me={me}
          isHost={isHost}
          onlineIds={onlineIds}
          onStart={handleStart}
          starting={starting}
          error={actionError}
        />
      )}
      {room.status === 'playing' && (
        <Game
          room={room}
          players={players}
          me={me}
          isDrawer={isDrawer}
          canvas={canvas}
          messages={messages}
          word={isDrawer ? word : null}
          onDraw={handleDraw}
          onGuess={handleGuess}
          onExpire={handleExpire}
        />
      )}
      {room.status === 'finished' && (
        <Results players={players} isHost={isHost} onPlayAgain={handlePlayAgain} />
      )}
    </div>
  );
}
