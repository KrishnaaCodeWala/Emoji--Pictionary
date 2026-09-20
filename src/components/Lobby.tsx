'use client';
import type { GameMode, Player, RoomPublic, RoomSettings } from '@/lib/types';
import { MIN_PLAYERS, RELAY_MIN_PLAYERS_HINT } from '@/lib/constants';
import RoomCodeBadge from './RoomCodeBadge';
import PlayerList from './PlayerList';
import ModePicker from './ModePicker';

export interface LobbyProps {
  room: RoomPublic; players: Player[]; me: Player | null; isHost: boolean;
  onlineIds: Set<string>; onStart: () => void; starting?: boolean; error?: string | null;
  /** v2: host changes mode/settings (Track D renders ModePicker). */
  onSetMode?: (mode: GameMode, settings: RoomSettings) => void;
}

export default function Lobby({ room, players, me, isHost, onlineIds, onStart, starting, error, onSetMode }: LobbyProps) {
  const canStart = players.length >= MIN_PLAYERS;
  const mode = room.mode ?? 'classic';
  const settings = room.settings ?? {};

  return (
    <div className="gutter mx-auto flex w-full max-w-md flex-col gap-6 py-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Lobby</h1>
        <p className="text-[var(--muted-foreground)]">Share the code and wait for everyone to join.</p>
      </div>

      <RoomCodeBadge code={room.room_code} />

      <ModePicker
        mode={mode}
        settings={settings}
        editable={isHost && !!onSetMode}
        onChange={(nextMode, nextSettings) => onSetMode?.(nextMode, nextSettings)}
      />

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          Players ({players.length})
        </h2>
        <PlayerList players={players} onlineIds={onlineIds} hostId={room.host_player_id} meId={me?.id ?? null} />
        {mode === 'relay' && players.length < RELAY_MIN_PLAYERS_HINT && (
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">Relay is best with 3+ players</p>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}

      {isHost ? (
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={onStart}
            disabled={!canStart || !!starting}
            className="w-full rounded-full bg-[var(--primary)] px-4 py-3 font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)] disabled:opacity-50"
          >
            {starting ? 'Starting…' : 'Start game'}
          </button>
          {!canStart && (
            <p className="text-sm text-[var(--muted-foreground)]">Need at least 2 players</p>
          )}
        </div>
      ) : (
        <p className="text-center text-sm text-[var(--muted-foreground)]">Waiting for host to start</p>
      )}
    </div>
  );
}
