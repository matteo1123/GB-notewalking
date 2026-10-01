import type { RefObject } from 'react';
import { Camera, CameraOff, Circle, Loader2, Square, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RecordingPreviewDialog } from './RecordingPreviewDialog';
import { useSessionRecording } from './useSessionRecording';
import type { SessionEventLog } from './sessionEventLog';
import { PIP_CORNERS, canRecord, formatElapsed, type FilenameParts, type PipCorner } from './recordingUtils';

interface SessionRecorderProps {
  micStream: MediaStream | null;
  captureRef?: RefObject<Element>;
  filenameParts: FilenameParts;
  eventLog?: SessionEventLog;
  getSnapshot?: () => Record<string, unknown>;
}

const CORNER_LABEL: Record<PipCorner, string> = {
  'top-left': 'Top left',
  'top-right': 'Top right',
  'bottom-left': 'Bottom left',
  'bottom-right': 'Bottom right',
};

function nextCorner(c: PipCorner): PipCorner {
  return PIP_CORNERS[(PIP_CORNERS.indexOf(c) + 1) % PIP_CORNERS.length];
}

// Record / Stop control for the practice sidebar, plus the setup dialog,
// the 3-2-1 overlay and the preview + share screen. Self-contained: the host
// only passes in streams and naming data it already has.
export function SessionRecorder({ micStream, captureRef, filenameParts, eventLog, getSnapshot }: SessionRecorderProps) {
  const rec = useSessionRecording({ micStream, captureRef, filenameParts, eventLog, getSnapshot });
  const { phase, prefs } = rec;

  if (!canRecord()) return null;

  const setupOpen = phase === 'setup' || phase === 'acquiring' || phase === 'camera-denied';
  const isLive = phase === 'recording' || phase === 'countdown' || phase === 'finalizing';

  return (
    <div className="border-t border-gray-800 pt-2 mt-1 flex flex-col gap-1">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Record</div>

      {!isLive ? (
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={rec.openSetup}
          disabled={phase === 'preview'}
          title="Record this session as a video"
        >
          <Circle className="w-3.5 h-3.5 mr-1 fill-red-500 text-red-500" /> Record
        </Button>
      ) : (
        <>
          <div className="flex items-center gap-1">
            <div
              className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded bg-red-600/20 border border-red-600/50 text-red-300 text-xs font-bold tabular-nums"
              aria-live="polite"
            >
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              {phase === 'countdown' ? 'Ready…' : phase === 'finalizing' ? 'Saving…' : formatElapsed(rec.elapsedMs)}
            </div>
            <Button
              size="sm"
              className="h-8 px-2 text-xs bg-red-600 hover:bg-red-700 text-white"
              onClick={() => void rec.stop()}
              disabled={phase === 'finalizing'}
              title={phase === 'countdown' ? 'Cancel' : 'Stop recording'}
            >
              {phase === 'finalizing' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Square className="w-3 h-3 mr-1 fill-current" /> {phase === 'countdown' ? 'Cancel' : 'Stop'}
                </>
              )}
            </Button>
          </div>
          {phase !== 'finalizing' && (
            <div className="flex items-center gap-1">
              <button
                className={`flex-1 h-7 text-[10px] rounded font-bold inline-flex items-center justify-center gap-1 ${
                  rec.cameraVisible ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
                onClick={() => void rec.toggleCamera()}
                title="Show or hide the camera overlay"
              >
                {rec.cameraVisible ? <Camera className="w-3 h-3" /> : <CameraOff className="w-3 h-3" />}
                Cam
              </button>
              {prefs.layout === 'landscape' && rec.cameraVisible && (
                <button
                  className="flex-1 h-7 text-[10px] rounded font-bold bg-muted text-muted-foreground hover:text-foreground"
                  onClick={() => rec.setCorner(nextCorner(rec.corner))}
                  title={`Camera corner: ${CORNER_LABEL[rec.corner]} (click to move)`}
                >
                  ↻ {CORNER_LABEL[rec.corner]}
                </button>
              )}
            </div>
          )}
          {rec.cameraError && phase === 'recording' && (
            <div className="text-[10px] text-amber-400 leading-tight">{rec.cameraError}</div>
          )}
          {!rec.micActive && phase === 'recording' && (
            <div className="text-[10px] text-amber-400 leading-tight">Mic is off — guitar isn't being recorded.</div>
          )}
        </>
      )}

      <Dialog open={setupOpen} onOpenChange={(open) => !open && rec.cancelSetup()}>
        <DialogContent className="max-w-md bg-zinc-950 border-zinc-800 text-slate-100">
          {phase === 'camera-denied' ? (
            <>
              <DialogHeader>
                <DialogTitle>Camera unavailable</DialogTitle>
                <DialogDescription>
                  {rec.cameraError} You can still record the practice screen with your guitar and the app's audio.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={rec.cancelSetup}>
                  Cancel
                </Button>
                <Button onClick={rec.continueScreenOnly}>Record screen only</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Video className="w-5 h-5" /> Record session
                </DialogTitle>
                <DialogDescription>
                  {rec.screenSupported
                    ? 'Your browser will ask what to share. Choose this tab.'
                    : "This browser can't capture the screen, so this will be a camera-only recording."}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-4 text-sm">
                <div className="flex flex-col gap-1.5">
                  <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Format</div>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ['landscape', '16:9 Landscape', 'YouTube, Facebook'],
                        ['vertical', '9:16 Vertical', 'Shorts, Reels'],
                      ] as const
                    ).map(([value, label, hint]) => (
                      <button
                        key={value}
                        onClick={() => rec.setPrefs({ layout: value })}
                        className={`rounded border px-3 py-2 text-left ${
                          prefs.layout === value
                            ? 'border-primary bg-primary/15 text-foreground'
                            : 'border-zinc-800 text-muted-foreground hover:border-zinc-600'
                        }`}
                      >
                        <div className="font-bold text-xs">{label}</div>
                        <div className="text-[10px] opacity-70">{hint}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center justify-between gap-3">
                  <span>
                    <span className="font-semibold">Camera</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {prefs.layout === 'vertical' ? 'Shown below the screen' : 'Picture-in-picture overlay'}
                    </span>
                  </span>
                  <Switch
                    checked={prefs.cameraEnabled || !rec.screenSupported}
                    disabled={!rec.screenSupported}
                    onCheckedChange={(v) => rec.setPrefs({ cameraEnabled: v })}
                  />
                </label>

                {prefs.layout === 'landscape' && prefs.cameraEnabled && rec.screenSupported && (
                  <div className="flex flex-col gap-1.5">
                    <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Camera corner
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 w-40">
                      {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as PipCorner[]).map((c) => (
                        <button
                          key={c}
                          onClick={() => rec.setPrefs({ corner: c })}
                          aria-label={CORNER_LABEL[c]}
                          title={CORNER_LABEL[c]}
                          className={`h-10 rounded border relative ${
                            prefs.corner === c ? 'border-primary bg-primary/15' : 'border-zinc-800 hover:border-zinc-600'
                          }`}
                        >
                          <span
                            className={`absolute w-4 h-3 rounded-sm ${
                              prefs.corner === c ? 'bg-primary' : 'bg-zinc-600'
                            } ${c.startsWith('top') ? 'top-1' : 'bottom-1'} ${c.endsWith('left') ? 'left-1' : 'right-1'}`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className={`text-xs ${rec.micActive ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {rec.micActive
                    ? 'Mic is on: your guitar and the chord playback will both be recorded.'
                    : "Mic is off: only the chord playback will be recorded. Turn on Mic to capture your guitar."}
                </div>

                {rec.error && <div className="text-xs text-red-400">{rec.error}</div>}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={rec.cancelSetup} disabled={phase === 'acquiring'}>
                  Cancel
                </Button>
                <Button
                  onClick={() => void rec.start()}
                  disabled={phase === 'acquiring'}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {phase === 'acquiring' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Waiting for permission…
                    </>
                  ) : (
                    <>
                      <Circle className="w-4 h-4 mr-1 fill-current" /> Start recording
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {phase === 'countdown' && rec.countdown > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 pointer-events-none">
          <div
            key={rec.countdown}
            className="text-[160px] font-black text-white drop-shadow-[0_0_30px_rgba(239,68,68,0.8)] animate-in zoom-in-50 fade-in duration-300"
          >
            {rec.countdown}
          </div>
        </div>
      )}

      {phase === 'preview' && rec.result && (
        <RecordingPreviewDialog result={rec.result} onDiscard={rec.discard} />
      )}
    </div>
  );
}
