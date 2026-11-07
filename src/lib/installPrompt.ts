// "Install the app" support.
//
// Chromium browsers (Android Chrome, desktop Chrome/Edge) fire
// `beforeinstallprompt` when the site is installable and not yet installed.
// It can fire before React mounts, so this module listens at import time
// (main.tsx imports it first) and keeps the event for the button to use.
//
// iOS has no install API at all: the only path is Share → Add to Home Screen,
// so there we show instructions instead.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Listener = () => void;

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((l) => l());

function track(event: string) {
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  w.gtag?.('event', event);
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Stop Chrome's own mini-infobar; our button decides when to ask.
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    track('pwa_installed');
    notify();
  });
}

export function subscribeInstall(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Running as the installed app (home-screen / app window), not a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac; touch points give it away.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export type InstallMode = 'native' | 'ios' | null;

/** How (if at all) this browser can install the app right now. */
export function installMode(): InstallMode {
  if (installed || isStandalone()) return null;
  if (deferred) return 'native';
  if (isIos()) return 'ios';
  return null;
}

/** Shows the browser's install dialog. Resolves true if the user accepted. */
export async function promptInstall(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  track('pwa_install_click');
  await e.prompt();
  const { outcome } = await e.userChoice;
  // A prompt event can only be used once.
  deferred = null;
  if (outcome === 'accepted') installed = true;
  notify();
  return outcome === 'accepted';
}

export function trackIosInstructions() {
  track('pwa_install_ios_instructions');
}
