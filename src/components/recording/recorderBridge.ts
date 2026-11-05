import { useSyncExternalStore } from 'react';
import type { SessionRecording } from './useSessionRecording';

// The recorder lives inside the practice view (it needs the mic stream, the
// event log and the app snapshot), but its trigger is the brand logo in the
// header. The practice view publishes its live recorder here; the logo reads it.
// Only the creator's practice view ever publishes (SessionRecorder is gated).

export interface RecorderHandle {
  rec: SessionRecording;
  /** Key the app is in, for showing the creator brief's degrees as note names. */
  musicKey?: string;
}

let current: RecorderHandle | null = null;
const listeners = new Set<() => void>();

export function publishRecorder(handle: RecorderHandle | null) {
  current = handle;
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useRecorderHandle(): RecorderHandle | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
