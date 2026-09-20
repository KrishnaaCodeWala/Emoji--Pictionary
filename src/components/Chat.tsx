'use client';

import { useEffect, useRef } from 'react';
import type { Message, Player } from '@/lib/types';

export interface ChatProps {
  messages: Message[];
  players: Player[];
}

export default function Chat({ messages, players }: ChatProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  function nicknameFor(playerId: string | null): string {
    if (!playerId) return 'Unknown';
    return players.find((p) => p.id === playerId)?.nickname ?? 'Unknown';
  }

  const visible = messages.filter((m) => m.type === 'guess' || m.type === 'system');

  return (
    <div className="flex h-48 w-full flex-col gap-1 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-2 sm:h-64">
      {visible.length === 0 && (
        <p className="text-center text-sm text-white/40">No messages yet.</p>
      )}
      {visible.map((m) =>
        m.type === 'system' ? (
          <p key={m.id} className="text-center text-xs italic text-amber-300/90">
            {m.content}
          </p>
        ) : (
          <p key={m.id} className="text-sm text-white/90 break-words">
            <span className="font-semibold">{nicknameFor(m.player_id)}:</span> {m.content}
          </p>
        ),
      )}
      <div ref={bottomRef} />
    </div>
  );
}
