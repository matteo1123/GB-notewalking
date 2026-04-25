import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';
import type { NodeId } from '@/data/skillTree';
import { SKILL_NODES, SKILL_NODE_BY_ID } from '@/data/skillTree';

const STORAGE_KEY = 'fq.skillTree.completed.v1';
const XP_KEY = 'fq.xp.total.v1';

function readCompletedSet(): Set<NodeId> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as NodeId[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function writeCompletedSet(set: Set<NodeId>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

const completedSetBase = atom<Set<NodeId>>(readCompletedSet());

export const completedSetAtom = atom(
  (get) => get(completedSetBase),
  (get, set, update: Set<NodeId> | ((prev: Set<NodeId>) => Set<NodeId>)) => {
    const prev = get(completedSetBase);
    const next = typeof update === 'function' ? update(prev) : update;
    writeCompletedSet(next);
    set(completedSetBase, next);
  },
);

export const nodeCompletedFamily = atomFamily((id: NodeId) =>
  atom((get) => get(completedSetAtom).has(id)),
);

export const nodeUnlockedFamily = atomFamily((id: NodeId) =>
  atom((get) => {
    const completed = get(completedSetAtom);
    const node = SKILL_NODE_BY_ID[id];
    if (!node) return false;
    return node.prerequisites.every((p) => completed.has(p));
  }),
);

export const completionCountAtom = atom((get) => get(completedSetAtom).size);

function readTotalXp(): number {
  if (typeof window === 'undefined') return 0;
  const raw = localStorage.getItem(XP_KEY);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

const totalXpBase = atom<number>(readTotalXp());

export const totalXpAtom = atom(
  (get) => get(totalXpBase),
  (get, set, update: number | ((prev: number) => number)) => {
    const prev = get(totalXpBase);
    const next = typeof update === 'function' ? update(prev) : update;
    const clamped = Math.max(0, Math.floor(next));
    if (typeof window !== 'undefined') localStorage.setItem(XP_KEY, String(clamped));
    set(totalXpBase, clamped);
  },
);

export const spentXpAtom = atom((get) => {
  const completed = get(completedSetAtom);
  let sum = 0;
  completed.forEach((id) => {
    const node = SKILL_NODE_BY_ID[id];
    if (node) sum += node.unlockCost;
  });
  return sum;
});

export const availableXpAtom = atom((get) => get(totalXpAtom) - get(spentXpAtom));

export const addXpAtom = atom(null, (get, set, amount: number) => {
  set(totalXpAtom, get(totalXpAtom) + amount);
});

export const toggleNodeAtom = atom(null, (get, set, id: NodeId) => {
  const completed = get(completedSetAtom);
  const next = new Set(completed);
  if (next.has(id)) {
    next.delete(id);
    for (const node of SKILL_NODES) {
      if (node.prerequisites.includes(id)) next.delete(node.id);
    }
  } else {
    const node = SKILL_NODE_BY_ID[id];
    if (!node) return;
    if (!node.prerequisites.every((p) => next.has(p))) return;
    const available = get(totalXpAtom) - get(spentXpAtom);
    if (available < node.unlockCost) return;
    next.add(id);
  }
  set(completedSetAtom, next);
});

// Purchase state moved to Convex (see usePurchaseStatus). The localStorage
// flag was intentionally removed so a stale local value can't unlock the app
// after a sign-out / device change.

// XP accrual speed — user-selectable in the practice sidebar. `slow` is the
// original rate (the one tuned against real practice sessions); `medium` and
// `fast` scale the per-tick reward so advanced players who already have all
// shapes unlocked don't sit at the diminishing 0.005/tick floor forever.
export type XpSpeed = 'slow' | 'medium' | 'fast';
const XP_SPEED_KEY = 'fq.xp.speed.v1';
const XP_SPEED_MULTIPLIER: Record<XpSpeed, number> = {
  slow: 1.0,
  medium: 1.3,
  fast: 1.6,
};

function readXpSpeed(): XpSpeed {
  if (typeof window === 'undefined') return 'slow';
  const raw = localStorage.getItem(XP_SPEED_KEY);
  return raw === 'medium' || raw === 'fast' ? raw : 'slow';
}

const xpSpeedBase = atom<XpSpeed>(readXpSpeed());

export const xpSpeedAtom = atom(
  (get) => get(xpSpeedBase),
  (_get, set, next: XpSpeed) => {
    if (typeof window !== 'undefined') localStorage.setItem(XP_SPEED_KEY, next);
    set(xpSpeedBase, next);
  },
);

export const xpSpeedMultiplierAtom = atom(
  (get) => XP_SPEED_MULTIPLIER[get(xpSpeedAtom)],
);
