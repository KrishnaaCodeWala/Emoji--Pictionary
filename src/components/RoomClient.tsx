'use client';
// Track B.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRoom } from '@/hooks/useRoom';
import { useRelay } from '@/hooks/useRelay';
import { useStrokes } from '@/hooks/useStrokes';
import { api } from '@/lib/api';
import { getPlayerId } from '@/lib/player';
import { ADVANCE_GRACE_MS, DRAWER_ABSENT_MS, THEME_FOR_MODE } from '@/lib/constants';
import type { GameMode, HintKey, Player, RoomSettings, WordRes } from '@/lib/types';
import Lobby from '@/components/Lobby';
import Game from '@/components/Game';
import Results from '@/components/Results';
import ConnectionBanner from '@/components/ConnectionBanner';
import RoundIntro from '@/components/RoundIntro';
import { AnimatePresence, motion } from 'framer-motion';
import { unlockAudio, playCorrect, playWrong, playReveal, playClapper, playYourTurn, playFanfare } from '@/lib/sound';

export default function RoomClient({ code }: { code: string }) {
  const router = useRouter();
  const {
    room, players, messages, canvas, me, isHost, isDrawer, onlineIds, loading, error,
    hints, reveal, reveals, chains, systemFeed, refetchRoom, channel,
    connection, scoreEvents, kicked, reactions,
  } = useRoom(code);

  // Optimistic mode/settings so rapid toggles in the lobby build on each other instead of
  // on stale server state. Cleared when the latest setMode request settles.
  const [optimisticMode, setOptimisticMode] = useState<{ mode: GameMode; settings: RoomSettings } | null>(null);
  const setModeSeqRef = useRef(0);

  // Always called (hooks order): internally inert unless room.mode === 'relay'.
  const relay = useRelay(code, room, me, systemFeed);

  // v4: canvas input mode. In relay there is no single drawer (current_drawer_id is
  // null while relay is playing), so useStrokes naturally accepts strokes from anyone.
  const inputMode = room?.settings?.input ?? 'emoji';
  const { strokes, send } = useStrokes(
    channel,
    room?.mode === 'relay' ? room?.relay_step ?? 0 : room?.round_number ?? 0,
    room?.current_drawer_id ?? null,
  );

  const [actionError, setActionError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [wordRes, setWordRes] = useState<WordRes | null>(null);
  const [closeFlash, setCloseFlash] = useState(0);

  const hasStoredPlayer = getPlayerId(code) !== null;

  useEffect(() => {
    if (!hasStoredPlayer) {
      router.replace('/?join=' + code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStoredPlayer, code]);

  // v5: redirect when kicked
  useEffect(() => {
    if (kicked) {
      router.replace('/?kicked=1');
    }
  }, [kicked, router]);

  // Drawer word fetch, keyed on round_number.
  useEffect(() => {
    if (!isDrawer || !room || !me) {
      return;
    }
    let cancelled = false;
    api
      .getWord(code, me.id)
      .then((res) => {
        if (!cancelled) setWordRes(res);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setWordRes(null);
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
    unlockAudio(); // first gesture — unlock Web Audio
    setStarting(true);
    setActionError(null);
    api
      .startRoom({ roomCode: code, playerId: me.id })
      .catch((err: unknown) => {
        setActionError(err instanceof Error ? err.message : 'Failed to start game');
      })
      .finally(() => setStarting(false));
  };

  const handleLeave = () => {
    if (!me) return;
    api.leave({ roomCode: code, playerId: me.id })
      .then(() => router.push('/'))
      .catch((err: unknown) => {
        setActionError(err instanceof Error ? err.message : 'Failed to leave room');
      });
  };

  const handleKick = (targetPlayerId: string) => {
    if (!me) return;
    api.kick({ roomCode: code, playerId: me.id, targetPlayerId }).catch((err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Failed to kick player');
    });
  };

  const handlePromote = (targetPlayerId: string) => {
    if (!me) return;
    api.promotePlayer({ roomCode: code, playerId: me.id, targetPlayerId }).catch((err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Failed to promote player');
    });
  };

  const handleDraw = (emojis: string) => {
    if (!me) return;
    api.draw({ roomCode: code, playerId: me.id, emojis }).catch((err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Failed to update drawing');
    });
  };

  const handleGuess = (guess: string) => {
    if (!me) return;
    api
      .guess({ roomCode: code, playerId: me.id, guess })
      .then((res) => {
        if (res.correct) {
          // ScoreEvent will handle the success chime
        } else if (res.close) {
          setCloseFlash((n) => n + 1);
          playWrong();
        } else {
          playWrong();
        }
      })
      .catch((err: unknown) => {
        setActionError(err instanceof Error ? err.message : 'Failed to submit guess');
      });
  };

  const handleSetMode = (mode: GameMode, settings: RoomSettings) => {
    if (!me) return;
    const seq = ++setModeSeqRef.current;
    setOptimisticMode({ mode, settings });
    api
      .setMode({ roomCode: code, playerId: me.id, mode, settings })
      .then(() => refetchRoom())
      .catch((err: unknown) => {
        setActionError(err instanceof Error ? err.message : 'Failed to set mode');
      })
      .finally(() => {
        if (setModeSeqRef.current === seq) setOptimisticMode(null);
      });
  };

  const handleRevealHint = (hint: HintKey) => {
    if (!me) return;
    api.revealHint({ roomCode: code, playerId: me.id, hint }).catch((err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Failed to reveal hint');
    });
  };

  const handlePlayAgain = () => {
    if (!me) return;
    api.resetRoom({ roomCode: code, playerId: me.id }).catch((err: unknown) => {
      setActionError(err instanceof Error ? err.message : 'Failed to reset room');
    });
  };

  const handleReact = (chainIndex: number, step: number, emoji: string) => {
    if (!me || !room) return;
    api.reactRelay({
      roomCode: code,
      gameNo: room.game_no,
      chainIndex,
      step,
      playerId: me.id,
      emoji
    }).catch(err => console.error("Failed to react", err));
  };

  // Always holds the latest round number so the grace-period check below is not stale.
  const latestRoundRef = useRef<number | null>(null);
  const currentRound = room?.round_number ?? null;
  useEffect(() => {
    latestRoundRef.current = currentRound;
  }, [currentRound]);

  const handleExpire = () => {
    if (!me || !room) return;
    // Relay has its own timeout-advance path (handleRelayExpire); the classic/charades
    // advance API is a different shape and must never fire in relay mode.
    if (room.mode === 'relay') return;
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

  // Keep the latest players list in a ref so the drawer-left timer below can read it
  // at fire time without needing to reset on every player object update (e.g. score
  // changes), which would otherwise keep clearing/re-arming the timeout.
  const playersRef = useRef<Player[]>(players);
  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  const advancedDrawerLeftRoundRef = useRef<number | null>(null);
  const roomStatus = room?.status ?? null;
  const drawerId = room?.current_drawer_id ?? null;
  const roundNumber = room?.round_number ?? null;
  const meId = me?.id ?? null;

  // Drawer-left detection: if the current drawer is continuously absent from Presence
  // for longer than DRAWER_ABSENT_MS, the lowest-turn_order online player advances the
  // round. Guarded on `me` being in onlineIds first, since onlineIds is empty until
  // Presence syncs on initial load (otherwise every client would think the drawer is
  // absent and skip the turn immediately).
  useEffect(() => {
    if (roomStatus !== 'playing' || !drawerId || !meId || roundNumber === null) return;
    if (!onlineIds.has(meId)) return;
    if (onlineIds.has(drawerId)) return;
    if (advancedDrawerLeftRoundRef.current === roundNumber) return;

    const round = roundNumber;
    const timer = setTimeout(() => {
      const onlinePlayers = playersRef.current.filter((p) => onlineIds.has(p.id));
      if (onlinePlayers.length === 0) return;
      const lowest = onlinePlayers.reduce((a, b) => (a.turn_order < b.turn_order ? a : b));
      if (lowest.id !== meId) return;
      advancedDrawerLeftRoundRef.current = round;
      api.advance({ roomCode: code, playerId: meId, reason: 'drawer_left' }).catch(() => {
        // Expected to fail if someone else already advanced; swallow.
      });
    }, DRAWER_ABSENT_MS);

    return () => clearTimeout(timer);
  }, [roomStatus, drawerId, roundNumber, onlineIds, meId, code]);

  // Sound triggers
  useEffect(() => {
    if (roomStatus === 'finished') playFanfare();
  }, [roomStatus]);

  useEffect(() => {
    if (reveal) playReveal();
  }, [reveal]);

  const prevRelayPhaseRef = useRef(relay?.task?.phase);
  useEffect(() => {
    if (relay?.task?.phase && relay.task.phase !== 'album' && relay.task.phase !== prevRelayPhaseRef.current && !relay.task.submitted) {
      playYourTurn();
    }
    prevRelayPhaseRef.current = relay?.task?.phase;
  }, [relay?.task?.phase, relay?.task?.submitted]);

  const prevRevealedUpToRef = useRef(relay?.album?.revealedUpTo);
  useEffect(() => {
    if (relay?.album?.revealedUpTo !== undefined && relay.album.revealedUpTo !== prevRevealedUpToRef.current && prevRevealedUpToRef.current !== undefined) {
      playClapper();
    }
    prevRevealedUpToRef.current = relay?.album?.revealedUpTo;
  }, [relay?.album?.revealedUpTo]);

  const scoreEventsLength = scoreEvents.length;
  const prevScoreEventsLength = useRef(scoreEventsLength);
  useEffect(() => {
    if (scoreEventsLength > prevScoreEventsLength.current) {
      const newEvents = scoreEvents.slice(prevScoreEventsLength.current);
      if (newEvents.some(e => e.playerId === me?.id && e.reason === 'guess')) {
        playCorrect();
      }
    }
    prevScoreEventsLength.current = scoreEventsLength;
  }, [scoreEventsLength, scoreEvents, me?.id]);

  // Relay: mirrors the drawer-left pattern above, but relay has no single actor — the
  // lowest-turn_order online player calls /api/relay/advance after the grace period.
  const relayStepRef = useRef<number | null>(null);
  useEffect(() => {
    relayStepRef.current = room?.relay_step ?? null;
  }, [room?.relay_step]);

  const handleRelayExpire = () => {
    if (!me || !room || room.mode !== 'relay') return;
    const stepAtExpire = room.relay_step;
    const onlinePlayers = players.filter((p) => onlineIds.has(p.id));
    if (onlinePlayers.length === 0) return;
    const lowest = onlinePlayers.reduce((a, b) => (a.turn_order < b.turn_order ? a : b));
    if (lowest.id !== me.id) return;
    setTimeout(() => {
      if (relayStepRef.current === stepAtExpire) {
        api.relayAdvance({ roomCode: code, playerId: me.id }).catch(() => {
          // Expected to fail if someone else already advanced; swallow.
        });
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

  const theme = THEME_FOR_MODE[optimisticMode?.mode ?? room.mode];

  // v5: find the next drawer for RoundIntro
  const nextDrawer = room.status === 'playing' && room.current_drawer_id
    ? players.find((p) => p.id === room.current_drawer_id) ?? null
    : null;

  return (
    <div data-theme={theme} className="h-[100dvh] w-full flex flex-col overflow-hidden transition-colors duration-500 relative bg-background text-foreground">
      {theme === 'theatre' && (
        <>
          <div className="vintage-noise" />
          <div className="vintage-vignette" />
        </>
      )}

      {/* v5: Connection banner */}
      <ConnectionBanner connection={connection} />

      {actionError && room.status !== 'lobby' && (
        <div role="alert" className="gutter relative z-10 mt-3 rounded-xl border border-red-400/50 bg-red-500/10 px-4 py-2 text-sm text-red-600">
          {actionError}
        </div>
      )}
      <AnimatePresence mode="wait">
        {room.status === 'lobby' && (
          <motion.div
            key="lobby"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.3 }}
            className="relative z-10 flex-1 overflow-y-auto min-h-0"
          >
            <Lobby
              room={optimisticMode ? { ...room, mode: optimisticMode.mode, settings: optimisticMode.settings } : room}
              players={players}
              me={me}
              isHost={isHost}
              onlineIds={onlineIds}
              onStart={handleStart}
              starting={starting}
              error={actionError}
              onSetMode={handleSetMode}
              onLeave={handleLeave}
              onKick={handleKick}
              onPromote={handlePromote}
              scoreEvents={scoreEvents}
            />
          </motion.div>
        )}
        {room.status === 'playing' && (
          <motion.div
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 flex-1 flex flex-col min-h-0 overflow-hidden"
          >
            {/* v5: Round intro overlay */}
            {room.round_intro_until && (
              <RoundIntro
                roundIntroUntil={room.round_intro_until}
                nextDrawer={nextDrawer}
                roundNumber={room.round_number}
              />
            )}
            <Game
              room={room}
              players={players}
              me={me}
              isDrawer={isDrawer}
              canvas={canvas}
              messages={messages}
              word={isDrawer ? wordRes?.word ?? null : null}
              onDraw={handleDraw}
              onGuess={handleGuess}
              onExpire={handleExpire}
              prompt={isDrawer ? wordRes?.prompt ?? null : null}
              hints={hints}
              reveal={reveal}
              closeFlash={closeFlash}
              onRevealHint={handleRevealHint}
              relay={room.mode === 'relay' ? relay : undefined}
              onRelayExpire={room.mode === 'relay' ? handleRelayExpire : undefined}
              inputMode={inputMode}
              strokes={strokes}
              onStroke={send}
            />
          </motion.div>
        )}
        {room.status === 'finished' && (
          <motion.div
            key="finished"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 flex-1 overflow-y-auto min-h-0"
          >
            <Results
              players={players}
              isHost={isHost}
              onPlayAgain={handlePlayAgain}
              mode={room.mode}
              reveals={reveals}
              chains={chains}
              reactions={reactions}
              onReact={handleReact}
              meId={me?.id ?? null}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
