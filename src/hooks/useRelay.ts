'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { SYS_RELAY_PREFIX } from '@/lib/constants';
import type { AlbumChainRes, Message, Player, RelayProgress, RelayTaskRes, RoomPublic } from '@/lib/types';

export interface UseRelayResult {
  task: RelayTaskRes | null;
  progress: RelayProgress | null;
  album: AlbumChainRes | null;
  loading: boolean;
  error: string | null;
  submit: (content: string) => Promise<void>;
  albumAdvance: () => Promise<void>;
  refetch: () => Promise<void>;
}

function parseProgress(content: string): RelayProgress | null {
  try {
    return JSON.parse(content.slice(SYS_RELAY_PREFIX.length)) as RelayProgress;
  } catch {
    return null;
  }
}

const noop = async () => {};

/**
 * Relay-mode client state. `systemFeed` is the room's full system-message stream (from
 * useRoom) so this hook can parse 'relay:' progress pings without a second subscription.
 */
export function useRelay(
  roomCode: string,
  room: RoomPublic | null,
  me: Player | null,
  systemFeed: Message[],
): UseRelayResult {
  const isRelay = room?.mode === 'relay';
  const playerId = me?.id ?? null;
  const phase = room?.relay_phase ?? null;
  const step = room?.relay_step ?? null;
  const albumChain = room?.album_chain ?? null;
  const albumStep = room?.album_step ?? null;

  const [task, setTask] = useState<RelayTaskRes | null>(null);
  const [album, setAlbum] = useState<AlbumChainRes | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped after a successful submit to force a task refetch (relay_step may not change,
  // e.g. we are not the last to submit yet, but our own `submitted` flag should refresh).
  const [submitBump, setSubmitBump] = useState(0);

  // Fetch the current task whenever phase/step/player changes, or after our own submit.
  useEffect(() => {
    // No reset here: when !isRelay the hook's final return below overrides everything
    // with inert values regardless of this internal state, and the other guard cases
    // (room/me not resolved yet) are transient enough that stale state is harmless —
    // matching the existing getWord effect's convention of "just skip" on a bad guard.
    if (!isRelay || !roomCode || !playerId) {
      return;
    }
    let cancelled = false;
    // setLoading(true) is deliberately inside this async IIFE (not directly in the effect
    // body) so all state updates here happen from an async callback, matching useRoom's
    // fetch convention rather than setting state synchronously during the effect.
    (async () => {
      setLoading(true);
      try {
        const res = await api.relayTask(roomCode, playerId);
        if (cancelled) return;
        setTask(res);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load task');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isRelay, roomCode, playerId, phase, step, submitBump]);

  // Fetch the album whenever it advances (album_chain/album_step come from rooms_public,
  // refetched by useRoom on the plain system message the server inserts per advance).
  useEffect(() => {
    if (!isRelay || phase !== 'album' || !roomCode || !playerId) {
      return;
    }
    let cancelled = false;
    api
      .relayAlbum(roomCode, playerId)
      .then((res) => {
        if (cancelled) return;
        setAlbum(res);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load album');
      });
    return () => {
      cancelled = true;
    };
  }, [isRelay, phase, roomCode, playerId, albumChain, albumStep]);

  const progress = useMemo<RelayProgress | null>(() => {
    if (!isRelay || step === null) return null;
    for (let i = systemFeed.length - 1; i >= 0; i--) {
      const m = systemFeed[i];
      if (m.type === 'system' && m.content.startsWith(SYS_RELAY_PREFIX)) {
        const parsed = parseProgress(m.content);
        if (parsed && parsed.step === step) return parsed;
      }
    }
    return null;
  }, [isRelay, step, systemFeed]);

  const submit = useCallback(
    async (content: string) => {
      if (!isRelay || !roomCode || !playerId || !task) return;
      const submittedStep = task.step;
      setError(null);
      // Optimistic: lock the panel immediately, revert on failure.
      setTask((prev) => (prev && prev.step === submittedStep ? { ...prev, submitted: true } : prev));
      try {
        await api.relaySubmit({ roomCode, playerId, step: submittedStep, content });
        setSubmitBump((n) => n + 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to submit');
        setTask((prev) => (prev && prev.step === submittedStep ? { ...prev, submitted: false } : prev));
      }
    },
    [isRelay, roomCode, playerId, task],
  );

  const albumAdvance = useCallback(async () => {
    if (!isRelay || !roomCode || !playerId) return;
    setError(null);
    try {
      await api.albumAdvance({ roomCode, playerId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to advance album');
    }
  }, [isRelay, roomCode, playerId]);

  const refetch = useCallback(async () => {
    if (!isRelay || !roomCode || !playerId) return;
    try {
      const res = await api.relayTask(roomCode, playerId);
      setTask(res);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task');
    }
  }, [isRelay, roomCode, playerId]);

  if (!isRelay) {
    return { task: null, progress: null, album: null, loading: false, error: null, submit: noop, albumAdvance: noop, refetch: noop };
  }

  return { task, progress, album, loading, error, submit, albumAdvance, refetch };
}
