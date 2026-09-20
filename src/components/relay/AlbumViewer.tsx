'use client';
import { useEffect, useRef } from 'react';
import type { AlbumChainRes } from '@/lib/types';
import AlbumCard from './AlbumCard';

export interface AlbumViewerProps {
  album: AlbumChainRes | null;
  isHost: boolean;
  onNext: () => void;
  advancing?: boolean;
}

export default function AlbumViewer({ album, isHost, onNext, advancing }: AlbumViewerProps) {
  const newestRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    newestRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [album?.chainIndex, album?.revealedUpTo]);

  if (!album) {
    return (
      <div className="flex w-full flex-col gap-3">
        <div className="h-5 w-2/3 animate-pulse rounded bg-surface-muted" />
        <div className="h-32 w-full animate-pulse rounded-xl bg-surface-muted" />
        <div className="h-32 w-full animate-pulse rounded-xl bg-surface-muted" />
      </div>
    );
  }

  const isLastStepOfChain = album.revealedUpTo === album.totalSteps - 1;
  const nextLabel = album.finished ? 'Finish' : isLastStepOfChain ? 'Next chain' : 'Next';

  return (
    <div className="flex w-full flex-col gap-4">
      <h2 className="text-lg font-semibold text-foreground">
        Chain {album.chainIndex + 1} of {album.totalChains}: started by {album.originNickname ?? 'Someone'}
      </h2>

      <div className="flex flex-col gap-3">
        {album.steps.map((step, i) => {
          const isNewest = i === album.steps.length - 1;
          return (
            <div key={step.step} ref={isNewest ? newestRef : undefined}>
              <AlbumCard step={step} isNew={isNewest} />
            </div>
          );
        })}
      </div>

      {isHost ? (
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
