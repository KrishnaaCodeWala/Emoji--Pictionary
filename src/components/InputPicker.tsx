'use client';
import type { InputMode } from '@/lib/types';

export interface InputPickerProps {
  input: InputMode;
  /** false => read-only summary for non-hosts */
  editable: boolean;
  onChange: (input: InputMode) => void;
}

export default function InputPicker({ input, editable, onChange }: InputPickerProps) {
  function select(next: InputMode) {
    if (!editable) return;
    if (next === input) return;
    onChange(next);
  }

  const cardBase =
    'flex-1 rounded-xl border-4 px-4 py-3 text-left transition-all disabled:cursor-not-allowed';
  const cardOn = 'border-primary bg-primary/10 shadow-[2px_2px_0_0_var(--color-primary)] translate-x-[2px] translate-y-[2px]';
  const cardOff = 'border-border bg-surface shadow-[6px_6px_0_0_var(--color-border)] hover:bg-surface-muted';

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground font-mono">
        Drawing input
      </h2>

      {!editable && (
        <p className="text-sm text-[var(--muted-foreground)]">Host chooses how the drawer draws</p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={!editable}
          onClick={() => select('emoji')}
          aria-pressed={input === 'emoji'}
          className={`${cardBase} ${input === 'emoji' ? cardOn : cardOff}`}
        >
          <p className="font-bold font-display tracking-wide text-lg text-primary">Emojis</p>
          <p className="text-xs font-mono text-muted-foreground leading-tight mt-1">Drag emojis onto the board.</p>
        </button>
        <button
          type="button"
          disabled={!editable}
          onClick={() => select('canvas')}
          aria-pressed={input === 'canvas'}
          className={`${cardBase} ${input === 'canvas' ? cardOn : cardOff}`}
        >
          <p className="font-bold font-display tracking-wide text-lg text-primary">Canvas</p>
          <p className="text-xs font-mono text-muted-foreground leading-tight mt-1">Freehand draw with brushes.</p>
        </button>
      </div>
    </div>
  );
}
