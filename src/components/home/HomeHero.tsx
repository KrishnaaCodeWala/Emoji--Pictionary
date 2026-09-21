'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { GameMode } from '@/lib/types';
import { HOME_CYCLE_MS, MAX_NICKNAME_LENGTH, ROOM_CODE_LENGTH, AVATARS } from '@/lib/constants';
import { getNickname, getAvatar, setAvatar as storeAvatar } from '@/lib/player';
import { THEME_FOR_MODE } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import AvatarPicker from '@/components/AvatarPicker';
import ThemeShowcase from './ThemeShowcase';

export interface HomeHeroProps {
  /** called with the mode of the panel that was visible when the user created a room */
  onCreate: (nickname: string, mode: GameMode, avatar: string) => void;
  onJoin: (nickname: string, code: string, avatar: string, spectate: boolean) => void;
  onRejoin: (nickname: string, code: string) => void;
  initialJoinCode?: string;
  pending?: 'create' | 'join' | null;
  error?: string | null;
}

const MODES: GameMode[] = ['classic', 'charades', 'relay'];
const MODE_LABEL: Record<GameMode, string> = { classic: 'Classic', charades: 'Charades', relay: 'Relay' };

const panelVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir >= 0 ? 48 : -48 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir >= 0 ? -48 : 48 }),
};

export default function HomeHero({ onCreate, onJoin, onRejoin, initialJoinCode, pending, error }: HomeHeroProps) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [paused, setPaused] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [nickname, setNicknameInput] = useState(() => getNickname());
  const [roomCode, setRoomCode] = useState(() => (initialJoinCode ?? '').toUpperCase());
  const [avatar, setAvatarState] = useState<string>(() => getAvatar() ?? AVATARS[Math.floor(Math.random() * AVATARS.length)]);
  const [spectate, setSpectate] = useState(false);
  const reducedMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement | null>(null);

  const activeMode = MODES[index];
  const theme = THEME_FOR_MODE[activeMode];

  function handleAvatarChange(next: string) {
    setAvatarState(next);
    storeAvatar(next);
  }

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setDirection(1);
      setIndex((i) => (i + 1) % MODES.length);
    }, HOME_CYCLE_MS);
    return () => clearInterval(id);
    // resetToken restarts the timer whenever the user navigates manually.
  }, [paused, resetToken]);

  function goTo(rawIndex: number) {
    const wrapped = ((rawIndex % MODES.length) + MODES.length) % MODES.length;
    setDirection(rawIndex >= index ? 1 : -1);
    setIndex(wrapped);
    setResetToken((t) => t + 1);
  }

  function handleBlur(e: React.FocusEvent<HTMLElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setPaused(false);
    }
  }

  const trimmedNickname = nickname.trim();
  const createDisabled = pending != null || trimmedNickname.length === 0;
  const joinDisabled = createDisabled || roomCode.trim().length !== ROOM_CODE_LENGTH;

  return (
    <section
      ref={sectionRef}
      data-theme={theme}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={handleBlur}
      className="relative flex flex-1 w-full flex-col min-h-0 overflow-hidden bg-background text-foreground transition-colors duration-500"
    >
      <div className="relative flex-1 flex flex-col justify-center min-h-[160px] md:min-h-[320px]">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={activeMode}
            custom={direction}
            variants={panelVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reducedMotion ? 0 : 0.45, ease: 'easeInOut' }}
            className="absolute inset-0"
          >
            <ThemeShowcase mode={activeMode} active />
          </motion.div>
        </AnimatePresence>

        <button
          type="button"
          aria-label="Previous look"
          onClick={() => goTo(index - 1)}
          className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border-2 border-border bg-surface/80 p-2 text-foreground shadow-[3px_3px_0_0_var(--color-border)] transition hover:bg-surface-muted sm:left-4"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Next look"
          onClick={() => goTo(index + 1)}
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border-2 border-border bg-surface/80 p-2 text-foreground shadow-[3px_3px_0_0_var(--color-border)] transition hover:bg-surface-muted sm:right-4"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-2">
          {MODES.map((m, i) => (
            <button
              key={m}
              type="button"
              aria-label={`Show ${MODE_LABEL[m]} look`}
              aria-current={i === index}
              onClick={() => goTo(i)}
              className={`h-2.5 w-2.5 rounded-full border border-border transition-all ${
                i === index ? 'w-6 bg-primary' : 'bg-surface-muted'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="gutter relative z-10 mx-auto w-full max-w-md pb-4 pt-2 sm:pb-12 flex flex-col shrink-0">
        <Card className="flex flex-col gap-2 sm:gap-3 shrink-0 p-3 sm:p-6 shadow-xl">
          <div className="text-center shrink-0">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Creating a room starts it in {MODE_LABEL[activeMode]}
            </p>
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            <label htmlFor="nickname" className="text-sm font-medium">
              Your nickname
            </label>
            <div className="flex items-center gap-3">
              <span className="text-2xl select-none" aria-label="Your avatar">{avatar}</span>
              <Input
                id="nickname"
                type="text"
                value={nickname}
                maxLength={MAX_NICKNAME_LENGTH}
                onChange={(e) => setNicknameInput(e.target.value)}
                placeholder="e.g. Pixel"
              />
            </div>
          </div>

          {/* v5: Avatar picker */}
          <AvatarPicker value={avatar} onChange={handleAvatarChange} />

          {error && (
            <p className="rounded-lg bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)] shrink-0" role="alert">
              {error}
            </p>
          )}

          <Button
            type="button"
            onClick={() => onCreate(trimmedNickname, activeMode, avatar)}
            disabled={createDisabled}
            className="w-full shrink-0"
          >
            {pending === 'create' ? 'Creating…' : 'Create room'}
          </Button>

          <div className="flex items-center gap-3 text-muted-foreground shrink-0">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wide">or join</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            <label htmlFor="roomCode" className="text-sm font-medium">
              Room code
            </label>
            <Input
              id="roomCode"
              type="text"
              value={roomCode}
              maxLength={ROOM_CODE_LENGTH}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="ABCD"
              className="text-center text-lg font-semibold tracking-[0.3em]"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <input 
              type="checkbox" 
              id="spectate" 
              checked={spectate} 
              onChange={(e) => setSpectate(e.target.checked)} 
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="spectate" className="text-sm text-muted-foreground">Join as spectator</label>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => onJoin(trimmedNickname, roomCode.trim().toUpperCase(), avatar, spectate)}
            disabled={joinDisabled}
            className="w-full shrink-0"
          >
            {pending === 'join' ? 'Joining…' : 'Join room'}
          </Button>

          {roomCode.trim().length === ROOM_CODE_LENGTH && trimmedNickname.length > 0 && (
            <button
              type="button"
              onClick={() => onRejoin(trimmedNickname, roomCode.trim().toUpperCase())}
              className="text-xs text-muted-foreground hover:text-primary transition underline decoration-dashed mt-2 shrink-0"
            >
              Were you just playing? Rejoin here.
            </button>
          )}
        </Card>
      </div>
    </section>
  );
}
