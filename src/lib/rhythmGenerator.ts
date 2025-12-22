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
 * Level 0: No skips (all 16 strums)
 * Level 1-16: One skip at different positions
 * Level 17-32: Two skips at different positions
 * etc.
 */
export function generateRhythmPattern(level: number): RhythmPattern {
    const basicPattern = generateBasicPattern();

    // Level 0 = no deviations
    if (level === 0) {
        return {
            id: `rhythm-l0-${Date.now()}`,
            level: 0,
            name: "Basic 16ths",
            description: "All strums: 1 y and a, 2 y and a, 3 y and a, 4 y and a",
            pattern: basicPattern,
            deviationCount: 0,
        };
    }

    // Calculate number of skips based on level
    const deviationCount = Math.floor((level - 1) / 16) + 1;

    // Clone the basic pattern
    const pattern = basicPattern.map(s => ({ ...s }));

    // Determine which positions to skip
    // Use a deterministic pattern based on level so the same level always gives the same pattern
    const skipPositions: number[] = [];
    let remaining = deviationCount;
    let position = ((level - 1) % 16);

    while (remaining > 0 && skipPositions.length < 16) {
        if (!skipPositions.includes(position)) {
            skipPositions.push(position);
            remaining--;
        }
        position = (position + 7) % 16; // Jump by 7 to spread out skips
    }

    // Apply skips
    skipPositions.forEach(pos => {
        pattern[pos].strum = false;
    });

    return {
        id: `rhythm-l${level}-${Date.now()}`,
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
