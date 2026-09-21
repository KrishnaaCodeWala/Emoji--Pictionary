'use client';

import { useEffect, useRef } from 'react';
import type { Message, Player } from '@/lib/types';
import Avatar from './Avatar';

export interface ChatProps {
  messages: Message[];
  players: Player[];
}

export default function Chat({ messages, players }: ChatProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  function playerFor(playerId: string | null): Player | null {
    if (!playerId) return null;
    return players.find((p) => p.id === playerId) ?? null;
  }

  const visible = messages.filter((m) => m.type === 'guess' || m.type === 'system');

  return (
    <div className="flex h-48 w-full flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-surface p-2 sm:h-64">
      {visible.length === 0 && (
        <p className="m-auto text-center text-sm text-muted-foreground">No guesses yet</p>
      )}
      {visible.map((m) => {
        if (m.type === 'system') {
          return (
            <p key={m.id} className="text-center text-xs italic text-primary">
              {m.content}
            </p>
          );
        }
        const p = playerFor(m.player_id);
        const name = p?.nickname ?? 'Unknown';
        return (
          <div key={m.id} className="flex items-start gap-1.5 break-words">
            <Avatar avatar={p?.avatar} nickname={name} size="sm" className="mt-0.5" />
            <p className="text-sm text-foreground">
              <span className="font-semibold">{name}:</span> {m.content}
            </p>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
