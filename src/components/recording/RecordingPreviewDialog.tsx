import { useMemo, useState, type SyntheticEvent } from 'react';
import { Download, ExternalLink, Share2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SHARE_TARGETS, canShareFile, formatBytes, formatElapsed } from './recordingUtils';
import type { RecordingResult } from './useSessionRecording';

interface RecordingPreviewDialogProps {
  result: RecordingResult;
  onDiscard: () => void;
}

// MediaRecorder output (WebM especially) often has no duration in its
// header, so Chrome reports Infinity and the scrubber doesn't work. Seeking
// far past the end forces the browser to scan the file and learn it.
function fixUnknownDuration(e: SyntheticEvent<HTMLVideoElement>) {
  const v = e.currentTarget;
  if (v.duration !== Infinity && !Number.isNaN(v.duration)) return;
  const onUpdate = () => {
    v.removeEventListener('timeupdate', onUpdate);
    v.currentTime = 0;
  };
  v.addEventListener('timeupdate', onUpdate);
  v.currentTime = 1e101;
}

export function RecordingPreviewDialog({ result, onDiscard }: RecordingPreviewDialogProps) {
  const { file, url, durationMs } = result;
  const shareable = useMemo(() => canShareFile(file), [file]);
  const [saved, setSaved] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const download = () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setSaved(true);
  };

  const share = async () => {
    setShareError(null);
    try {
      await navigator.share({ files: [file], title: 'Guitar Brain practice session' });
      setSaved(true);
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return; // user closed the sheet
      setShareError('Sharing failed. Use Download instead.');
    }
  };

  // Download first, then open the upload page — both inside the click so the
  // new tab isn't treated as a popup.
  const downloadAndOpen = (href: string) => {
    download();
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  // Closing (X, Esc, outside click) would lose an unsaved video, so route it
  // through the discard confirmation until the user has saved or shared.
  const requestClose = () => {
    if (saved) onDiscard();
    else setConfirmDiscard(true);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && requestClose()}>
      <DialogContent className="max-w-2xl bg-zinc-950 border-zinc-800 text-slate-100 max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Your recording</DialogTitle>
          <DialogDescription className="font-mono text-[11px] break-all">
            {file.name} · {formatElapsed(durationMs)} · {formatBytes(file.size)}
          </DialogDescription>
        </DialogHeader>

        <video
          src={url}
          controls
          playsInline
          onLoadedMetadata={fixUnknownDuration}
          className="w-full max-h-[55vh] rounded bg-black"
        />

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {shareable && (
              <Button onClick={() => void share()} className="flex-1 min-w-[140px]">
                <Share2 className="w-4 h-4 mr-1" /> Share…
              </Button>
            )}
            <Button
              onClick={download}
              variant={shareable ? 'outline' : 'default'}
              className="flex-1 min-w-[140px]"
            >
              <Download className="w-4 h-4 mr-1" /> Download
            </Button>
          </div>
          {shareError && <div className="text-xs text-red-400">{shareError}</div>}

          <div className="flex flex-col gap-1.5">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Post it</div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => downloadAndOpen(SHARE_TARGETS.youtube)}>
                YouTube <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => downloadAndOpen(SHARE_TARGETS.drive)}>
                Google Drive <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
              {SHARE_TARGETS.facebookGroup && (
                <Button size="sm" variant="outline" onClick={() => downloadAndOpen(SHARE_TARGETS.facebookGroup)}>
                  Facebook group <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Each button saves the video, then opens the upload page in a new tab. Drag the file in from your
              downloads.
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {confirmDiscard ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-red-300">Discard this video? It hasn't been saved.</span>
              <Button size="sm" variant="destructive" onClick={onDiscard}>
                Discard
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmDiscard(false)}>
                Keep
              </Button>
            </div>
          ) : (
            <Button variant="ghost" className="text-red-400 hover:text-red-300" onClick={requestClose}>
              <Trash2 className="w-4 h-4 mr-1" /> {saved ? 'Discard' : 'Discard…'}
            </Button>
          )}
          {saved && !confirmDiscard && <Button onClick={onDiscard}>Done</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
