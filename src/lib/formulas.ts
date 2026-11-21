// Melody formulas: two melody notes over a two-chord change, all counted from
// the key ("Melody 5 → 6, Chords I → IV"). Used by the creator's Formulas
// checklist (a popup window) and by the practice screen, which hears every
// chord change and reports which two notes were played across it.

import type { ChordNumeral } from '@/types/chords';
import { UNIVERSES, type UniverseId } from '@/data/universes';

/** Semitones above the key root for major-scale degrees 1–7. */
export const DEGREE_SEMIS = [0, 2, 4, 5, 7, 9, 11] as const;

const NUMERAL_DEGREE: Record<ChordNumeral, number> = {
  I: 1, ii: 2, iii: 3, IV: 4, V: 5, vi: 6, 'vii°': 7,
};

export type Role = 'root' | '3rd' | '5th' | '7th';
const ROLES: Role[] = ['root', '3rd', '5th', '7th'];

/** Chord tones in stacking order (root, 3rd, 5th, 7th) as key degrees: IV → [4, 6, 1, 3]. */
export function stackedTones(numeral: ChordNumeral): number[] {
  const r = NUMERAL_DEGREE[numeral];
  return [0, 2, 4, 6].map((step) => ((r - 1 + step) % 7) + 1);
}

/** What a key degree is inside a chord ("3rd"), or null if it isn't a chord tone. */
export function roleIn(degree: number, numeral: ChordNumeral): Role | null {
  const i = stackedTones(numeral).indexOf(degree);
  return i >= 0 ? ROLES[i] : null;
}

export function degreeOfSemi(semi: number): number | null {
  const i = DEGREE_SEMIS.indexOf(semi as (typeof DEGREE_SEMIS)[number]);
  return i >= 0 ? i + 1 : null;
}

export interface Formula {
  id: string;
  universe: UniverseId;
  chords: [ChordNumeral, ChordNumeral];
  melody: [number, number]; // key degrees
  idea: string;
}

function roleLabel(degree: number, numeral: ChordNumeral): string {
  const role = roleIn(degree, numeral);
  return role === 'root' ? `root of ${numeral}` : `${role} of ${numeral}`;
}

export function describeFormula(f: Formula): string {
  const [x, y] = f.chords;
  const [a, b] = f.melody;
  return `${a} is the ${roleLabel(a, x)}; ${b} is the ${roleLabel(b, y)}`;
}

/** Scale steps between two degrees: 0 = same note, 1 = neighbour. */
function stepDistance(a: number, b: number): number {
  const d = (b - a + 7) % 7;
  return Math.min(d, 7 - d);
}

/**
 * The default library: for each chord change the app offers (both directions of
 * every two-chord universe), the melodies that stay on triad tones of both chords
 * and move by a step or not at all. Ordered so the clearest sound comes first:
 * stepping onto the new chord's 3rd, holding the shared note, stepping onto its root.
 */
export function buildLibrary(): Formula[] {
  const out: Formula[] = [];
  for (const u of UNIVERSES) {
    for (const [x, y] of [u.chords, [u.chords[1], u.chords[0]] as [ChordNumeral, ChordNumeral]]) {
      const fromTriad = stackedTones(x).slice(0, 3);
      const toTriad = stackedTones(y).slice(0, 3);
      const picks: { a: number; b: number; idea: string; rank: number }[] = [];
      for (const a of fromTriad) {
        for (const b of toTriad) {
          const d = stepDistance(a, b);
          const role = roleIn(b, y);
          if (d === 1 && role === '3rd') picks.push({ a, b, rank: 0, idea: `Step onto the 3rd of ${y}` });
          else if (d === 0) picks.push({ a, b, rank: 1, idea: `Hold the note ${x} and ${y} share` });
          else if (d === 1 && role === 'root') picks.push({ a, b, rank: 2, idea: `Step onto the root of ${y}` });
          else if (d === 1 && role === '5th') picks.push({ a, b, rank: 3, idea: `Step onto the 5th of ${y}` });
        }
      }
      picks.sort((p, q) => p.rank - q.rank);
      for (const p of picks) {
        out.push({
          id: `${x}-${y}:${p.a}-${p.b}`,
          universe: u.id,
          chords: [x, y],
          melody: [p.a, p.b],
          idea: p.idea,
        });
      }
    }
  }
  return out;
}

/** What the practice screen heard across one chord change. */
export interface MelodyChange {
  chords: [ChordNumeral, ChordNumeral];
  /** Semitones above the key root (0–11), so chromatic notes are reported too. */
  semis: [number, number];
  key: string;
  bpm: number;
  /** ms from the start of the recording, or null when not recording. */
  t: number | null;
  at: number; // Date.now()
}

export function matches(f: Formula, c: MelodyChange): boolean {
  return (
    f.chords[0] === c.chords[0] &&
    f.chords[1] === c.chords[1] &&
    DEGREE_SEMIS[f.melody[0] - 1] === c.semis[0] &&
    DEGREE_SEMIS[f.melody[1] - 1] === c.semis[1]
  );
}

// The practice screen and the checklist popup talk over this channel.
export const FORMULA_CHANNEL = 'gb-formulas';

export type FormulaMessage =
  | { type: 'hello' }
  | { type: 'state'; universe: UniverseId; key: string; bpm: number; recording: boolean; playing: boolean }
  | { type: 'change'; change: MelodyChange }
  | { type: 'hearing'; semi: number; chord: ChordNumeral | null }
  | { type: 'setUniverse'; universe: UniverseId }
  | { type: 'manualTick'; formulaId: string; pace: 'normal' | 'slow' };
