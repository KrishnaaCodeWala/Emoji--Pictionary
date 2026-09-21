import { useState, useEffect } from 'react';
import type { GameMode, PromptKind, RoomSettings } from '@/lib/types';
import { ALL_PROMPT_KINDS, RELAY_TIMER_PRESETS, ROUNDS_PER_PLAYER, PACKS } from '@/lib/constants';

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
  const difficulty = settings.difficulty ?? 'normal';
  const packs = settings.packs ?? [];
  const customWordsArray = settings.customWords ?? [];

  const [customWordsText, setCustomWordsText] = useState(customWordsArray.join('\n'));

  // Sync incoming customWords if they change externally (e.g. initial load)
  useEffect(() => {
    setCustomWordsText((settings.customWords ?? []).join('\n'));
  }, [settings.customWords]);

  function getCommonSettings() {
    return { rounds, input: settings.input };
  }

  function selectMode(next: GameMode) {
    if (!editable) return;
    if (next === 'classic') {
      onChange('classic', { ...getCommonSettings(), packs, customWords: customWordsArray });
    } else if (next === 'relay') {
      onChange('relay', { relayTimers: RELAY_TIMER_PRESETS[relayPreset], input: settings.input });
    } else {
      onChange('charades', { ...getCommonSettings(), kinds, difficulty });
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
    onChange('charades', { ...getCommonSettings(), kinds: nextKinds, difficulty });
  }

  function selectDifficulty(diff: 'easy' | 'normal' | 'hard') {
    if (!editable) return;
    onChange('charades', { ...getCommonSettings(), kinds, difficulty: diff });
  }

  function togglePack(packId: string) {
    if (!editable) return;
    const has = packs.includes(packId);
    const nextPacks = has ? packs.filter((p) => p !== packId) : [...packs, packId];
    onChange('classic', { ...getCommonSettings(), packs: nextPacks, customWords: customWordsArray });
  }

  function handleCustomWordsBlur() {
    if (!editable) return;
    const words = Array.from(new Set(customWordsText.split('\n').map((w) => w.trim()).filter((w) => w.length > 0 && w.length <= 40)));
    // If it's between 1 and 2, it's invalid, we won't push it. But if it's 0 or >=3, it's valid.
    if (words.length > 0 && words.length < 3) {
      // Don't update DB, maybe show error locally if we had error state, but let's just ignore.
      return;
    }
    const finalWords = words.slice(0, 60);
    onChange('classic', { ...getCommonSettings(), packs, customWords: finalWords });
  }

  function selectRounds(next: number) {
    if (!editable) return;
    if (mode === 'classic') {
      onChange('classic', { ...getCommonSettings(), rounds: next, packs, customWords: customWordsArray });
    } else {
      onChange('charades', { ...getCommonSettings(), kinds, rounds: next, difficulty });
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
        <div className="flex flex-col gap-3">
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

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-[var(--muted-foreground)]">Difficulty</span>
            <div className="flex gap-1">
              {(['easy', 'normal', 'hard'] as const).map((diff) => (
                <button
                  key={diff}
                  type="button"
                  disabled={!editable}
                  onClick={() => selectDifficulty(diff)}
                  aria-pressed={difficulty === diff}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed capitalize ${
                    difficulty === diff
                      ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)]'
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {mode === 'classic' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-[var(--muted-foreground)]">Word Packs</span>
            <div className="flex flex-wrap gap-2">
              {PACKS.map((pack) => {
                const on = packs.includes(pack.id);
                return (
                  <button
                    key={pack.id}
                    type="button"
                    disabled={!editable}
                    onClick={() => togglePack(pack.id)}
                    aria-pressed={on}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed ${
                      on
                        ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                        : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)]'
                    }`}
                  >
                    {pack.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-end">
              <label htmlFor="customWords" className="text-sm text-[var(--muted-foreground)]">Custom Words (one per line)</label>
              <span className="text-xs text-muted-foreground">
                {customWordsText.split('\n').filter(w => w.trim().length > 0).length} / 60
              </span>
            </div>
            <textarea
              id="customWords"
              disabled={!editable}
              value={customWordsText}
              onChange={(e) => setCustomWordsText(e.target.value)}
              onBlur={handleCustomWordsBlur}
              placeholder="e.g. Apple&#10;Banana&#10;Orange"
              className="w-full min-h-[100px] resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
            {customWordsText.split('\n').filter(w => w.trim().length > 0).length > 0 && customWordsText.split('\n').filter(w => w.trim().length > 0).length < 3 && (
              <p className="text-xs text-red-500">Need at least 3 words to use custom words.</p>
            )}
          </div>
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
