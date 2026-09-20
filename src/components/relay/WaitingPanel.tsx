import type { RelayProgress } from '@/lib/types';

export interface WaitingPanelProps { progress: RelayProgress | null; phaseLabel: string }

export default function WaitingPanel({ progress, phaseLabel }: WaitingPanelProps) {
  const submitted = progress?.submitted ?? 0;
  const total = progress?.total ?? 0;
  const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;

  return (
    <div className="flex w-full flex-col items-center gap-3 rounded-xl border border-border bg-surface p-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{phaseLabel}</p>
      <p className="text-lg font-semibold text-foreground">
        {submitted} of {total} done
      </p>
      <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
