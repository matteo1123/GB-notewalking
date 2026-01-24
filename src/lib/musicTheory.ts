
export const FRET_COUNT = 24;
export const STRING_COUNT = 6;

export const notes = ['E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#'];
export const notesWithFlats = ['E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B', 'C', 'Db', 'D', 'Eb'];

// High E (string 1) to Low E (string 6)
export const standardTuning = ['E', 'B', 'G', 'D', 'A', 'E'];


export const findAllNoteOccurrences = (noteName: string, tuning: string[] = standardTuning): { string: number, fret: number }[] => {
    const occurrences = [];
    const noteIndex = notes.indexOf(noteName);
    const noteWithFlatIndex = notesWithFlats.indexOf(noteName);

    for (let s = 1; s <= tuning.length; s++) {
        for (let f = 0; f <= FRET_COUNT; f++) {
            const currentNoteIndex = (notes.indexOf(tuning[s - 1]) + f) % 12;
            if (currentNoteIndex === noteIndex || currentNoteIndex === noteWithFlatIndex) {
                occurrences.push({ string: s, fret: f });
            }
        }
    }
    return occurrences;
};

export const CHROMATIC_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const CHROMATIC_SCALE_FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Standard tuning from string 6 (low E) to string 1 (high E)
export const GUITAR_TUNING = {
    6: 'E',
    5: 'A',
    4: 'D',
    3: 'G',
    2: 'B',
    1: 'E'
};

// Assign a color for each of the 7 scale degrees
export const DEGREE_COLORS = {
    1: '#FF6347', // Tomato (Root)
    2: '#FFD700', // Gold
    3: '#ADFF2F', // GreenYellow
    4: '#40E0D0', // Turquoise
    5: '#1E90FF', // DodgerBlue
    6: '#9370DB', // MediumPurple
    7: '#F08080'  // LightCoral
};

export function getNoteFromFret(string: number, fret: number): string {
    const openStringNote = GUITAR_TUNING[string as keyof typeof GUITAR_TUNING];
    const openNoteIndex = CHROMATIC_SCALE.indexOf(openStringNote);
    const noteIndex = (openNoteIndex + fret) % 12;
    return CHROMATIC_SCALE[noteIndex];
}

export const getNote = (string: number, fret: number): string => {
    const tuning = ['E', 'B', 'G', 'D', 'A', 'E'];
    if (string < 1 || string > tuning.length) {
        throw new Error(`Invalid string number: ${string}`);
    }
    const openStringNote = tuning[string - 1];
    const openStringNoteIndex = CHROMATIC_SCALE.indexOf(openStringNote);
    if (openStringNoteIndex === -1) {
        throw new Error(`Invalid note in tuning: ${openStringNote}`);
    }
    const noteIndex = (openStringNoteIndex + fret) % 12;
    return CHROMATIC_SCALE[noteIndex];
};

export function createDegreeMap(
    majorKey: string,
    mode: string = "major"
): Map<string, number> {
    const formulas: { [key: string]: number[] } = {
        major: [0, 2, 4, 5, 7, 9, 11],
        dorian: [0, 2, 3, 5, 7, 9, 10],
        phrygian: [0, 1, 3, 5, 7, 8, 10],
        lydian: [0, 2, 4, 6, 7, 9, 11],
        mixolydian: [0, 2, 4, 5, 7, 9, 10],
        minor: [0, 2, 3, 5, 7, 8, 10],
        locrian: [0, 1, 3, 5, 6, 8, 10],
    };

    const formula = formulas[mode] || formulas.major;
    const scale = majorKey.includes('b') ? CHROMATIC_SCALE_FLATS : CHROMATIC_SCALE;
    const rootIndex = scale.indexOf(majorKey);
    const degreeMap = new Map<string, number>();

    formula.forEach((interval, index) => {
        const noteName = scale[(rootIndex + interval) % 12];
        const degree = index + 1;
        degreeMap.set(noteName, degree);
    });

    return degreeMap;
}

export function createChromaticDegreeMap(rootNote: string): Map<string, string> {
    const chromaticDegrees = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];
    const rootIndex = CHROMATIC_SCALE.indexOf(rootNote);
    const degreeMap = new Map<string, string>();

    for (let i = 0; i < 12; i++) {
        const noteName = CHROMATIC_SCALE[(rootIndex + i) % 12];
        degreeMap.set(noteName, chromaticDegrees[i]);
    }

    return degreeMap;
}

export const CHROMATIC_DEGREE_COLORS = {
    '1': '#FF6347', // Tomato (Root)
    'b2': '#FFA500', // Orange
    '2': '#FFD700', // Gold
    'b3': '#9ACD32', // YellowGreen
    '3': '#ADFF2F', // GreenYellow
    '4': '#40E0D0', // Turquoise
    'b5': '#00CED1', // DarkTurquoise
    '5': '#1E90FF', // DodgerBlue
    'b6': '#4169E1', // RoyalBlue
    '6': '#9370DB', // MediumPurple
    'b7': '#8A2BE2', // BlueViolet
    '7': '#F08080'  // LightCoral
};

export const KEY_SIGNATURES: { [key: string]: string[] } = {
    'C': ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
    'G': ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
    'D': ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
    'A': ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'],
    'E': ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'],
    'B': ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#'],
    'F#': ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#'],
    'C#': ['C#', 'D#', 'E#', 'F#', 'G#', 'A#', 'B#'],
    'F': ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'],
    'Bb': ['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A'],
    'Eb': ['Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D'],
    'Ab': ['Ab', 'Bb', 'C', 'Db', 'Eb', 'F', 'G'],
    'Db': ['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C'],
    'Gb': ['Gb', 'Ab', 'Bb', 'Cb', 'Db', 'Eb', 'F'],
    'Cb': ['Cb', 'Db', 'Eb', 'Fb', 'Gb', 'Ab', 'Bb'],
};

