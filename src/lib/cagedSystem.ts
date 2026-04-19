/**
 * CAGED System — major-pentatonic shape geometry
 *
 * Each of the 5 CAGED shapes = exactly 2 consecutive major-pentatonic notes
 * per string. Adjacent shapes share a boundary note on every string — so the
 * fretboard is tiled end-to-end by 5 interlocking shapes that repeat every
 * 12 frets. This mirrors the reference poster exactly.
 *
 * Two derived views are exposed:
 *   - getShapeMap()    — assigns every major-scale (string, fret) cell to a
 *                        single owning shape. Drives reveal logic and any
 *                        per-note coloring.
 *   - getShapeRects()  — per-string fret spans (with optional padding past
 *                        the note centers) for rendering each shape as a
 *                        translucent overlapping polygon. Adjacent shapes
 *                        overlap at the shared fret column, so the boundary
 *                        passes through the shared note, not between frets.
 */

export type CagedShape = 'C' | 'A' | 'G' | 'E' | 'D';

export const CAGED_SHAPES: CagedShape[] = ['C', 'A', 'G', 'E', 'D'];

export const CAGED_SHAPE_COLORS: Record<CagedShape, string> = {
    C: 'rgba(59, 130, 246, 0.07)',   // blue
    A: 'rgba(236, 72, 153, 0.07)',   // pink
    G: 'rgba(34, 197, 94, 0.06)',    // green
    E: 'rgba(168, 85, 247, 0.07)',   // purple
    D: 'rgba(249, 115, 22, 0.07)',   // orange
};

export const CAGED_LABEL_COLORS: Record<CagedShape, string> = {
    C: 'rgba(59, 130, 246, 0.25)',
    A: 'rgba(236, 72, 153, 0.25)',
    G: 'rgba(34, 197, 94, 0.25)',
    E: 'rgba(168, 85, 247, 0.25)',
    D: 'rgba(249, 115, 22, 0.25)',
};

export const CAGED_SHAPE_COLORS_STRONG: Record<CagedShape, string> = {
    C: 'rgba(59, 130, 246, 0.30)',
    A: 'rgba(236, 72, 153, 0.30)',
    G: 'rgba(34, 197, 94, 0.28)',
    E: 'rgba(168, 85, 247, 0.30)',
    D: 'rgba(249, 115, 22, 0.30)',
};

export const CAGED_LABEL_COLORS_STRONG: Record<CagedShape, string> = {
    C: 'rgba(59, 130, 246, 0.75)',
    A: 'rgba(236, 72, 153, 0.75)',
    G: 'rgba(34, 197, 94, 0.75)',
    E: 'rgba(168, 85, 247, 0.75)',
    D: 'rgba(249, 115, 22, 0.75)',
};

/** Solid hex, used for borders/strokes. */
export const CAGED_SHAPE_HEX: Record<CagedShape, string> = {
    C: '#3b82f6',
    A: '#ec4899',
    G: '#22c55e',
    E: '#a855f7',
    D: '#f97316',
};

const NOTE_TO_SEMITONE: Record<string, number> = {
    'C': 0, 'C#': 1, 'Db': 1,
    'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4,
    'F': 5, 'F#': 6, 'Gb': 6,
    'G': 7, 'G#': 8, 'Ab': 8,
    'A': 9, 'A#': 10, 'Bb': 10,
    'B': 11,
};

const MAJOR_SCALE_INTERVALS = new Set([0, 2, 4, 5, 7, 9, 11]);
const LEADING_TONE_DEGREE = 11;  // major 7th — pulled into the shape ABOVE its pent window
const SUBDOMINANT_DEGREE = 5;    // perfect 4th — pulled in BELOW
const CHORD_TONE_ROLES: Record<number, 'R' | '3' | '5'> = {
    0: 'R',
    4: '3',
    7: '5',
};

