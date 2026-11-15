// The recording, in the Android app: the phone's screen video is already saved on the phone;
// Share writes the other files (sound, camera, app sound, session data) next to it and hands
// them all to Android's share sheet (Drive, for the pipeline).
import { useState } from 'react';
import { Share2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { removeFiles, saveFile, shareFiles } from '@/native/nativeApp';
import { formatBytes, formatElapsed } from './recordingUtils';
import type { RecordingResult } from './useSessionRecording';

export function AppRecordingPreview({ result, onDiscard }: { result: RecordingResult; onDiscard: () => void }) {
  const { screen, name, bytes, url, durationMs, dataFile, companions } = result;
  const extras = [...companions, dataFile];
  const extrasSize = extras.reduce((n, f) => n + f.size, 0);
  const [saved, setSaved] = useState<string[] | null>(null); // paths of the extras, once written
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shared, setShared] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const share = async () => {
    if (!screen) return;
    setError(null);
    try {
      let paths = saved;
      if (!paths) {
        paths = [];
        const total = extrasSize || 1;
        let done = 0;
        for (const f of extras) {
          paths.push(
            await saveFile(f, f.name, (n) => setProgress(`Saving… ${Math.round(((done + n) / total) * 100)}%`)),
          );
          done += f.size;
        }
        setSaved(paths);
        setProgress(null);
      }
      await shareFiles([screen.path, ...paths], 'Notewalking practice session');
      setShared(true);
    } catch (e) {
      setProgress(null);
      setError(`Sharing failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const discard = () => {
    void removeFiles([...(screen ? [screen.path] : []), ...(saved ?? [])]).catch(() => {});
    onDiscard();
  };

  const requestClose = () => {
    if (shared) onDiscard();
    else setConfirmDiscard(true);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && requestClose()}>
      <DialogContent className="max-w-2xl bg-zinc-950 border-zinc-800 text-slate-100 max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Your recording</DialogTitle>
          <DialogDescription className="font-mono text-[11px] break-all">
            {name} · {formatElapsed(durationMs)} · {formatBytes(bytes)}
          </DialogDescription>
        </DialogHeader>

        {/* the screen video alone: the sound is its own file, joined by the pipeline */}
        <video src={url} controls playsInline muted className="w-full max-h-[55vh] rounded bg-black" />

        <div className="flex flex-col gap-2">
          <Button onClick={() => void share()} disabled={!!progress}>
            <Share2 className="w-4 h-4 mr-1" /> {progress ?? 'Share…'}
          </Button>
          {error && <div className="text-xs text-red-400">{error}</div>}
          <div className="text-[11px] text-muted-foreground">
            Shares the screen video with its sound, camera and session data ({formatBytes(extrasSize)}). Pick Drive
            for the pipeline. The preview is silent: the sound is its own file, joined later.
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {confirmDiscard ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-red-300">Discard this video? It hasn't been shared.</span>
              <Button size="sm" variant="destructive" onClick={discard}>
                Discard
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmDiscard(false)}>
                Keep
              </Button>
            </div>
          ) : (
            <Button variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => (shared ? discard() : setConfirmDiscard(true))}>
              <Trash2 className="w-4 h-4 mr-1" /> {shared ? 'Delete from phone' : 'Discard…'}
            </Button>
          )}
          {shared && !confirmDiscard && <Button onClick={onDiscard}>Done</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
