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

export interface EngineOptions {
  layout: RecordingLayout;
  corner: PipCorner;
  cameraVisible: boolean;
}

export class CameraUnavailableError extends Error {}

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

function drawContain(ctx: CanvasRenderingContext2D, v: HTMLVideoElement, x: number, y: number, w: number, h: number) {
  const s = Math.min(w / v.videoWidth, h / v.videoHeight);
  const dw = v.videoWidth * s;
  const dh = v.videoHeight * s;
  ctx.drawImage(v, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function drawCover(ctx: CanvasRenderingContext2D, v: HTMLVideoElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / v.videoWidth, h / v.videoHeight);
  const sw = w / s;
  const sh = h / s;
  ctx.drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, x, y, w, h);
}

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
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micStream: MediaStream | null = null;
  private appSources: MediaStreamAudioSourceNode[] = [];
  private stopTap: (() => void) | null = null;

  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
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
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
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

    if (this.opts.layout === 'vertical') {
      if (screen && cam) {
        // Screen on top at full width (capped at half the frame), camera
        // fills everything below it.
        const topH = Math.min(H / 2, (W * screen.videoHeight) / screen.videoWidth);
        drawContain(ctx, screen, 0, 0, W, topH);
        drawCover(ctx, cam, 0, topH, W, H - topH);
      } else if (screen) {
        drawContain(ctx, screen, 0, 0, W, H);
      } else if (cam) {
        drawCover(ctx, cam, 0, 0, W, H);
      }
      return;
    }

    if (screen) {
      drawContain(ctx, screen, 0, 0, W, H);
      if (cam) this.drawPip(cam, W, H);
    } else if (cam) {
      drawCover(ctx, cam, 0, 0, W, H);
    }
  }

  private drawPip(cam: HTMLVideoElement, W: number, H: number) {
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
    this.recorder.start(TIMESLICE_MS);
    return this.recorder.mimeType || mimeType || 'video/webm';
  }

  /** Stop encoding and return the finished file's Blob. */
  stop(): Promise<Blob> {
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
    void this.mixCtx.close().catch(() => {});
    this.chunks = [];
  }
}
