'use client';
import type { GameMode, Player, RevealPayload } from '@/lib/types';

export interface ResultsProps {
  players: Player[]; isHost: boolean; onPlayAgain: () => void;
  /** v2 */
  mode?: GameMode; reveals?: RevealPayload[];
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function Results({ players, isHost, onPlayAgain }: ResultsProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  // Compute shared ranks (ties share rank).
  const ranks: number[] = [];
  sorted.forEach((p, i) => {
    if (i === 0) {
      ranks.push(1);
    } else {
      ranks.push(sorted[i - 1].score === p.score ? ranks[i - 1] : i + 1);
    }
  });

  const winner = sorted[0];
  const winners = sorted.filter((p) => p.score === winner?.score);

  return (
    <div className="gutter mx-auto flex w-full max-w-md flex-col gap-6 py-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Results</h1>
        {winner && (
          <p className="mt-1 text-[var(--muted-foreground)]">
            {winners.length > 1
              ? `It's a tie between ${winners.map((w) => w.nickname).join(', ')}!`
              : `${winner.nickname} wins!`}
          </p>
        )}
      </div>

      <ol className="flex flex-col gap-2">
        {sorted.map((p, i) => (
          <li
            key={p.id}
            className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
          >
            <span className="w-8 shrink-0 text-center text-lg">
              {ranks[i] <= 3 ? MEDALS[ranks[i] - 1] : `#${ranks[i]}`}
            </span>
            <span className="truncate font-medium">{p.nickname}</span>
            <span className="ml-auto font-semibold text-[var(--primary)]">{p.score}</span>
          </li>
        ))}
      </ol>

      {isHost ? (
        <button
          type="button"
          onClick={onPlayAgain}
          className="w-full rounded-full bg-[var(--primary)] px-4 py-3 font-semibold text-[var(--primary-foreground)] transition hover:bg-[var(--primary-hover)]"
        >
          Play again
        </button>
      ) : (
        <p className="text-center text-sm text-[var(--muted-foreground)]">Waiting for host</p>
      )}
    </div>
  );
}
