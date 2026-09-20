// TODO (Track D)
import type { Player } from '@/lib/types';
export interface PlayerListProps { players: Player[]; onlineIds: Set<string>; hostId?: string | null; meId?: string | null }
export default function PlayerList(_p: PlayerListProps) { return null; }
