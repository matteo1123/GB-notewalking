import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import type { Recital, RecitalQueueEntry, RecitalChatMessage, RecitalSchedule } from '@/types/recital';

interface RecitalContextType {
  // State
  activeRecital: Recital | null;
  queue: RecitalQueueEntry[];
  chatMessages: RecitalChatMessage[];
  viewerCount: number;
  upcomingSchedule: RecitalSchedule[];
  myQueueEntry: RecitalQueueEntry | null;
  isPerformer: boolean;
  isAdmin: boolean;
  loading: boolean;

  // User actions
  joinQueue: () => Promise<void>;
  toggleReady: () => Promise<void>;
  sendMessage: (body: string) => Promise<void>;

  // Admin actions
  startRecital: () => Promise<void>;
  endRecital: () => Promise<void>;
  advancePerformer: () => Promise<void>;
  banUserFromChat: (userId: string, displayName: string) => Promise<void>;
  banUserFromVideo: (userId: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  scheduleRecital: (title: string, scheduledFor: Date, notes?: string) => Promise<void>;
  updateSchedule: (scheduleId: string, title: string, scheduledFor: Date, notes?: string) => Promise<void>;
  deleteSchedule: (scheduleId: string) => Promise<void>;
}

const RecitalContext = createContext<RecitalContextType | undefined>(undefined);

export const useRecital = () => {
  const ctx = useContext(RecitalContext);
  if (!ctx) throw new Error('useRecital must be used within a RecitalProvider');
  return ctx;
};

export const RecitalProvider = ({ children }: { children: ReactNode }) => {
  const { user, session } = useAuth();
  const userRole = useUserRole();
  const isAdmin = userRole === 'admin';

  const [activeRecital, setActiveRecital] = useState<Recital | null>(null);
  const [queue, setQueue] = useState<RecitalQueueEntry[]>([]);
  const [chatMessages, setChatMessages] = useState<RecitalChatMessage[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [upcomingSchedule, setUpcomingSchedule] = useState<RecitalSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const mainChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const autoStartAttemptedRef = useRef<Set<string>>(new Set());

  const myQueueEntry = user ? (queue.find(e => e.user_id === user.id) ?? null) : null;
  const isPerformer = !!(user && activeRecital?.current_performer_id === user.id);

  // ── Fetch initial state ──────────────────────────────────────────────────
  const fetchActiveRecital = useCallback(async () => {
    const { data } = await supabase
      .from('recitals')
      .select('*')
      .eq('status', 'active')
      .maybeSingle();
    setActiveRecital(data ?? null);
    return data ?? null;
  }, []);

  const fetchQueue = useCallback(async (recitalId: string) => {
    const { data } = await supabase
      .from('recital_queue')
      .select('*')
      .eq('recital_id', recitalId)
      .order('joined_at', { ascending: true });
    setQueue(data ?? []);
  }, []);

  const fetchChatMessages = useCallback(async (recitalId: string) => {
    const { data } = await supabase
      .from('recital_chat')
      .select('*')
      .eq('recital_id', recitalId)
      .order('created_at', { ascending: true })
      .limit(200);
    setChatMessages(data ?? []);
  }, []);

  const fetchUpcomingSchedule = useCallback(async () => {
    const { data } = await supabase
      .from('recital_schedule')
      .select('*')
      .gte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true });
    setUpcomingSchedule(data ?? []);
  }, []);

  // ── Auto-start: check for due scheduled recitals ─────────────────────────
  const checkAndAutoStart = useCallback(async () => {
    if (!user || !session) return;
    const now = new Date().toISOString();
    const { data: due } = await supabase
      .from('recital_schedule')
      .select('*')
      .lte('scheduled_for', now)
      .eq('auto_started', false)
      .limit(1);

    if (!due || due.length === 0) return;
    const schedule = due[0];

    // Prevent duplicate calls from this client
    if (autoStartAttemptedRef.current.has(schedule.id)) return;
    autoStartAttemptedRef.current.add(schedule.id);

    const { data, error } = await supabase.functions.invoke('start-scheduled-recital', {
      body: { scheduleId: schedule.id },
    });

    if (!error && data?.recital) {
      setActiveRecital(data.recital);
    }
  }, [user, session]);

