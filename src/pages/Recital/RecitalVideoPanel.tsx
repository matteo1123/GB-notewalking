import { useEffect } from 'react';
import {
  DailyProvider,
  DailyAudio,
  DailyVideo,
  useDaily,
  useLocalParticipant,
  useParticipantIds,
  useParticipant,
} from '@daily-co/daily-react';
import { useRecital } from '@/contexts/RecitalContext';
import { useAuth } from '@/contexts/AuthContext';
import { Video } from 'lucide-react';

// ── Renders the performer's remote video tile ─────────────────────────────────
// Only mounts a DailyVideo if this participant's userData.userId matches the
// current performer. Because only the performer has camera on, this avoids
// showing blank tiles for viewers/admin.
const PerformerRemoteTile = ({
  sessionId,
  performerUserId,
}: {
  sessionId: string;
  performerUserId: string;
}) => {
  const participant = useParticipant(sessionId);
  if (!participant) return null;
  const userData = participant.userData as { userId?: string } | undefined;
  if (userData?.userId !== performerUserId) return null;

  return (
    <DailyVideo
      sessionId={sessionId}
      type="video"
      fit="cover"
      className="absolute inset-0 w-full h-full"
    />
  );
};

// ── Inner call component (must live inside DailyProvider) ─────────────────────
const RecitalCallInner = () => {
  const daily = useDaily();
  const { activeRecital, isPerformer, isAdmin, queue } = useRecital();
  const { user } = useAuth();
  const localParticipant = useLocalParticipant();
  const remoteIds = useParticipantIds({ filter: 'remote' });

  // Join the Daily room on mount (once per session)
  useEffect(() => {
    if (!daily || !user) return;
    // Fall back to email prefix if display_name not in queue yet
    const displayName =
      user.email?.split('@')[0] ?? 'Viewer';

    daily.join({
      startVideoOff: true,
      startAudioOff: true,
      userName: displayName,
      userData: { userId: user.id },
    });

    return () => {
      daily.leave();
    };
  }, [daily, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reactively sync camera / mic with performer + admin state
  useEffect(() => {
    if (!daily) return;
    // Performers: camera + mic on. Admin: mic on (audio-only announcements).
    // Everyone else: camera + mic off.
    daily.setLocalVideo(isPerformer);
    daily.setLocalAudio(isPerformer || isAdmin);
  }, [daily, isPerformer, isAdmin]);

  const currentPerformer = activeRecital?.current_performer_id
    ? queue.find((e) => e.user_id === activeRecital.current_performer_id)
    : null;

  return (
    <div className="flex flex-col h-full bg-black rounded-lg overflow-hidden">
      {/* DailyAudio renders all remote audio tracks (performers + admin voice) */}
      <DailyAudio />

      <div className="flex-1 relative min-h-0">
        {/* Local camera when you're performing */}
        {isPerformer && localParticipant && (
          <DailyVideo
            sessionId={localParticipant.session_id}
            type="video"
            mirror
            fit="cover"
            className="absolute inset-0 w-full h-full"
          />
        )}

        {/* Remote performer video (matched by userData.userId) */}
        {!isPerformer && activeRecital?.current_performer_id &&
          remoteIds.map((id) => (
            <PerformerRemoteTile
              key={id}
              sessionId={id}
              performerUserId={activeRecital.current_performer_id!}
            />
          ))}

        {/* Waiting state when no one is performing yet */}
        {!activeRecital?.current_performer_id && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-white/50 text-sm">Waiting for first performer…</p>
          </div>
        )}

        {/* "You're performing" badge */}
        {isPerformer && (
          <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs font-semibold px-2 py-1 rounded">
            🎸 You're Performing
          </div>
        )}

        {/* Performer name overlay for viewers */}
        {currentPerformer && !isPerformer && (
          <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
            {currentPerformer.display_name}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Public component ───────────────────────────────────────────────────────────
export const RecitalVideoPanel = () => {
  const { activeRecital } = useRecital();

  if (!activeRecital) return null;

  if (!activeRecital.daily_room_url) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <Video className="h-12 w-12" />
        <p className="text-sm">Video room is being set up…</p>
      </div>
    );
  }

  return (
    <DailyProvider url={activeRecital.daily_room_url}>
      <RecitalCallInner />
    </DailyProvider>
  );
};
