/**
 * Rhythm Training - Algorithmic rhythm pattern generator
 * Progressively increases complexity from whole notes to complex mixed patterns
 */

export type RhythmUnit = "whole" | "half" | "quarter" | "eighth" | "triplet" | "sixteenth";

export interface RhythmNote {
    subdivision: number;  // Subdivision within measure (0-15 for sixteenth notes)
    duration: number;     // Duration in sixteenth note units
    isRest: boolean;
}

export interface RhythmPattern {
    id: string;
    level: number;        // Difficulty level (1-10+)
    measures: number;     // Number of measures
    notes: RhythmNote[];
    name: string;
    description: string;
}

/**
 * Generate a rhythm pattern based on difficulty level
 * Levels 1-10 progressively introduce complexity
 */
export function generateRhythmPattern(level: number): RhythmPattern {
    const measuresCount = Math.min(Math.floor(level / 3) + 1, 4); // 1-4 measures
    const notes: RhythmNote[] = [];

    // Level 1-2: Whole and half notes
    if (level <= 2) {
        if (level === 1) {
            // Whole notes - one note per measure
            for (let m = 0; m < measuresCount; m++) {
                notes.push({ subdivision: m * 16, duration: 16, isRest: false });
            }
        } else {
            // Half notes - two notes per measure
            for (let m = 0; m < measuresCount; m++) {
                notes.push({ subdivision: m * 16, duration: 8, isRest: false });
                notes.push({ subdivision: m * 16 + 8, duration: 8, isRest: false });
            }
        }
    }
    // Level 3-4: Quarter notes
    else if (level <= 4) {
        for (let m = 0; m < measuresCount; m++) {
            for (let beat = 0; beat < 4; beat++) {
                notes.push({ subdivision: m * 16 + beat * 4, duration: 4, isRest: false });
            }
        }
    }
    // Level 5-6: Eighth notes
    else if (level <= 6) {
        const includeRests = level === 6;
        for (let m = 0; m < measuresCount; m++) {
            for (let eighth = 0; eighth < 8; eighth++) {
                const isRest = includeRests && Math.random() < 0.2; // 20% rests at level 6
                notes.push({ subdivision: m * 16 + eighth * 2, duration: 2, isRest });
            }
        }
    }
    // Level 7-8: Triplets and mixed
    else if (level <= 8) {
        // Mix of quarters, eighths, and some triplets
        for (let m = 0; m < measuresCount; m++) {
            let position = m * 16;
            while (position < (m + 1) * 16) {
                const roll = Math.random();
                if (roll < 0.3) {
                    // Quarter note
                    notes.push({ subdivision: position, duration: 4, isRest: false });
                    position += 4;
                } else if (roll < 0.7) {
                    // Two eighth notes
                    notes.push({ subdivision: position, duration: 2, isRest: false });
                    notes.push({ subdivision: position + 2, duration: 2, isRest: false });
                    position += 4;
                } else {
                    // Triplet (approximate with sixteenths for simplicity)
                    for (let i = 0; i < 3; i++) {
                        notes.push({ subdivision: position + i * 1.33, duration: 1.33, isRest: false });
                    }
                    position += 4;
                }
            }
        }
    }
    // Level 9-10: Sixteenth notes and complex
    else {
        for (let m = 0; m < measuresCount; m++) {
            for (let sixteenth = 0; sixteenth < 16; sixteenth++) {
                const isRest = Math.random() < 0.3; // 30% rests
                notes.push({ subdivision: m * 16 + sixteenth, duration: 1, isRest });
            }
        }
    }

    return {
        id: `rhythm-l${level}-${Date.now()}`,
        level,
        measures: measuresCount,
        notes,
        name: getRhythmLevelName(level),
        description: getRhythmLevelDescription(level),
    };
}

function getRhythmLevelName(level: number): string {
    if (level === 1) return "Whole Notes";
    if (level === 2) return "Half Notes";
    if (level <= 4) return "Quarter Notes";
    if (level <= 6) return "Eighth Notes";
    if (level <= 8) return "Mixed Rhythms";
    return "Sixteenth Notes";
}

function getRhythmLevelDescription(level: number): string {
    if (level === 1) return "Play one note that lasts the entire measure";
    if (level === 2) return "Play two notes, each lasting half a measure";
    if (level <= 4) return "Play on each beat (1 2 3 4)";
    if (level <= 6) return "Play on beats and off-beats (1 + 2 + 3 + 4 +)";
    if (level <= 8) return "Mix of quarter notes, eighth notes, and triplets";
    return "Fast sixteenth note patterns with rests";
}

/**
 * Convert rhythm pattern to visual notation string
 * Uses Unicode musical symbols
 */
export function rhythmToNotation(pattern: RhythmPattern): string {
    const symbols: string[] = [];

    for (const note of pattern.notes) {
        if (note.isRest) {
            if (note.duration >= 16) symbols.push("𝄻"); // Whole rest
            else if (note.duration >= 8) symbols.push("𝄼"); // Half rest
            else if (note.duration >= 4) symbols.push("𝄽"); // Quarter rest
            else if (note.duration >= 2) symbols.push("𝄾"); // Eighth rest
            else symbols.push("𝄿"); // Sixteenth rest
        } else {
            if (note.duration >= 16) symbols.push("𝅝"); // Whole note
            else if (note.duration >= 8) symbols.push("𝅗𝅥"); // Half note
            else if (note.duration >= 4) symbols.push("♩"); // Quarter note
            else if (note.duration >= 2) symbols.push("♪"); // Eighth note
            else symbols.push("♬"); // Sixteenth note
        }
    }

    return symbols.join(" ");
}
