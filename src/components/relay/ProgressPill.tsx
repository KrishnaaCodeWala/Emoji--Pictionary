import type { RelayProgress } from '@/lib/types';

export interface ProgressPillProps { progress: RelayProgress | null }

export default function ProgressPill({ progress }: ProgressPillProps) {
  if (!progress) return null;

  return (
    <span className="inline-flex min-h-6 items-center rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold tabular-nums text-foreground">
      {progress.submitted}/{progress.total}
    </span>
  );
}
