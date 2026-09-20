import type { AlbumStep } from '@/lib/types';

export interface AlbumCardProps { step: AlbumStep; isNew?: boolean }

const KIND_LABELS: Record<AlbumStep['kind'], string> = {
  write: 'Phrase',
  draw: 'Drawing',
  guess: 'Guess',
};

export default function AlbumCard({ step, isNew }: AlbumCardProps) {
  return (
    <div
      className={`w-full rounded-xl border border-border bg-surface p-4 shadow-sm ${
        isNew ? 'animate-relay-card-in' : ''
      }`}
    >
      {isNew && (
        <style>{`
          @keyframes relay-card-in {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-relay-card-in { animation: relay-card-in 300ms ease-out; }
        `}</style>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">
          {step.authorNickname ?? 'Someone'}
        </span>
        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {KIND_LABELS[step.kind]}
        </span>
      </div>
      <div className="mt-3">
        {step.kind === 'draw' ? (
          <p className="break-all text-center text-4xl leading-relaxed sm:text-5xl">{step.content}</p>
        ) : (
          <p className="break-words text-lg text-foreground">&ldquo;{step.content}&rdquo;</p>
        )}
      </div>
    </div>
  );
}
