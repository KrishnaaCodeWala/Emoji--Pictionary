'use client';

import type { HintKey, InputMode, Prompt, StrokeEvent } from '@/lib/types';
import { HINT_COST, HINT_KEYS } from '@/lib/constants';
import { motion } from 'framer-motion';
import EmojiCanvas from '@/components/EmojiCanvas';
import dynamic from 'next/dynamic';

const EmojiPicker = dynamic(() => import('@/components/EmojiPicker'), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded-xl bg-surface-muted" />
});
const DrawCanvas = dynamic(() => import('@/components/canvas/DrawCanvas'), { ssr: false });
import PosterFrame from './PosterFrame';

export interface ActorPanelProps {
  prompt: Prompt | null;
  canvas: string;
  revealed: HintKey[];
  onDraw: (emojis: string) => void;
  onRevealHint: (hint: HintKey) => void;
  // ---- v4 (canvas input) ----
  inputMode?: InputMode;
  playerId?: string;
  round?: number;
  onStroke?: (s: StrokeEvent) => void;
}

const HINT_LABEL: Record<HintKey, string> = {
  year: 'Year',
  genre: 'Genre',
  wordCount: 'Word count',
  firstLetters: 'First letters',
};

const KIND_LABEL: Record<Prompt['kind'], string> = {
  movie: 'Movie',
  series: 'Series',
  game: 'Game',
};

export default function ActorPanel({
  prompt,
  canvas,
  revealed,
  onDraw,
  onRevealHint,
  inputMode,
  playerId,
  round,
  onStroke,
}: ActorPanelProps) {
  if (!prompt) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-20 aspect-[2/3] rounded-lg bg-surface-muted" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-4 w-2/3 rounded bg-surface-muted" />
            <div className="h-3 w-1/3 rounded bg-surface-muted" />
          </div>
        </div>
        <div className="h-32 rounded-lg bg-surface-muted" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto rounded-xl border-4 border-border shadow-[8px_8px_0_0_var(--color-border)] bg-surface p-4">
      <div className="flex items-center gap-4">
        <PosterFrame url={prompt.poster_url} title={prompt.title} className="w-20 shrink-0 border-2 border-border shadow-[2px_2px_0_0_var(--color-border)]" />
        <div className="flex flex-1 flex-col gap-1">
          <span className="inline-flex w-fit items-center rounded-full border-2 border-border bg-surface-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-foreground font-mono">
            {KIND_LABEL[prompt.kind]}
          </span>
          <h2 className="text-xl font-bold text-primary font-display tracking-widest">{prompt.title}</h2>
          <p className="text-xs text-muted-foreground font-mono font-bold">
            {[prompt.year ?? undefined, prompt.genres.join(', ') || undefined].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      <p className="text-sm font-bold font-mono text-primary uppercase tracking-widest text-center mt-2 border-y-2 border-dashed border-border py-2">Act it out!</p>

      {inputMode === 'canvas' ? (
        <DrawCanvas
          value={canvas}
          playerId={playerId ?? ''}
          round={round ?? 0}
          onStroke={onStroke}
          onSnapshot={onDraw}
        />
      ) : (
        <>
          <EmojiCanvas emojis={canvas} />
          <EmojiPicker value={canvas} onChange={onDraw} />
        </>
      )}

      <div className="flex flex-wrap gap-2">
        {HINT_KEYS.map((key) => {
          const isRevealed = revealed.includes(key);
          return (
            <motion.button
              whileHover={!isRevealed ? { scale: 1.05 } : {}}
              whileTap={!isRevealed ? { scale: 0.95 } : {}}
              key={key}
              type="button"
              disabled={isRevealed}
              onClick={() => onRevealHint(key)}
              className="min-h-10 flex-1 rounded-lg border-2 border-border bg-surface px-3 py-2 text-xs font-mono font-bold text-foreground hover:bg-surface-muted disabled:opacity-50 disabled:bg-surface-muted shadow-[2px_2px_0_0_var(--color-border)] disabled:shadow-[0px_0px_0_0_var(--color-border)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
            >
              {isRevealed ? (
                <span className="line-through">{HINT_LABEL[key]} Revealed</span>
              ) : (
                <span>
                  {HINT_LABEL[key]} <span className="text-danger ml-1 px-1 bg-danger-bg rounded-md">-{HINT_COST} pts</span>
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
