'use client';
import { CANVAS_BRUSHES, CANVAS_COLORS } from '@/lib/constants';

export interface CanvasToolbarProps {
  tool: 'brush' | 'eraser' | 'fill';
  color: string;
  size: number;
  onTool: (t: 'brush' | 'eraser' | 'fill') => void;
  onColor: (c: string) => void;
  onSize: (s: number) => void;
  onUndo: () => void;
  onClear: () => void;
  canUndo: boolean;
  disabled?: boolean;
}

const TOOLS: { key: 'brush' | 'eraser' | 'fill'; label: string; icon: string }[] = [
  { key: 'brush', label: 'Brush', icon: '\u{1F58C}\u{FE0F}' },
  { key: 'eraser', label: 'Eraser', icon: '\u{1FA79}' },
  { key: 'fill', label: 'Bucket fill', icon: '\u{1FAA3}' },
];

const SIZE_NAMES = ['S', 'M', 'L'];

export default function CanvasToolbar({
  tool,
  color,
  size,
  onTool,
  onColor,
  onSize,
  onUndo,
  onClear,
  canUndo,
  disabled,
}: CanvasToolbarProps) {
  return (
    <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-2">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Tool">
        {TOOLS.map((t) => (
          <button
            key={t.key}
            type="button"
            disabled={disabled}
            aria-pressed={tool === t.key}
            aria-label={t.label}
            title={t.label}
            onClick={() => onTool(t.key)}
            className={`flex min-h-10 min-w-10 items-center justify-center rounded-lg border px-3 py-2 text-lg ${
              tool === t.key
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-surface text-foreground'
            } disabled:opacity-40`}
          >
            {t.icon}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1" role="group" aria-label="Brush size">
        {CANVAS_BRUSHES.map((s, i) => (
          <button
            key={s}
            type="button"
            disabled={disabled}
            aria-pressed={size === s}
            aria-label={`Brush size ${SIZE_NAMES[i] ?? s}`}
            onClick={() => onSize(s)}
            className={`min-h-10 min-w-10 rounded-lg border px-3 py-2 text-sm font-semibold ${
              size === s
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-surface text-foreground'
            } disabled:opacity-40`}
          >
            {SIZE_NAMES[i] ?? s}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1" role="group" aria-label="Color">
        {CANVAS_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            disabled={disabled}
            aria-pressed={tool !== 'eraser' && color === c}
            aria-label={`Color ${c}`}
            title={c}
            onClick={() => {
              onColor(c);
              if (tool === 'eraser') onTool('brush');
            }}
            style={{ backgroundColor: c }}
            className={`h-10 w-10 rounded-lg border-2 ${
              tool !== 'eraser' && color === c ? 'border-primary' : 'border-border'
            } disabled:opacity-40`}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          disabled={disabled || !canUndo}
          onClick={onUndo}
          className="min-h-10 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground disabled:opacity-40"
        >
          Undo
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onClear}
          className="min-h-10 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground disabled:opacity-40"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
