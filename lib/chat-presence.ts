import { useAuth } from '@/context/auth-context';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';

type PresencePayload = { userId: string; name: string; onlineAt: string };
type TypingPayload = { userId: string; name: string; typing: boolean; sentAt: number };

export function useEventChatPresence(eventId: string, displayName: string, enabled: boolean) {
  const { user } = useAuth();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastTyping = useRef(false);
  const typingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [connected, setConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [typingByUserId, setTypingByUserId] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!enabled || !supabase || !user || !eventId) return;
    const activeTypingTimers = typingTimers.current;
    const channel = supabase.channel(`event:${eventId}:chat`, {
      config: { private: true, presence: { key: user.id }, broadcast: { self: false } },
    });
    channelRef.current = channel;

    const syncPresence = () => {
      const states = channel.presenceState<PresencePayload>();
      const ids = [...new Set(Object.values(states).flat().map((state) => state.userId).filter(Boolean))];
      setOnlineUserIds(ids);
    };

    channel
      .on('presence', { event: 'sync' }, syncPresence)
      .on('presence', { event: 'join' }, syncPresence)
      .on('presence', { event: 'leave' }, syncPresence)
      .on('broadcast', { event: 'typing' }, ({ payload }: { payload: TypingPayload }) => {
        if (!payload || payload.userId === user.id || typeof payload.name !== 'string') return;
        const existing = activeTypingTimers.get(payload.userId);
        if (existing) clearTimeout(existing);
        setTypingByUserId((current) => {
          if (!payload.typing) {
            const next = { ...current };
            delete next[payload.userId];
            return next;
          }
          return { ...current, [payload.userId]: payload.name.slice(0, 80) };
        });
        if (payload.typing) {
          const timer = setTimeout(() => {
            setTypingByUserId((current) => {
              const next = { ...current };
              delete next[payload.userId];
              return next;
            });
            activeTypingTimers.delete(payload.userId);
          }, 3000);
          activeTypingTimers.set(payload.userId, timer);
        }
      })
      .subscribe(async (status) => {
        const isConnected = status === 'SUBSCRIBED';
        setConnected(isConnected);
        if (isConnected) {
          await channel.track({ userId: user.id, name: displayName.slice(0, 80), onlineAt: new Date().toISOString() });
        }
      });

    return () => {
      setConnected(false);
      setOnlineUserIds([]);
      setTypingByUserId({});
      activeTypingTimers.forEach(clearTimeout);
      activeTypingTimers.clear();
      channelRef.current = null;
      lastTyping.current = false;
      void supabase?.removeChannel(channel);
    };
  }, [displayName, enabled, eventId, user]);

  const setTyping = useCallback((typing: boolean) => {
    if (!connected || !user || !channelRef.current) return;
    if (lastTyping.current === typing) return;
    lastTyping.current = typing;
    void channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: user.id, name: displayName.slice(0, 80), typing, sentAt: Date.now() } satisfies TypingPayload,
    });
  }, [connected, displayName, user]);

  return {
    connected,
    onlineUserIds,
    typingNames: Object.values(typingByUserId),
    setTyping,
  };
}
