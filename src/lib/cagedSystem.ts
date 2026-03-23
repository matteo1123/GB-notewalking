/**
 * CAGED System utility
 *
 * Computes the 5 CAGED shape zones for a given key across the fretboard.
 * Each shape occupies a fret range and is shown as a faint colored band.
 *
 * Shape order going up the neck: C → A → G → E → D → (repeat at fret 12)
 *
 * Base starting frets in key of C (all other keys are shifts of these):
 *   C shape: 0, A shape: 3, G shape: 5, E shape: 8, D shape: 10
 */

export type CagedShape = 'C' | 'A' | 'G' | 'E' | 'D';

export const CAGED_SHAPE_COLORS: Record<CagedShape, string> = {
    C: 'rgba(59, 130, 246, 0.28)',   // blue
    A: 'rgba(236, 72, 153, 0.26)',   // pink
    G: 'rgba(34, 197, 94, 0.24)',    // green
    E: 'rgba(168, 85, 247, 0.26)',   // purple
    D: 'rgba(249, 115, 22, 0.26)',   // orange
};

export const CAGED_LABEL_COLORS: Record<CagedShape, string> = {
    C: 'rgba(59, 130, 246, 0.5)',
    A: 'rgba(236, 72, 153, 0.5)',
    G: 'rgba(34, 197, 94, 0.5)',
    E: 'rgba(168, 85, 247, 0.5)',
    D: 'rgba(249, 115, 22, 0.5)',
};

// Semitone offset from C for each note name
const NOTE_TO_SEMITONE: Record<string, number> = {
    'C': 0, 'C#': 1, 'Db': 1,
    'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4,
    'F': 5, 'F#': 6, 'Gb': 6,
    'G': 7, 'G#': 8, 'Ab': 8,
    'A': 9, 'A#': 10, 'Bb': 10,
    'B': 11,
};

// Base fret starts for each shape in key of C
const BASE_STARTS: Record<CagedShape, number> = {
    C: 0, A: 3, G: 5, E: 8, D: 10,
};

export interface CagedZone {
    shape: CagedShape;
    startFret: number; // 1-based, inclusive (fret 1 = first fret on neck)
    endFret: number;   // 1-based, inclusive
    color: string;
    labelColor: string;
}

/**
 * Extract the root note letter(s) from a key string.
 * Handles formats like "C", "F#", "Bb", "Am", "A minor", "G major"
 */
function extractRootNote(key: string): string {
    if (!key) return '';
    const trimmed = key.trim();
    // Try two-character accidental first (C#, Db, Bb, etc.)
    if (trimmed.length >= 2 && (trimmed[1] === '#' || trimmed[1] === 'b')) {
        return trimmed.substring(0, 2);
    }
    return trimmed.substring(0, 1).toUpperCase();
}

/**
 * Returns the 5 CAGED zones for a given key, covering frets 1 through fretCount.
 * Open string (fret 0) is not included — it's rendered separately.
 */
export function getCagedZones(key: string, fretCount: number = 22): CagedZone[] {
    const rootNote = extractRootNote(key);
    const semitone = NOTE_TO_SEMITONE[rootNote];
    if (semitone === undefined) return [];

    const shapes: CagedShape[] = ['C', 'A', 'G', 'E', 'D'];

    // Generate all shape start frets across two octaves (0-23) to cover the full neck
    const allStarts: { shape: CagedShape; fret: number }[] = [];
    for (let octave = 0; octave <= 1; octave++) {
        for (const shape of shapes) {
            const fret = (BASE_STARTS[shape] + semitone) % 12 + octave * 12;
            allStarts.push({ shape, fret });
        }
    }

    // Sort by fret ascending
    allStarts.sort((a, b) => a.fret - b.fret);

    // Build zones: each zone runs from its start to just before the next zone's start
    const zones: CagedZone[] = [];
    for (let i = 0; i < allStarts.length; i++) {
        const { shape, fret: rawStart } = allStarts[i];
        const nextStart = i + 1 < allStarts.length ? allStarts[i + 1].fret : fretCount + 1;

        // Clamp to fret 1-fretCount (fret 0 is open strings, handled separately)
        const startFret = Math.max(rawStart, 1);
        const endFret = Math.min(nextStart - 1, fretCount);

        if (startFret > fretCount) break;
        if (endFret < startFret) continue;

        zones.push({
            shape,
            startFret,
            endFret,
            color: CAGED_SHAPE_COLORS[shape],
            labelColor: CAGED_LABEL_COLORS[shape],
        });
    }

    return zones;
}