// Standard tuning, open-string pitch as semitones from C.
const OPEN_STRING_SEMITONE: Record<number, number> = {
    1: 4,   // high E
    2: 11,  // B
    3: 7,   // G
    4: 2,   // D
    5: 9,   // A
    6: 4,   // low E
};

/**
 * The five CAGED major-pentatonic shapes in key of C, as [lowFret, highFret]
 * per string (2 consecutive pentatonic notes per string). Adjacent shapes
 * share the boundary fret on every string — e.g. C shape's highFret on a
 * given string = A shape's lowFret on that same string.
 */
const SHAPE_FRET_PAIRS_KEY_C: Record<CagedShape, Record<number, [number, number]>> = {
    C: { 1: [0, 3],  2: [1, 3],  3: [0, 2],  4: [0, 2],  5: [0, 3],  6: [0, 3]  },
    A: { 1: [3, 5],  2: [3, 5],  3: [2, 5],  4: [2, 5],  5: [3, 5],  6: [3, 5]  },
    G: { 1: [5, 8],  2: [5, 8],  3: [5, 7],  4: [5, 7],  5: [5, 7],  6: [5, 8]  },
    E: { 1: [8, 10], 2: [8, 10], 3: [7, 9],  4: [7, 10], 5: [7, 10], 6: [8, 10] },
    D: { 1: [10, 12],2: [10, 13],3: [9, 12], 4: [10, 12],5: [10, 12],6: [10, 12] },
};

function extractRootNote(key: string): string {
    if (!key) return '';
    const trimmed = key.trim();
    if (trimmed.length >= 2 && (trimmed[1] === '#' || trimmed[1] === 'b')) {
        return trimmed[0].toUpperCase() + trimmed[1];
    }
    return trimmed[0].toUpperCase();
}

function getKeyRoot(key: string): number | null {
    const root = extractRootNote(key);
    const semi = NOTE_TO_SEMITONE[root];
    return semi === undefined ? null : semi;
}

function isMajorScaleNote(string: number, fret: number, keyRoot: number): boolean {
    const open = OPEN_STRING_SEMITONE[string];
    if (open === undefined) return false;
    const pitch = ((open + fret) % 12 + 12) % 12;
    const degree = (pitch - keyRoot + 12) % 12;
    return MAJOR_SCALE_INTERVALS.has(degree);
}

/** Degree (0..11) relative to keyRoot if this fret holds a major-scale note,
 *  otherwise null. */
function majorScaleDegree(string: number, fret: number, keyRoot: number): number | null {
    const open = OPEN_STRING_SEMITONE[string];
    if (open === undefined) return null;
    const pitch = ((open + fret) % 12 + 12) % 12;
    const degree = (pitch - keyRoot + 12) % 12;
    return MAJOR_SCALE_INTERVALS.has(degree) ? degree : null;
}

/**
 * Shape's fret range on one string, shifted for key and octave.
 * octaveShift = 0 is the base position in C.
 */
export function getShapeRangeOnString(
    key: string,
    shape: CagedShape,
    string: number,
    octaveShift: number = 0,
): [number, number] {
    const keyRoot = getKeyRoot(key);
    if (keyRoot === null) return [0, 0];
    const base = SHAPE_FRET_PAIRS_KEY_C[shape][string];
    const shift = keyRoot + 12 * octaveShift;
    return [base[0] + shift, base[1] + shift];
}

/**
 * For every (string, fret) that holds a major-scale note in this key,
 * return which CAGED shape owns it. First-match wins using iteration order:
 *   - octave 0 before other octaves (current-position shapes win boundaries)
 *   - within each octave, C → A → G → E → D
 *
 * Non-pentatonic scale notes (4th and 7th) are claimed by whichever shape's
 * [low, high] window contains them on that string — e.g. F on string 4 fret 3
 * (key of C) falls inside A-shape's [2, 5] window, so A owns it.
 */
