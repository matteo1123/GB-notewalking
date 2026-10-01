// Non-React recording engine. Owns every stream, element, timer and audio
// node it creates, and releases all of them in dispose(). It never stops the
// mic stream — that belongs to pitch detection and is only read from here.

import { startAppAudioTap } from './appAudioTap';
import { LAYOUT_SIZE, pickRecorderMimeType, type PipCorner, type RecordingLayout } from './recordingUtils';

// Frame-rate ladder for the compositor. If drawing a frame starts eating
// into the main thread (where pitch detection also runs), step down.
const FPS_STEPS = [30, 24, 20, 15];
const SLOW_FRAME_MS = 10;
const TIMESLICE_MS = 1000;

// Companion files: the raw camera at full resolution and the mic on its own,
// so downstream tools get a sharp camera and a guitar-only audio track. Each
// is a separate MediaRecorder started in the same tick as the main one; the
// measured start offsets go into the session JSON.
const CAMERA_MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.640028',
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];
const MIC_MIME_CANDIDATES = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];

function pickMime(candidates: string[]): string | undefined {
  return candidates.find((m) => MediaRecorder.isTypeSupported(m));
}

export interface CompanionResult {
  blob: Blob;
  /** ms after the main video's first frame that this file's first frame was captured. */
  offsetMs: number;
}

export interface RecordingOutput {
  main: Blob;
  camera: CompanionResult | null;
  mic: CompanionResult | null;
}

/** One MediaRecorder writing ~1s chunks, with its real start time. */
class ChunkRecorder {
  readonly rec: MediaRecorder;
  startedAt = 0;
  private chunks: Blob[] = [];

  constructor(stream: MediaStream, mimeCandidates: string[], bits: { video?: number; audio?: number }) {
    const mimeType = pickMime(mimeCandidates);
    this.rec = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      ...(bits.video ? { videoBitsPerSecond: bits.video } : {}),
      ...(bits.audio ? { audioBitsPerSecond: bits.audio } : {}),
    });
    this.rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };
    this.rec.onstart = () => {
      this.startedAt = performance.now();
    };
  }

  start() {
    this.rec.start(TIMESLICE_MS);
  }

  stop(): Promise<Blob> {
    const type = this.rec.mimeType || 'application/octet-stream';
    if (this.rec.state === 'inactive') return Promise.resolve(new Blob(this.chunks, { type }));
    return new Promise((resolve) => {
      this.rec.addEventListener('stop', () => resolve(new Blob(this.chunks, { type })), { once: true });
      try {
        this.rec.requestData();
      } catch {
        // not all browsers allow requestData right before stop
      }
      this.rec.stop();
    });
  }

  abort() {
    if (this.rec.state !== 'inactive') {
      try {
        this.rec.stop();
      } catch {
        // ignore
      }
    }
    this.chunks = [];
  }
}

export interface EngineOptions {
  layout: RecordingLayout;
  corner: PipCorner;
  cameraVisible: boolean;
}

export class CameraUnavailableError extends Error {}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where each source sits in the output video, in output pixels. */
export interface LayoutInfo {
  layout: RecordingLayout;
  width: number;
  height: number;
  screen: Rect | null;
  camera: Rect | null;
}

function hiddenVideo(stream: MediaStream): HTMLVideoElement {
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.autoplay = true;
  v.srcObject = stream;
  // Attached (but invisible) so no browser decides to stop decoding it.
  Object.assign(v.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '2px',
    height: '2px',
    opacity: '0',
    pointerEvents: 'none',
    zIndex: '-1',
  });
  document.body.appendChild(v);
  void v.play().catch(() => {});
  return v;
}

function videoReady(v: HTMLVideoElement | null): v is HTMLVideoElement {
  return !!v && v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0;
}

function drawContain(ctx: CanvasRenderingContext2D, v: HTMLVideoElement, x: number, y: number, w: number, h: number): Rect {
  const s = Math.min(w / v.videoWidth, h / v.videoHeight);
  const dw = v.videoWidth * s;
  const dh = v.videoHeight * s;
  const r = { x: x + (w - dw) / 2, y: y + (h - dh) / 2, w: dw, h: dh };
  ctx.drawImage(v, r.x, r.y, r.w, r.h);
  return r;
}

function drawCover(ctx: CanvasRenderingContext2D, v: HTMLVideoElement, x: number, y: number, w: number, h: number): Rect {
  const s = Math.max(w / v.videoWidth, h / v.videoHeight);
  const sw = w / s;
  const sh = h / s;
  ctx.drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, x, y, w, h);
  return { x, y, w, h };
}

