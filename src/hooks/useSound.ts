'use client';
// v5 Wave 1 Track C: useSound hook — wraps lib/sound.ts, re-renders on pref changes.
import { useCallback, useEffect, useState } from 'react';
import {
  isSoundEnabled, setSoundEnabled,
  isHapticsEnabled, setHapticsEnabled,
  unlockAudio,
} from '@/lib/sound';

export interface UseSoundResult {
  soundOn: boolean;
  hapticsOn: boolean;
  toggleSound: () => void;
  toggleHaptics: () => void;
}

export function useSound(): UseSoundResult {
  const [soundOn, setSoundOn] = useState(false);
  const [hapticsOn, setHapticsOn] = useState(false);

  useEffect(() => {
    setSoundOn(isSoundEnabled());
    setHapticsOn(isHapticsEnabled());
  }, []);

  const toggleSound = useCallback(() => {
    const next = !soundOn;
    setSoundEnabled(next);
    setSoundOn(next);
    unlockAudio();
  }, [soundOn]);

  const toggleHaptics = useCallback(() => {
    const next = !hapticsOn;
    setHapticsEnabled(next);
    setHapticsOn(next);
  }, [hapticsOn]);

  return { soundOn, hapticsOn, toggleSound, toggleHaptics };
}
