// Sign-in for the Android app. Google refuses to sign anyone in inside an app's web view,
// so: the app opens Notewalking in Chrome (`?app-signin=1`), the person signs in there the
// usual way, Chrome gets a one-time pass for that account (convex/appSignIn.ts) and opens
// the app with it, and the app signs in with the pass.
import { SignIn, SignInButton, useAuth, useSignIn } from '@clerk/clerk-react';
import { useAction, useConvexAuth } from 'convex/react';
import { ConvexError } from 'convex/values';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from '@/hooks/use-toast';
import { api } from '../../convex/_generated/api';
import { inApp, onSigninTicket, openExternal } from './nativeApp';

const FLAG = 'app-signin';
const SCHEME = 'com.guitarbrain.notewalking';

function signInThroughChrome() {
  toast({ title: 'Finish signing in in Chrome', description: 'It brings you back here when you’re done.' });
  void openExternal(`${window.location.origin}/?${FLAG}=1`);
}

/** Stands in for `clerk.openSignIn()`: in the app it signs in through Chrome. */
export function openSignIn(clerk: { openSignIn: (o: object) => void }) {
  if (inApp()) signInThroughChrome();
  else clerk.openSignIn({});
}

/** Stands in for `clerk.openSignUp()`: in the app, Chrome's sign-in page has the sign-up link. */
export function openSignUp(clerk: { openSignUp: (o: object) => void }) {
  if (inApp()) signInThroughChrome();
  else clerk.openSignUp({});
}

/** Stands in for Clerk's <SignInButton>: in the app it signs in through Chrome. */
export function AppAwareSignInButton({ children }: { children: ReactNode }) {
  if (!inApp()) return <SignInButton mode="modal">{children}</SignInButton>;
  return (
    <span
      onClickCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
        signInThroughChrome();
      }}
      style={{ display: 'contents' }}
    >
      {children}
    </span>
  );
}

/** In the app: take the pass when Chrome sends it. Mounted once at the root. */
export function AppTicketListener() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const busy = useRef(false);

  useEffect(() => {
    if (!isLoaded || !inApp()) return;
    let off: (() => void) | null = null;
    let live = true;
    void onSigninTicket(async (ticket) => {
      if (busy.current) return;
      busy.current = true;
      try {
        const res = await signIn.create({ strategy: 'ticket', ticket });
        if (res.status === 'complete' && res.createdSessionId) await setActive({ session: res.createdSessionId });
        else toast({ title: 'That didn’t finish signing in', description: 'Try Sign in again.' });
      } catch (e) {
        toast({ title: 'Couldn’t sign in', description: e instanceof Error ? e.message : String(e) });
      } finally {
        busy.current = false;
      }
    }).then((h) => {
      if (live) off = () => void h.remove();
      else void h.remove();
    });
    return () => {
      live = false;
      off?.();
    };
  }, [isLoaded, signIn, setActive]);

  return null;
}

/** Chrome was opened by the app to sign in: remember that through the Google round trip. */
function wantsAppHandoff(): boolean {
  try {
    if (new URLSearchParams(window.location.search).has(FLAG)) sessionStorage.setItem(FLAG, '1');
    return sessionStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
}

const page = 'min-h-screen bg-zinc-950 text-slate-100 flex flex-col items-center justify-center gap-4 p-6 text-center';
const btn = 'rounded-md bg-primary px-5 py-3 font-bold text-primary-foreground';

/**
 * In Chrome, opened by the app: sign in here, then send the pass back to the app.
 * Renders the rest of the site (children) when this isn't that.
 */
export function AppHandoffGate({ children }: { children: ReactNode }) {
  const [handoff, setHandoff] = useState(() => !inApp() && wantsAppHandoff());
  const { isLoaded, isSignedIn } = useAuth();
  const done = () => {
    try {
      sessionStorage.removeItem(FLAG);
    } catch {
      /* fine */
    }
    setHandoff(false);
  };

  if (!handoff) return <>{children}</>;
  if (!isLoaded) return <div className={page}>Loading…</div>;
  if (!isSignedIn)
    return (
      <div className={page}>
        <div className="text-sm text-muted-foreground">Sign in to Notewalking, and the app will follow.</div>
        <SignIn routing="hash" />
      </div>
    );
  return <Handoff onDone={done} />;
}

function Handoff({ onDone }: { onDone: () => void }) {
  const { isAuthenticated } = useConvexAuth();
  const getTicket = useAction(api.appSignIn.ticket);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let live = true;
    getTicket({})
      .then((ticket) => {
        if (!live) return;
        const url = `intent://signin?ticket=${encodeURIComponent(ticket)}#Intent;scheme=${SCHEME};package=${SCHEME};end`;
        setLink(url);
        try {
          sessionStorage.removeItem(FLAG);
        } catch {
          /* fine */
        }
        window.location.href = url; // Chrome may want a tap instead: the button below
      })
      .catch((e: unknown) => live && setError(e instanceof ConvexError ? String(e.data) : e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [isAuthenticated, getTicket]);

  return (
    <div className={page}>
      {error ? (
        <>
          <div>Couldn’t sign the app in: {error}</div>
          <button type="button" className={btn} onClick={onDone}>
            Use Notewalking here instead
          </button>
        </>
      ) : link ? (
        <>
          <div>You’re signed in.</div>
          <a href={link} className={btn}>
            Back to the Notewalking app
          </a>
          <button type="button" className="text-xs text-muted-foreground underline" onClick={onDone}>
            Stay in Chrome
          </button>
        </>
      ) : (
        <div>Signing the app in…</div>
      )}
    </div>
  );
}
