'use client';
// Track B.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { getPlayerId } from '@/lib/player';
import { ROOM_POLL_MS } from '@/lib/constants';
import type { Message, Player, RoomPublic } from '@/lib/types';

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

  const roundNumberRef = useRef<number | null>(null);
  const statusRef = useRef<RoomPublic['status'] | null>(null);
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
    }
    roundNumberRef.current = r.round_number;
    // Back to lobby after a reset: drop the old game's chat and canvas.
    if (statusRef.current !== null && statusRef.current !== 'lobby' && r.status === 'lobby') {
      setMessages([]);
      setCanvas('');
    }
    statusRef.current = r.status;
    setRoom(r);
    setError(null);
    return r;
  }, [roomCode, supabase]);

  const refetchRoom = useCallback(async () => {
    await fetchRoom();
  }, [fetchRoom]);

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
        setMessages(msgs);
        // Messages aren't tagged by round, so bound the search to messages after the
        // latest system message (each turn change inserts one) — that approximates
        // "this round's" emoji_update without a schema change.
        let lastSystemIndex = -1;
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].type === 'system') {
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
          if (msg.type === 'emoji_update') {
            setCanvas(msg.content);
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
      if (status === 'SUBSCRIBED' && playerId) {
        void channel.track({ playerId });
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId, playerId, supabase, refetchRoom]);

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
  };
}
