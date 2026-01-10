/**
 * Rhythm Training - Progressive strumming patterns for guitarists
 * Based on 16th notes (1 y and a, 2 y and a, 3 y and a, 4 y and a)
 * 
 * Supports two modes:
 * - Random: Random deviations for creative practice
 * - Systematic: Predictable progression through all beat positions
 * 
 * Supports two deviation types:
 * - Skip: Rest on specific strums
 * - Triplet: 3 strums in place of 2 (replaces adjacent 16th notes)
 */

// Types

export type RhythmMode = 'random' | 'systematic';

export type DeviationType = 'skip' | 'triplet';

export interface DeviationOptions {
    skip: boolean;
    triplet: boolean;
}

export interface StumPattern {
    beat: number;        // Which beat (1-4)
    subdivision: string; // Which subdivision: "1", "y", "and", "a"
    strum: boolean;      // true = play, false = skip (rest)
    direction: "down" | "up"; // Strum direction
    triplet?: boolean;   // true = this is part of a triplet
    tripletPosition?: 1 | 2 | 3; // Position within the triplet
}

export interface RhythmPattern {
    id: string;
    level: number;
    name: string;
    description: string;
    pattern: StumPattern[];
    deviationCount: number;
    deviationTypes: DeviationType[];
    tripletPositions: number[]; // Beat positions (1-4) that have triplets
    skipPositions: number[];    // Pattern indices that are skipped
}

export interface RhythmGeneratorOptions {
    mode: RhythmMode;
    deviationTypes: DeviationOptions;
    level: number;
    systematicIndex?: number; // For systematic mode, which permutation
}

// Constants

const SUBDIVISIONS = ["1", "y", "and", "a"] as const;

// Systematic sequence: all permutations of beat positions (1-4)
// Format: array of arrays, each inner array is beat positions to apply deviation
const SYSTEMATIC_SEQUENCE: number[][] = [
    [],           // 0: No deviations
    [1],          // 1: Beat 1 only
    [2],          // 2: Beat 2 only
    [3],          // 3: Beat 3 only
    [4],          // 4: Beat 4 only
    [1, 3],       // 5: Beats 1 and 3
    [2, 4],       // 6: Beats 2 and 4
    [1, 2],       // 7: Beats 1 and 2
    [3, 4],       // 8: Beats 3 and 4
    [1, 4],       // 9: Beats 1 and 4
    [2, 3],       // 10: Beats 2 and 3
    [1, 2, 3],    // 11: Beats 1, 2, 3
    [2, 3, 4],    // 12: Beats 2, 3, 4
    [1, 3, 4],    // 13: Beats 1, 3, 4
    [1, 2, 4],    // 14: Beats 1, 2, 4
    [1, 2, 3, 4], // 15: All beats
];

export const SYSTEMATIC_SEQUENCE_LENGTH = SYSTEMATIC_SEQUENCE.length;

// Functions

/**
 * Generate the basic 16th note strumming pattern (no deviations)
 * Down-up-down-up on each beat
 */
function generateBasicPattern(): StumPattern[] {
    const pattern: StumPattern[] = [];

    for (let beat = 1; beat <= 4; beat++) {
        for (let subIndex = 0; subIndex < 4; subIndex++) {
            pattern.push({
                beat,
                subdivision: SUBDIVISIONS[subIndex],
                strum: true,
                direction: subIndex % 2 === 0 ? "down" : "up",
            });
        }
    }

    return pattern;
}

/**
 * Apply triplet to a specific beat.
 * A triplet replaces 2 adjacent 16th notes ("1 y" or "and a") with 3 evenly-spaced notes.
 * We replace positions 0-1 (first half of beat) or could do 2-3 (second half).
 * For simplicity: triplet replaces the first two notes of a beat ("1" and "y").
 */
function applyTripletToBeat(pattern: StumPattern[], beat: number): StumPattern[] {
    const result: StumPattern[] = [];

    for (const note of pattern) {
        if (note.beat === beat) {
            // First two subdivisions become a triplet (3 notes in place of 2)
            if (note.subdivision === "1") {
                // Replace "1" and "y" with 3 triplet notes
                result.push({
                    beat,
                    subdivision: "1",
                    strum: true,
                    direction: "down",
                    triplet: true,
                    tripletPosition: 1,
                });
                result.push({
                    beat,
                    subdivision: "t",
                    strum: true,
                    direction: "up",
                    triplet: true,
                    tripletPosition: 2,
                });
                result.push({
                    beat,
                    subdivision: "y",
                    strum: true,
                    direction: "down",
                    triplet: true,
                    tripletPosition: 3,
                });
            } else if (note.subdivision === "y") {
                // Skip - already handled in "1" case
                continue;
            } else {
                // "and" and "a" stay normal
                result.push({ ...note });
            }
        } else {
            result.push({ ...note });
        }
    }

    return result;
}

