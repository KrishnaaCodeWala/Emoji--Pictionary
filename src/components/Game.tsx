'use client';
import type { Message, Player, RoomPublic } from '@/lib/types';
import Scoreboard from './Scoreboard';
import Timer from '../components/Timer';
import EmojiPicker from '../components/EmojiPicker';
import EmojiCanvas from '../components/EmojiCanvas';
import Chat from '../components/Chat';
import GuessInput from '../components/GuessInput';

export interface GameProps {
  room: RoomPublic; players: Player[]; me: Player | null; isDrawer: boolean;
  canvas: string; messages: Message[];
  /** Secret word; only provided when isDrawer. */
  word: string | null;
  onDraw: (emojis: string) => void;
  onGuess: (guess: string) => void;
  onExpire: () => void;
}

export default function Game({
  room, players, me, isDrawer, canvas, messages, word, onDraw, onGuess, onExpire,
}: GameProps) {
  const drawer = players.find((p) => p.id === room.current_drawer_id) ?? null;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold">Round {room.round_number}</h1>
        <Timer endsAt={room.round_end_time} onExpire={onExpire} />
      </div>

      <Scoreboard players={players} currentDrawerId={room.current_drawer_id} meId={me?.id ?? null} />

      {isDrawer ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-[var(--primary)] bg-[var(--primary)]/10 px-4 py-3 text-center">
            <p className="text-sm text-[var(--muted-foreground)]">Draw:</p>
            <p className="text-2xl font-bold text-[var(--primary)]">{word ?? '…'}</p>
          </div>
          <EmojiPicker value={canvas} onChange={onDraw} />
          <EmojiCanvas emojis={canvas} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-center text-[var(--muted-foreground)]">
            {drawer ? `${drawer.nickname} is drawing` : 'Waiting for the drawer…'}
          </p>
          <EmojiCanvas emojis={canvas} />
          <Chat messages={messages} players={players} />
          <GuessInput onSubmit={onGuess} />
        </div>
      )}
    </div>
  );
}
