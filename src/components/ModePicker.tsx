'use client';
import type { GameMode, PromptKind, RoomSettings } from '@/lib/types';
import { ALL_PROMPT_KINDS, RELAY_TIMER_PRESETS, ROUNDS_PER_PLAYER } from '@/lib/constants';

type RelayPreset = keyof typeof RELAY_TIMER_PRESETS;

const RELAY_PRESET_LABELS: Record<RelayPreset, string> = {
  quick: 'Quick',
  normal: 'Normal',
  relaxed: 'Relaxed',
};

const RELAY_PRESET_ORDER: RelayPreset[] = ['quick', 'normal', 'relaxed'];

function matchRelayPreset(timers: RoomSettings['relayTimers']): RelayPreset {
  const entry = RELAY_PRESET_ORDER.find((key) => {
    const preset = RELAY_TIMER_PRESETS[key];
    return (
      timers?.write === preset.write && timers?.draw === preset.draw && timers?.guess === preset.guess
    );
  });
  return entry ?? 'normal';
}

export interface ModePickerProps {
  mode: GameMode;
  settings: RoomSettings;
  /** false => read-only summary for non-hosts */
  editable: boolean;
  onChange: (mode: GameMode, settings: RoomSettings) => void;
}

const KIND_LABELS: Record<PromptKind, string> = {
  movie: 'Movies',
  series: 'Series',
  game: 'Games',
};

const ROUND_OPTIONS = [1, 2, 3, 4, 5];

export default function ModePicker({ mode, settings, editable, onChange }: ModePickerProps) {
  const rounds = settings.rounds ?? ROUNDS_PER_PLAYER;
  const kinds = settings.kinds ?? [...ALL_PROMPT_KINDS];
  const relayPreset = matchRelayPreset(settings.relayTimers);

  function selectMode(next: GameMode) {
    if (!editable) return;
    if (next === 'classic') {
      onChange('classic', { rounds, input: settings.input });
    } else if (next === 'relay') {
      onChange('relay', { relayTimers: RELAY_TIMER_PRESETS[relayPreset], input: settings.input });
    } else {
      onChange('charades', { kinds, rounds, input: settings.input });
    }
  }

  function selectRelayPreset(preset: RelayPreset) {
    if (!editable) return;
    onChange('relay', { relayTimers: RELAY_TIMER_PRESETS[preset], input: settings.input });
  }

  function toggleKind(kind: PromptKind) {
    if (!editable) return;
    const has = kinds.includes(kind);
    if (has && kinds.length <= 1) return; // at least one must stay on
    const nextKinds = has ? kinds.filter((k) => k !== kind) : [...kinds, kind];
    onChange('charades', { kinds: nextKinds, rounds, input: settings.input });
  }

  function selectRounds(next: number) {
    if (!editable) return;
    if (mode === 'classic') {
      onChange('classic', { rounds: next, input: settings.input });
    } else {
      onChange('charades', { kinds, rounds: next, input: settings.input });
    }
  }

  const cardBase =
    'flex-1 rounded-xl border-4 px-4 py-3 text-left transition-all disabled:cursor-not-allowed';
  const cardOn = 'border-primary bg-primary/10 shadow-[2px_2px_0_0_var(--color-primary)] translate-x-[2px] translate-y-[2px]';
  const cardOff = 'border-border bg-surface shadow-[6px_6px_0_0_var(--color-border)] hover:bg-surface-muted';

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground font-mono">
        Game mode
      </h2>

      {!editable && (
        <p className="text-sm text-[var(--muted-foreground)]">Host chooses the mode</p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={!editable}
          onClick={() => selectMode('classic')}
          aria-pressed={mode === 'classic'}
          className={`${cardBase} ${mode === 'classic' ? cardOn : cardOff}`}
        >
          <p className="font-bold font-display tracking-wide text-lg text-primary">Classic</p>
          <p className="text-xs font-mono text-muted-foreground leading-tight mt-1">Draw with emojis, guess words.</p>
        </button>
        <button
          type="button"
          disabled={!editable}
          onClick={() => selectMode('charades')}
          aria-pressed={mode === 'charades'}
          className={`${cardBase} ${mode === 'charades' ? cardOn : cardOff}`}
        >
          <p className="font-bold font-display tracking-wide text-lg text-primary">Charades</p>
          <p className="text-xs font-mono text-muted-foreground leading-tight mt-1">Movies, series, and games.</p>
        </button>
        <button
          type="button"
          disabled={!editable}
          onClick={() => selectMode('relay')}
          aria-pressed={mode === 'relay'}
          className={`${cardBase} ${mode === 'relay' ? cardOn : cardOff}`}
        >
          <p className="font-bold font-display tracking-wide text-lg text-primary">Relay</p>
          <p className="text-xs font-mono text-muted-foreground leading-tight mt-1">Pass canvas, guess chain.</p>
        </button>
      </div>

      {mode === 'relay' && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-[var(--muted-foreground)]">Timer</span>
          <div className="flex gap-1">
            {RELAY_PRESET_ORDER.map((preset) => (
              <button
                key={preset}
                type="button"
                disabled={!editable}
                onClick={() => selectRelayPreset(preset)}
                aria-pressed={relayPreset === preset}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed ${
                  relayPreset === preset
                    ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)]'
                }`}
              >
                {RELAY_PRESET_LABELS[preset]}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === 'charades' && (
        <div className="flex flex-wrap gap-2">
          {ALL_PROMPT_KINDS.map((kind) => {
            const on = kinds.includes(kind);
            return (
              <button
                key={kind}
                type="button"
                disabled={!editable}
                onClick={() => toggleKind(kind)}
                aria-pressed={on}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed ${
                  on
                    ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)]'
                }`}
              >
                {KIND_LABELS[kind]}
              </button>
            );
          })}
        </div>
      )}

      {mode !== 'relay' && (
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[var(--muted-foreground)]">Rounds per player</span>
        <div className="flex gap-1">
          {ROUND_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              disabled={!editable}
              onClick={() => selectRounds(n)}
              aria-pressed={rounds === n}
              className={`h-8 w-8 rounded-full border text-sm font-semibold transition disabled:cursor-not-allowed ${
                rounds === n
                  ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)]'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}
