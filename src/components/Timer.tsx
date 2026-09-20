'use client';

import { useEffect, useState } from 'react';

export interface TimerProps {
  endsAt: string | null;
  onExpire?: () => void;
}

function secondsLeft(endsAt: string | null): number {
  if (!endsAt) return 0;
  const ms = new Date(endsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 1000));
}

export default function Timer({ endsAt, onExpire }: TimerProps) {
  const [seconds, setSeconds] = useState(() => secondsLeft(endsAt));
  const [trackedEndsAt, setTrackedEndsAt] = useState(endsAt);

  // Reset the displayed value synchronously whenever endsAt changes (e.g. a new round starts),
  // via the "adjust state during render" pattern rather than an effect.
  if (endsAt !== trackedEndsAt) {
    setTrackedEndsAt(endsAt);
    setSeconds(secondsLeft(endsAt));
  }

  useEffect(() => {
    if (!endsAt) return;

    // Scoped to this effect run (one per distinct endsAt), so it naturally resets when
    // endsAt changes and guarantees onExpire fires at most once per endsAt value.
    let fired = false;

    const tick = () => {
      const s = secondsLeft(endsAt);
      setSeconds(s);
      if (s <= 0 && !fired) {
        fired = true;
        onExpire?.();
      }
    };

    // Run the first tick asynchronously so no setState happens synchronously in the effect body.
    const immediate = setTimeout(tick, 0);
    const interval = setInterval(tick, 1000);
    return () => {
      clearTimeout(immediate);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt]);

  const warning = endsAt !== null && seconds < 10;

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${
        warning ? 'bg-red-500/20 text-red-300 animate-pulse' : 'bg-white/10 text-white/80'
      }`}
      aria-live="polite"
    >
      <span aria-hidden>&#9200;</span>
      {endsAt ? `${seconds}s` : '--s'}
    </div>
  );
}
