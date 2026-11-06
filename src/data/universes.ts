import type { ChordNumeral } from '@/types/chords';
import { CAGED_SHAPES, type CagedShape } from '@/lib/cagedSystem';
import { assetUrl } from '@/lib/assetUrl';
import { SKILL_NODES, type NodeId } from './skillTree';

/**
 * "Universes" — the post-course world. The CAGED tree teaches every section
 * of the neck over I → IV. Once a player has unlocked every node AND spent
 * real time on each practice section, the Expanse orb opens: a closing video,
 * after which the same sections can be practiced over other two-chord vamps.
 *
 * Each vamp is a universe: the same stars (the I chord's CAGED shapes), but a
 * different harmonic gravity pulling on them. Time is tracked per universe ×
 * section, and each universe gets its own constellation that fills in.
 */

export type UniverseId = 'I-IV' | 'I-V' | 'vi-IV' | 'IV-V' | 'ii-V' | 'I-vi' | 'iii-IV';

export interface Universe {
  id: UniverseId;
  chords: [ChordNumeral, ChordNumeral];
  label: string;
  blurb: string;
  /** Hue shift applied to the constellation so each universe reads as the
   * same stars seen through a different sky. 0 = the home universe. */
  hue: number;
}

// Ordered by how often each pair shows up as a chord-to-chord move in large
// pop/rock corpora (Hooktheory-style transition counts), with the constraint
// that every diatonic chord I–vi appears at least once. I–IV is the course's
// home universe and stays first.
export const UNIVERSES: Universe[] = [
  { id: 'I-IV', chords: ['I', 'IV'], label: 'I – IV', blurb: 'Home. Where the course was learned.', hue: 0 },
  { id: 'I-V', chords: ['I', 'V'], label: 'I – V', blurb: 'Tension and release, the most common move in music.', hue: 55 },
  { id: 'vi-IV', chords: ['vi', 'IV'], label: 'vi – IV', blurb: 'The minor-to-major lift behind countless pop choruses.', hue: 110 },
  { id: 'IV-V', chords: ['IV', 'V'], label: 'IV – V', blurb: 'Two majors leaning toward a home that never arrives.', hue: 165 },
  { id: 'ii-V', chords: ['ii', 'V'], label: 'ii – V', blurb: 'The backbone of jazz, and a pop setup move.', hue: 220 },
  { id: 'I-vi', chords: ['I', 'vi'], label: 'I – vi', blurb: 'The bittersweet shift between relative major and minor.', hue: 270 },
  { id: 'iii-IV', chords: ['iii', 'IV'], label: 'iii – IV', blurb: 'A rarer, dreamier color. Same notes, new light.', hue: 315 },
];

export const HOME_UNIVERSE: UniverseId = 'I-IV';

export const UNIVERSE_BY_ID: Record<UniverseId, Universe> = Object.fromEntries(
  UNIVERSES.map((u) => [u.id, u]),
) as Record<UniverseId, Universe>;

export function isUniverseId(id: string | null | undefined): id is UniverseId {
  return !!id && id in UNIVERSE_BY_ID;
}

/** Minutes on a section (per universe) before it counts as "seasoned". */
export const SEASONED_SECONDS = 10 * 60;

export const EXPANSE_VIDEO_SRC = assetUrl('/videos/expanse.mp4');

/** The 20 sections you actually practice: 15 shape halves/wholes + 5 connects. */
export const PRACTICE_SECTIONS: NodeId[] = SKILL_NODES.filter(
  (n) => n.kind !== 'landing' && n.kind !== 'intro',
).map((n) => n.id);

export type PracticeSeconds = Record<string, number>;

/** Storage key for one universe × section bucket, e.g. "I-V|C-top". */
export function timeKey(universe: UniverseId, section: NodeId): string {
  return `${universe}|${section}`;
}

export function secondsFor(
  seconds: PracticeSeconds,
  universe: UniverseId,
  section: NodeId,
): number {
  return seconds[timeKey(universe, section)] ?? 0;
}

/** Every node on the CAGED tree has been unlocked. */
export function isTreeComplete(completed: Set<NodeId>): boolean {
  return SKILL_NODES.every((n) => completed.has(n.id));
}

/** Practice sections that still need time in the home universe. */
export function sectionsNeedingTime(seconds: PracticeSeconds): NodeId[] {
  return PRACTICE_SECTIONS.filter(
    (id) => secondsFor(seconds, HOME_UNIVERSE, id) < SEASONED_SECONDS,
  );
}

/**
 * Per-shape fill (0–3) for a universe's constellation: each of the shape's
 * low / high / whole sections contributes up to 1 as its time approaches
 * SEASONED_SECONDS. Fractional, so stars brighten gradually while playing.
 */
export function universeShapeProgress(
  seconds: PracticeSeconds,
  universe: UniverseId,
): Map<CagedShape, number> {
  const map = new Map<CagedShape, number>();
  for (const shape of CAGED_SHAPES) {
    let sum = 0;
    for (const k of ['bot', 'top', 'full'] as const) {
      const s = secondsFor(seconds, universe, `${shape}-${k}` as NodeId);
      sum += Math.min(1, s / SEASONED_SECONDS);
    }
    map.set(shape, sum);
  }
  return map;
}

export function formatMinutes(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
