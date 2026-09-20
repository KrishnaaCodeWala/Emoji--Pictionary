import type { Player } from '@/lib/types';

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
          <li
            key={p.id}
            className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
          >
            <span
              aria-label={online ? 'online' : 'offline'}
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${online ? 'bg-[var(--success)]' : 'bg-[var(--muted-foreground)] opacity-40'}`}
            />
            {isHost && <span title="Host" aria-label="Host">👑</span>}
            <span className="truncate font-medium">{p.nickname}</span>
            {isMe && (
              <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-xs text-[var(--muted-foreground)]">
                you
              </span>
            )}
            <span className="ml-auto text-sm font-semibold text-[var(--primary)]">{p.score}</span>
          </li>
        );
      })}
    </ul>
  );
}
