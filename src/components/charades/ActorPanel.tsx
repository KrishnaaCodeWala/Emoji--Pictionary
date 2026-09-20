'use client';

import type { HintKey, Prompt } from '@/lib/types';
import { HINT_COST, HINT_KEYS } from '@/lib/constants';
import EmojiCanvas from '@/components/EmojiCanvas';
import EmojiPicker from '@/components/EmojiPicker';
import PosterFrame from './PosterFrame';

export interface ActorPanelProps {
  prompt: Prompt | null;
  canvas: string;
  revealed: HintKey[];
  onDraw: (emojis: string) => void;
  onRevealHint: (hint: HintKey) => void;
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

export default function ActorPanel({ prompt, canvas, revealed, onDraw, onRevealHint }: ActorPanelProps) {
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
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <PosterFrame url={prompt.poster_url} title={prompt.title} className="w-20 shrink-0" />
        <div className="flex flex-1 flex-col gap-1">
          <span className="inline-flex w-fit items-center rounded-full border border-border bg-surface-muted px-2 py-0.5 text-xs font-medium text-foreground">
            {KIND_LABEL[prompt.kind]}
          </span>
          <h2 className="text-lg font-bold text-foreground">{prompt.title}</h2>
          <p className="text-xs text-muted-foreground">
            {[prompt.year ?? undefined, prompt.genres.join(', ') || undefined].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      <p className="text-sm font-medium text-primary">Act it out with emojis!</p>

      <EmojiCanvas emojis={canvas} />
      <EmojiPicker value={canvas} onChange={onDraw} />

      <div className="flex flex-wrap gap-2">
        {HINT_KEYS.map((key) => {
          const isRevealed = revealed.includes(key);
          return (
            <button
              key={key}
              type="button"
              disabled={isRevealed}
              onClick={() => onRevealHint(key)}
              className="min-h-10 flex-1 rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-medium text-foreground hover:bg-border disabled:opacity-50"
            >
              {isRevealed ? (
                <span>{HINT_LABEL[key]}: Revealed</span>
              ) : (
                <span>
                  {HINT_LABEL[key]} <span className="text-danger">-{HINT_COST} pts</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
