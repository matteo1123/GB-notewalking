import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Capacitor } from '@capacitor/core';
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
import { inApp, onScreenEnded, startScreen, stopScreen, type ScreenFile, type ScreenStarted } from '@/native/nativeApp';

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
  /** Headphones on: mix the app's sound in. Off (chords through the speaker): the mic's room sound alone. */
  headphones: boolean;
}

export interface RecordingResult {
  /** The video, on the web. In the Android app the video is `screen`, already on the phone. */
  file: File | null;
  screen: ScreenFile | null;
  name: string;
  bytes: number;
  url: string;
  durationMs: number;
  /** Sidecar JSON of what the app did, named to match the video. */
  dataFile: File;
  /**
   * Full-res camera (`<name>.camera.mp4`), mic-only audio (`<name>.mic.m4a`) and the app's own
   * sound (`<name>.app.m4a`), when recorded; in the Android app also the soundtrack (`<name>.audio.m4a`).
   */
  companions: File[];
}

// Companion filenames: `<name>.camera.<ext>` / `<name>.mic.<ext>`. The
// pipeline pairs files by everything before the role suffix.
type CompanionKind = 'camera' | 'mic' | 'app' | 'audio';
function companionExt(mime: string, kind: CompanionKind): string {
  if (mime.includes('mp4')) return kind === 'camera' ? 'mp4' : 'm4a';
  return 'webm';
}

export const SESSION_LOG_FORMAT = 'guitarbrain-session-log';

