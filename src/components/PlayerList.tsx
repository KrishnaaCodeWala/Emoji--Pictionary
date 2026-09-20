import type { Player } from '@/lib/types';
import { motion } from 'framer-motion';

export interface PlayerListProps { players: Player[]; onlineIds: Set<string>; hostId?: string | null; meId?: string | null }

export default function PlayerList({ players, onlineIds, hostId, meId }: PlayerListProps) {
  const sorted = [...players].sort((a, b) => a.turn_order - b.turn_order);
  return (
    <ul className="flex flex-col gap-2">
      {sorted.map((p) => {
        const online = onlineIds.has(p.id);
        const isHost = hostId != null && p.id === hostId;
        const isMe = meId != null && p.id === meId;
        return (
          <motion.li
            whileHover={{ scale: 1.02 }}
            key={p.id}
            className="flex items-center gap-2 rounded-xl border-4 border-border shadow-[4px_4px_0_0_var(--color-border)] bg-surface px-3 py-2 mb-1"
          >
            <span
              aria-label={online ? 'online' : 'offline'}
              className={`h-3 w-3 shrink-0 rounded-full border-2 border-border ${online ? 'bg-success' : 'bg-muted-foreground opacity-40'}`}
            />
            {isHost && <span title="Host" aria-label="Host">👑</span>}
            <span className="truncate font-bold font-mono text-lg">{p.nickname}</span>
            {isMe && (
              <span className="rounded-full border-2 border-border bg-surface-muted px-2 py-0.5 text-xs font-bold text-muted-foreground uppercase">
                you
              </span>
            )}
            <span className="ml-auto text-xl font-display text-primary">{p.score}</span>
          </motion.li>
        );
      })}
    </ul>
  );
}
