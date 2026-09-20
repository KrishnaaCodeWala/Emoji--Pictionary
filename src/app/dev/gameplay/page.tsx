'use client';

import { useState } from 'react';
import EmojiPicker from '@/components/EmojiPicker';
import EmojiCanvas from '@/components/EmojiCanvas';
import Chat from '@/components/Chat';
import GuessInput from '@/components/GuessInput';
import Timer from '@/components/Timer';
import type { Message, Player } from '@/lib/types';

const fakePlayers: Player[] = [
  { id: 'p1', room_id: 'r1', nickname: 'Ada', score: 10, turn_order: 0, joined_at: new Date().toISOString() },
  { id: 'p2', room_id: 'r1', nickname: 'Grace', score: 5, turn_order: 1, joined_at: new Date().toISOString() },
];

const fakeMessages: Message[] = [
  { id: 'm1', room_id: 'r1', player_id: null, content: 'Round 1 - Ada is drawing', type: 'system', created_at: new Date().toISOString() },
  { id: 'm2', room_id: 'r1', player_id: 'p2', content: 'pizza?', type: 'guess', created_at: new Date().toISOString() },
  { id: 'm3', room_id: 'r1', player_id: 'p2', content: '\u{1F355}\u{1F355}', type: 'emoji_update', created_at: new Date().toISOString() },
];

export default function DevGameplay() {
  const [drawing, setDrawing] = useState('');
  const [messages, setMessages] = useState<Message[]>(fakeMessages);
  const [endsAt] = useState(() => new Date(Date.now() + 30_000).toISOString());

  function handleGuessSubmit(guess: string) {
    setMessages((prev) => [
      ...prev,
      {
        id: `m-${prev.length}`,
        room_id: 'r1',
        player_id: 'p2',
        content: guess,
        type: 'guess',
        created_at: new Date().toISOString(),
      },
    ]);
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-4 text-white">
      <h1 className="text-xl font-bold">Gameplay component dev page</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-white/60">Timer</h2>
        <Timer endsAt={endsAt} onExpire={() => console.log('timer expired')} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-white/60">EmojiCanvas (mirrors picker below)</h2>
        <EmojiCanvas emojis={drawing} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-white/60">EmojiPicker</h2>
        <EmojiPicker value={drawing} onChange={setDrawing} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-white/60">Chat</h2>
        <Chat messages={messages} players={fakePlayers} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-white/60">GuessInput</h2>
        <GuessInput onSubmit={handleGuessSubmit} />
      </section>
    </main>
  );
}
