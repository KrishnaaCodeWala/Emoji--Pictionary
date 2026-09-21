import type { Player } from '@/lib/types';
import type { ScoreEvent } from '@/lib/types';
import Avatar from '@/components/Avatar';
import ScorePop from '@/components/ScorePop';

export interface ScoreboardProps {
  players: Player[];
  currentDrawerId?: string | null;
  meId?: string | null;
  /** v5: score events for ScorePop animations. */
  scoreEvents?: ScoreEvent[];
}

export default function Scoreboard({ players, currentDrawerId, meId, scoreEvents = [] }: ScoreboardProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return (
    <div className="flex flex-wrap gap-2">
      {sorted.map((p) => {
        const isDrawer = currentDrawerId != null && p.id === currentDrawerId;
        const isMe = meId != null && p.id === meId;
        return (
          <div
            key={p.id}
            className={`relative flex items-center gap-1.5 rounded-xl border-2 px-3 py-1 text-sm font-mono font-bold shadow-[2px_2px_0_0_var(--color-border)] ${
              isDrawer
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-surface'
            }`}
          >
            {/* Score pop-up for this player */}
            <ScorePop playerId={p.id} scoreEvents={scoreEvents} />
            {isDrawer && <span aria-hidden>✏️</span>}
            <Avatar avatar={p.avatar} nickname={p.nickname} size="sm" />
            <span className="truncate max-w-[8rem]">
              {p.nickname}
              {isMe ? ' (you)' : ''}
            </span>
            {/* Streak badge */}
            {(p.streak ?? 0) >= 2 && (
              <span title={`${p.streak} streak`} className="text-xs">🔥</span>
            )}
            <span className="font-semibold">{p.score}</span>
          </div>
        );
      })}
    </div>
  );
}