const roundRect = (r: Rect | null): Rect | null =>
  r && { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) };

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class RecordingEngine {
  opts: EngineOptions;
  onScreenEnded: (() => void) | null = null;
  /** Fires whenever a source moves/appears/disappears in the output frame. */
  onLayoutChange: ((info: LayoutInfo) => void) | null = null;
  private layoutSig = '';
  layoutInfo: LayoutInfo | null = null;

  private displayStream: MediaStream | null = null;
  private cameraStream: MediaStream | null = null;
  private screenVideo: HTMLVideoElement | null = null;
  private cameraVideo: HTMLVideoElement | null = null;

  private canvas: HTMLCanvasElement;
  private ctx2d: CanvasRenderingContext2D;
  private canvasStream: MediaStream | null = null;
  private drawTimer: ReturnType<typeof setInterval> | null = null;
  private fpsStep = 0;
  private slowFrameAvg = 0;

  private mixCtx: AudioContext;
  private mixDest: MediaStreamAudioDestinationNode;
  // Mic only, for the companion audio file. Fed from the same source node as
  // the mix, so toggling the mic off and on keeps one continuous file.
  private micOnlyDest: MediaStreamAudioDestinationNode;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micStream: MediaStream | null = null;
  private appSources: MediaStreamAudioSourceNode[] = [];
  private stopTap: (() => void) | null = null;

  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private mainStartedAt = 0;
  private cameraRecorder: ChunkRecorder | null = null;
  private micRecorder: ChunkRecorder | null = null;
  private disposed = false;

  // Construct synchronously inside the click handler so the mixing
  // AudioContext is created with a user gesture and starts running.
  constructor(opts: EngineOptions) {
    this.opts = { ...opts };
    const { width, height } = LAYOUT_SIZE[opts.layout];
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx2d = this.canvas.getContext('2d', { alpha: false })!;
    this.mixCtx = new AudioContext();
    void this.mixCtx.resume().catch(() => {});
    this.mixDest = this.mixCtx.createMediaStreamDestination();
    this.micOnlyDest = this.mixCtx.createMediaStreamDestination();
  }

  get hasScreen() {
    return !!this.displayStream;
  }

  get hasCamera() {
    return !!this.cameraStream;
  }

  /** Must be the first await after a click — getDisplayMedia needs the gesture. */
  async acquireScreen(cropTo?: Element | null): Promise<void> {
    const { width, height } = LAYOUT_SIZE.landscape;
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { width: { ideal: width }, height: { ideal: height }, frameRate: { ideal: 30, max: 30 } },
      // App audio is tapped directly from Web Audio (see appAudioTap), so we
      // don't ask for tab audio — no checkbox to forget, no double audio.
      audio: false,
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
      surfaceSwitching: 'exclude',
    } as DisplayMediaStreamOptions);
    if (this.disposed) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.displayStream = stream;
    const track = stream.getVideoTracks()[0];
    track.addEventListener('ended', () => this.onScreenEnded?.());

    // Region Capture (Chromium): crop the tab down to the practice stage so
    // the app header and browser chrome aren't in the video. Only valid when
    // the user picked this tab; any failure just keeps the full capture.
    const CropTargetCtor = (window as unknown as { CropTarget?: { fromElement(el: Element): Promise<unknown> } }).CropTarget;
    const croppable = track as MediaStreamTrack & { cropTo?: (t: unknown) => Promise<void> };
    if (cropTo && CropTargetCtor && typeof croppable.cropTo === 'function') {
      try {
        await croppable.cropTo(await CropTargetCtor.fromElement(cropTo));
      } catch {
        // Different tab/window/screen chosen, or unsupported — fine.
      }
    }
    this.screenVideo = hiddenVideo(stream);
  }

  async acquireCamera(): Promise<void> {
    if (this.cameraStream) return;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        // Full resolution: this feed is also saved as its own file.
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
        audio: false, // never a second mic — the pitch-detection stream is reused
      });
    } catch (err) {
      const name = (err as DOMException)?.name;
      const reason =
        name === 'NotAllowedError'
          ? 'Camera permission was denied.'
          : name === 'NotFoundError' || name === 'OverconstrainedError'
          ? 'No camera was found.'
          : name === 'NotReadableError'
          ? 'The camera is in use by another app.'
          : 'The camera could not be started.';
      throw new CameraUnavailableError(reason);
    }
    if (this.disposed) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.cameraStream = stream;
    this.cameraVideo = hiddenVideo(stream);
    // Camera switched on mid-recording: its file starts now, and the offset
    // records how late.
    if (this.recorder && this.recorder.state === 'recording') this.startCameraRecorder();
  }

  private startCameraRecorder() {
    if (!this.cameraStream || this.cameraRecorder) return;
    try {
      this.cameraRecorder = new ChunkRecorder(
        new MediaStream(this.cameraStream.getVideoTracks()),
        CAMERA_MIME_CANDIDATES,
        { video: 5_000_000 },
      );
      this.cameraRecorder.start();
    } catch (err) {
      // A missing companion file only costs quality downstream; never fail the recording for it.
      console.warn('[recording] camera file could not start', err);
      this.cameraRecorder = null;
    }
  }

  setCorner(corner: PipCorner) {
    this.opts.corner = corner;
  }

  setCameraVisible(visible: boolean) {
    this.opts.cameraVisible = visible;
  }

  /** Swap the mic source; called whenever pitch detection's stream changes. */
  setMicStream(stream: MediaStream | null) {
    if (stream === this.micStream) return;
    this.micSource?.disconnect();
    this.micSource = null;
    this.micStream = stream;
    if (stream && stream.getAudioTracks().some((t) => t.readyState === 'live') && !this.disposed) {
      this.micSource = this.mixCtx.createMediaStreamSource(stream);
      this.micSource.connect(this.mixDest);
      this.micSource.connect(this.micOnlyDest);
    }
  }

  /** Start drawing and mixing. Runs during the countdown, before recording. */
  startCompositing() {
    if (this.drawTimer || this.disposed) return;
    this.stopTap = startAppAudioTap((stream) => {
      if (this.disposed) return;
      const src = this.mixCtx.createMediaStreamSource(stream);
      src.connect(this.mixDest);
      this.appSources.push(src);
    });
    this.canvasStream = this.canvas.captureStream(FPS_STEPS[0]);
    this.drawFrame();
    this.scheduleDraw();
  }

  private scheduleDraw() {
    if (this.drawTimer) clearInterval(this.drawTimer);
    this.drawTimer = setInterval(() => this.tick(), 1000 / FPS_STEPS[this.fpsStep]);
  }

  private tick() {
    const t0 = performance.now();
    this.drawFrame();
    const cost = performance.now() - t0;
    this.slowFrameAvg = this.slowFrameAvg * 0.9 + cost * 0.1;
    if (this.slowFrameAvg > SLOW_FRAME_MS && this.fpsStep < FPS_STEPS.length - 1) {
      this.fpsStep += 1;
      this.slowFrameAvg = 0;
      console.info(`[recording] compositing is slow, dropping to ${FPS_STEPS[this.fpsStep]}fps`);
      this.scheduleDraw();
    }
  }

  private drawFrame() {
    const ctx = this.ctx2d;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, W, H);

    const screen = videoReady(this.screenVideo) ? this.screenVideo : null;
    const cam = this.opts.cameraVisible && videoReady(this.cameraVideo) ? this.cameraVideo : null;
    let screenRect: Rect | null = null;
    let camRect: Rect | null = null;

    if (this.opts.layout === 'vertical') {
      if (screen && cam) {
        // Screen on top at full width (capped at half the frame), camera
        // fills everything below it.
        const topH = Math.min(H / 2, (W * screen.videoHeight) / screen.videoWidth);
        screenRect = drawContain(ctx, screen, 0, 0, W, topH);
        camRect = drawCover(ctx, cam, 0, topH, W, H - topH);
      } else if (screen) {
        screenRect = drawContain(ctx, screen, 0, 0, W, H);
      } else if (cam) {
        camRect = drawCover(ctx, cam, 0, 0, W, H);
      }
    } else if (screen) {
      screenRect = drawContain(ctx, screen, 0, 0, W, H);
      if (cam) camRect = this.drawPip(cam, W, H);
    } else if (cam) {
      camRect = drawCover(ctx, cam, 0, 0, W, H);
    }
    this.reportLayout(screenRect, camRect);
  }

  private reportLayout(screen: Rect | null, camera: Rect | null) {
    const info: LayoutInfo = {
      layout: this.opts.layout,
      width: this.canvas.width,
      height: this.canvas.height,
      screen: roundRect(screen),
      camera: roundRect(camera),
    };
    const sig = JSON.stringify(info);
    if (sig === this.layoutSig) return;
    this.layoutSig = sig;
    this.layoutInfo = info;
    this.onLayoutChange?.(info);
  }

  private drawPip(cam: HTMLVideoElement, W: number, H: number): Rect {
    const ctx = this.ctx2d;
    const pw = Math.round(W * 0.24);
    const ph = Math.round((pw * cam.videoHeight) / cam.videoWidth);
    const m = Math.round(W * 0.018);
    const x = this.opts.corner.endsWith('left') ? m : W - pw - m;
    const y = this.opts.corner.startsWith('top') ? m : H - ph - m;
    const r = Math.round(pw * 0.05);
    ctx.save();
    roundedRectPath(ctx, x, y, pw, ph, r);
    ctx.clip();
    ctx.drawImage(cam, x, y, pw, ph);
    ctx.restore();
    roundedRectPath(ctx, x, y, pw, ph, r);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.stroke();
    return { x, y, w: pw, h: ph };
  }

  /** Begin encoding. Returns the MIME type actually used. */
  startRecording(): string {
    if (!this.canvasStream) this.startCompositing();
    const tracks = [...this.canvasStream!.getVideoTracks(), ...this.mixDest.stream.getAudioTracks()];
    const stream = new MediaStream(tracks);
    const mimeType = pickRecorderMimeType();
    const layoutPixels = this.canvas.width * this.canvas.height;
    this.recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: layoutPixels >= 1920 * 1080 ? 8_000_000 : 5_000_000,
      audioBitsPerSecond: 160_000,
    });
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };
    // Timeslice: the browser hands us ~1s Blobs as it goes instead of holding
    // the whole encode in one buffer, and Chromium can page Blobs to disk.
    this.recorder.onstart = () => {
      this.mainStartedAt = performance.now();
    };
    this.recorder.start(TIMESLICE_MS);
    // Companions start in the same tick; offsets are measured from their own
    // start events, so a slow encoder start-up is accounted for.
    this.startCameraRecorder();
    try {
      this.micRecorder = new ChunkRecorder(this.micOnlyDest.stream, MIC_MIME_CANDIDATES, { audio: 128_000 });
      this.micRecorder.start();
    } catch (err) {
      console.warn('[recording] mic file could not start', err);
      this.micRecorder = null;
    }
    return this.recorder.mimeType || mimeType || 'video/webm';
  }

  /** Stop every encoder and return the main video plus its companion files. */
  async stop(): Promise<RecordingOutput> {
    const companion = async (r: ChunkRecorder | null): Promise<CompanionResult | null> => {
      if (!r) return null;
      const blob = await r.stop();
      if (blob.size === 0) return null;
      const offsetMs = r.startedAt && this.mainStartedAt ? Math.round(r.startedAt - this.mainStartedAt) : 0;
      return { blob, offsetMs };
    };
    const [main, camera, mic] = await Promise.all([
      this.stopMain(),
      companion(this.cameraRecorder),
      companion(this.micRecorder),
    ]);
    this.cameraRecorder = null;
    this.micRecorder = null;
    return { main, camera, mic };
  }

  private stopMain(): Promise<Blob> {
    const recorder = this.recorder;
    if (!recorder || recorder.state === 'inactive') {
      return Promise.resolve(new Blob(this.chunks, { type: recorder?.mimeType || 'video/webm' }));
    }
    return new Promise((resolve) => {
      recorder.addEventListener(
        'stop',
        () => resolve(new Blob(this.chunks, { type: recorder.mimeType || 'video/webm' })),
        { once: true },
      );
      try {
        recorder.requestData();
      } catch {
        // not all browsers allow requestData right before stop
      }
      recorder.stop();
    });
  }

  /** Release everything: camera light off, capture indicator gone, audio closed. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.drawTimer) clearInterval(this.drawTimer);
    this.drawTimer = null;
    if (this.recorder && this.recorder.state !== 'inactive') {
      try {
        this.recorder.stop();
      } catch {
        // ignore
      }
    }
    this.recorder = null;
    this.cameraRecorder?.abort();
    this.micRecorder?.abort();
    this.cameraRecorder = null;
    this.micRecorder = null;
    this.stopTap?.();
    this.stopTap = null;
    for (const v of [this.screenVideo, this.cameraVideo]) {
      if (!v) continue;
      v.pause();
      v.srcObject = null;
      v.remove();
    }
    this.screenVideo = null;
    this.cameraVideo = null;
    this.displayStream?.getTracks().forEach((t) => t.stop());
    this.cameraStream?.getTracks().forEach((t) => t.stop());
    this.canvasStream?.getTracks().forEach((t) => t.stop());
    this.displayStream = null;
    this.cameraStream = null;
    this.canvasStream = null;
    // Disconnect (not stop) the mic source — the track is pitch detection's.
    this.micSource?.disconnect();
    this.micSource = null;
    this.micStream = null;
    this.appSources.forEach((s) => s.disconnect());
    this.appSources = [];
    this.mixDest.stream.getTracks().forEach((t) => t.stop());
    this.micOnlyDest.stream.getTracks().forEach((t) => t.stop());
    void this.mixCtx.close().catch(() => {});
    this.chunks = [];
  }
}
