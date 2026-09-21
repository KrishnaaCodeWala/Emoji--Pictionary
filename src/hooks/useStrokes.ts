'use client';
// Broadcast strokes over the room channel; buffer received strokes per round.
import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { StrokeEvent } from '@/lib/types';

export interface UseStrokesResult {
  /** strokes received this round (receivers) */
  strokes: StrokeEvent[];
  /** send a stroke (drawer) */
  send: (s: StrokeEvent) => void;
}

export function useStrokes(
  channel: RealtimeChannel | null,
  roundKey: string | number,
  acceptFrom: string | null,
): UseStrokesResult {
  const [strokes, setStrokes] = useState<StrokeEvent[]>([]);
  const [trackedRoundKey, setTrackedRoundKey] = useState(roundKey);

  // Reset the buffer when the round changes. Adjusting state during render (instead of in an
  // effect body) avoids a synchronous setState-in-effect, per the project's react-hooks 7 rules
  // (see EmojiPicker's trackedValue pattern).
  if (roundKey !== trackedRoundKey) {
    setTrackedRoundKey(roundKey);
    setStrokes([]);
  }

  const queueRef = useRef<StrokeEvent[]>([]);
  const flushScheduledRef = useRef(false);
  const acceptFromRef = useRef(acceptFrom);
  const roundKeyRef = useRef(roundKey);

  useEffect(() => {
    acceptFromRef.current = acceptFrom;
  }, [acceptFrom]);

  useEffect(() => {
    roundKeyRef.current = roundKey;
  }, [roundKey]);

  useEffect(() => {
    // Round changed: drop anything queued but not yet flushed for the previous round.
    queueRef.current = [];
  }, [roundKey]);

  // Subscribe once per channel. The channel is already subscribed by useRoom; we only add a
  // broadcast listener here. supabase-js's RealtimeChannel has no per-listener removal API, so
  // we register a single handler for the lifetime of this channel and read the "latest" round /
  // acceptFrom values via refs instead of re-registering on every change.
  useEffect(() => {
    if (!channel) return;
    channel.on('broadcast', { event: 'stroke' }, ({ payload }: { payload: StrokeEvent }) => {
      const af = acceptFromRef.current;
      if (af !== null && payload.playerId !== af) return;
      if (String(payload.round) !== String(roundKeyRef.current)) return;

      queueRef.current.push(payload);
      if (!flushScheduledRef.current) {
        flushScheduledRef.current = true;
        setTimeout(() => {
          flushScheduledRef.current = false;
          const batch = queueRef.current;
          queueRef.current = [];
          if (batch.length > 0) {
            setStrokes((prev) => [...prev, ...batch]);
          }
        }, 16);
      }
    });
  }, [channel]);

  function send(s: StrokeEvent) {
    channel?.send({ type: 'broadcast', event: 'stroke', payload: s });
  }

  return { strokes, send };
}