export const getNoteWithEnharmonicPreference = (string: number, fret: number, majorKey: string | null): string => {
    const note = getNote(string, fret);
    if (!majorKey || !KEY_SIGNATURES[majorKey]) {
        return note;
    }

    const keySignature = KEY_SIGNATURES[majorKey];
    const noteName = note.slice(0, -1);
    if (keySignature.includes(note)) {
        return note;
    }

    const enharmonicEquivalents: { [key: string]: string } = {
        'A#': 'Bb', 'Bb': 'A#',
        'C#': 'Db', 'Db': 'C#',
        'D#': 'Eb', 'Eb': 'D#',
        'F#': 'Gb', 'Gb': 'F#',
        'G#': 'Ab', 'Ab': 'G#',
    };

    const equivalent = enharmonicEquivalents[note];
    if (equivalent && keySignature.some(n => n.startsWith(equivalent.slice(0, 1)))) {
        return equivalent;
    }

    return note;
}
export const determineEnharmonicNotes = (noteList: string[], rootNote: string): string[] => {
    const keySignature = KEY_SIGNATURES[rootNote];
    if (!keySignature) {
        return noteList;
    }

    const enharmonicEquivalents: { [key: string]: string } = {
        'A#': 'Bb', 'Bb': 'A#',
        'C#': 'Db', 'Db': 'C#',
        'D#': 'Eb', 'Eb': 'D#',
        'F#': 'Gb', 'Gb': 'F#',
        'G#': 'Ab', 'Ab': 'G#',
    };

    const letterCounts = new Map<string, number>();
    const finalNotes: string[] = [];

    noteList.forEach(note => {
        const letter = note.charAt(0);
        letterCounts.set(letter, (letterCounts.get(letter) || 0) + 1);
    });

    noteList.forEach(note => {
        if (note.length > 1) { // It's a sharp or flat
            const letter = note.charAt(0);
            const equivalent = enharmonicEquivalents[note];
            if (equivalent) {
                const equivalentLetter = equivalent.charAt(0);
                if ((letterCounts.get(letter) ?? 0) > 1 && (letterCounts.get(equivalentLetter) ?? 0) === 0) {
                    finalNotes.push(equivalent);
                    letterCounts.set(letter, (letterCounts.get(letter) ?? 0) - 1);
                    letterCounts.set(equivalentLetter, 1);
                } else if (keySignature.includes(equivalent) && !keySignature.includes(note)) {
                    finalNotes.push(equivalent);
                } else {
                    finalNotes.push(note);
                }
            } else {
                finalNotes.push(note);
            }
        } else {
            finalNotes.push(note);
        }
    });

    const finalLetterCounts = new Map<string, number>();
    const correctedNotes: string[] = [];
    const notesToProcess = [...new Set(finalNotes)];

    notesToProcess.forEach(note => {
        const letter = note.charAt(0);
        finalLetterCounts.set(letter, (finalLetterCounts.get(letter) || 0) + 1);
    });

    notesToProcess.forEach(note => {
        const letter = note.charAt(0);
        if ((finalLetterCounts.get(letter) ?? 0) > 1) {
            const equivalent = enharmonicEquivalents[note];
            if (equivalent) {
                const equivalentLetter = equivalent.charAt(0);
                if (!finalLetterCounts.has(equivalentLetter)) {
                    correctedNotes.push(equivalent);
                    finalLetterCounts.set(letter, (finalLetterCounts.get(letter) ?? 0) - 1);
                    finalLetterCounts.set(equivalentLetter, 1);
                } else {
                    correctedNotes.push(note);
                }
            } else {
                correctedNotes.push(note);
            }
        } else {
            correctedNotes.push(note);
        }
    });

    return [...new Set(correctedNotes)];
};

/**
 * Normalize note frets to stay within valid fretboard bounds.
 * 
 * Strategy:
 * 1. First, try to shift ALL notes uniformly (preserves relative positions)
 * 2. If that's not possible (shape spans > 22 frets), normalize individual notes
 * 
 * If any note has fret < 0, shift ALL notes up 12 frets (one octave).
 * If any note has fret > maxFret, shift ALL notes down 12 frets.
 * If uniform shifting isn't possible, shift individual notes to stay in bounds.
 */
export function normalizeNotesToFretboard<T extends { fret: number }>(
    notes: T[],
    maxFret = 22
): T[] {
    if (notes.length === 0) return notes;

    let normalized = notes.map(n => ({ ...n })) as T[];

    // Shift up if any note < 0
    while (normalized.some(n => n.fret < 0)) {
        normalized = normalized.map(n => ({ ...n, fret: n.fret + 12 })) as T[];
    }

    // Try to shift all notes down uniformly if any note > maxFret
    while (
        normalized.some(n => n.fret > maxFret) &&
        !normalized.some(n => n.fret - 12 < 0)
    ) {
        normalized = normalized.map(n => ({ ...n, fret: n.fret - 12 })) as T[];
    }

    // If we still have notes > maxFret after uniform shifting, 
    // normalize individual notes that are out of bounds
    // This handles edge cases where the shape spans more than 22 frets
    if (normalized.some(n => n.fret > maxFret)) {
        normalized = normalized.map(n => {
            let fret = n.fret;
            // Shift down by octaves until within bounds
            while (fret > maxFret) {
                fret -= 12;
            }
            // If we went negative, shift back up
            while (fret < 0) {
                fret += 12;
            }
            return { ...n, fret };
        }) as T[];
    }

    return normalized;
}