export function getShapeMap(key: string, fretCount: number = 22): Map<string, CagedShape> {
    const keyRoot = getKeyRoot(key);
    if (keyRoot === null) return new Map();

    const map = new Map<string, CagedShape>();
    const octaveShifts = [0, -1, 1, 2];

    for (const oct of octaveShifts) {
        for (const shape of CAGED_SHAPES) {
            for (let s = 1; s <= 6; s++) {
                const [low, high] = getShapeRangeOnString(key, shape, s, oct);
                const lo = Math.max(0, low);
                const hi = Math.min(fretCount, high);
                for (let f = lo; f <= hi; f++) {
                    const k = `${s}-${f}`;
                    if (map.has(k)) continue;
                    if (!isMajorScaleNote(s, f, keyRoot)) continue;
                    map.set(k, shape);
                }
            }
        }
    }

    return map;
}

/**
 * Per-string [low, high] window for a shape, expanded by one fret on each
 * side IF that adjacent fret holds a non-pentatonic major-scale note (the
 * leading-tone below or the perfect-4th above). This is the "constellation
 * window" — pent endpoints + the in-scale colour tones that musically
 * belong to this shape but sit just outside the pent box.
 *
 * Shared with both reveal and rect-bounds logic so the polygon always
 * contains every revealed note.
 */
export function getShapeWindowOnString(
    key: string,
    shape: CagedShape,
    string: number,
    octaveShift: number = 0,
): [number, number] {
    const keyRoot = getKeyRoot(key);
    const [low, high] = getShapeRangeOnString(key, shape, string, octaveShift);
    if (keyRoot === null) return [low, high];

    let lo = low;
    let hi = high;
    const dBelow = majorScaleDegree(string, low - 1, keyRoot);
    if (dBelow === LEADING_TONE_DEGREE) lo = low - 1;
    const dAbove = majorScaleDegree(string, high + 1, keyRoot);
    if (dAbove === SUBDOMINANT_DEGREE) hi = high + 1;
    return [lo, hi];
}

/**
 * Every (string, fret) this shape "owns" musically: all in-scale notes
 * inside the pent window, plus the leading-tone (degree 7) one fret below
 * and the perfect 4th one fret above when present.
 *
 * Unlike getShapeMap, the same fret may be claimed by adjacent shapes —
 * pent boundary notes appear in BOTH neighbours, which is what we want
 * for reveal so a learner who unlocks just one shape still sees its full
 * shared edge.
 */
export function getShapeRevealPositions(
    key: string,
    shape: CagedShape,
    fretCount: number = 22,
): Set<string> {
    const keyRoot = getKeyRoot(key);
    const out = new Set<string>();
    if (keyRoot === null) return out;
    const octaveShifts = [-1, 0, 1, 2];
    for (const oct of octaveShifts) {
        for (let s = 1; s <= 6; s++) {
            const [lo, hi] = getShapeWindowOnString(key, shape, s, oct);
            const a = Math.max(0, lo);
            const b = Math.min(fretCount, hi);
            for (let f = a; f <= b; f++) {
                if (majorScaleDegree(s, f, keyRoot) !== null) out.add(`${s}-${f}`);
            }
        }
    }
    return out;
}

/**
 * Chord-tone (R, 3, 5) positions inside a shape's pent window across every
 * visible octave. Powers the "constellation" polyline that traces the
 * underlying chord through each shape.
 */
export interface ChordToneNode {
    string: number;
    fret: number;
    role: 'R' | '3' | '5';
    octaveShift: number;
}

