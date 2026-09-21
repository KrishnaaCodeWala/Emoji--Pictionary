'use client';
// Track B.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { getPlayerId } from '@/lib/player';
import {
  ROOM_POLL_MS, REVEAL_DURATION_MS, SYS_HINTS_PREFIX, SYS_REVEAL_PREFIX, SYS_RELAY_PREFIX, SYS_CHAIN_PREFIX,
} from '@/lib/constants';
import type { ChainSummary, Message, Player, PublicHints, RevealPayload, RoomPublic } from '@/lib/types';

function parseHints(content: string): PublicHints | null {
  try {
    return JSON.parse(content.slice(SYS_HINTS_PREFIX.length)) as PublicHints;
  } catch {
    return null;
  }
}

function parseReveal(content: string): RevealPayload | null {
  try {
    return JSON.parse(content.slice(SYS_REVEAL_PREFIX.length)) as RevealPayload;
  } catch {
    return null;
  }
}

function parseChain(content: string): ChainSummary | null {
  try {
    return JSON.parse(content.slice(SYS_CHAIN_PREFIX.length)) as ChainSummary;
  } catch {
    return null;
  }
}

function isStructuredSystemMessage(m: Message): boolean {
  return (
    m.type === 'system' &&
    (m.content.startsWith(SYS_HINTS_PREFIX) ||
      m.content.startsWith(SYS_REVEAL_PREFIX) ||
      m.content.startsWith(SYS_RELAY_PREFIX) ||
      m.content.startsWith(SYS_CHAIN_PREFIX))
  );
}

/** Merge a ChainSummary into a list, deduped by chainIndex (last one wins). */
function upsertChain(prev: ChainSummary[], next: ChainSummary): ChainSummary[] {
  const idx = prev.findIndex((c) => c.chainIndex === next.chainIndex);
  if (idx >= 0) {
    const copy = prev.slice();
    copy[idx] = next;
    return copy;
  }
  return [...prev, next];
}

export interface UseRoomResult {
  room: RoomPublic | null;
  players: Player[];
  messages: Message[];
  /** Latest emoji_update content for the current round (empty string if none). */
  canvas: string;
  me: Player | null;
  isHost: boolean;
  isDrawer: boolean;
  onlineIds: Set<string>;
  loading: boolean;
  error: string | null;
  refetchRoom: () => Promise<void>;
  // ---- v2 (Track B) ----
  /** Latest 'hints:' system message for the current round, or null. */
  hints: PublicHints | null;
  /** Latest 'reveal:' payload; cleared when round_number changes. */
  reveal: RevealPayload | null;
  /** All reveals seen this game, oldest first (for Results). */
  reveals: RevealPayload[];
  /** v3 (Track B): relay chain summaries parsed from 'chain:' system messages. */
  chains: ChainSummary[];
  /** v3 (Track B): raw system messages incl. structured ones, for useRelay to parse 'relay:' progress. */
  systemFeed: Message[];
  /** v4 (Track C): the subscribed room channel, for broadcast (strokes). null until subscribed. */
  channel: import('@supabase/supabase-js').RealtimeChannel | null;
}

