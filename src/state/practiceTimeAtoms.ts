import { atom } from 'jotai';
import {
  HOME_UNIVERSE,
  isUniverseId,
  type PracticeSeconds,
  type UniverseId,
} from '@/data/universes';

// localStorage keys. Cleared on sign-out alongside the skill-tree keys (see
// useSyncProgress) so one account's time never leaks into another's.
export const PRACTICE_SECONDS_KEY = 'fq.practice.seconds.v1';
export const EXPANSE_OPENED_KEY = 'fq.expanse.opened.v1';
const UNIVERSE_KEY = 'fq.practice.universe.v1';

function readSeconds(): PracticeSeconds {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(PRACTICE_SECONDS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    if (!parsed || typeof parsed !== 'object') return {};
    const out: PracticeSeconds = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

const secondsBase = atom<PracticeSeconds>(readSeconds());

/** Total practice seconds per "universe|section" bucket. */
export const practiceSecondsAtom = atom(
  (get) => get(secondsBase),
  (get, set, update: PracticeSeconds | ((prev: PracticeSeconds) => PracticeSeconds)) => {
    const next = typeof update === 'function' ? update(get(secondsBase)) : update;
    if (typeof window !== 'undefined') {
      localStorage.setItem(PRACTICE_SECONDS_KEY, JSON.stringify(next));
    }
    set(secondsBase, next);
  },
);

/**
 * Seconds earned locally that haven't reached the server yet. The sync hook
 * drains this; the server adds deltas (rather than taking a max) so two
 * devices practicing the same section both count.
 */
export const pendingSecondsAtom = atom<PracticeSeconds>({});

export const addPracticeSecondsAtom = atom(
  null,
  (get, set, { key, seconds }: { key: string; seconds: number }) => {
    if (!(seconds > 0)) return;
    set(practiceSecondsAtom, (prev) => ({ ...prev, [key]: (prev[key] ?? 0) + seconds }));
    const pending = get(pendingSecondsAtom);
    set(pendingSecondsAtom, { ...pending, [key]: (pending[key] ?? 0) + seconds });
  },
);

function readExpanseOpened(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(EXPANSE_OPENED_KEY) === '1';
}

const expanseOpenedBase = atom<boolean>(readExpanseOpened());

/** True once the player has watched the Expanse video — opens other universes. */
export const expanseOpenedAtom = atom(
  (get) => get(expanseOpenedBase),
  (_get, set, next: boolean) => {
    if (typeof window !== 'undefined') {
      if (next) localStorage.setItem(EXPANSE_OPENED_KEY, '1');
      else localStorage.removeItem(EXPANSE_OPENED_KEY);
    }
    set(expanseOpenedBase, next);
  },
);

function readUniverse(): UniverseId {
  if (typeof window === 'undefined') return HOME_UNIVERSE;
  const raw = localStorage.getItem(UNIVERSE_KEY);
  return isUniverseId(raw) ? raw : HOME_UNIVERSE;
}

const universeBase = atom<UniverseId>(readUniverse());

/** The vamp the player last chose. Only honored once the Expanse is open. */
export const selectedUniverseAtom = atom(
  (get) => get(universeBase),
  (_get, set, next: UniverseId) => {
    if (typeof window !== 'undefined') localStorage.setItem(UNIVERSE_KEY, next);
    set(universeBase, next);
  },
);
