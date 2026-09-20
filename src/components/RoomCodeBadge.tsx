import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';

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
    <div className="flex items-center gap-3 rounded-xl border-4 border-border shadow-[6px_6px_0_0_var(--color-border)] bg-surface px-4 py-3">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-mono">Room code</p>
        <p className="text-4xl font-bold tracking-[0.3em] text-primary font-display pt-1">{code}</p>
      </div>
      <Button
        type="button"
        onClick={handleCopy}
        variant="outline"
        className="ml-auto"
      >
        {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}
