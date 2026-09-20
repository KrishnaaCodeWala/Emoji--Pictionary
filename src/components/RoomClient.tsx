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

  const roundAtExpireRef = useRef<number | null>(null);
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
    roundAtExpireRef.current = room.round_number;
    setTimeout(() => {
      if (room.round_number === roundAtExpireRef.current) {
        callAdvance();
      }
    }, ADVANCE_GRACE_MS);
  };

  if (loading) {
    return <div>Loading room…</div>;
  }

  if (error || !room) {
    return <div>Error: {error ?? 'Room not found'}</div>;
  }

  return (
    <div>
      {actionError && <div role="alert">{actionError}</div>}
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
