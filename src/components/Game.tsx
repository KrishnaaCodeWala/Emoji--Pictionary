'use client';
import type { HintKey, Message, Player, Prompt, PublicHints, RevealPayload, RoomPublic } from '@/lib/types';
import type { UseRelayResult } from '@/hooks/useRelay';
import { ROUNDS_PER_PLAYER } from '@/lib/constants';
import Scoreboard from './Scoreboard';
import Timer from '../components/Timer';
import EmojiPicker from '../components/EmojiPicker';
import EmojiCanvas from '../components/EmojiCanvas';
import Chat from '../components/Chat';
import GuessInput from '../components/GuessInput';
import ActorPanel from './charades/ActorPanel';
import GuesserPanel from './charades/GuesserPanel';
import RevealCard from './charades/RevealCard';

export interface GameProps {
  room: RoomPublic; players: Player[]; me: Player | null; isDrawer: boolean;
  canvas: string; messages: Message[];
  /** Secret word; only provided when isDrawer. */
  word: string | null;
  onDraw: (emojis: string) => void;
  onGuess: (guess: string) => void;
  onExpire: () => void;
  // ---- v2 (charades); all optional so classic callers are unchanged ----
  /** Actor's prompt (charades, isDrawer only). */
  prompt?: Prompt | null;
  hints?: PublicHints | null;
  reveal?: RevealPayload | null;
  /** Toggles each time the guesser's last guess was a near miss. */
  closeFlash?: number;
  onRevealHint?: (hint: HintKey) => void;
  // ---- v3 (relay) ----
  relay?: UseRelayResult;
  /** relay: timer expiry handler (calls /api/relay/advance) */
  onRelayExpire?: () => void;
}

const noop = () => {};

export default function Game({
  room, players, me, isDrawer, canvas, messages, word, onDraw, onGuess, onExpire,
  prompt, hints, reveal, closeFlash, onRevealHint,
}: GameProps) {
  const drawer = players.find((p) => p.id === room.current_drawer_id) ?? null;
  const totalRounds = players.length * (room.settings?.rounds ?? ROUNDS_PER_PLAYER);

  if (room.mode === 'charades') {
    return (
      <div className="gutter mx-auto flex w-full max-w-3xl flex-col gap-4 py-6 pb-28 md:pb-6">
        <RevealCard reveal={reveal ?? null} />

        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold">
            Round {room.round_number} of {totalRounds}
          </h1>
          <Timer endsAt={room.round_end_time} onExpire={onExpire} />
        </div>

        <Scoreboard players={players} currentDrawerId={room.current_drawer_id} meId={me?.id ?? null} />

        {isDrawer ? (
          <ActorPanel
            prompt={prompt ?? null}
            canvas={canvas}
            revealed={room.revealed_hints ?? []}
            onDraw={onDraw}
            onRevealHint={onRevealHint ?? noop}
          />
        ) : (
          <GuesserPanel
            canvas={canvas}
            hints={hints ?? null}
            messages={messages}
            players={players}
            actorNickname={drawer?.nickname ?? null}
            onGuess={onGuess}
            closeFlash={closeFlash ?? 0}
          />
        )}
      </div>
    );
  }

  return (
    <div className="gutter mx-auto flex w-full max-w-3xl flex-col gap-4 py-6 pb-28 md:pb-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold">
          Round {room.round_number} of {totalRounds}
        </h1>
        <Timer endsAt={room.round_end_time} onExpire={onExpire} />
      </div>

      <Scoreboard players={players} currentDrawerId={room.current_drawer_id} meId={me?.id ?? null} />

      {isDrawer ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-[var(--primary)] bg-[var(--primary)]/10 px-4 py-3 text-center">
              <p className="text-sm text-[var(--muted-foreground)]">Draw:</p>
              <p className="text-2xl font-bold text-[var(--primary)]">{word ?? '…'}</p>
            </div>
            <EmojiCanvas emojis={canvas} />
          </div>
          <div className="flex flex-col gap-3">
            <EmojiPicker value={canvas} onChange={onDraw} />
            <Chat messages={messages} players={players} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
          <div className="flex flex-col gap-3">
            <p className="text-center text-[var(--muted-foreground)]">
              {drawer ? `${drawer.nickname} is drawing` : 'Waiting for the drawer…'}
            </p>
            <EmojiCanvas emojis={canvas} />
          </div>
          <div className="flex flex-col gap-3">
            <Chat messages={messages} players={players} />
            <div className="sticky bottom-0 z-10 -mx-4 bg-[var(--background)]/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/75 md:static md:mx-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
              <GuessInput onSubmit={onGuess} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