export function getShapeChordTonePositions(
    key: string,
    shape: CagedShape,
    fretCount: number = 22,
): ChordToneNode[] {
    const keyRoot = getKeyRoot(key);
    if (keyRoot === null) return [];
    const out: ChordToneNode[] = [];
    const octaveShifts = [-1, 0, 1, 2];
    for (const oct of octaveShifts) {
        for (let s = 1; s <= 6; s++) {
            const [low, high] = getShapeRangeOnString(key, shape, s, oct);
            const a = Math.max(0, low);
            const b = Math.min(fretCount, high);
            for (let f = a; f <= b; f++) {
                const open = OPEN_STRING_SEMITONE[s];
                if (open === undefined) continue;
                const pitch = ((open + f) % 12 + 12) % 12;
                const degree = (pitch - keyRoot + 12) % 12;
                const role = CHORD_TONE_ROLES[degree];
                if (role) out.push({ string: s, fret: f, role, octaveShift: oct });
            }
        }
    }
    return out;
}

/**
 * Canonical chord voicings for each CAGED shape — the actual notes a
 * guitarist fingers when playing the shape, not every chord tone in its
 * range. Each entry maps (string 1..6) → role on that string, where
 * 'skip' means the string is muted/not played in this voicing.
 *
 *   C: x R 3 5 R 3   (open C: x 3 2 0 1 0)
 *   A: x R 5 R 3 5   (open A: x 0 2 2 2 0)
 *   G: R 3 5 R 3 R   (open G: 3 2 0 0 0 3)
 *   E: R 5 R 3 5 R   (open E: 0 2 2 1 0 0)
 *   D: x x R 5 R 3   (open D: x x 0 2 3 2)
 */
export type VoicingRole = 'R' | '3' | '5' | 'skip';

export const CAGED_SHAPE_VOICING: Record<CagedShape, Record<number, VoicingRole>> = {
    C: { 6: 'skip', 5: 'R', 4: '3', 3: '5', 2: 'R', 1: '3' },
    A: { 6: 'skip', 5: 'R', 4: '5', 3: 'R', 2: '3', 1: '5' },
    G: { 6: 'R', 5: '3', 4: '5', 3: 'R', 2: '3', 1: 'R' },
    E: { 6: 'R', 5: '5', 4: 'R', 3: '3', 2: '5', 1: 'R' },
    D: { 6: 'skip', 5: 'skip', 4: 'R', 3: '5', 2: 'R', 1: '3' },
};

const ROLE_TO_DEGREE: Record<Exclude<VoicingRole, 'skip'>, number> = {
    R: 0,
    '3': 4,
    '5': 7,
};

/**
 * Voicing notes for a shape — exactly what the guitarist plays for this
 * CAGED chord at every visible octave. Skipped strings are omitted entirely.
 * Used as the constellation source so the polyline traces the actual chord
 * shape (R-5-R-3-5 for an A barre, etc.) instead of every R/3/5 in the
 * pent window.
 */
export function getShapeVoicingPositions(
    key: string,
    shape: CagedShape,
    fretCount: number = 22,
): ChordToneNode[] {
    const keyRoot = getKeyRoot(key);
    if (keyRoot === null) return [];
    const voicing = CAGED_SHAPE_VOICING[shape];
    const out: ChordToneNode[] = [];
    const octaveShifts = [-1, 0, 1, 2];

    for (const oct of octaveShifts) {
        for (let s = 1; s <= 6; s++) {
            const role = voicing[s];
            if (!role || role === 'skip') continue;
            const targetDegree = ROLE_TO_DEGREE[role];
            const [low, high] = getShapeRangeOnString(key, shape, s, oct);
            const a = Math.max(0, low);
            const b = Math.min(fretCount, high);
            for (let f = a; f <= b; f++) {
                const open = OPEN_STRING_SEMITONE[s];
                if (open === undefined) continue;
                const pitch = ((open + f) % 12 + 12) % 12;
                const degree = (pitch - keyRoot + 12) % 12;
                if (degree === targetDegree) {
                    out.push({ string: s, fret: f, role, octaveShift: oct });
                    break; // exactly one voicing note per (string, octave)
                }
            }
        }
    }

    return out;
}

/**
 * The 2 pentatonic notes (endpoints) of a shape on every string, across
 * every visible octave. Used for connect-node reveal logic.
 */
