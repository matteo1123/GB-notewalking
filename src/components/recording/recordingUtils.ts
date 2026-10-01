// Pure helpers for session recording: capability checks, container/codec
// choice, and filename construction. No React, no side effects.

export type RecordingLayout = 'landscape' | 'vertical';
export type PipCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export const PIP_CORNERS: PipCorner[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];

// Output canvas sizes. 1080p is the target; the compositor steps the frame
// rate down (never the resolution) if drawing starts to cost too much.
export const LAYOUT_SIZE: Record<RecordingLayout, { width: number; height: number }> = {
  landscape: { width: 1920, height: 1080 },
  vertical: { width: 1080, height: 1920 },
};

// Ordered by preference. MP4/H.264 first because YouTube and Facebook ingest
// it without re-muxing and iOS can play it inline; WebM is the fallback for
// Firefox and older Chromium.
const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.640028,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

export function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
}

export function extensionForMime(mime: string): 'mp4' | 'webm' {
  return mime.startsWith('video/mp4') ? 'mp4' : 'webm';
}

export function canRecord(): boolean {
  return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices;
}

export function canCaptureScreen(): boolean {
  return !!navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function';
}

export function canShareFiles(files: File[]): boolean {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files });
  } catch {
    return false;
  }
}

// Chromium's Web Share only accepts an allowlist of file types, and JSON
// isn't on it (plain text is). Same bytes, different label.
export function asShareableText(file: File): File {
  return new File([file], `${file.name}.txt`, { type: 'text/plain' });
}

/**
 * Best set of files the native share sheet will take, most complete first:
 * everything with the data as .json, then as .json.txt, then without the
 * companions, then the video alone. `missing` lists what the caller must
 * still deliver another way (download).
 */
export function pickShareFiles(
  video: File,
  data: File,
  companions: File[] = [],
): { files: File[]; missing: File[] } | null {
  const dataTxt = asShareableText(data);
  const attempts: File[][] = [
    [video, ...companions, data],
    [video, ...companions, dataTxt],
    [video, data],
    [video, dataTxt],
    [video],
  ];
  for (const files of attempts) {
    if (!canShareFiles(files)) continue;
    const names = new Set(files.map((f) => f.name));
    const sentData = names.has(data.name) || names.has(dataTxt.name);
    const missing = [...companions, data].filter((f) => !names.has(f.name) && !(f === data && sentData));
    return { files, missing };
  }
  return null;
}

export interface FilenameParts {
  day?: number | null;
  key?: string | null;
  shape?: string | null;
}

// '#' is legal on most filesystems but breaks URLs and some upload forms.
function slug(value: string): string {
  return value.replace(/#/g, 'sharp').replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
}

// guitarbrain_day-017_key-E_shape-C-top_2026-09-29.mp4 — fields the app
// doesn't have are simply left out.
export function buildRecordingFilename(parts: FilenameParts, ext: string, date = new Date()): string {
  const segments = ['guitarbrain'];
  if (parts.day != null) segments.push(`day-${String(parts.day).padStart(3, '0')}`);
  if (parts.key) segments.push(`key-${slug(parts.key)}`);
  if (parts.shape) segments.push(`shape-${slug(parts.shape)}`);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  segments.push(`${yyyy}-${mm}-${dd}`);
  return `${segments.join('_')}.${ext}`;
}

export function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mmss = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Upload destinations for the desktop fallback. There's no deep link that
// pre-attaches a file to any of these, so the flow is download-then-open.
export const SHARE_TARGETS = {
  youtube: 'https://www.youtube.com/upload',
  drive: 'https://drive.google.com/drive/my-drive',
  facebookGroup: (import.meta.env.VITE_FACEBOOK_GROUP_URL as string | undefined)?.trim() || '',
};
