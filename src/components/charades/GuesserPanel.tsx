'use client';

import { useEffect, useRef, useState } from 'react';
import type { Message, Player, PublicHints } from '@/lib/types';
import EmojiCanvas from '@/components/EmojiCanvas';
import Chat from '@/components/Chat';
import GuessInput from '@/components/GuessInput';
import HintBar from './HintBar';

export interface GuesserPanelProps {
  canvas: string;
  hints: PublicHints | null;
  messages: Message[];
  players: Player[];
  actorNickname: string | null;
  onGuess: (guess: string) => void;
  /** increments on each near miss; show a brief "Close!" flash */
  closeFlash: number;
}

export default function GuesserPanel({
  canvas,
  hints,
  messages,
  players,
  actorNickname,
  onGuess,
  closeFlash,
}: GuesserPanelProps) {
  const [showFlash, setShowFlash] = useState(false);
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (closeFlash <= 0) return;
    if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    showTimeoutRef.current = setTimeout(() => {
      setShowFlash(true);
      hideTimeoutRef.current = setTimeout(() => {
        setShowFlash(false);
      }, 1500);
    }, 0);
    return () => {
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [closeFlash]);

  return (
    <div className="relative flex flex-col gap-3">
      {showFlash && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center">
          <div className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg">
            So close!
          </div>
        </div>
      )}

      <p className="text-center text-muted-foreground">
        {actorNickname ? `${actorNickname} is acting` : 'Waiting for the actor…'}
      </p>

      <HintBar hints={hints} />
      <EmojiCanvas emojis={canvas} />
      <Chat messages={messages} players={players} />

      <div className="sticky bottom-0 z-10 -mx-4 bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:static md:mx-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
        <GuessInput onSubmit={onGuess} />
      </div>
    </div>
  );
}
