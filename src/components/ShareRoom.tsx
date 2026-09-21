'use client';
// v5 Wave 1 Track C: ShareRoom — QR code, copy-link, Web Share.
import { useState, useEffect } from 'react';
import { generateQRSvg } from '@/lib/qr';

export interface ShareRoomProps {
  roomCode: string;
  className?: string;
}

export default function ShareRoom({ roomCode, className = '' }: ShareRoomProps) {
  const [copied, setCopied] = useState(false);
  const [qrSvg, setQrSvg] = useState('');
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/?join=${roomCode}`;
    setQrSvg(generateQRSvg(url, 160));
    setCanShare(typeof navigator !== 'undefined' && !!navigator.share);
  }, [roomCode]);

  const getUrl = () =>
    typeof window !== 'undefined' ? `${window.location.origin}/?join=${roomCode}` : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: 'Join Emoji Pictionary!',
        text: `Join my Emoji Pictionary room (code: ${roomCode})`,
        url: getUrl(),
      });
    } catch {
      // User cancelled or not supported
    }
  };

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Invite friends
      </p>
      {/* QR code */}
      {qrSvg && (
        <div
          className="rounded-xl border-2 border-border bg-white p-2 shadow-sm"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
          aria-label={`QR code for room ${roomCode}`}
        />
      )}
      <div className="flex gap-2">
        <button
          id="share-copy-link"
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-xl border-2 border-border bg-surface px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-surface-muted active:scale-95"
        >
          {copied ? '✅ Copied!' : '🔗 Copy link'}
        </button>
        {canShare && (
          <button
            id="share-native"
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1.5 rounded-xl border-2 border-border bg-surface px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-surface-muted active:scale-95"
          >
            📤 Share
          </button>
        )}
      </div>
    </div>
  );
}
