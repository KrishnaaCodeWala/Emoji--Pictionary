import type { AlbumStep, ReactionEvent } from '@/lib/types';
import { isImageContent } from '@/lib/canvasContent';

export interface AlbumCardProps { 
  step: AlbumStep; 
  isNew?: boolean;
  reactions?: ReactionEvent[];
  onReact?: (emoji: string) => void;
  meId?: string | null;
}

const KIND_LABELS: Record<AlbumStep['kind'], string> = {
  write: 'Phrase',
  draw: 'Drawing',
  guess: 'Guess',
};

const REACTION_EMOJIS = ['😂', '😮', '❤️', '🤔', '💀'];

export default function AlbumCard({ step, isNew, reactions = [], onReact, meId }: AlbumCardProps) {
  // Aggregate reactions by emoji
  const counts = new Map<string, number>();
  const myReactions = new Set<string>();
  
  for (const r of reactions) {
    counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
    if (meId && r.playerId === meId) {
      myReactions.add(r.emoji);
    }
  }

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
          isImageContent(step.content) ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL snapshot, not a static asset
            <img
              src={step.content}
              alt="drawing"
              className="mx-auto max-h-64 w-full max-w-full rounded-lg border border-border object-contain"
            />
          ) : (
            <p className="break-all text-center text-4xl leading-relaxed sm:text-5xl">{step.content}</p>
          )
        ) : (
          <p className="break-words text-lg text-foreground">&ldquo;{step.content}&rdquo;</p>
        )}
      </div>

      {onReact && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
          {REACTION_EMOJIS.map(e => {
            const hasReacted = myReactions.has(e);
            const count = counts.get(e) ?? 0;
            if (!onReact && count === 0) return null; // Don't show zero-count if readonly
            
            return (
              <button
                key={e}
                onClick={() => onReact?.(e)}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm transition-colors ${
                  hasReacted ? 'bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30' : 'bg-surface-muted hover:bg-[var(--border)] text-muted-foreground'
                }`}
              >
                <span>{e}</span>
                {count > 0 && <span className="font-semibold">{count}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
