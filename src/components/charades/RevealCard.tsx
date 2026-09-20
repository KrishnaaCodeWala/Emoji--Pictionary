'use client';

import type { RevealPayload } from '@/lib/types';
import { motion } from 'framer-motion';
import PosterFrame from './PosterFrame';

export interface RevealCardProps {
  reveal: RevealPayload | null;
}

const KIND_LABEL: Record<RevealPayload['kind'], string> = {
  movie: 'Movie',
  series: 'Series',
  game: 'Game',
};

export default function RevealCard({ reveal }: RevealCardProps) {
  if (!reveal) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/60 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ y: -50, opacity: 0, rotateZ: -5 }}
        animate={{ y: 0, opacity: 1, rotateZ: 0 }}
        className="flex w-full max-w-xs flex-col items-center gap-3 rounded-xl border-4 border-border bg-surface p-6 text-center shadow-[8px_8px_0_0_var(--color-border)]"
      >
        <PosterFrame url={reveal.poster_url} title={reveal.title} className="w-40 border-4 border-border shadow-[4px_4px_0_0_var(--color-border)]" />
        <span className="inline-flex items-center rounded-full border-2 border-border bg-surface-muted px-2 py-0.5 text-xs font-bold text-foreground font-mono uppercase tracking-widest">
          {KIND_LABEL[reveal.kind]}
        </span>
        <h2 className="text-2xl font-bold text-primary font-display tracking-widest">{reveal.title}</h2>
        {reveal.year !== null && <p className="text-sm text-muted-foreground font-mono font-bold">{reveal.year}</p>}
        <p className="text-sm font-bold font-mono text-primary bg-primary/10 px-3 py-1 rounded-full border-2 border-primary">
          {reveal.guesserNickname ? `${reveal.guesserNickname} got it!` : 'Nobody got it'}
        </p>
        <p className="text-xs text-muted-foreground font-mono mt-2 uppercase">Next round starting...</p>
      </motion.div>
    </div>
  );
}