export function getShapePentatonicPositions(
    key: string,
    shape: CagedShape,
    fretCount: number = 22,
): Set<string> {
    const out = new Set<string>();
    const octaveShifts = [-1, 0, 1, 2];
    for (const oct of octaveShifts) {
        for (let s = 1; s <= 6; s++) {
            const [low, high] = getShapeRangeOnString(key, shape, s, oct);
            if (low >= 0 && low <= fretCount) out.add(`${s}-${low}`);
            if (high >= 0 && high <= fretCount) out.add(`${s}-${high}`);
        }
    }
    return out;
}

/** All frets on one string that belong to `shape` per the shape map. */
export function getShapeNotesOnString(
    key: string,
    shape: CagedShape,
    string: number,
    fretCount: number = 22,
): number[] {
    const map = getShapeMap(key, fretCount);
    const out: number[] = [];
    for (let f = 0; f <= fretCount; f++) {
        if (map.get(`${string}-${f}`) === shape) out.push(f);
    }
    return out;
}

export interface ShapeRect {
    shape: CagedShape;
    string: number;  // 1..6
    /** Left edge in fret-center coords: fret 1 note sits at x = 0.5, fret 22 at x = 21.5. */
    xLow: number;
    xHigh: number;
    /** True when this segment reaches across the nut into the open string. */
    includesOpen: boolean;
}

/**
 * Rectangles describing each shape's coverage per string, per visible octave.
 * Coordinate system matches the main fretboard grid: fret f (for f ≥ 1) spans
 * x ∈ [f-1, f], with the note dot centered at x = f - 0.5.
 *
 * `padding` extends each end past the note center by that many fret-widths.
 * Default 0.5 means the polygon reaches to the fret edge on each side, so
 * adjacent shapes overlap by exactly one full fret column at every shared
 * note — the shared note visually lives in both shapes.
 */
export function getShapeRects(
    key: string,
    fretCount: number = 22,
    padding: number = 0.5,
): ShapeRect[] {
    const keyRoot = getKeyRoot(key);
    if (keyRoot === null) return [];

    const rects: ShapeRect[] = [];
    const octaveShifts = [-1, 0, 1, 2];

    for (const oct of octaveShifts) {
        for (const shape of CAGED_SHAPES) {
            for (let s = 1; s <= 6; s++) {
                // Use the expanded constellation window so the polygon
                // captures the leading-tone-below / 4th-above when present.
                const [low, high] = getShapeWindowOnString(key, shape, s, oct);
                const xLowRaw = (low - 0.5) - padding;
                const xHighRaw = (high - 0.5) + padding;
                const xLow = Math.max(0, xLowRaw);
                const xHigh = Math.min(fretCount, xHighRaw);
                if (xLow >= xHigh) continue;
                rects.push({
                    shape,
                    string: s,
                    xLow,
                    xHigh,
                    includesOpen: xLowRaw < 0 && low <= 0,
                });
            }
        }
    }

    return rects;
}

/**
 * Map of (string, fret=0) → shape for every open string that a shape's
 * polygon visually extends into. Used to tint the open-notes column so the
 * shape coloring doesn't cut off abruptly at the nut.
 */
export function getOpenStringShapes(key: string, fretCount: number = 22): Map<number, CagedShape> {
    const out = new Map<number, CagedShape>();
    const octaveShifts = [0, -1];
    for (const oct of octaveShifts) {
        for (const shape of CAGED_SHAPES) {
            for (let s = 1; s <= 6; s++) {
                if (out.has(s)) continue;
                const [low, high] = getShapeRangeOnString(key, shape, s, oct);
                // Polygon reaches the nut if the low edge of the shape sits at
                // or before fret 0 and the high edge is at or past fret 0.
                if (low <= 0 && high >= 0) out.set(s, shape);
            }
        }
    }
    return out;
}
