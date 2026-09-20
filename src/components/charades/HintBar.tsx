import type { ReactNode } from 'react';
import type { PublicHints } from '@/lib/types';

export interface HintBarProps {
  hints: PublicHints | null;
}

const KIND_LABEL: Record<PublicHints['kind'], string> = {
  movie: 'Movie',
  series: 'Series',
  game: 'Game',
};

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-surface-muted px-3 py-1 text-xs font-medium text-foreground">
      {children}
    </span>
  );
}

export default function HintBar({ hints }: HintBarProps) {
  if (!hints) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full border border-dashed border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
          Waiting for hints...
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip>{KIND_LABEL[hints.kind]}</Chip>
      {hints.year !== undefined && <Chip>{hints.year}</Chip>}
      {hints.genre !== undefined && <Chip>{hints.genre}</Chip>}
      {hints.wordCount !== undefined && <Chip>{hints.wordCount} words</Chip>}
      {hints.firstLetters !== undefined && (
        <Chip>First letters: {hints.firstLetters.split('').join(' ')}</Chip>
      )}
    </div>
  );
}
