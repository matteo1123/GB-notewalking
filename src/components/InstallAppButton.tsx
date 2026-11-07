import { useEffect, useState, useSyncExternalStore } from 'react';
import { Download, PlusSquare, Share, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  installMode,
  promptInstall,
  subscribeInstall,
  trackIosInstructions,
} from '@/lib/installPrompt';

// A dismissed pill stays hidden this long, then comes back once.
const DISMISS_KEY = 'fq.install.dismissedAt.v1';
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000;

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_MS;
  } catch {
    return false;
  }
}

/**
 * "Install app" pill for the Skill Tree HUD. Only renders when this browser
 * can actually install the app and it isn't already running installed:
 *   - Chromium: opens the browser's own install dialog.
 *   - iOS: opens Share → Add to Home Screen instructions (no API exists).
 */
export function InstallAppButton() {
  const mode = useSyncExternalStore(subscribeInstall, installMode, () => null);
  const [dismissed, setDismissed] = useState(recentlyDismissed);
  const [iosHelpOpen, setIosHelpOpen] = useState(false);

  // Installed in another tab/window while this one is open: drop the pill.
  useEffect(() => {
    const mq = window.matchMedia?.('(display-mode: standalone)');
    if (!mq) return;
    const onChange = () => setDismissed((d) => d || mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  if (!mode || dismissed) return null;

  const onClick = () => {
    if (mode === 'native') {
      void promptInstall();
    } else {
      trackIosInstructions();
      setIosHelpOpen(true);
    }
  };

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // private mode: hide for this visit only
    }
    setDismissed(true);
  };

  return (
    <>
      <div className="pointer-events-auto flex items-center h-[42px] rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 backdrop-blur-md border border-emerald-400/40 shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-colors">
        <button
          onClick={onClick}
          className="flex items-center gap-2 h-full pl-3 sm:pl-4 pr-1.5 text-emerald-200"
          title="Install GuitarBrain as an app: full screen, one tap from your home screen"
        >
          <Download className="w-4 h-4" />
          <span className="text-xs font-black tracking-wider whitespace-nowrap">
            Install<span className="hidden sm:inline"> app</span>
          </span>
        </button>
        <button
          onClick={dismiss}
          className="h-full pr-2.5 pl-1 text-emerald-300/50 hover:text-emerald-100"
          aria-label="Not now"
          title="Not now"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <Dialog open={iosHelpOpen} onOpenChange={setIosHelpOpen}>
        <DialogContent className="bg-slate-950 border-white/10 max-w-sm w-[calc(100%-1rem)]">
          <DialogHeader>
            <DialogTitle>Install GuitarBrain</DialogTitle>
            <DialogDescription>
              Full screen, no browser bars, one tap from your home screen.
            </DialogDescription>
          </DialogHeader>
          <ol className="grid gap-3 text-sm text-slate-200">
            <li className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-black">1</span>
              <span className="flex items-center gap-1.5">
                Tap the <Share className="w-4 h-4 text-sky-400" /> <b>Share</b> button in the browser bar
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-black">2</span>
              <span className="flex items-center gap-1.5">
                Choose <PlusSquare className="w-4 h-4" /> <b>Add to Home Screen</b>
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-black">3</span>
              <span>
                Tap <b>Add</b>, then open GuitarBrain from your home screen
              </span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
