import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { CameraUnavailableError, RecordingEngine } from './RecordingEngine';
import { serializeSessionLog, type SessionEventLog } from './sessionEventLog';
import {
  buildRecordingFilename,
  canCaptureScreen,
  extensionForMime,
  type FilenameParts,
  type PipCorner,
  type RecordingLayout,
} from './recordingUtils';

export type RecordingPhase =
  | 'idle'
  | 'setup'
  | 'acquiring'
  | 'camera-denied'
  | 'countdown'
  | 'recording'
  | 'finalizing'
  | 'preview';

export interface RecordingPrefs {
  layout: RecordingLayout;
  cameraEnabled: boolean;
  corner: PipCorner;
}

export interface RecordingResult {
  file: File;
  url: string;
  durationMs: number;
  /** Sidecar JSON of what the app did, named to match the video. */
  dataFile: File;
  /** Full-res camera (`<name>.camera.mp4`) and mic-only audio (`<name>.mic.m4a`), when recorded. */
  companions: File[];
}

// Companion filenames: `<name>.camera.<ext>` / `<name>.mic.<ext>`. The
// pipeline pairs files by everything before the role suffix.
function companionExt(mime: string, kind: 'camera' | 'mic'): string {
  if (mime.includes('mp4')) return kind === 'mic' ? 'm4a' : 'mp4';
  return 'webm';
}

export const SESSION_LOG_FORMAT = 'guitarbrain-session-log';

const PREFS_KEY = 'gb.recording.prefs.v1';
const DEFAULT_PREFS: RecordingPrefs = { layout: 'landscape', cameraEnabled: true, corner: 'bottom-right' };

function readPrefs(): RecordingPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

function writePrefs(prefs: RecordingPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // private mode etc. — prefs just won't persist
  }
}

interface UseSessionRecordingArgs {
  /** The stream pitch detection already has open. Read-only; never stopped here. */
  micStream: MediaStream | null;
  /** Element to crop the tab capture to (Region Capture, Chromium only). */
  captureRef?: RefObject<Element>;
  filenameParts: FilenameParts;
  /** Host-owned log the host appends chord/note events to. */
  eventLog?: SessionEventLog;
  /** State of the app at the first frame; becomes the log's first event. */
  getSnapshot?: () => Record<string, unknown>;
}

