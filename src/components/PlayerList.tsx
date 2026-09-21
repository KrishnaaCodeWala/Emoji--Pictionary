import { useState } from 'react';
import type { Player } from '@/lib/types';
import type { ScoreEvent } from '@/lib/types';
import { motion } from 'framer-motion';
import Avatar from '@/components/Avatar';
import ScorePop from '@/components/ScorePop';

export interface PlayerListProps {
  players: Player[];
  onlineIds: Set<string>;
  hostId?: string | null;
  meId?: string | null;
  /** v5: host can kick. Called with the target player id. */
  onKick?: (targetPlayerId: string) => void;
  /** v5: score events for ScorePop animations. */
  scoreEvents?: ScoreEvent[];
}

export default function PlayerList({ players, onlineIds, hostId, meId, onKick, scoreEvents = [] }: PlayerListProps) {
  const [page, setPage] = useState(0);
  const pageSize = 5;
  const sorted = [...players].sort((a, b) => a.turn_order - b.turn_order);
  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginatedPlayers = sorted.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {paginatedPlayers.map((p) => {
          const online = onlineIds.has(p.id);
          const isHost = hostId != null && p.id === hostId;
          const isMe = meId != null && p.id === meId;
          const isLeft = p.left_at != null;
          return (
            <motion.li
              whileHover={{ scale: 1.02 }}
              key={p.id}
              className={`relative flex items-center gap-2 rounded-xl border-4 border-border shadow-[4px_4px_0_0_var(--color-border)] bg-surface px-3 py-2 mb-1 ${isLeft ? 'opacity-40 line-through' : ''} animate-bob`}
            >
              {/* Score pop-up for this player */}
              <ScorePop playerId={p.id} scoreEvents={scoreEvents} />

              <Avatar avatar={p.avatar} nickname={p.nickname} size="sm" />
              <span
                aria-label={online ? 'online' : 'offline'}
                className={`h-2.5 w-2.5 shrink-0 rounded-full border-2 border-border ${online ? 'bg-success' : 'bg-muted-foreground opacity-40'}`}
              />
              {isHost && <span title="Host" aria-label="Host">👑</span>}
              <span className="truncate font-bold font-mono text-lg">{p.nickname}</span>
              {isMe && (
                <span className="rounded-full border-2 border-border bg-surface-muted px-2 py-0.5 text-xs font-bold text-muted-foreground uppercase">
                  you
                </span>
              )}
              {/* Streak badge */}
              {(p.streak ?? 0) >= 2 && (
                <span title={`${p.streak} streak`} className="text-sm">🔥</span>
              )}
              <span className="ml-auto text-xl font-display text-primary">{p.score}</span>
              {/* Kick button (host only, not self, not already left) */}
              {onKick && !isMe && !isLeft && (
                <button
                  type="button"
                  onClick={() => onKick(p.id)}
                  className="ml-1 rounded-lg border border-red-300 px-2 py-0.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-50 active:scale-95"
                  aria-label={`Kick ${p.nickname}`}
                >
                  Kick
                </button>
              )}
            </motion.li>
          );
        })}
      </ul>
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-2 px-2 font-mono">
          <button
            disabled={page === 0}
            onClick={() => setPage(p => Math.max(0, p - 1))}
            className="rounded-lg border-2 border-border px-3 py-1 font-bold shadow-[2px_2px_0_0_var(--color-border)] transition-transform active:scale-95 disabled:opacity-50"
          >
            Prev
          </button>
          <span className="font-bold">Page {page + 1} of {totalPages}</span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            className="rounded-lg border-2 border-border px-3 py-1 font-bold shadow-[2px_2px_0_0_var(--color-border)] transition-transform active:scale-95 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
