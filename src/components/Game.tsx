'use client';
import { useState, type ReactNode } from 'react';
import type { HintKey, InputMode, Message, Player, Prompt, PublicHints, RevealPayload, RoomPublic, StrokeEvent } from '@/lib/types';
import type { UseRelayResult } from '@/hooks/useRelay';
import { ROUNDS_PER_PLAYER } from '@/lib/constants';
import { pickWord } from '@/lib/words';
import Scoreboard from './Scoreboard';
import Timer from '../components/Timer';
import EmojiPicker from '../components/EmojiPicker';
import EmojiCanvas from '../components/EmojiCanvas';
import DrawCanvas from '../components/canvas/DrawCanvas';
import CanvasView from '../components/canvas/CanvasView';
import Chat from '../components/Chat';
import GuessInput from '../components/GuessInput';
import ActorPanel from './charades/ActorPanel';
import GuesserPanel from './charades/GuesserPanel';
import RevealCard from './charades/RevealCard';
import WritePanel from './relay/WritePanel';
import DrawPanel from './relay/DrawPanel';
import GuessPanel from './relay/GuessPanel';
import WaitingPanel from './relay/WaitingPanel';
import AlbumViewer from './relay/AlbumViewer';
import ProgressPill from './relay/ProgressPill';
import { ModeTransition } from './transitions/ModeTransition';

/** "{word} at a wedding" style random writing prompts for the relay "Inspire me" button. */
const RELAY_INSPIRE_TEMPLATES = [
  '{word} at a wedding',
  'a {word} learning to dance',
  '{word} on the moon',
  'a {word} ordering coffee',
  '{word} stuck in traffic',
  'a {word} playing chess',
  'a {word} on a first date',
  '{word} in outer space',
];

function inspireRelayPhrase(): string {
  const word = pickWord();
  const template =
    RELAY_INSPIRE_TEMPLATES[Math.floor(Math.random() * RELAY_INSPIRE_TEMPLATES.length)] ??
    RELAY_INSPIRE_TEMPLATES[0];
  return template.replace('{word}', word);
}

const RELAY_PHASE_LABELS: Record<'write' | 'draw' | 'guess' | 'album', string> = {
  write: 'Write',
  draw: 'Draw',
  guess: 'Guess',
  album: 'Album',
};

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
  // ---- v4 (canvas input) ----
  inputMode?: InputMode;
  /** live strokes received this round (guessers) */
  strokes?: StrokeEvent[];
  /** drawer: broadcast a stroke batch */
  onStroke?: (s: StrokeEvent) => void;
}

const noop = () => {};

