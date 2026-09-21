'use client';
import type { ChainSummary, GameMode, Player, RevealPayload, ReactionEvent } from '@/lib/types';
import PosterFrame from './charades/PosterFrame';
import { Button } from '@/components/ui/button';
import AlbumViewer from './relay/AlbumViewer';
import { Download, Share } from 'lucide-react';
import { generateResultsCard } from '@/lib/resultsCard';

export interface ResultsProps {
  players: Player[]; isHost: boolean; onPlayAgain: () => void;
  /** v2 */
  mode?: GameMode; reveals?: RevealPayload[];
  /** v3 (Track B): relay chains */
  chains?: ChainSummary[];
  /** v5: relay reactions */
  reactions?: ReactionEvent[];
  onReact?: (chainIndex: number, step: number, emoji: string) => void;
  meId?: string | null;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function Results({ players, isHost, onPlayAgain, mode, reveals, chains, reactions, onReact, meId }: ResultsProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  const handleDownload = async () => {
    try {
      // Very naive funniest chain detection just to pass something to the card
      let funniest = undefined;
      if (mode === 'relay' && chains && reactions && reactions.length > 0) {
        const counts = new Map<number, number>();
        for (const r of reactions) counts.set(r.chainIndex, (counts.get(r.chainIndex) ?? 0) + 1);
        let max = 0, maxId = -1;
        for (const [ci, count] of counts.entries()) {
          if (count > max) { max = count; maxId = ci; }
        }
        if (maxId !== -1) {
          const c = chains.find(ch => ch.chainIndex === maxId);
          if (c) funniest = `${c.originNickname}'s chain`;
        }
      }

      const dataUrl = await generateResultsCard({
        mode: mode ?? 'classic',
        scoreboard: sorted,
        roomCode: window.location.pathname.split('/').pop() || '????',
        funniestChain: funniest
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `emoji-pictionary-${mode}-results.png`;
      a.click();
    } catch (err) {
      console.error(err);
    }
  };

  const handleShare = async () => {
    // navigator.share if available
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Emoji Pictionary Results',
          text: `I just played Emoji Pictionary in ${mode} mode!`,
          url: window.location.href,
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

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

  // Relay is about the album, not the leaderboard: scores default to 0, so the
  // scoreboard is hidden (rather than announcing a hollow "everyone wins!" tie).
  const isRelayNoScores = mode === 'relay' && sorted.every((p) => p.score === 0);

  return (
    <div className="gutter mx-auto flex w-full max-w-md flex-col gap-6 py-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Results</h1>
        {winner && !isRelayNoScores && (
          <p className="mt-1 text-[var(--muted-foreground)]">
            {winners.length > 1
              ? `It's a tie between ${winners.map((w) => w.nickname).join(', ')}!`
              : `${winner.nickname} wins!`}
          </p>
        )}
      </div>

      <div className="flex gap-2 justify-center">
        <Button variant="outline" size="sm" onClick={handleDownload} className="flex gap-2">
          <Download className="w-4 h-4" /> Save Scorecard
        </Button>
        {typeof navigator !== 'undefined' && !!navigator.share && (
          <Button variant="outline" size="sm" onClick={handleShare} className="flex gap-2">
            <Share className="w-4 h-4" /> Share
          </Button>
        )}
      </div>

      {mode === 'relay' && chains && chains.length > 0 && (
        <div className="mt-8 border-t border-[var(--border)] pt-8">
          <h2 className="mb-4 text-center text-xl font-bold uppercase tracking-widest text-primary font-display">
            Relay Chains
          </h2>
          <div className="space-y-4">
            {chains.map(c => {
              const chainReacts = reactions?.filter(r => r.chainIndex === c.chainIndex) ?? [];
              return (
                <div key={c.chainIndex} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                  <div className="font-semibold text-lg">{c.originNickname ?? 'Someone'}&apos;s chain</div>
                  <div className="text-sm mt-1 text-muted-foreground">
                    &quot;{c.firstPhrase}&quot; ➡️ &quot;{c.lastGuess}&quot;
                  </div>
                  {chainReacts.length > 0 && (
                    <div className="mt-2 text-xs text-primary font-medium">
                      {chainReacts.length} reaction{chainReacts.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!isRelayNoScores && (
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
      )}

      {mode === 'charades' && reveals && reveals.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Rounds
          </h2>
          <ol className="flex flex-col gap-2">
            {reveals.map((r) => (
              <li
                key={r.roundNumber}
                className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              >
                <PosterFrame url={r.poster_url} title={r.title} className="w-10" />
                <span className="text-sm">
                  Round {r.roundNumber}: {r.title}
                  {r.year != null ? ` (${r.year})` : ''}
                  {' - '}
                  {r.guesserNickname ? `guessed by ${r.guesserNickname}` : 'nobody'}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

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
