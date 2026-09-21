// v5 Wave 1 Track C: Web Audio oscillator-based sound engine. No audio files.
// All sounds are synthesised from oscillators — works in any modern browser.
// Unlock on first user gesture (autoplay policy).

const SOUND_KEY = 'ep:sound';
const HAPTICS_KEY = 'ep:haptics';

let _ctx: AudioContext | null = null;
let _unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_ctx) {
    try {
      _ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return _ctx;
}

/** Call on first user gesture so Safari / Chrome autoplay policy allows sound. */
export function unlockAudio(): void {
  if (_unlocked) return;
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  // Play a silent buffer
  const buf = ctx.createBuffer(1, 1, 22050);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start(0);
  _unlocked = true;
}

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const v = window.localStorage.getItem(SOUND_KEY);
    return v === null ? true : v === '1'; // default ON
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SOUND_KEY, on ? '1' : '0');
  } catch { /* ignore */ }
}

export function isHapticsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const v = window.localStorage.getItem(HAPTICS_KEY);
    // Default: ON for touch devices
    const defaultOn = 'ontouchstart' in window;
    return v === null ? defaultOn : v === '1';
  } catch {
    return false;
  }
}

export function setHapticsEnabled(on: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HAPTICS_KEY, on ? '1' : '0');
  } catch { /* ignore */ }
}

function vibrate(pattern: number | number[]): void {
  if (!isHapticsEnabled()) return;
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch { /* ignore */ }
  }
}

// ---- Low-level helpers ----

interface OscOptions {
  type?: OscillatorType;
  freq: number;
  duration: number;
  gain?: number;
  /** Attack in seconds (default 0.005). */
  attack?: number;
  /** Release start as fraction of duration (default 0.6). */
  releaseFraction?: number;
}

function playOsc(opts: OscOptions): void {
  const ctx = getCtx();
  if (!ctx) return;
  const { type = 'sine', freq, duration, gain = 0.3, attack = 0.005, releaseFraction = 0.6 } = opts;
  const now = ctx.currentTime;
  const gainNode = ctx.createGain();
  gainNode.connect(ctx.destination);
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(gain, now + attack);
  gainNode.gain.setValueAtTime(gain, now + duration * releaseFraction);
  gainNode.gain.linearRampToValueAtTime(0, now + duration);

  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  osc.connect(gainNode);
  osc.start(now);
  osc.stop(now + duration);
}

function playTone(freq: number, duration: number, gain = 0.25, type: OscillatorType = 'sine') {
  playOsc({ freq, duration, gain, type });
}

// ---- Named sounds ----

/** Ticking sound for the last 10 seconds of a round. */
export function playTick(): void {
  if (!isSoundEnabled()) return;
  playTone(880, 0.06, 0.18, 'square');
}

/** Correct guess chime — upward major triad. */
export function playCorrect(): void {
  if (!isSoundEnabled()) return;
  [523, 659, 784].forEach((freq, i) => {
    const ctx = getCtx();
    if (!ctx) return;
    setTimeout(() => playTone(freq, 0.2, 0.25, 'sine'), i * 80);
  });
  vibrate([30, 20, 30]);
}

/** Wrong guess blip — low descending. Private to guesser. */
export function playWrong(): void {
  if (!isSoundEnabled()) return;
  playTone(220, 0.12, 0.2, 'sawtooth');
}

/** Reveal sting — short dramatic fanfare. */
export function playReveal(): void {
  if (!isSoundEnabled()) return;
  const notes = [392, 440, 523, 659];
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.18, 0.28, 'triangle'), i * 70);
  });
}

/** Clapper snap — short percussive noise (relay album flip). */
export function playClapper(): void {
  if (!isSoundEnabled()) return;
  playTone(1200, 0.04, 0.22, 'square');
  setTimeout(() => playTone(900, 0.05, 0.15, 'square'), 40);
}

/** "Your turn" ping — relay drawer notification. */
export function playYourTurn(): void {
  if (!isSoundEnabled()) return;
  [880, 1100].forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.15, 0.22, 'sine'), i * 120);
  });
  vibrate([40, 30, 80]);
}

/** Time-up haptic — long buzz. */
export function hapticTimeUp(): void {
  vibrate(200);
}

/** Results fanfare — ascending arpeggio. */
export function playFanfare(): void {
  if (!isSoundEnabled()) return;
  const notes = [262, 330, 392, 523, 659, 784];
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.22, 0.28, 'triangle'), i * 90);
  });
  vibrate([50, 30, 50, 30, 100]);
}
