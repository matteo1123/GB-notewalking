// The Android app (android/, Capacitor): a shell around this same site that adds what a
// browser can't do on a phone. It records the real screen, and it saves files and hands them
// to the share sheet. On the web, `inApp()` is false and nothing here is used.
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface ScreenStarted {
  /** epoch ms when the screen recording began */
  startedAt: number;
  width: number;
  height: number;
}

export interface ScreenFile {
  path: string;
  name: string;
  bytes: number;
  startedAt: number;
  width: number;
  height: number;
}

interface GbRecorderPlugin {
  available(): Promise<{ screen: boolean; recording: boolean }>;
  startScreen(): Promise<ScreenStarted>;
  stopScreen(o: { name?: string }): Promise<ScreenFile>;
  openFile(o: { name: string }): Promise<{ id: string }>;
  appendFile(o: { id: string; data: string }): Promise<void>;
  closeFile(o: { id: string }): Promise<{ path: string; bytes: number }>;
  share(o: { paths: string[]; title?: string }): Promise<void>;
  remove(o: { paths: string[] }): Promise<void>;
  openExternal(o: { url: string }): Promise<void>;
  addListener(event: 'screenEnded', fn: (e: { reason: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'signinTicket', fn: (e: { ticket: string }) => void): Promise<PluginListenerHandle>;
}

const Native = registerPlugin<GbRecorderPlugin>('GbRecorder');

/** Running inside the Android app. */
export function inApp(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('GbRecorder');
}

export const startScreen = () => Native.startScreen();
export const stopScreen = (name?: string) => Native.stopScreen({ name });
export const onScreenEnded = (fn: () => void) => Native.addListener('screenEnded', () => fn());

const CHUNK = 768 * 1024; // bytes per trip across to the app (sent as base64)

function base64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).replace(/^data:[^,]*,/, ''));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}

/** Write a file into the app's recordings folder; its path there. */
export async function saveFile(blob: Blob, name: string, onProgress?: (done: number) => void): Promise<string> {
  const { id } = await Native.openFile({ name });
  for (let at = 0; at < blob.size; at += CHUNK) {
    await Native.appendFile({ id, data: await base64(blob.slice(at, at + CHUNK)) });
    onProgress?.(Math.min(blob.size, at + CHUNK));
  }
  return (await Native.closeFile({ id })).path;
}

export const shareFiles = (paths: string[], title?: string) => Native.share({ paths, title });
export const removeFiles = (paths: string[]) => Native.remove({ paths });

/** A page in the phone's browser (Chrome). */
export const openExternal = (url: string) => Native.openExternal({ url });
/** Chrome handing back a sign-in pass (src/native/AppSignIn.tsx). */
export const onSigninTicket = (fn: (ticket: string) => void) => Native.addListener('signinTicket', (e) => fn(e.ticket));