export function useRoom(roomCode: string): UseRoomResult {
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const [room, setRoom] = useState<RoomPublic | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [canvas, setCanvas] = useState('');
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hints, setHints] = useState<PublicHints | null>(null);
  const [reveal, setReveal] = useState<RevealPayload | null>(null);
  const [reveals, setReveals] = useState<RevealPayload[]>([]);
  const [chains, setChains] = useState<ChainSummary[]>([]);
  const [systemFeed, setSystemFeed] = useState<Message[]>([]);

  const roundNumberRef = useRef<number | null>(null);
  const statusRef = useRef<RoomPublic['status'] | null>(null);
  /** Epoch ms when the current `reveal` was set (client time, or the message's created_at
   *  on initial load); used to keep the reveal card visible for REVEAL_DURATION_MS even
   *  after round_number advances. */
  const revealSetAtRef = useRef<number | null>(null);
  const playerId = getPlayerId(roomCode);

  const fetchRoom = useCallback(async (): Promise<RoomPublic | null> => {
    const { data, error: err } = await supabase
      .from('rooms_public')
      .select('*')
      .eq('room_code', roomCode)
      .single();
    if (err || !data) {
      setError(err?.message ?? 'Room not found');
      return null;
    }
    const r = data as RoomPublic;
    if (roundNumberRef.current !== null && roundNumberRef.current !== r.round_number) {
      setCanvas('');
      // hints are not cleared here: they carry roundNumber and are filtered on return,
      // so a hints message that arrives before this refetch completes is not lost.
    }
    roundNumberRef.current = r.round_number;
    // Back to lobby after a reset: drop the old game's chat, canvas and charades state.
    if (statusRef.current !== null && statusRef.current !== 'lobby' && r.status === 'lobby') {
      setMessages([]);
      setCanvas('');
      setHints(null);
      setReveal(null);
      setReveals([]);
      setChains([]);
      setSystemFeed([]);
      revealSetAtRef.current = null;
    }
    statusRef.current = r.status;
    setRoom(r);
    setError(null);
    return r;
  }, [roomCode, supabase]);

  // Also refreshes players: a join that lands before the Realtime channel is
  // subscribed would otherwise be missed until a page reload.
  const refetchRoom = useCallback(async () => {
    const r = await fetchRoom();
    if (!r) return;
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', r.id)
      .order('turn_order', { ascending: true });
    if (data) setPlayers(data as Player[]);
  }, [fetchRoom, supabase]);

  // Initial load: room, players, last 100 messages.
  useEffect(() => {
    let cancelled = false;
    roundNumberRef.current = null;
    statusRef.current = null;

    (async () => {
      setLoading(true);
      const r = await fetchRoom();
      if (cancelled) return;
      if (!r) {
        setLoading(false);
        return;
      }

      const [playersRes, messagesRes] = await Promise.all([
        supabase.from('players').select('*').eq('room_id', r.id).order('turn_order', { ascending: true }),
        supabase
          .from('messages')
          .select('*')
          .eq('room_id', r.id)
          .order('created_at', { ascending: false })
          .limit(100),
      ]);
      if (cancelled) return;

      if (playersRes.error) {
        setError(playersRes.error.message);
      } else {
        setPlayers((playersRes.data ?? []) as Player[]);
      }

      if (messagesRes.error) {
        setError(messagesRes.error.message);
      } else {
        const msgs = ((messagesRes.data ?? []) as Message[]).slice().reverse();
        setMessages(msgs.filter((m) => !isStructuredSystemMessage(m)));
        setSystemFeed(msgs.filter((m) => m.type === 'system').slice(-200));
        {
          let chainList: ChainSummary[] = [];
          for (const m of msgs) {
            if (m.type === 'system' && m.content.startsWith(SYS_CHAIN_PREFIX)) {
              const parsed = parseChain(m.content);
              if (parsed) chainList = upsertChain(chainList, parsed);
            }
          }
          setChains(chainList);
        }
        // Messages aren't tagged by round, so bound the search to messages after the
        // latest plain (non-structured) system message (each turn change inserts one) —
        // that approximates "this round's" emoji_update/hints without a schema change.
        let lastSystemIndex = -1;
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].type === 'system' && !isStructuredSystemMessage(msgs[i])) {
            lastSystemIndex = i;
            break;
          }
        }
        for (let i = msgs.length - 1; i > lastSystemIndex; i--) {
          if (msgs[i].type === 'emoji_update') {
            setCanvas(msgs[i].content);
            break;
          }
        }
        // Current round's hints: the latest hints: message after the latest plain
        // system message.
        for (let i = msgs.length - 1; i > lastSystemIndex; i--) {
          const m = msgs[i];
          if (m.type === 'system' && m.content.startsWith(SYS_HINTS_PREFIX)) {
            const parsed = parseHints(m.content);
            if (parsed) setHints(parsed);
            break;
          }
        }
        // Reveals: all reveal: messages in order, deduped by roundNumber (last wins).
        const revealList: RevealPayload[] = [];
        let latestReveal: { payload: RevealPayload; createdAt: string } | null = null;
        for (const m of msgs) {
          if (m.type === 'system' && m.content.startsWith(SYS_REVEAL_PREFIX)) {
            const parsed = parseReveal(m.content);
            if (!parsed) continue;
            const existingIdx = revealList.findIndex((r) => r.roundNumber === parsed.roundNumber);
            if (existingIdx >= 0) {
              revealList[existingIdx] = parsed;
            } else {
              revealList.push(parsed);
            }
            latestReveal = { payload: parsed, createdAt: m.created_at };
          }
        }
        setReveals(revealList);
        if (latestReveal) {
          setReveal(latestReveal.payload);
          revealSetAtRef.current = new Date(latestReveal.createdAt).getTime();
        }
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, supabase]);

  // Realtime subscriptions + presence, scoped to the resolved room id.
  const roomId = room?.id ?? null;
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`room:${roomId}`);

    channel
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const newPlayer = payload.new as Player;
          setPlayers((prev) =>
            prev.some((p) => p.id === newPlayer.id)
              ? prev
              : [...prev, newPlayer].sort((a, b) => a.turn_order - b.turn_order),
          );
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const updated = payload.new as Player;
          setPlayers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const msg = payload.new as Message;
          if (msg.type === 'system') {
            setSystemFeed((prev) => [...prev, msg].slice(-200));
          }
          if (msg.type === 'emoji_update') {
            setCanvas(msg.content);
          } else if (msg.type === 'system' && msg.content.startsWith(SYS_HINTS_PREFIX)) {
            const parsed = parseHints(msg.content);
            if (parsed) setHints(parsed);
            // revealed_hints lives on the room row; refresh so the actor's buttons update now.
            void refetchRoom();
          } else if (msg.type === 'system' && msg.content.startsWith(SYS_REVEAL_PREFIX)) {
            const parsed = parseReveal(msg.content);
            if (parsed) {
              setReveal(parsed);
              // Client clock, not created_at: avoids skew shortening/lengthening the card.
              revealSetAtRef.current = Date.now();
              setReveals((prev) => {
                const existingIdx = prev.findIndex((r) => r.roundNumber === parsed.roundNumber);
                if (existingIdx >= 0) {
                  const next = prev.slice();
                  next[existingIdx] = parsed;
                  return next;
                }
                return [...prev, parsed];
              });
            }
          } else if (msg.type === 'system' && msg.content.startsWith(SYS_RELAY_PREFIX)) {
            // Progress pings only; parsed by useRelay from systemFeed. Never in `messages`,
            // never triggers a room refetch (would happen on every submit otherwise).
          } else if (msg.type === 'system' && msg.content.startsWith(SYS_CHAIN_PREFIX)) {
            const parsed = parseChain(msg.content);
            if (parsed) setChains((prev) => upsertChain(prev, parsed));
          } else {
            setMessages((prev) => [...prev, msg].slice(-100));
            if (msg.type === 'system') {
              void refetchRoom();
            }
          }
        },
      );

    if (playerId) {
      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ playerId: string }>();
        const ids = new Set<string>();
        Object.values(state).forEach((presences) => {
          presences.forEach((p) => ids.add(p.playerId));
        });
        setOnlineIds(ids);
      });
    }

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        if (playerId) void channel.track({ playerId });
        // Catch up on anything inserted between the initial load and now.
        void refetchRoom();
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId, playerId, supabase, refetchRoom]);

  // Keep the reveal card visible across the round transition: once round_number moves
  // past the round the reveal belongs to, clear it REVEAL_DURATION_MS after it was set
  // (not from when the round changed), so guessers get the full reveal window.
  const revealRoundNumber = reveal?.roundNumber ?? null;
  const currentRoundNumber = room?.round_number ?? null;
  useEffect(() => {
    if (revealRoundNumber === null || currentRoundNumber === null) return;
    if (revealRoundNumber === currentRoundNumber) return;
    const setAt = revealSetAtRef.current ?? Date.now();
    const remaining = Math.max(0, REVEAL_DURATION_MS - (Date.now() - setAt));
    const timer = setTimeout(() => {
      setReveal(null);
    }, remaining);
    return () => clearTimeout(timer);
  }, [revealRoundNumber, currentRoundNumber]);

  // Fallback poll of rooms_public while the game is in progress.
  const roomStatus = room?.status ?? null;
  useEffect(() => {
    if (!roomStatus || roomStatus === 'finished') return;
    const interval = setInterval(() => {
      void refetchRoom();
    }, ROOM_POLL_MS);
    return () => clearInterval(interval);
  }, [roomStatus, refetchRoom]);

  const me = players.find((p) => p.id === playerId) ?? null;
  const isHost = !!room && !!playerId && room.host_player_id === playerId;
  const isDrawer = !!room && !!playerId && room.current_drawer_id === playerId;

  return {
    room,
    players,
    messages,
    canvas,
    me,
    isHost,
    isDrawer,
    onlineIds,
    loading,
    error,
    refetchRoom,
    hints: hints && (hints.roundNumber === undefined || hints.roundNumber === room?.round_number) ? hints : null,
    chains,
    systemFeed,
    reveal,
    reveals,
    channel: null,
  };
}