/**
 * Apply skip to random positions in the pattern
 */
function applyRandomSkips(pattern: StumPattern[], skipCount: number): { pattern: StumPattern[], positions: number[] } {
    const result = pattern.map(s => ({ ...s }));

    // Get valid positions (not already triplets)
    const validPositions = result
        .map((s, i) => (!s.triplet ? i : -1))
        .filter(i => i !== -1);

    // Fisher-Yates shuffle to get random positions
    for (let i = validPositions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [validPositions[i], validPositions[j]] = [validPositions[j], validPositions[i]];
    }

    const skipPositions = validPositions.slice(0, Math.min(skipCount, validPositions.length - 1));

    skipPositions.forEach(pos => {
        result[pos].strum = false;
    });

    return { pattern: result, positions: skipPositions };
}

/**
 * Generate a rhythm pattern with the new options
 */
export function generateRhythmPattern(level: number): RhythmPattern;
export function generateRhythmPattern(options: RhythmGeneratorOptions): RhythmPattern;
export function generateRhythmPattern(arg: number | RhythmGeneratorOptions): RhythmPattern {
    // Handle legacy call with just level
    if (typeof arg === 'number') {
        return generateRandomPattern({
            mode: 'random',
            deviationTypes: { skip: true, triplet: false },
            level: arg,
        });
    }

    const options = arg;

    if (options.mode === 'systematic') {
        return generateSystematicPattern(options);
    } else {
        return generateRandomPattern(options);
    }
}

/**
 * Generate a random rhythm pattern (current behavior + triplet support)
 */
