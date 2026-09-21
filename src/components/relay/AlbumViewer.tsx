'use client';
import { useEffect, useRef } from 'react';
import type { AlbumChainRes, ReactionEvent } from '@/lib/types';
import AlbumCard from './AlbumCard';

export interface AlbumViewerProps {
  album?: AlbumChainRes | null;
  /** If album is omitted, we render a summary-only view from chain instead of full steps */
  chain?: import('@/lib/types').ChainSummary | null;
  isHost?: boolean;
  onNext?: () => void;
  advancing?: boolean;
  reactions?: ReactionEvent[];
  onReact?: (step: number, emoji: string) => void;
  meId?: string | null;
}

export default function AlbumViewer({ album, chain, isHost, onNext, advancing, reactions, onReact, meId }: AlbumViewerProps) {
  const newestRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    newestRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [album?.chainIndex, album?.revealedUpTo]);

  if (!album && !chain) {
    return (
      <div className="flex w-full flex-col gap-3">
        <div className="h-5 w-2/3 animate-pulse rounded bg-surface-muted" />
        <div className="h-32 w-full animate-pulse rounded-xl bg-surface-muted" />
        <div className="h-32 w-full animate-pulse rounded-xl bg-surface-muted" />
      </div>
    );
  }

  // If we only have a chain summary (e.g. in Results when we didn't fetch full albums)
  if (!album && chain) {
    return (
      <div className="flex w-full flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">
          Chain {chain.chainIndex + 1}: started by {chain.originNickname ?? 'Someone'}
        </h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <div className="text-sm mt-1 text-muted-foreground">
            &quot;{chain.firstPhrase}&quot; ➡️ &quot;{chain.lastGuess}&quot;
          </div>
        </div>
      </div>
    );
  }

  // From here, album is guaranteed to exist.
  const albumSafe = album!;
  const isLastStepOfChain = albumSafe.revealedUpTo === albumSafe.totalSteps - 1;
  const nextLabel = albumSafe.finished ? 'Finish' : isLastStepOfChain ? 'Next chain' : 'Next';

  return (
    <div className="flex w-full flex-col gap-4">
      <h2 className="text-lg font-semibold text-foreground">
        Chain {albumSafe.chainIndex + 1} of {albumSafe.totalChains}: started by {albumSafe.originNickname ?? 'Someone'}
      </h2>

      <div className="flex flex-col gap-3">
        {albumSafe.steps.map((step, i) => {
          const isNewest = i === albumSafe.steps.length - 1;
          const stepReactions = reactions?.filter(r => r.step === step.step) ?? [];
          return (
            <div key={step.step} ref={isNewest ? newestRef : undefined}>
              <AlbumCard 
                step={step} 
                isNew={isNewest} 
                reactions={stepReactions}
                onReact={onReact ? (emoji) => onReact(step.step, emoji) : undefined}
                meId={meId}
              />
            </div>
          );
        })}
      </div>

      {isHost && onNext && (
        <button
          type="button"
          disabled={advancing}
          onClick={onNext}
          className="min-h-12 w-full rounded-lg bg-primary px-4 py-3 text-base font-semibold text-primary-foreground disabled:opacity-40"
        >
          {nextLabel}
        </button>
      ) : (
        <p className="text-center text-sm text-muted-foreground">Host is revealing...</p>
      )}
    </div>
  );
}
