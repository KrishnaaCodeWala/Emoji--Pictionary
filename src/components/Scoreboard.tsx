import type { Player } from '@/lib/types';

export interface ScoreboardProps { players: Player[]; currentDrawerId?: string | null; meId?: string | null }

export default function Scoreboard({ players, currentDrawerId, meId }: ScoreboardProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return (
    <div className="flex flex-wrap gap-2">
      {sorted.map((p) => {
        const isDrawer = currentDrawerId != null && p.id === currentDrawerId;
        const isMe = meId != null && p.id === meId;
        return (
          <div
            key={p.id}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${
              isDrawer
                ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] font-semibold'
                : 'border-[var(--border)] bg-[var(--surface)]'
            }`}
          >
            {isDrawer && <span aria-hidden>✏️</span>}
            <span className="truncate max-w-[8rem]">
              {p.nickname}
              {isMe ? ' (you)' : ''}
            </span>
            <span className="font-semibold">{p.score}</span>
          </div>
        );
      })}
    </div>
  );
}
