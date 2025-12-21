import { ChordNumeral, ChordInfo, RhythmPattern, RhythmPatternInfo } from "@/types/chords";
import { CHROMATIC_SCALE } from "./musicTheory";

/**
 * Rhythm pattern definitions
 * subdivision: how many subdivisions per beat (1 = quarter, 2 = eighth, 4 = sixteenth)
 * hitPattern: which subdivisions to hit (0-indexed within each beat)
 */
export const RHYTHM_PATTERNS: Record<RhythmPattern, RhythmPatternInfo> = {
    quarter: {
        id: "quarter",
        name: "Quarter Notes",
        description: "1  2  3  4",
        subdivision: 1, // 1 subdivision per beat
        hitPattern: [0], // Hit on beat (subdivision 0)
    },
    eighth: {
        id: "eighth",
        name: "Eighth Notes",
        description: "1 + 2 + 3 + 4 +",
        subdivision: 2, // 2 subdivisions per beat
        hitPattern: [0, 1], // Hit on beat and "+"
    },
    sixteenth: {
        id: "sixteenth",
        name: "Sixteenth Notes",
        description: "1 y + a 2 y + a 3 y + a 4 y + a",
        subdivision: 4, // 4 subdivisions per beat
        hitPattern: [0, 1, 2, 3], // Hit on all subdivisions
    },
};

/**
 * Check if the current subdivision should trigger a note
 * @param tickCount - Total ticks since start
 * @param subdivision - Subdivisions per beat (1, 2, or 4)
 * @param hitPattern - Which subdivisions to hit
 * @returns true if this tick should play a note
 */
export function shouldPlayOnTick(
    tickCount: number,
    subdivision: number,
    hitPattern: number[]
): boolean {
    // Calculate which subdivision we're on (0-indexed within the current beat)
    const subdivisionIndex = tickCount % subdivision;
    return hitPattern.includes(subdivisionIndex);
}

/**
 * Get all diatonic chord numerals in order
 */
export function getDiatonicChords(): ChordNumeral[] {
    return ["I", "ii", "iii", "IV", "V", "vi", "vii°"];
}

/**
 * Get the scale degree for a chord numeral
 * @param numeral - Roman numeral chord (I, ii, iii, etc.)
 * @returns Scale degree (1-7)
 */
export function getChordDegree(numeral: ChordNumeral): number {
    const degreeMap: Record<ChordNumeral, number> = {
        "I": 1,
        "ii": 2,
        "iii": 3,
        "IV": 4,
        "V": 5,
        "vi": 6,
        "vii°": 7,
    };
    return degreeMap[numeral];
}

/**
 * Get the root note for a chord in a given key
 * @param key - The key (e.g., "G", "C", "F#")
 * @param numeral - The chord numeral (e.g., "IV")
 * @returns The root note (e.g., "C" for IV in G major)
 */
export function getChordRoot(key: string, numeral: ChordNumeral): string {
    const degree = getChordDegree(numeral);

    // Major scale intervals (in semitones from root)
    const majorScaleIntervals = [0, 2, 4, 5, 7, 9, 11];

    const keyIndex = CHROMATIC_SCALE.indexOf(key);
    if (keyIndex === -1) {
        console.error(`Invalid key: ${key}`);
        return key; // Fallback
    }

    const interval = majorScaleIntervals[degree - 1];
    const rootNoteIndex = (keyIndex + interval) % 12;

    return CHROMATIC_SCALE[rootNoteIndex];
}

/**
 * Get chord info for a specific chord in a key
 * @param key - The musical key
 * @param numeral - The chord numeral
 * @returns ChordInfo object with numeral, root note, and degree
 */
export function getChordInfo(key: string, numeral: ChordNumeral): ChordInfo {
    return {
        numeral,
        rootNote: getChordRoot(key, numeral),
        degree: getChordDegree(numeral),
    };
}

/**
 * Calculate the scale degree of a detected note relative to a chord root
 * @param detectedNote - The note detected by pitch detection (e.g., "B")
 * @param chordRoot - The root of the current chord (e.g., "G")
 * @returns Scale degree (1-7) or null if chromatic
 */
export function calculateDegreeFromRoot(
    detectedNote: string,
    chordRoot: string
): number | null {
    const rootIdx = CHROMATIC_SCALE.indexOf(chordRoot);
    const noteIdx = CHROMATIC_SCALE.indexOf(detectedNote);

    if (rootIdx === -1 || noteIdx === -1) {
        return null;
    }

    // Calculate interval in semitones
    const interval = (noteIdx - rootIdx + 12) % 12;

    // Map semitones to major scale degrees
    const degreeMap: Record<number, number> = {
        0: 1,   // Root
        2: 2,   // Major 2nd
        4: 3,   // Major 3rd
        5: 4,   // Perfect 4th
        7: 5,   // Perfect 5th
        9: 6,   // Major 6th
        11: 7,  // Major 7th
    };

    return degreeMap[interval] ?? null; // null if chromatic (not in major scale)
}

/**
 * Get the chord tones (scale degrees) for a given chord
 * Returns the scale degrees that make up the chord
 * @param numeral - The chord numeral
 * @returns Array of scale degrees (e.g., [1, 3, 5, 7] for I, [4, 6, 1, 3] for IV)
 */
export function getChordTones(numeral: ChordNumeral): number[] {
    const chordDegree = getChordDegree(numeral);

    // Build a 7th chord (root, 3rd, 5th, 7th)
    // Stack thirds: root, +2 scale degrees, +2 more, +2 more
    const tones = [
        chordDegree,                          // Root (1st)
        ((chordDegree + 1) % 7) + 1,         // 3rd (skip one scale degree)
        ((chordDegree + 3) % 7) + 1,         // 5th (skip two more)
        ((chordDegree + 5) % 7) + 1,         // 7th (skip two more)
    ];

    return tones;
}

/**
 * Format a chord progression for display
 * @param chords - Array of chord numerals
 * @returns Formatted string (e.g., "I - IV - V")
 */
export function formatProgression(chords: ChordNumeral[]): string {
    return chords.join(" - ");
}