const PREFS_KEY = 'gb.recording.prefs.v1';
const DEFAULT_PREFS: RecordingPrefs = { layout: 'landscape', cameraEnabled: true, corner: 'bottom-right', headphones: false };

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
  // the camera, for the face bubble in the Android app
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraVisible, setCameraVisible] = useState(true);
  const [corner, setCornerState] = useState<PipCorner>(prefs.corner);
  const [result, setResult] = useState<RecordingResult | null>(null);
  // Creator-only "Talk" marker: segment start/end events in the session log,
  // so the pipeline can cut teaching Shorts from the talking parts.
  const [talking, setTalking] = useState(false);
  const talkingRef = useRef(false);

  const engineRef = useRef<RecordingEngine | null>(null);
  // the phone recording its own screen (Android app)
  const nativeRef = useRef<{ started: ScreenStarted; off: () => void } | null>(null);
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
  const headphonesRef = useRef(prefs.headphones);
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
    setCameraStream(null);
    if (nativeRef.current) {
      nativeRef.current.off();
      nativeRef.current = null;
      void stopScreen().catch(() => {});
    }
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
    // Stop click lands in it. An open talk segment ends with the recording.
    if (talkingRef.current) eventLogRef.current?.add('segment', { kind: 'talk', phase: 'end' });
    talkingRef.current = false;
    setTalking(false);
    const events = eventLogRef.current?.stop() ?? [];
    setPhase('finalizing');
    const native = nativeRef.current;
    nativeRef.current = null;
    native?.off();
    const parts = filenamePartsRef.current;
    const [output, screen] = await Promise.all([
      engine.stop(),
      native
        ? stopScreen(buildRecordingFilename(parts, 'mp4')).catch((err: unknown) => {
            console.warn('[recording] the phone did not save the screen', err);
            return null;
          })
        : Promise.resolve(null),
    ]);
    const audioStartedAt = engine.mainStartedEpoch;
    teardownEngine();
    if (native && !screen) {
      setError('The phone could not save the screen recording. Please try again.');
      setPhase('setup');
      return;
    }
    const blob = output.main;
    if (blob.size === 0) {
      setError('The recording came out empty. Please try again.');
      setPhase('setup');
      return;
    }
    // In the app the phone's screen video is the main file; this page's files (the sound, the
    // camera...) start a little after it: main time = file time + shift.
    const shift = screen && native && audioStartedAt ? audioStartedAt - (screen.startedAt || native.started.startedAt) : 0;
    const name = screen ? screen.name : buildRecordingFilename(parts, extensionForMime(blob.type || mimeRef.current));
    const file = screen ? null : new File([blob], name, { type: blob.type || mimeRef.current });
    const stem = name.replace(/\.[^.]+$/, '');
    const companions: File[] = [];
    const companionMeta: Record<string, { file: string; offsetMs: number }> = {};
    const addCompanion = (kind: CompanionKind, c: { blob: Blob; offsetMs: number } | null) => {
      if (!c) return;
      const cname = `${stem}.${kind}.${companionExt(c.blob.type, kind)}`;
      companions.push(new File([c.blob], cname, { type: c.blob.type }));
      companionMeta[kind] = { file: cname, offsetMs: c.offsetMs + shift };
    };
    if (screen) addCompanion('audio', { blob, offsetMs: 0 });
    addCompanion('camera', output.camera);
    addCompanion('mic', output.mic);
    addCompanion('app', output.app);
    const timed = shift ? events.map((e) => ({ ...e, t: e.t + shift })) : events;
    const log = {
      format: SESSION_LOG_FORMAT,
      version: 1,
      // Which Guitar Brain app made this (Keylight writes 'keylight').
      app: 'notewalking',
      video: name,
      recordedAt: new Date(Date.now() - durationMs).toISOString(),
      durationMs: Math.round(durationMs),
      timeBase: 't = milliseconds from the first frame of the video',
      // offsetMs: how long after the main video's first frame each companion's
      // first frame was captured (main time = companion time + offsetMs).
      companions: companionMeta,
      // room: the soundtrack is the mic alone (chords through the speaker); mix: the app's sound mixed in
      sound: headphonesRef.current ? 'mix' : 'room',
      ...(screen ? { captureMode: 'android-screen', screen: { width: screen.width, height: screen.height } } : {}),
    };
    const dataFile = new File([serializeSessionLog(log, timed)], `${stem}.json`, {
      type: 'application/json',
    });
    setResult({
      file,
      screen,
      name,
      bytes: screen ? screen.bytes : blob.size,
      url: screen ? Capacitor.convertFileSrc(screen.path) : URL.createObjectURL(file as File),
      durationMs,
      dataFile,
      companions,
    });
    setPhase('preview');
  }, [clearTimers, teardownEngine]);
  const stopRef = useRef(stop);
  stopRef.current = stop;

  // Whether the 3-2-1 runs before recording. The setup dialog's Start button
  // counts down; the creator's logo trigger starts right away.
  const useCountdownRef = useRef(true);

  const beginCountdown = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setMicStream(micStreamRef.current);
    engine.startCompositing();
    const roll = () => {
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
      elapsedTimerRef.current = setInterval(() => setElapsedMs(performance.now() - startedAtRef.current), 250);
      setPhase('recording');
    };
    setPhase('countdown');
    if (!useCountdownRef.current) {
      setCountdown(0);
      // One beat for the compositor to paint its first frame.
      timersRef.current.push(setTimeout(roll, 150));
      return;
    }
    setCountdown(3);
    timersRef.current.push(setTimeout(() => setCountdown(2), 1000));
    timersRef.current.push(setTimeout(() => setCountdown(1), 2000));
    timersRef.current.push(
      setTimeout(() => {
        setCountdown(0);
        // Give the overlay a moment to unpaint so "1" isn't the first frame.
        timersRef.current.push(setTimeout(roll, 150));
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

  // Called directly from a click handler (the setup dialog's Start button or
  // the creator's logo), so the browser's screen-share prompt is allowed.
  const start = useCallback(async ({ countdown = true }: { countdown?: boolean } = {}) => {
    useCountdownRef.current = countdown;
    setError(null);
    setCameraError(null);
    filenamePartsRef.current = filenameParts;
    headphonesRef.current = prefs.headphones;
    // The Android app: the phone records the screen (its prompt has to come first, while the
    // tap still counts), and this page records the sound and the camera.
    const app = inApp();
    let native: ScreenStarted | null = null;
    if (app) {
      setPhase('acquiring');
      try {
        native = await startScreen();
      } catch {
        setError('Screen recording was cancelled. Allow it in the phone’s prompt to record the practice screen.');
        setPhase('setup');
        return;
      }
    }
    const screenSupported = app || canCaptureScreen();
    // Without screen capture the camera is the whole picture.
    const wantCamera = prefs.cameraEnabled || !screenSupported;
    const engine = new RecordingEngine({
      layout: prefs.layout,
      corner: prefs.corner,
      cameraVisible: wantCamera,
      roomSound: !prefs.headphones,
      soundOnly: app,
    });
    engineRef.current = engine;
    if (native) {
      let off = () => {};
      // stopped from Android's own notification / status bar
      void onScreenEnded(() => {
        if (nativeRef.current) void stopRef.current();
      }).then((h) => {
        off = () => void h.remove();
      });
      nativeRef.current = { started: native, off: () => off() };
    }
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

    if (screenSupported && !app) {
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
        setCameraStream(engine.camera);
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
        setCameraStream(engine.camera);
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

  const toggleTalk = useCallback(() => {
    if (phaseRef.current !== 'recording') return;
    const next = !talkingRef.current;
    eventLogRef.current?.add('segment', { kind: 'talk', phase: next ? 'start' : 'end' });
    talkingRef.current = next;
    setTalking(next);
  }, []);

  const discard = useCallback(() => {
    clearTimers();
    teardownEngine();
    releaseResult();
    setError(null);
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
      if (nativeRef.current) {
        nativeRef.current.off();
        nativeRef.current = null;
        void stopScreen().catch(() => {});
      }
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
    cameraStream,
    /** In the Android app (the phone records the screen). */
    inApp: inApp(),
    corner,
    result,
    talking,
    toggleTalk,
    /** Started from the logo (no setup dialog, no countdown). */
    quickStart: !useCountdownRef.current,
    screenSupported: inApp() || canCaptureScreen(),
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
