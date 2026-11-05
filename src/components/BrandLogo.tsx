import { useEffect, useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { Camera, CameraOff, FileText, MessageCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CreatorBriefCard, useCreatorBrief, useIsCreator } from '@/components/recording/CreatorBrief';
import { useRecorderHandle, type RecorderHandle } from '@/components/recording/recorderBridge';
import { PIP_CORNERS, formatElapsed, type PipCorner } from '@/components/recording/recordingUtils';

// The GuitarBrain mark. For everyone but the creator it's the plain logo.
// For the creator:
//   * on page load the logo "winks": it turns into a red record dot for a
//     moment, then fades back;
//   * on the practice view the logo IS the record button: click to start
//     recording right away (screen + camera + mic), click again to stop.
//     Shift-click or right-click opens the recording options instead.
//   * while recording, the timer, Cam, Talk and the day's brief sit next to it.

const WINK_MS = 1600;
// Once per page load, shared by every logo on screen (Skill Tree HUD and the
// header), and robust to StrictMode's double effects.
let winkUntil: number | null = null;

function useWink(isCreator: boolean): boolean {
  const [wink, setWink] = useState(false);
  useEffect(() => {
    if (!isCreator) return;
    if (winkUntil === null) winkUntil = performance.now() + WINK_MS;
    const left = winkUntil - performance.now();
    if (left <= 0) return;
    setWink(true);
    const t = setTimeout(() => setWink(false), left);
    return () => clearTimeout(t);
  }, [isCreator]);
  return wink;
}

interface BrandLogoProps {
  /** Size classes for the mark, e.g. "h-8 w-8". */
  markClass?: string;
  /** Classes for the wordmark. */
  textClass?: string;
  /** Header: a link home (and the record trigger on the practice view). HUD: decorative. */
  interactive?: boolean;
}

export function BrandLogo({
  markClass = 'h-8 w-8',
  textClass = 'text-lg',
  interactive = true,
}: BrandLogoProps) {
  const isCreator = useIsCreator();
  const wink = useWink(isCreator);
  const handle = useRecorderHandle();
  const recorder = interactive && isCreator ? handle : null;
  const phase = recorder?.rec.phase ?? 'idle';
  const live = phase === 'acquiring' || phase === 'countdown' || phase === 'recording' || phase === 'finalizing';
  const red = wink || live;

  const mark = (
    <span className={`relative inline-block shrink-0 ${markClass}`}>
      <img
        src="/logo2.png"
        alt="GuitarBrain"
        className={`h-full w-full object-contain transition-all duration-500 ${red ? 'opacity-0 scale-75' : 'opacity-100'}`}
      />
      <span
        aria-hidden
        className={`absolute inset-[12%] rounded-full transition-all duration-500 ${
          red ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
        } ${phase === 'recording' ? 'animate-pulse' : ''}`}
        style={{
          background: 'radial-gradient(circle at 35% 35%, #fca5a5, #ef4444 60%, #b91c1c)',
          boxShadow: '0 0 12px rgba(239, 68, 68, 0.9)',
        }}
      />
    </span>
  );
  const wordmark = (
    <span className={`${textClass} font-black tracking-tight text-foreground`}>
      Guitar<span className="text-primary">Brain</span>
    </span>
  );

  if (!interactive) {
    return (
      <span className="flex items-center gap-2">
        {mark}
        {wordmark}
      </span>
    );
  }

  if (!recorder) {
    return (
      <Link to="/" className="flex items-center gap-2">
        {mark}
        {wordmark}
      </Link>
    );
  }

  const { rec } = recorder;
  const onClick = (e: MouseEvent) => {
    e.preventDefault();
    if (e.shiftKey) {
      if (rec.phase === 'idle') rec.openSetup();
      return;
    }
    if (rec.phase === 'idle') void rec.start({ countdown: false });
    else if (rec.phase === 'countdown' || rec.phase === 'recording') void rec.stop();
  };
  const onContextMenu = (e: MouseEvent) => {
    if (rec.phase !== 'idle') return;
    e.preventDefault();
    rec.openSetup();
  };

  return (
    <div className="flex items-center gap-2 min-w-0">
      <button
        type="button"
        onClick={onClick}
        onContextMenu={onContextMenu}
        className="flex items-center gap-2 select-none"
        title={
          phase === 'recording'
            ? `Recording ${formatElapsed(rec.elapsedMs)}. Click to stop`
            : phase === 'idle'
              ? 'Click to record · right-click or Shift-click for options'
              : undefined
        }
      >
        {mark}
        <span className={live ? 'hidden md:inline' : undefined}>{wordmark}</span>
      </button>
      {live && <LiveControls recorder={recorder} />}
    </div>
  );
}

const CORNER_SHORT: Record<PipCorner, string> = {
  'top-left': 'TL',
  'top-right': 'TR',
  'bottom-left': 'BL',
  'bottom-right': 'BR',
};

function LiveControls({ recorder }: { recorder: RecorderHandle }) {
  const { rec, musicKey } = recorder;
  const brief = useCreatorBrief(true);
  const { phase } = rec;
  const chip = 'h-6 px-2 rounded text-[10px] font-bold inline-flex items-center gap-1 shrink-0';

  if (phase !== 'recording') {
    return (
      <span className="text-[11px] font-mono text-red-300 shrink-0" aria-live="polite">
        {phase === 'finalizing' ? 'Saving…' : phase === 'acquiring' ? 'Pick this tab…' : 'Ready…'}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1 min-w-0">
      <span className="text-[11px] font-mono tabular-nums text-red-300 shrink-0" aria-live="polite">
        {formatElapsed(rec.elapsedMs)}
      </span>
      <button
        className={`${chip} ${rec.cameraVisible ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
        onClick={() => void rec.toggleCamera()}
        title="Show or hide the camera overlay"
      >
        {rec.cameraVisible ? <Camera className="w-3 h-3" /> : <CameraOff className="w-3 h-3" />}
        <span className="hidden sm:inline">Cam</span>
      </button>
      {rec.prefs.layout === 'landscape' && rec.cameraVisible && (
        <button
          className={`${chip} bg-muted text-muted-foreground hover:text-foreground font-mono`}
          onClick={() => rec.setCorner(PIP_CORNERS[(PIP_CORNERS.indexOf(rec.corner) + 1) % PIP_CORNERS.length])}
          title="Move the camera to the next corner"
        >
          ↻ {CORNER_SHORT[rec.corner]}
        </button>
      )}
      <button
        className={`${chip} ${rec.talking ? 'bg-amber-500 text-black animate-pulse' : 'bg-muted text-muted-foreground'}`}
        onClick={rec.toggleTalk}
        title="Mark the part where you're talking to camera (becomes a teaching Short)"
      >
        <MessageCircle className="w-3 h-3" />
        {rec.talking ? 'Talking' : 'Talk'}
      </button>
      {brief && (
        <Popover>
          <PopoverTrigger asChild>
            <button className={`${chip} bg-muted text-muted-foreground hover:text-foreground`} title="Today's brief">
              <FileText className="w-3 h-3" />
              <span className="hidden sm:inline">Brief</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 bg-black/95 border-white/10 p-3" sideOffset={8} align="start">
            <CreatorBriefCard brief={brief} musicKey={musicKey} compact />
          </PopoverContent>
        </Popover>
      )}
      {(rec.cameraError || !rec.micActive) && (
        <span
          className="text-[10px] text-amber-400 truncate"
          title={rec.cameraError ?? "Mic is off, so your guitar isn't being recorded."}
        >
          ⚠ {rec.cameraError ? 'Camera' : 'Mic off'}
        </span>
      )}
    </div>
  );
}