function generateRandomPattern(options: RhythmGeneratorOptions): RhythmPattern {
    let pattern = generateBasicPattern();
    const tripletPositions: number[] = [];
    let skipPositions: number[] = [];
    const activeTypes: DeviationType[] = [];

    // Level 0 = no deviations
    if (options.level === 0) {
        return {
            id: `rhythm-r0-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            level: 0,
            name: "Basic 16ths",
            description: "All strums: 1 y and a, 2 y and a, 3 y and a, 4 y and a",
            pattern,
            deviationCount: 0,
            deviationTypes: [],
            tripletPositions: [],
            skipPositions: [],
        };
    }

    const deviationCount = Math.min(options.level, 15);

    // Determine how many of each deviation type to apply
    let tripletCount = 0;
    let skipCount = 0;

    if (options.deviationTypes.triplet && options.deviationTypes.skip) {
        // Both enabled: split deviations between them
        tripletCount = Math.floor(deviationCount / 2);
        skipCount = deviationCount - tripletCount;
        activeTypes.push('triplet', 'skip');
    } else if (options.deviationTypes.triplet) {
        tripletCount = Math.min(deviationCount, 4); // Max 4 triplets (one per beat)
        activeTypes.push('triplet');
    } else if (options.deviationTypes.skip) {
        skipCount = deviationCount;
        activeTypes.push('skip');
    }

    // Apply triplets to random beats
    if (tripletCount > 0) {
        const beats = [1, 2, 3, 4];
        // Shuffle beats
        for (let i = beats.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [beats[i], beats[j]] = [beats[j], beats[i]];
        }
        const selectedBeats = beats.slice(0, tripletCount);

        for (const beat of selectedBeats) {
            pattern = applyTripletToBeat(pattern, beat);
            tripletPositions.push(beat);
        }
    }

    // Apply skips
    if (skipCount > 0) {
        const result = applyRandomSkips(pattern, skipCount);
        pattern = result.pattern;
        skipPositions = result.positions;
    }

    const totalDeviations = tripletPositions.length + skipPositions.length;

    return {
        id: `rhythm-r${options.level}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        level: options.level,
        name: getPatternName(totalDeviations, activeTypes),
        description: getPatternDescription(pattern, tripletPositions, skipPositions),
        pattern,
        deviationCount: totalDeviations,
        deviationTypes: activeTypes,
        tripletPositions,
        skipPositions,
    };
}

/**
 * Generate a systematic rhythm pattern (predictable progression)
 */
function generateSystematicPattern(options: RhythmGeneratorOptions): RhythmPattern {
    const index = options.systematicIndex ?? options.level;
    const safeIndex = Math.min(index, SYSTEMATIC_SEQUENCE.length - 1);
    const beatPositions = SYSTEMATIC_SEQUENCE[safeIndex];

    let pattern = generateBasicPattern();
    const tripletPositions: number[] = [];
    const skipPositions: number[] = [];
    const activeTypes: DeviationType[] = [];

    // Level 0 = basic pattern
    if (safeIndex === 0) {
        return {
            id: `rhythm-s0-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            level: 0,
            name: "Basic 16ths",
            description: "All strums: 1 y and a, 2 y and a, 3 y and a, 4 y and a",
            pattern,
            deviationCount: 0,
            deviationTypes: [],
            tripletPositions: [],
            skipPositions: [],
        };
    }

    // Apply deviations to the specified beat positions
    if (options.deviationTypes.triplet) {
        activeTypes.push('triplet');
        for (const beat of beatPositions) {
            pattern = applyTripletToBeat(pattern, beat);
            tripletPositions.push(beat);
        }
    }

    if (options.deviationTypes.skip) {
        activeTypes.push('skip');
        // For systematic skips, skip the first note of each deviation beat
        for (const beat of beatPositions) {
            const noteIndex = pattern.findIndex(n => n.beat === beat && n.subdivision === "1" && !n.triplet);
            if (noteIndex !== -1 && pattern[noteIndex].strum) {
                pattern[noteIndex].strum = false;
                skipPositions.push(noteIndex);
            }
        }
    }

    const totalDeviations = tripletPositions.length + skipPositions.length;

    return {
        id: `rhythm-s${safeIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        level: safeIndex,
        name: getSystematicPatternName(beatPositions, activeTypes),
        description: getPatternDescription(pattern, tripletPositions, skipPositions),
        pattern,
        deviationCount: totalDeviations,
        deviationTypes: activeTypes,
        tripletPositions,
        skipPositions,
    };
}

/**
 * Get the next systematic index (wraps around)
 */
export function getNextSystematicIndex(currentIndex: number): number {
    return (currentIndex + 1) % SYSTEMATIC_SEQUENCE.length;
}

/**
 * Get systematic pattern name
 */
function getSystematicPatternName(beats: number[], types: DeviationType[]): string {
    if (beats.length === 0) return "Basic 16ths";

    const typeStr = types.includes('triplet') ? "Triplet" : "Skip";
    const beatStr = beats.length === 1
        ? `Beat ${beats[0]}`
        : `Beats ${beats.join(' & ')}`;

    return `${typeStr} on ${beatStr}`;
}

/**
 * Get pattern name
 */
function getPatternName(deviationCount: number, types: DeviationType[]): string {
    if (deviationCount === 0) return "Basic 16ths";

    const typeNames: string[] = [];
    if (types.includes('triplet')) typeNames.push('Triplet');
    if (types.includes('skip')) typeNames.push('Skip');

    if (deviationCount === 1) return `One ${typeNames.join('/')}`;
    if (deviationCount <= 4) return `${deviationCount} ${typeNames.join('/')}s`;
    return "Advanced Pattern";
}

/**
 * Get pattern description
 */
function getPatternDescription(
    pattern: StumPattern[],
    tripletPositions: number[],
    skipPositions: number[]
): string {
    const parts: string[] = [];

    if (tripletPositions.length > 0) {
        parts.push(`Triplets on beat${tripletPositions.length > 1 ? 's' : ''} ${tripletPositions.join(', ')}`);
    }

    if (skipPositions.length > 0) {
        const skips = skipPositions
            .map(i => pattern[i])
            .filter(s => s)
            .map(s => `${s.beat}${s.subdivision}`)
            .join(', ');
        if (skips) parts.push(`Skip: ${skips}`);
    }

    return parts.length > 0 ? parts.join(' | ') : "Play all 16th notes with alternate picking";
}

/**
 * Convert pattern to strumming notation
 * ↓ = down strum, ↑ = up strum, · = skip/rest
 * Triplets shown as ↓↓↓ (compressed)
 */
export function patternToNotation(pattern: RhythmPattern): string {
    const beats: string[] = [];

    for (let beat = 1; beat <= 4; beat++) {
        const beatNotes = pattern.pattern.filter(s => s.beat === beat);

        const symbols: string[] = [];
        let i = 0;

        while (i < beatNotes.length) {
            const note = beatNotes[i];

            if (note.triplet && note.tripletPosition === 1) {
                // Triplet: show 3 compressed arrows
                symbols.push("↓↓↓");
                // Skip the next two triplet notes (positions 2 and 3)
                i += 3;
            } else if (note.triplet) {
                // Part of triplet already handled, skip
                i++;
            } else if (!note.strum) {
                symbols.push("·");
                i++;
            } else {
                symbols.push(note.direction === "down" ? "↓" : "↑");
                i++;
            }
        }

        beats.push(symbols.join(" "));
    }

    return beats.join("  |  ");
}

/**
 * Get subdivision labels for display
 */
export function getSubdivisionLabels(): string {
    const beats: string[] = [];

    for (let beat = 1; beat <= 4; beat++) {
        beats.push(`${beat} y & a`);
    }

    return beats.join("    ");
}
