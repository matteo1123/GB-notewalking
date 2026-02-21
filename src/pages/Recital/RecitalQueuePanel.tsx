import { useRecital } from '@/contexts/RecitalContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { PerformerSlotTimer } from './PerformerSlotTimer';
import { Mic, MicOff, SkipForward, Ban, Video, VideoOff } from 'lucide-react';

export const RecitalQueuePanel = () => {
  const {
    activeRecital, queue, myQueueEntry, isAdmin, isPerformer,
    joinQueue, toggleReady, advancePerformer, banUserFromChat, banUserFromVideo, viewerCount,
  } = useRecital();
  const { user } = useAuth();

  if (!activeRecital) return null;

  // Sort: performing first, then ready (by joined_at), then not-ready, then done
  const currentPerformerId = activeRecital.current_performer_id;
  const sorted = [...queue].sort((a, b) => {
    const rank = (e: typeof a) => {
      if (e.user_id === currentPerformerId) return 0;
      if (e.performed_at) return 3;
      if (e.ready && !e.video_banned) return 1;
      return 2;
    };
    const diff = rank(a) - rank(b);
    if (diff !== 0) return diff;
    return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
  });

  const readyCount = queue.filter(e => e.ready && !e.video_banned && !e.performed_at && e.user_id !== currentPerformerId).length;

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b space-y-1">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Queue</h3>
          <span className="text-xs text-muted-foreground">{viewerCount} watching</span>
        </div>

        {/* Current performer + timer */}
        {currentPerformerId && (
          <div className="rounded-md bg-primary/10 border border-primary/30 p-2 text-center space-y-1">
            <p className="text-xs font-medium text-primary">
              {currentPerformerId === user?.id
                ? '🎸 Your turn!'
                : `🎸 ${queue.find(e => e.user_id === currentPerformerId)?.display_name ?? 'Performing'}`}
            </p>
            <PerformerSlotTimer />
          </div>
        )}

        {/* Admin advance button */}
        {isAdmin && currentPerformerId && (
          <Button variant="outline" size="sm" className="w-full" onClick={advancePerformer}>
            <SkipForward className="h-3 w-3 mr-1" />
            Next Performer ({readyCount} ready)
          </Button>
        )}

        {/* Admin start first performer */}
        {isAdmin && !currentPerformerId && readyCount > 0 && (
          <Button size="sm" className="w-full" onClick={advancePerformer}>
            Start First Performer
          </Button>
        )}
      </div>

      {/* User join / ready controls */}
      {user && (
        <div className="p-3 border-b flex gap-2">
          {!myQueueEntry ? (
            <Button size="sm" className="flex-1" onClick={joinQueue}>
              Join Queue
            </Button>
          ) : myQueueEntry.video_banned ? (
            <p className="text-xs text-destructive flex-1 text-center">
              You are banned from performing video
            </p>
          ) : myQueueEntry.performed_at ? (
            <p className="text-xs text-muted-foreground flex-1 text-center">
              You've performed — thanks!
            </p>
          ) : (
            <Button
              size="sm"
              className="flex-1"
              variant={myQueueEntry.ready ? 'default' : 'outline'}
              onClick={toggleReady}
            >
              {myQueueEntry.ready ? (
                <><Mic className="h-3 w-3 mr-1" /> Ready</>
              ) : (
                <><MicOff className="h-3 w-3 mr-1" /> Not Ready</>
              )}
            </Button>
          )}
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-1">
          {sorted.map((entry) => {
            const isCurrentPerformer = entry.user_id === currentPerformerId;
            const isDone = !!entry.performed_at;
            return (
              <div
                key={entry.id}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                  isCurrentPerformer ? 'bg-primary/10 border border-primary/30' :
                  isDone ? 'opacity-40' : ''
                }`}
              >
                <span className="flex-1 truncate font-medium">
                  {entry.user_id === user?.id ? 'You' : entry.display_name}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {isCurrentPerformer && <Badge variant="default" className="text-xs py-0">On</Badge>}
                  {isDone && <Badge variant="secondary" className="text-xs py-0">Done</Badge>}
                  {!isDone && !isCurrentPerformer && entry.ready && !entry.video_banned && (
                    <Badge variant="outline" className="text-xs py-0 text-green-600 border-green-600">Ready</Badge>
                  )}
                  {entry.video_banned && <Badge variant="destructive" className="text-xs py-0">Video Banned</Badge>}

                  {/* Admin ban buttons */}
                  {isAdmin && entry.user_id !== user?.id && (
                    <>
                      {!entry.chat_banned_this_session && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive">
                              <Ban className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Chat Ban</AlertDialogTitle>
                              <AlertDialogDescription>
                                Ban {entry.display_name} from chat for this recital? 3 bans = permanent chat ban.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => banUserFromChat(entry.user_id, entry.display_name)}>
                                Ban from Chat
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      {!entry.video_banned && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive">
                              <VideoOff className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Video Ban</AlertDialogTitle>
                              <AlertDialogDescription>
                                Ban {entry.display_name} from performing video? They can still watch and chat.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => banUserFromVideo(entry.user_id)}>
                                Ban from Video
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {queue.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">
              No one in the queue yet. Join and mark yourself ready!
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
