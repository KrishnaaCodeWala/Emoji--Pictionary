'use client';
import type { GameMode, Player, RoomPublic, RoomSettings } from '@/lib/types';
import { MIN_PLAYERS, RELAY_MIN_PLAYERS_HINT } from '@/lib/constants';
import RoomCodeBadge from './RoomCodeBadge';
import PlayerList from './PlayerList';
import ModePicker from './ModePicker';
import InputPicker from './InputPicker';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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
      <Card vintage={true} className="flex flex-col gap-6">
        <div className="text-center font-display">
          <h1 className="text-3xl font-bold tracking-widest text-primary">LOBBY</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Gather your crew.</p>
        </div>

      <RoomCodeBadge code={room.room_code} />

      <ModePicker
        mode={mode}
        settings={settings}
        editable={isHost && !!onSetMode}
        onChange={(nextMode, nextSettings) => onSetMode?.(nextMode, nextSettings)}
      />

      <InputPicker
        input={settings.input ?? 'emoji'}
        editable={isHost && !!onSetMode}
        onChange={(input) => onSetMode?.(mode, { ...settings, input })}
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
        <div className="flex flex-col items-center gap-2">
          <Button
            onClick={onStart}
            disabled={!canStart || !!starting}
            size="lg"
            className="w-full text-xl uppercase tracking-wider font-display"
          >
            {starting ? 'Starting…' : 'Start game'}
          </Button>
          {!canStart && (
            <p className="text-sm text-[var(--muted-foreground)]">Need at least 2 players</p>
          )}
        </div>
      ) : (
        <p className="text-center text-sm text-[var(--muted-foreground)] font-mono">Waiting for host to start...</p>
      )}
      </Card>
    </div>
  );
}
