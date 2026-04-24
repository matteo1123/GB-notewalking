import { useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { useMutation, useQuery } from 'convex/react';
import { useAuth } from '@clerk/clerk-react';
import { api } from '../../convex/_generated/api';
import { completedSetAtom, totalXpAtom } from '@/state/skillTreeAtoms';
import type { NodeId } from '@/data/skillTree';

// Bridges localStorage-backed Jotai atoms with the per-user Convex
// userProgress row so users carry XP + unlocks between phone and desktop.
//
// Lifecycle:
//   1. On sign-in, fetch server progress.
//   2. Merge with local (union of completed nodes, max XP) and apply to atoms.
//   3. Push the merged result back so the server has the union.
//   4. Debounced pushes on every subsequent local change while signed in.
//
// "Local-first with sync up" — works offline, never silently overwrites a
// device's progress with an older snapshot.
export function useSyncProgress() {
  const { isSignedIn, isLoaded } = useAuth();
  const [completed, setCompleted] = useAtom(completedSetAtom);
  const [totalXp, setTotalXp] = useAtom(totalXpAtom);
  const remote = useQuery(api.progress.getProgress, isSignedIn ? {} : 'skip');
  const setRemote = useMutation(api.progress.setProgress);
  const mergedRef = useRef(false);

  // Reset the merged flag on sign-out so the next sign-in re-merges fresh.
  useEffect(() => {
    if (!isSignedIn) mergedRef.current = false;
  }, [isSignedIn]);

  // Step 1+2+3 — one-shot merge once both local and remote are known.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (remote === undefined) return; // remote query still loading
    if (mergedRef.current) return;
    mergedRef.current = true;

    const remoteCompleted = (remote?.completedNodes ?? []) as NodeId[];
    const merged = new Set<NodeId>([...completed, ...remoteCompleted]);
    const mergedXp = Math.max(totalXp, remote?.totalXp ?? 0);

    const localCount = completed.size;
    const remoteCount = remoteCompleted.length;
    if (merged.size !== localCount) setCompleted(merged);
    if (mergedXp !== totalXp) setTotalXp(mergedXp);

    // Push the merged snapshot back if it differs from what's on the server,
    // so the server now has the union of both devices.
    if (
      merged.size !== remoteCount ||
      mergedXp !== (remote?.totalXp ?? 0)
    ) {
      setRemote({ totalXp: mergedXp, completedNodes: [...merged] }).catch(
        (err) => console.error('initial progress sync failed', err),
      );
    }
    // We intentionally exclude `completed` and `totalXp` from deps — we only
    // want this to fire once when remote first arrives. Subsequent local
    // changes are handled by the push effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, remote]);

  // Step 4 — debounced push of any local changes after the initial merge.
  useEffect(() => {
    if (!isSignedIn || !mergedRef.current) return;
    const handle = setTimeout(() => {
      setRemote({ totalXp, completedNodes: [...completed] }).catch((err) =>
        console.error('progress sync failed', err),
      );
    }, 500);
    return () => clearTimeout(handle);
  }, [isSignedIn, totalXp, completed, setRemote]);
}
