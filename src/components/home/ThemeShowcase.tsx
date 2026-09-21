'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { GameMode } from '@/lib/types';
import { THEME_FOR_MODE } from '@/lib/constants';

export interface ThemeShowcaseProps {
  mode: GameMode;
  active: boolean;
}

const COPY: Record<GameMode, { title: string; pitch: string }> = {
  classic: {
    title: 'Classic',
    pitch: 'Draw a secret word in emoji. First guess wins the round.',
  },
  charades: {
    title: 'Charades',
    pitch: 'Act out a movie, show, or game with emoji — no words allowed.',
  },
  relay: {
    title: 'Relay',
    pitch: 'Write a phrase, draw it, guess the next drawing — pass it on.',
  },
};

const BURST_EMOJI: Record<GameMode, string[]> = {
  classic: ['🍕', '🚀', '🐱', '🎩', '🌙'],
  charades: ['🎬', '🍿', '🎭', '🕶️', '⭐'],
  relay: ['✏️', '🖼️', '👀', '🔁', '✨'],
};

function ClassicAnimation({ play }: { play: boolean }) {
  return (
    <div className="flex items-end justify-center gap-3 text-4xl sm:text-5xl" aria-hidden="true">
      {BURST_EMOJI.classic.map((e, i) => (
        <motion.span
          key={e}
          initial={{ opacity: 0.3, y: 0, scale: 0.7 }}
          animate={
            play
              ? { opacity: [0.3, 1, 0.3], y: [0, -14, 0], scale: [0.7, 1.1, 0.7] }
              : { opacity: 0.6, y: 0, scale: 0.9 }
          }
          transition={
            play
              ? { duration: 1.6, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }
              : { duration: 0 }
          }
        >
          {e}
        </motion.span>
      ))}
    </div>
  );
}

function CharadesAnimation({ play }: { play: boolean }) {
  return (
    <div className="relative flex items-center justify-center" aria-hidden="true">
      <motion.div
        className="absolute h-28 w-28 rounded-full sm:h-36 sm:w-36"
        style={{
          background:
            'radial-gradient(circle, color-mix(in srgb, var(--accent) 55%, transparent) 0%, transparent 70%)',
        }}
        animate={play ? { opacity: [0.4, 0.9, 0.4], scale: [0.9, 1.05, 0.9] } : { opacity: 0.6, scale: 1 }}
        transition={play ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }}
      />
      <motion.div
        className="relative text-6xl sm:text-7xl"
        style={{ transformOrigin: '20% 20%' }}
        animate={play ? { rotate: [0, -18, 0] } : { rotate: 0 }}
        transition={play ? { duration: 1.2, repeat: Infinity, repeatDelay: 0.8, ease: 'easeInOut' } : { duration: 0 }}
      >
        🎬
      </motion.div>
    </div>
  );
}

function RelayAnimation({ play }: { play: boolean }) {
  const pathLength = 220;
  return (
    <div className="flex items-center justify-center" aria-hidden="true">
      <svg width="180" height="110" viewBox="0 0 180 110" className="text-[var(--primary)]">
        <motion.path
          d="M12 90 C 40 20, 70 100, 95 40 S 150 10, 168 70"
          fill="none"
          stroke="currentColor"
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={pathLength}
          initial={{ strokeDashoffset: pathLength }}
          animate={play ? { strokeDashoffset: [pathLength, 0, 0, pathLength] } : { strokeDashoffset: 0 }}
          transition={
            play
              ? { duration: 3.2, repeat: Infinity, ease: 'easeInOut', times: [0, 0.55, 0.8, 1] }
              : { duration: 0 }
          }
        />
      </svg>
    </div>
  );
}

export default function ThemeShowcase({ mode, active }: ThemeShowcaseProps) {
  const reducedMotion = useReducedMotion();
  const play = active && !reducedMotion;
  const theme = THEME_FOR_MODE[mode];
  const copy = COPY[mode];

  return (
    <div
      data-theme={theme}
      className="flex h-full w-full flex-col items-center justify-center gap-2 sm:gap-4 bg-background px-6 pt-2 pb-6 text-center text-foreground transition-colors"
    >
      <div className="h-24 sm:h-28">
        {mode === 'classic' && <ClassicAnimation play={play} />}
        {mode === 'charades' && <CharadesAnimation play={play} />}
        {mode === 'relay' && <RelayAnimation play={play} />}
      </div>
      <h2
        className={
          mode === 'relay'
            ? 'font-sketch text-5xl font-bold tracking-wide text-primary sm:text-6xl'
            : 'font-display text-4xl font-bold tracking-wide text-primary sm:text-5xl'
        }
      >
        {copy.title}
      </h2>
    </div>
  );
}
