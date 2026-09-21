'use client';
// v5 Wave 1 Track D: RoundIntro — 3-2-1 countdown overlay shown to all clients
// before each round. Blocks the game UI while now < round_intro_until.
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Avatar from '@/components/Avatar';
import type { Player } from '@/lib/types';

export interface RoundIntroProps {
  /** ISO timestamp until which the overlay is shown. */
  roundIntroUntil: string;
  /** The player who will draw this round. */
  nextDrawer: Player | null;
  roundNumber: number;
  onDone?: () => void;
}

export default function RoundIntro({ roundIntroUntil, nextDrawer, roundNumber, onDone }: RoundIntroProps) {
  const endMs = new Date(roundIntroUntil).getTime();
  const [count, setCount] = useState<number | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const tick = () => {
      const remaining = endMs - Date.now();
      if (remaining <= 0) {
        setVisible(false);
        onDone?.();
        return;
      }
      const secs = Math.ceil(remaining / 1000);
      setCount(Math.min(secs, 3));
    };

    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [endMs, onDone]);

  if (!visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="round-intro"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background/90 backdrop-blur-sm"
        >
          {/* Round label */}
          <motion.p
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-sm font-semibold uppercase tracking-widest text-muted-foreground"
          >
            Round {roundNumber}
          </motion.p>

          {/* Drawer avatar + name */}
          {nextDrawer && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex flex-col items-center gap-2"
            >
              <Avatar avatar={nextDrawer.avatar} nickname={nextDrawer.nickname} size="lg" />
              <p className="text-lg font-bold text-foreground">{nextDrawer.nickname} is drawing</p>
            </motion.div>
          )}

          {/* Countdown digit */}
          <AnimatePresence mode="wait">
            {count !== null && (
              <motion.div
                key={count}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-primary bg-primary/10 text-5xl font-black text-primary font-display"
              >
                {count}
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-sm text-muted-foreground">Get ready…</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
