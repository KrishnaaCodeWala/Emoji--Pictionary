'use client';
// v5 Wave 1 Track D: LeaveButton — shown to all players.
import { useState } from 'react';

export interface LeaveButtonProps {
  onLeave: () => void;
  className?: string;
}

export default function LeaveButton({ onLeave, className = '' }: LeaveButtonProps) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        id="leave-room-btn"
        onClick={() => setConfirming(true)}
        className={`rounded-xl border-2 border-border px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:border-red-400 hover:text-red-600 active:scale-95 ${className}`}
      >
        Leave
      </button>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm text-muted-foreground">Leave game?</span>
      <button
        type="button"
        onClick={() => { setConfirming(false); onLeave(); }}
        className="rounded-xl border-2 border-red-400 bg-red-400/10 px-3 py-1 text-sm font-bold text-red-600 transition-colors hover:bg-red-400/20 active:scale-95"
      >
        Yes, leave
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-xl border-2 border-border px-3 py-1 text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface-muted active:scale-95"
      >
        Cancel
      </button>
    </div>
  );
}
