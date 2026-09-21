'use client';
import { useState, useEffect } from 'react';
import { getCurrentUser } from '@/lib/supabase/auth';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User } from '@supabase/supabase-js';

export default function MePage() {
  const [user, setUser] = useState<User | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser().then(async u => {
      setUser(u);
      if (u) {
        const supabase = getSupabaseBrowser();
        const { data } = await supabase.from('game_results').select('*').eq('user_id', u.id).order('timestamp', { ascending: false });
        setResults(data || []);
      }
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="gutter p-8 text-center text-muted-foreground">Loading...</div>;

  if (!user) {
    return (
      <div className="gutter mx-auto flex w-full max-w-lg flex-col gap-6 py-8">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Your Stats</h1>
          <p className="text-muted-foreground mb-6">You need to sign in to see your stats.</p>
          <a href="/">
            <Button>Back to Home</Button>
          </a>
        </Card>
      </div>
    );
  }

  const gamesPlayed = results.length;
  const classicWins = results.filter(r => r.mode === 'classic' && r.placement === 1).length;
  const charadesWins = results.filter(r => r.mode === 'charades' && r.placement === 1).length;
  const totalPoints = results.reduce((acc, r) => acc + (r.points || 0), 0);

  return (
    <div className="gutter mx-auto flex w-full max-w-2xl flex-col gap-6 py-8">
      <Card className="p-8">
        <h1 className="text-3xl font-display font-bold text-primary mb-6 uppercase tracking-widest text-center">Lifetime Stats</h1>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-surface rounded-xl p-4 text-center border border-[var(--border)]">
            <div className="text-3xl font-bold">{gamesPlayed}</div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">Games Played</div>
          </div>
          <div className="bg-surface rounded-xl p-4 text-center border border-[var(--border)]">
            <div className="text-3xl font-bold">{totalPoints}</div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">Total Points</div>
          </div>
          <div className="bg-surface rounded-xl p-4 text-center border border-[var(--border)]">
            <div className="text-3xl font-bold">{classicWins}</div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">Classic Wins</div>
          </div>
          <div className="bg-surface rounded-xl p-4 text-center border border-[var(--border)]">
            <div className="text-3xl font-bold">{charadesWins}</div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">Charades Wins</div>
          </div>
        </div>

        <h2 className="text-xl font-bold mb-4">Recent Games</h2>
        {results.length === 0 ? (
          <p className="text-muted-foreground text-sm">No games played yet.</p>
        ) : (
          <div className="space-y-3">
            {results.slice(0, 10).map((r, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] bg-surface-muted">
                <div>
                  <div className="font-semibold capitalize">{r.mode}</div>
                  <div className="text-xs text-muted-foreground">{new Date(r.timestamp).toLocaleDateString()}</div>
                </div>
                <div className="text-right">
                  {r.mode !== 'relay' && (
                    <div className="font-medium text-sm">Placed {r.placement}{r.placement === 1 ? 'st' : r.placement === 2 ? 'nd' : r.placement === 3 ? 'rd' : 'th'}</div>
                  )}
                  {r.points > 0 && <div className="text-xs text-muted-foreground">{r.points} pts</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <a href="/">
            <Button variant="outline">Back to Home</Button>
          </a>
        </div>
      </Card>
    </div>
  );
}
