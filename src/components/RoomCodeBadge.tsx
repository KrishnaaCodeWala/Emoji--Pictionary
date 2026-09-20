'use client';
import { useState } from 'react';

export interface RoomCodeBadgeProps { code: string }

export default function RoomCodeBadge({ code }: RoomCodeBadgeProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable; ignore
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Room code</p>
        <p className="text-3xl font-bold tracking-[0.3em] text-[var(--primary)]">{code}</p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="ml-auto rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--border)]"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}
