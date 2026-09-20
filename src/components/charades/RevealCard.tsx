'use client';

import type { RevealPayload } from '@/lib/types';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm p-4">
      <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-xl border border-border bg-surface p-6 text-center shadow-xl">
        <PosterFrame url={reveal.poster_url} title={reveal.title} className="w-40" />
        <span className="inline-flex items-center rounded-full border border-border bg-surface-muted px-2 py-0.5 text-xs font-medium text-foreground">
          {KIND_LABEL[reveal.kind]}
        </span>
        <h2 className="text-xl font-bold text-foreground">{reveal.title}</h2>
        {reveal.year !== null && <p className="text-sm text-muted-foreground">{reveal.year}</p>}
        <p className="text-sm font-medium text-primary">
          {reveal.guesserNickname ? `${reveal.guesserNickname} got it!` : 'Nobody got it'}
        </p>
        <p className="text-xs text-muted-foreground">Next round starting...</p>
      </div>
    </div>
  );
}