export function useSessionRecording({
  micStream,
  captureRef,
  filenameParts,
  eventLog,
  getSnapshot,
}: UseSessionRecordingArgs) {
  const [phase, setPhase] = useState<RecordingPhase>('idle');
  const [prefs, setPrefsState] = useState<RecordingPrefs>(readPrefs);
  const [countdown, setCountdown] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraLive, setCameraLive] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(true);
  const [corner, setCornerState] = useState<PipCorner>(prefs.corner);
  const [result, setResult] = useState<RecordingResult | null>(null);

  const engineRef = useRef<RecordingEngine | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startedAtRef = useRef(0);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  // Freeze the name inputs at start so a key change mid-recording doesn't
  // rename the file to a key that was only played for the last few seconds.
  const filenamePartsRef = useRef(filenameParts);
  const micStreamRef = useRef(micStream);
  micStreamRef.current = micStream;
  const mimeRef = useRef('video/webm');
  const eventLogRef = useRef(eventLog);
  eventLogRef.current = eventLog;
  const getSnapshotRef = useRef(getSnapshot);
  getSnapshotRef.current = getSnapshot;

  const setPrefs = useCallback((update: Partial<RecordingPrefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...update };
      writePrefs(next);
      return next;
    });
    if (update.corner) setCornerState(update.corner);
  }, []);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    elapsedTimerRef.current = null;
  }, []);

  const teardownEngine = useCallback(() => {
    engineRef.current?.dispose();
    engineRef.current = null;
    eventLogRef.current?.clear();
    setCameraLive(false);
  }, []);

  const releaseResult = useCallback(() => {
    setResult((r) => {
      if (r) URL.revokeObjectURL(r.url);
      return null;
    });
  }, []);

  // Keep the mixer pointed at whatever mic stream pitch detection currently
  // has (it's replaced when the user toggles the mic off and on again).
  useEffect(() => {
    engineRef.current?.setMicStream(micStream);
  }, [micStream]);

  const stop = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (phaseRef.current === 'countdown' || phaseRef.current === 'acquiring' || phaseRef.current === 'camera-denied') {
      // Nothing recorded yet — just back out.
      clearTimers();
      teardownEngine();
      setPhase('idle');
      return;
    }
    if (phaseRef.current !== 'recording') return;
    clearTimers();
    const durationMs = performance.now() - startedAtRef.current;
    // Close the log before the async encoder flush so nothing after the
    // Stop click lands in it.
    const events = eventLogRef.current?.stop() ?? [];
    setPhase('finalizing');
    const output = await engine.stop();
    const blob = output.main;
    teardownEngine();
    if (blob.size === 0) {
      setError('The recording came out empty. Please try again.');
      setPhase('setup');
      return;
    }
    const name = buildRecordingFilename(filenamePartsRef.current, extensionForMime(blob.type || mimeRef.current));
    const file = new File([blob], name, { type: blob.type || mimeRef.current });
    const stem = name.replace(/\.[^.]+$/, '');
    const companions: File[] = [];
    const companionMeta: Record<string, { file: string; offsetMs: number }> = {};
    for (const kind of ['camera', 'mic'] as const) {
      const c = output[kind];
      if (!c) continue;
      const cname = `${stem}.${kind}.${companionExt(c.blob.type, kind)}`;
      companions.push(new File([c.blob], cname, { type: c.blob.type }));
      companionMeta[kind] = { file: cname, offsetMs: c.offsetMs };
    }
    const log = {
      format: SESSION_LOG_FORMAT,
      version: 1,
      video: name,
      recordedAt: new Date(Date.now() - durationMs).toISOString(),
      durationMs: Math.round(durationMs),
      timeBase: 't = milliseconds from the first frame of the video',
      // offsetMs: how long after the main video's first frame each companion's
      // first frame was captured (main time = companion time + offsetMs).
      companions: companionMeta,
    };
    const dataFile = new File([serializeSessionLog(log, events)], name.replace(/\.[^.]+$/, '.json'), {
      type: 'application/json',
    });
    setResult({ file, url: URL.createObjectURL(file), durationMs, dataFile, companions });
    setPhase('preview');
  }, [clearTimers, teardownEngine]);

  const beginCountdown = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setMicStream(micStreamRef.current);
    engine.startCompositing();
    setPhase('countdown');
    setCountdown(3);
    timersRef.current.push(setTimeout(() => setCountdown(2), 1000));
    timersRef.current.push(setTimeout(() => setCountdown(1), 2000));
    timersRef.current.push(
      setTimeout(() => {
        setCountdown(0);
        // Give the overlay a moment to unpaint so "1" isn't the first frame.
        timersRef.current.push(
          setTimeout(() => {
            if (engineRef.current !== engine) return;
            try {
              mimeRef.current = engine.startRecording();
            } catch (err) {
              console.error('[recording] MediaRecorder failed to start', err);
              teardownEngine();
              setError('This browser could not start the video encoder.');
              setPhase('setup');
              return;
            }
            startedAtRef.current = performance.now();
            eventLogRef.current?.start(startedAtRef.current);
            eventLogRef.current?.add('recording-start', getSnapshotRef.current?.() ?? {});
            if (engine.layoutInfo) eventLogRef.current?.add('layout', { ...engine.layoutInfo });
            setElapsedMs(0);
            elapsedTimerRef.current = setInterval(
              () => setElapsedMs(performance.now() - startedAtRef.current),
              250,
            );
            setPhase('recording');
          }, 150),
        );
      }, 3000),
    );
  }, [teardownEngine]);

  const openSetup = useCallback(() => {
    setError(null);
    setCameraError(null);
    setPhase('setup');
  }, []);

  const cancelSetup = useCallback(() => {
    clearTimers();
    teardownEngine();
    setPhase('idle');
  }, [clearTimers, teardownEngine]);

  // Called directly from the Start button's click handler.
  const start = useCallback(async () => {
    setError(null);
    setCameraError(null);
    filenamePartsRef.current = filenameParts;
    const screenSupported = canCaptureScreen();
    // Without screen capture the camera is the whole picture.
    const wantCamera = prefs.cameraEnabled || !screenSupported;
    const engine = new RecordingEngine({
      layout: prefs.layout,
      corner: prefs.corner,
      cameraVisible: wantCamera,
    });
    engineRef.current = engine;
    // Layout events let downstream tools crop the screen and camera apart.
    engine.onLayoutChange = (info) => eventLogRef.current?.add('layout', { ...info });
    engine.onScreenEnded = () => {
      // User hit the browser's own "Stop sharing" button.
      if (phaseRef.current === 'recording') void stop();
      else if (engineRef.current === engine) {
        teardownEngine();
        setPhase('idle');
      }
    };
    setCornerState(prefs.corner);
    setCameraVisible(wantCamera);
    setPhase('acquiring');

    if (screenSupported) {
      try {
        await engine.acquireScreen(captureRef?.current);
      } catch (err) {
        teardownEngine();
        const name = (err as DOMException)?.name;
        setError(
          name === 'NotAllowedError' || name === 'AbortError'
            ? 'Screen sharing was cancelled. Pick this tab in the browser prompt to record the practice view.'
            : 'Screen capture could not start.',
        );
        setPhase('setup');
        return;
      }
    }
    if (engineRef.current !== engine) return;

    if (wantCamera) {
      try {
        await engine.acquireCamera();
        setCameraLive(true);
      } catch (err) {
        if (engineRef.current !== engine) return;
        const reason = err instanceof CameraUnavailableError ? err.message : 'The camera could not be started.';
        if (!screenSupported) {
          teardownEngine();
          setError(`${reason} This browser can't capture the screen either, so there's nothing to record.`);
          setPhase('setup');
          return;
        }
        setCameraError(reason);
        setPhase('camera-denied');
        return;
      }
    }
    if (engineRef.current !== engine) return;
    beginCountdown();
  }, [filenameParts, prefs, captureRef, stop, teardownEngine, beginCountdown]);

  const continueScreenOnly = useCallback(() => {
    engineRef.current?.setCameraVisible(false);
    setCameraVisible(false);
    beginCountdown();
  }, [beginCountdown]);

  const toggleCamera = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (cameraVisible) {
      engine.setCameraVisible(false);
      setCameraVisible(false);
      return;
    }
    if (!engine.hasCamera) {
      try {
        await engine.acquireCamera();
        setCameraLive(true);
      } catch (err) {
        setCameraError(err instanceof CameraUnavailableError ? err.message : 'The camera could not be started.');
        return;
      }
    }
    engine.setCameraVisible(true);
    setCameraVisible(true);
  }, [cameraVisible]);

  const setCorner = useCallback(
    (c: PipCorner) => {
      engineRef.current?.setCorner(c);
      setPrefs({ corner: c });
    },
    [setPrefs],
  );

  const discard = useCallback(() => {
    clearTimers();
    teardownEngine();
    releaseResult();
    setPhase('idle');
  }, [clearTimers, teardownEngine, releaseResult]);

  // Warn before the tab closes/reloads while anything would be lost.
  const guardLeave =
    phase === 'countdown' || phase === 'recording' || phase === 'finalizing' || phase === 'preview';
  useEffect(() => {
    if (!guardLeave) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [guardLeave]);

  // In-app links (e.g. "Skill Tree") unmount the practice view, which would
  // silently throw the recording away. BrowserRouter has no blocker API, so
  // intercept link clicks while recording.
  useEffect(() => {
    if (phase !== 'recording' && phase !== 'countdown') return;
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('a[href]');
      if (!link) return;
      if (!window.confirm('A recording is in progress. Leave and discard it?')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [phase]);

  // Unmount: stop everything (camera light off) and free the preview blob.
  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);
  const resultRef = useRef(result);
  resultRef.current = result;
  useEffect(() => () => {
    if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
  }, []);

  return {
    phase,
    prefs,
    setPrefs,
    countdown,
    elapsedMs,
    error,
    cameraError,
    cameraLive,
    cameraVisible,
    corner,
    result,
    screenSupported: canCaptureScreen(),
    micActive: !!micStream && micStream.getAudioTracks().some((t) => t.readyState === 'live'),
    openSetup,
    cancelSetup,
    start,
    continueScreenOnly,
    stop,
    discard,
    toggleCamera,
    setCorner,
  };
}

export type SessionRecording = ReturnType<typeof useSessionRecording>;
