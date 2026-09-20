'use client';
// Dev page rendering Lobby/Game/Results with fake props. Deleted in Stage 2.
import type { Message, Player, RoomPublic } from '@/lib/types';
import Lobby from '@/components/Lobby';
import Game from '@/components/Game';
import Results from '@/components/Results';

const players: Player[] = [
  { id: 'p1', room_id: 'r1', nickname: 'Astra', score: 20, turn_order: 0, joined_at: new Date().toISOString() },
  { id: 'p2', room_id: 'r1', nickname: 'Boop', score: 15, turn_order: 1, joined_at: new Date().toISOString() },
  { id: 'p3', room_id: 'r1', nickname: 'Cosmo', score: 15, turn_order: 2, joined_at: new Date().toISOString() },
  { id: 'p4', room_id: 'r1', nickname: 'Dizzy', score: 0, turn_order: 3, joined_at: new Date().toISOString() },
];

const lobbyRoom: RoomPublic = {
  id: 'r1',
  room_code: 'WXYZ',
  status: 'lobby',
  host_player_id: 'p1',
  current_drawer_id: null,
  round_number: 0,
  round_end_time: null,
  created_at: new Date().toISOString(),
};

const playingRoom: RoomPublic = {
  ...lobbyRoom,
  status: 'playing',
  current_drawer_id: 'p1',
  round_number: 2,
  round_end_time: new Date(Date.now() + 45_000).toISOString(),
};

const messages: Message[] = [
  { id: 'm1', room_id: 'r1', player_id: null, content: 'Round 2 — Astra is drawing', type: 'system', created_at: new Date().toISOString() },
  { id: 'm2', room_id: 'r1', player_id: 'p2', content: 'pizza?', type: 'guess', created_at: new Date().toISOString() },
  { id: 'm3', room_id: 'r1', player_id: 'p3', content: 'rainbow?', type: 'guess', created_at: new Date().toISOString() },
];

const onlineIds = new Set(['p1', 'p2', 'p3']);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="gutter border-b border-[var(--border)] py-8">
      <h2 className="mx-auto mb-4 max-w-xl text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function DevScreens() {
  return (
    <div className="flex flex-1 flex-col">
      <Section title="Lobby — host">
        <Lobby
          room={lobbyRoom}
          players={players}
          me={players[0]}
          isHost
          onlineIds={onlineIds}
          onStart={() => {}}
        />
      </Section>

      <Section title="Lobby — non-host, error state">
        <Lobby
          room={lobbyRoom}
          players={players.slice(0, 1)}
          me={players[1]}
          isHost={false}
          onlineIds={onlineIds}
          onStart={() => {}}
          error="Room is full"
        />
      </Section>

      <Section title="Game — drawer view">
        <Game
          room={playingRoom}
          players={players}
          me={players[0]}
          isDrawer
          canvas={'🍕🍕🌈'}
          messages={messages}
          word="pizza"
          onDraw={() => {}}
          onGuess={() => {}}
          onExpire={() => {}}
        />
      </Section>

      <Section title="Game — guesser view">
        <Game
          room={playingRoom}
          players={players}
          me={players[1]}
          isDrawer={false}
          canvas={'🍕🍕🌈'}
          messages={messages}
          word={null}
          onDraw={() => {}}
          onGuess={() => {}}
          onExpire={() => {}}
        />
      </Section>

      <Section title="Results">
        <Results players={players} isHost onPlayAgain={() => {}} />
      </Section>
    </div>
  );
}
