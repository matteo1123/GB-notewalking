import { useCallback, useEffect, useRef } from 'react';
import { useStore } from 'jotai';
import { useMutation, useQuery } from 'convex/react';
import { useAuth } from '@clerk/clerk-react';
import { api } from '../../convex/_generated/api';
import {
  EXPANSE_OPENED_KEY,
  PRACTICE_SECONDS_KEY,
  expanseOpenedAtom,
  pendingSecondsAtom,
  practiceSecondsAtom,
} from '@/state/practiceTimeAtoms';
import type { PracticeSeconds } from '@/data/universes';

const FLUSH_MS = 30_000;

// Bridges the local practice-time atoms with the per-user Convex
// practiceTime row. Mirrors useSyncProgress: local-first, union on sign-in.
// Time is sent as deltas (pendingSecondsAtom) and summed server-side; the
// local view of totals is max(local, remote) per bucket.
export function useSyncPracticeTime() {
  const { isSignedIn, isLoaded } = useAuth();
  const store = useStore();
  const remote = useQuery(api.practiceTime.getPracticeTime, isSignedIn ? {} : 'skip');
  const addRemote = useMutation(api.practiceTime.addPracticeTime);
  const mergedRef = useRef(false);
  const inFlightRef = useRef(false);
  const remoteExpanseRef = useRef(false);

  const flush = useCallback(async () => {
    if (!isSignedIn || !mergedRef.current || inFlightRef.current) return;
    const pending = store.get(pendingSecondsAtom);
    const keys = Object.keys(pending);
    const needExpanse = store.get(expanseOpenedAtom) && !remoteExpanseRef.current;
    if (keys.length === 0 && !needExpanse) return;
    const deltas: PracticeSeconds = {};
    for (const k of keys) deltas[k] = Math.round(pending[k] * 10) / 10;
    inFlightRef.current = true;
    try {
      await addRemote({ deltas, ...(needExpanse ? { expanseOpened: true } : {}) });
      if (needExpanse) remoteExpanseRef.current = true;
      // Subtract only what was sent — seconds earned during the request stay.
      const now = store.get(pendingSecondsAtom);
      const rest: PracticeSeconds = {};
      for (const [k, v] of Object.entries(now)) {
        const left = v - (pending[k] ?? 0);
        if (left > 0.05) rest[k] = left;
      }
      store.set(pendingSecondsAtom, rest);
    } catch (err) {
      console.error('practice time sync failed', err);
    } finally {
      inFlightRef.current = false;
    }
  }, [isSignedIn, store, addRemote]);

  // Sign-out: drop this account's local time so the next account starts clean.
  const wasSignedIn = useRef(isSignedIn);
  useEffect(() => {
    if (wasSignedIn.current && !isSignedIn) {
      mergedRef.current = false;
      remoteExpanseRef.current = false;
      localStorage.removeItem(PRACTICE_SECONDS_KEY);
      localStorage.removeItem(EXPANSE_OPENED_KEY);
      store.set(practiceSecondsAtom, {});
      store.set(pendingSecondsAtom, {});
      store.set(expanseOpenedAtom, false);
    }
    wasSignedIn.current = isSignedIn;
  }, [isSignedIn, store]);

  // Merge whenever the server row changes (first load, other device flushes).
  useEffect(() => {
    if (!isLoaded || !isSignedIn || remote === undefined) return;
    const remoteSeconds = remote?.seconds ?? {};
    const local = store.get(practiceSecondsAtom);

    if (!mergedRef.current) {
      // First contact: time this device has that the server doesn't (played
      // signed-out, or before a failed flush) is queued as a delta.
      const pending = { ...store.get(pendingSecondsAtom) };
      for (const [k, v] of Object.entries(local)) {
        const gap = v - (remoteSeconds[k] ?? 0) - (pending[k] ?? 0);
        if (gap > 0.5) pending[k] = (pending[k] ?? 0) + gap;
      }
      store.set(pendingSecondsAtom, pending);
      mergedRef.current = true;
    }

    let changed = false;
    const merged: PracticeSeconds = { ...local };
    for (const [k, v] of Object.entries(remoteSeconds)) {
      if (v > (merged[k] ?? 0)) {
        merged[k] = v;
        changed = true;
      }
    }
    if (changed) store.set(practiceSecondsAtom, merged);

    remoteExpanseRef.current = !!remote?.expanseOpened;
    if (remote?.expanseOpened && !store.get(expanseOpenedAtom)) {
      store.set(expanseOpenedAtom, true);
    }
    void flush();
  }, [isLoaded, isSignedIn, remote, store, flush]);

  // Periodic flush, plus a best-effort one when the tab is hidden.
  useEffect(() => {
    if (!isSignedIn) return;
    const id = window.setInterval(() => void flush(), FLUSH_MS);
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    document.addEventListener('visibilitychange', onHide);
    // Opening the Expanse should reach the server right away, not in 30s.
    const unsub = store.sub(expanseOpenedAtom, () => void flush());
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onHide);
      unsub();
    };
  }, [isSignedIn, flush, store]);
}
