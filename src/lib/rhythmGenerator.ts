/**
 * Rhythm Training - Progressive strumming patterns for guitarists
 * Based on 16th notes (1 y and a, 2 y and a, 3 y and a, 4 y and a)
 * Introduces complexity through "skips" (rests on specific strums)
 */

export interface StumPattern {
    beat: number;        // Which beat (1-4)
    subdivision: string; // Which subdivision: "1", "y", "and", "a"
    strum: boolean;      // true = play, false = skip (rest)
    direction: "down" | "up"; // Strum direction
}

export interface RhythmPattern {
    id: string;
    level: number;
    name: string;
    description: string;
    pattern: StumPattern[];
    deviationCount: number; // How many skips from the basic pattern
}

// Map subdivision positions to names
const SUBDIVISIONS = ["1", "y", "and", "a"] as const;

/**
 * Generate the basic 16th note strumming pattern (no skips)
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
                direction: subIndex % 2 === 0 ? "down" : "up", // Down on 1 and "and", up on "y" and "a"
            });
        }
    }

    return pattern;
}

/**
 * Generate a rhythm pattern based on level
 * Level = number of skips (deviations from all notes played)
 * Level 0: No skips (all 16 strums)
 * Level 1: 1 random skip
 * Level N: N random skips (max 15, leaving at least 1 note)
 */
export function generateRhythmPattern(level: number): RhythmPattern {
    const basicPattern = generateBasicPattern();

    // Level 0 = no deviations
    if (level === 0) {
        return {
            id: `rhythm-l0-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            level: 0,
            name: "Basic 16ths",
            description: "All strums: 1 y and a, 2 y and a, 3 y and a, 4 y and a",
            pattern: basicPattern,
            deviationCount: 0,
        };
    }

    // Level directly equals number of skips (capped at 15 to leave at least 1 note)
    const deviationCount = Math.min(level, 15);

    // Clone the basic pattern
    const pattern = basicPattern.map(s => ({ ...s }));

    // Generate RANDOM skip positions using Fisher-Yates shuffle
    const allPositions = Array.from({ length: 16 }, (_, i) => i);
    for (let i = allPositions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allPositions[i], allPositions[j]] = [allPositions[j], allPositions[i]];
    }
    const skipPositions = allPositions.slice(0, deviationCount);

    // Apply skips
    skipPositions.forEach(pos => {
        pattern[pos].strum = false;
    });

    return {
        id: `rhythm-l${level}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        level,
        name: getPatternName(deviationCount),
        description: getPatternDescription(pattern, deviationCount),
        pattern,
        deviationCount,
    };
}

function getPatternName(deviationCount: number): string {
    if (deviationCount === 0) return "Basic 16ths";
    if (deviationCount === 1) return "One Skip";
    if (deviationCount === 2) return "Two Skips";
    if (deviationCount <= 4) return `${deviationCount} Skips`;
    return "Advanced Pattern";
}

function getPatternDescription(pattern: StumPattern[], deviationCount: number): string {
    if (deviationCount === 0) {
        return "Play all 16th notes with alternate picking";
    }

    const skips = pattern
        .filter(s => !s.strum)
        .map(s => `${s.beat}${s.subdivision}`)
        .join(", ");

    return `Skip: ${skips}`;
}

/**
 * Convert pattern to strumming notation
 * ↓ = down strum, ↑ = up strum, · = skip/rest
 */
export function patternToNotation(pattern: RhythmPattern): string {
    const beats: string[] = [];

    for (let beat = 1; beat <= 4; beat++) {
        const beatPatterns = pattern.pattern
            .filter(s => s.beat === beat)
            .map(s => {
                if (!s.strum) return "·";
                return s.direction === "down" ? "↓" : "↑";
            });

        beats.push(beatPatterns.join(" "));
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