  // ── Realtime subscriptions ────────────────────────────────────────────────
  const subscribeToRecital = useCallback((recital: Recital) => {
    // Clean up previous subscription
    if (mainChannelRef.current) {
      supabase.removeChannel(mainChannelRef.current);
    }

    const channel = supabase
      .channel(`recital-${recital.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recitals', filter: `id=eq.${recital.id}` },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setActiveRecital(payload.new as Recital);
          } else if (payload.eventType === 'DELETE') {
            setActiveRecital(null);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recital_queue', filter: `recital_id=eq.${recital.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setQueue(prev => [...prev, payload.new as RecitalQueueEntry]);
          } else if (payload.eventType === 'UPDATE') {
            setQueue(prev => prev.map(e => e.id === payload.new.id ? payload.new as RecitalQueueEntry : e));
          } else if (payload.eventType === 'DELETE') {
            setQueue(prev => prev.filter(e => e.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'recital_chat', filter: `recital_id=eq.${recital.id}` },
        (payload) => {
          setChatMessages(prev => [...prev, payload.new as RecitalChatMessage]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'recital_chat', filter: `recital_id=eq.${recital.id}` },
        (payload) => {
          setChatMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new as RecitalChatMessage : m));
        }
      )
      .subscribe();

    mainChannelRef.current = channel;
  }, []);

  const subscribeToPresence = useCallback((recitalId: string) => {
    if (!user) return;

    if (presenceChannelRef.current) {
      supabase.removeChannel(presenceChannelRef.current);
    }

    const channel = supabase.channel(`recital-presence-${recitalId}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setViewerCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id });
        }
      });

    presenceChannelRef.current = channel;
  }, [user]);

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      setLoading(true);
      await fetchUpcomingSchedule();
      const recital = await fetchActiveRecital();

      if (!recital && user && session) {
        await checkAndAutoStart();
        // Re-fetch after potential auto-start
        const started = await fetchActiveRecital();
        if (started && isMounted) {
          await Promise.all([fetchQueue(started.id), fetchChatMessages(started.id)]);
          subscribeToRecital(started);
          subscribeToPresence(started.id);
        }
      } else if (recital && isMounted) {
        await Promise.all([fetchQueue(recital.id), fetchChatMessages(recital.id)]);
        subscribeToRecital(recital);
        subscribeToPresence(recital.id);
      }

      if (isMounted) setLoading(false);
    };

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, [user?.id]); // re-run when user changes

  // Clean up channels on unmount
  useEffect(() => {
    return () => {
      if (mainChannelRef.current) supabase.removeChannel(mainChannelRef.current);
      if (presenceChannelRef.current) supabase.removeChannel(presenceChannelRef.current);
    };
  }, []);

  // When activeRecital changes (e.g. auto-start result arrives), subscribe
  useEffect(() => {
    if (activeRecital) {
      subscribeToRecital(activeRecital);
      if (user) subscribeToPresence(activeRecital.id);
    }
  }, [activeRecital?.id]);

  // ── Display name helper ───────────────────────────────────────────────────
  const getDisplayName = useCallback(async (): Promise<string> => {
    if (!user) return 'Anonymous';
    const { data } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single();
    return (data as any)?.display_name || user.email?.split('@')[0] || 'Player';
  }, [user]);

  // ── User actions ──────────────────────────────────────────────────────────
  const joinQueue = useCallback(async () => {
    if (!user || !activeRecital) return;
    if (myQueueEntry) return; // already joined

    const displayName = await getDisplayName();
    await supabase.from('recital_queue').insert({
      recital_id: activeRecital.id,
      user_id: user.id,
      display_name: displayName,
    });
  }, [user, activeRecital, myQueueEntry, getDisplayName]);

  const toggleReady = useCallback(async () => {
    if (!user || !activeRecital || !myQueueEntry) return;
    await supabase
      .from('recital_queue')
      .update({ ready: !myQueueEntry.ready })
      .eq('recital_id', activeRecital.id)
      .eq('user_id', user.id);
  }, [user, activeRecital, myQueueEntry]);

  const sendMessage = useCallback(async (body: string) => {
    if (!user || !activeRecital) return;
    if (myQueueEntry?.chat_banned_this_session) return;

    const { data: profileData } = await supabase
      .from('profiles')
      .select('display_name, chat_permanently_banned')
      .eq('id', user.id)
      .single();

    if ((profileData as any)?.chat_permanently_banned) return;

    const displayName = (profileData as any)?.display_name || user.email?.split('@')[0] || 'Player';

    await supabase.from('recital_chat').insert({
      recital_id: activeRecital.id,
      user_id: user.id,
      display_name: displayName,
      body: body.trim(),
    });
  }, [user, activeRecital, myQueueEntry]);

  // ── Admin actions ──────────────────────────────────────────────────────────
  const startRecital = useCallback(async () => {
    if (!isAdmin) return;

    const { data, error } = await supabase.functions.invoke('create-daily-room', {});
    if (error || !data?.url) throw new Error(error?.message || 'Failed to create room');

    await supabase.from('recitals').insert({
      created_by: user!.id,
      status: 'active',
      daily_room_url: data.url,
      daily_room_name: data.name,
    });

    const recital = await fetchActiveRecital();
    if (recital) {
      await Promise.all([fetchQueue(recital.id), fetchChatMessages(recital.id)]);
    }
  }, [isAdmin, user, fetchActiveRecital, fetchQueue, fetchChatMessages]);

  const endRecital = useCallback(async () => {
    if (!isAdmin || !activeRecital) return;
    await supabase
      .from('recitals')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', activeRecital.id);
    setActiveRecital(null);
    setQueue([]);
    setChatMessages([]);
    setViewerCount(0);
  }, [isAdmin, activeRecital]);

  const advancePerformer = useCallback(async () => {
    if (!activeRecital) return;
    await supabase.functions.invoke('advance-performer', {
      body: { recitalId: activeRecital.id },
    });
  }, [activeRecital]);

  const banUserFromChat = useCallback(async (userId: string, displayName: string) => {
    if (!isAdmin || !activeRecital) return;

    // Ban from this session
    await supabase
      .from('recital_queue')
      .update({ chat_banned_this_session: true })
      .eq('recital_id', activeRecital.id)
      .eq('user_id', userId);

    // Increment strike count and check for permanent ban
    const { data: profile } = await supabase
      .from('profiles')
      .select('chat_ban_strikes')
      .eq('id', userId)
      .single();

    const currentStrikes = (profile as any)?.chat_ban_strikes ?? 0;
    const newStrikes = currentStrikes + 1;
    const permanentlyBanned = newStrikes >= 3;

    await supabase
      .from('profiles')
      .update({
        chat_ban_strikes: newStrikes,
        ...(permanentlyBanned ? { chat_permanently_banned: true } : {}),
      })
      .eq('id', userId);
  }, [isAdmin, activeRecital]);

  const banUserFromVideo = useCallback(async (userId: string) => {
    if (!isAdmin || !activeRecital) return;
    await supabase
      .from('recital_queue')
      .update({ video_banned: true, ready: false })
      .eq('recital_id', activeRecital.id)
      .eq('user_id', userId);

    // If this user is the current performer, auto-advance
    if (activeRecital.current_performer_id === userId) {
      await advancePerformer();
    }
  }, [isAdmin, activeRecital, advancePerformer]);

  const deleteMessage = useCallback(async (messageId: string) => {
    if (!isAdmin) return;
    await supabase
      .from('recital_chat')
      .update({ deleted_by_admin: true })
      .eq('id', messageId);
  }, [isAdmin]);

  const scheduleRecital = useCallback(async (title: string, scheduledFor: Date, notes?: string) => {
    if (!isAdmin || !user) return;
    const { error } = await supabase.from('recital_schedule').insert({
      title,
      scheduled_for: scheduledFor.toISOString(),
      notes: notes ?? null,
      created_by: user.id,
    });
    if (!error) await fetchUpcomingSchedule();
  }, [isAdmin, user, fetchUpcomingSchedule]);

  const updateSchedule = useCallback(async (scheduleId: string, title: string, scheduledFor: Date, notes?: string) => {
    if (!isAdmin) return;
    const { error } = await supabase
      .from('recital_schedule')
      .update({
        title,
        scheduled_for: scheduledFor.toISOString(),
        notes: notes ?? null,
      })
      .eq('id', scheduleId);
    if (!error) await fetchUpcomingSchedule();
  }, [isAdmin, fetchUpcomingSchedule]);

  const deleteSchedule = useCallback(async (scheduleId: string) => {
    if (!isAdmin) return;
    await supabase.from('recital_schedule').delete().eq('id', scheduleId);
    setUpcomingSchedule(prev => prev.filter(s => s.id !== scheduleId));
  }, [isAdmin]);

  const value: RecitalContextType = {
    activeRecital,
    queue,
    chatMessages,
    viewerCount,
    upcomingSchedule,
    myQueueEntry,
    isPerformer,
    isAdmin,
    loading,
    joinQueue,
    toggleReady,
    sendMessage,
    startRecital,
    endRecital,
    advancePerformer,
    banUserFromChat,
    banUserFromVideo,
    deleteMessage,
    scheduleRecital,
    updateSchedule,
    deleteSchedule,
  };

  return <RecitalContext.Provider value={value}>{children}</RecitalContext.Provider>;
};
