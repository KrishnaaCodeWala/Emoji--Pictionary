'use client';
// v5 Wave 1 Track D: ScorePop — floating +N toast anchored near a player row.
// Mount one per player; it animates in when a ScoreEvent for that player arrives.
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ScoreEvent } from '@/lib/types';

export interface ScorePopProps {
  /** The player ID this pop-up belongs to. */
  playerId: string;
  /** Latest score events from useRoom. The component picks events for its player. */
  scoreEvents: ScoreEvent[];
}

export default function ScorePop({ playerId, scoreEvents }: ScorePopProps) {
  const [pops, setPops] = useState<{ id: number; delta: number; streak: number }[]>([]);
  const [seen, setSeen] = useState<Set<number>>(new Set());

  // Deduplicate by index into scoreEvents to avoid double-firing on re-renders
  useEffect(() => {
    scoreEvents.forEach((ev, idx) => {
      if (ev.playerId !== playerId) return;
      if (seen.has(idx)) return;
      setSeen((s) => new Set(s).add(idx));
      const id = Date.now() + idx;
      setPops((prev) => [...prev, { id, delta: ev.delta, streak: ev.streak }]);
      setTimeout(() => {
        setPops((prev) => prev.filter((p) => p.id !== id));
      }, 1800);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoreEvents, playerId]);

  return (
    <div className="pointer-events-none absolute -top-8 right-0 flex flex-col items-end gap-1">
      <AnimatePresence>
        {pops.map((pop) => (
          <motion.div
            key={pop.id}
            initial={{ opacity: 0, y: 4, scale: 0.8 }}
            animate={{ opacity: 1, y: -8, scale: 1 }}
            exit={{ opacity: 0, y: -24, scale: 0.9 }}
            transition={{ duration: 0.35 }}
            className="rounded-full border-2 border-primary/40 bg-primary/10 px-2 py-0.5 text-sm font-black text-primary shadow-sm"
          >
            +{pop.delta}
            {pop.streak >= 2 && <span className="ml-0.5">🔥</span>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
