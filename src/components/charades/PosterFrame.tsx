'use client';

import { useState } from 'react';

export interface PosterFrameProps {
  url: string | null;
  title?: string;
  blurred?: boolean;
  className?: string;
}

function initialsFor(title: string | undefined): string {
  if (!title) return '?';
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const initials = words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return initials || '?';
}

export default function PosterFrame({ url, title, blurred, className }: PosterFrameProps) {
  const [failed, setFailed] = useState(false);
  const [trackedUrl, setTrackedUrl] = useState(url);

  // Reset the failure state when the url changes so a new poster gets a fresh chance to
  // load. Adjusting state during render (instead of an effect) avoids an extra render pass.
  if (url !== trackedUrl) {
    setTrackedUrl(url);
    setFailed(false);
  }

  const showFallback = !url || failed;

  return (
    <div
      className={`relative aspect-[2/3] overflow-hidden rounded-lg border border-border bg-surface-muted ${className ?? 'w-full'}`}
    >
      {showFallback ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center">
          <span aria-hidden className="text-2xl">🎬</span>
          <span className="text-xs font-semibold text-muted-foreground">No poster</span>
          <span className="text-lg font-bold text-foreground">{initialsFor(title)}</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url ?? undefined}
          alt={title ? `Poster for ${title}` : 'Poster'}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className={`h-full w-full object-cover transition-transform ${blurred ? 'scale-105 blur-md' : ''}`}
        />
      )}
    </div>
  );
}