export default function Game({
  room, players, me, isDrawer, canvas, messages, word, onDraw, onGuess, onExpire,
  prompt, hints, reveal, closeFlash, onRevealHint, relay, onRelayExpire,
  inputMode, strokes, onStroke,
}: GameProps) {
  // Relay album: disable "Next" while a request is in flight so a double tap cannot skip a card.
  const [albumAdvancing, setAlbumAdvancing] = useState(false);
  const handleAlbumNext = () => {
    if (!relay || albumAdvancing) return;
    setAlbumAdvancing(true);
    relay.albumAdvance().finally(() => setAlbumAdvancing(false));
  };
  const drawer = players.find((p) => p.id === room.current_drawer_id) ?? null;
  const totalRounds = players.length * (room.settings?.rounds ?? ROUNDS_PER_PLAYER);

  if (room.mode === 'relay') {
    if (!relay) {
      return (
        <div className="gutter mx-auto flex w-full max-w-3xl items-center justify-center py-20 text-[var(--muted-foreground)]">
          Loading...
        </div>
      );
    }

    const isHost = !!me && me.id === room.host_player_id;
    const task = relay.task;
    const phase = task?.phase ?? 'write';

    let body: ReactNode;
    if (!task) {
      body = <p className="text-center text-[var(--muted-foreground)]">Loading...</p>;
    } else if (task.phase === 'write') {
      body = task.submitted ? (
        <WaitingPanel progress={relay.progress} phaseLabel="Write" />
      ) : (
        <WritePanel onSubmit={relay.submit} submitted={task.submitted} onInspire={inspireRelayPhrase} />
      );
    } else if (task.phase === 'draw') {
      body = task.submitted ? (
        <WaitingPanel progress={relay.progress} phaseLabel="Draw" />
      ) : (
        <DrawPanel
          inputMode={inputMode}
          playerId={me?.id}
          round={room.relay_step}
          onStroke={onStroke}
          phrase={task.input?.content ?? ''}
          onSubmit={relay.submit}
          submitted={task.submitted}
        />
      );
    } else if (task.phase === 'guess') {
      body = task.submitted ? (
        <WaitingPanel progress={relay.progress} phaseLabel="Guess" />
      ) : (
        <GuessPanel canvas={task.input?.content ?? ''} onSubmit={relay.submit} submitted={task.submitted} />
      );
    } else {
      body = <AlbumViewer album={relay.album} isHost={isHost} onNext={handleAlbumNext} advancing={albumAdvancing} />;
    }

    return (
      <ModeTransition mode="relay">
        <div className="gutter mx-auto flex w-full max-w-3xl flex-col gap-4 py-6 pb-28 md:pb-6">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg font-bold font-display tracking-wide">
              {phase === 'album' ? 'Album' : `Step ${room.relay_step + 1} of ${players.length} · ${RELAY_PHASE_LABELS[phase]}`}
            </h1>
            {phase !== 'album' && <Timer endsAt={room.round_end_time} onExpire={onRelayExpire ?? noop} />}
          </div>

          <ProgressPill progress={relay.progress} />

          {relay.error && (
            <p className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger" role="alert">
              {relay.error}
            </p>
          )}

          {body}
        </div>
      </ModeTransition>
    );
  }

  if (room.mode === 'charades') {
    return (
      <ModeTransition mode="charades">
        <div className="gutter mx-auto flex w-full max-w-3xl flex-col gap-4 py-6 pb-28 md:pb-6">
          <RevealCard reveal={reveal ?? null} />

          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg font-bold font-display tracking-wide">
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
              inputMode={inputMode}
              playerId={me?.id}
              round={room.round_number}
              onStroke={onStroke}
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
              inputMode={inputMode}
              strokes={strokes}
            />
          )}
        </div>
      </ModeTransition>
    );
  }

  return (
    <ModeTransition mode="classic">
      <div className="gutter mx-auto flex w-full max-w-3xl flex-col gap-4 py-6 pb-28 md:pb-6 theme-modern font-sans">
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
              <div className="rounded-xl border border-primary bg-primary/10 px-4 py-3 text-center shadow-sm">
                <p className="text-sm text-muted-foreground">Draw:</p>
                <p className="text-2xl font-bold text-primary">{word ?? '…'}</p>
              </div>
              {inputMode === 'canvas' ? (
                <DrawCanvas
                  value={canvas}
                  playerId={me?.id ?? ''}
                  round={room.round_number}
                  onStroke={onStroke}
                  onSnapshot={onDraw}
                />
              ) : (
                <EmojiCanvas emojis={canvas} />
              )}
            </div>
            <div className="flex flex-col gap-3">
              {inputMode !== 'canvas' && <EmojiPicker value={canvas} onChange={onDraw} />}
              <Chat messages={messages} players={players} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
            <div className="flex flex-col gap-3">
              <p className="text-center text-muted-foreground">
                {drawer ? `${drawer.nickname} is drawing` : 'Waiting for the drawer…'}
              </p>
              {inputMode === 'canvas' ? (
                <CanvasView value={canvas} strokes={strokes ?? []} />
              ) : (
                <EmojiCanvas emojis={canvas} />
              )}
            </div>
            <div className="flex flex-col gap-3">
              <Chat messages={messages} players={players} />
              <div className="sticky bottom-0 z-10 -mx-4 bg-background/95 px-4 py-2 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
                <GuessInput onSubmit={onGuess} />
              </div>
            </div>
          </div>
        )}
      </div>
    </ModeTransition>
  );
}
