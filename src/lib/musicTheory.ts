
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

export const CHROMATIC_SCALE = ['E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#'];

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

export function createDegreeMap(majorKey: string): Map<string, number> {
    const majorScaleFormula = [0, 2, 4, 5, 7, 9, 11];
    const rootIndex = CHROMATIC_SCALE.indexOf(majorKey);
    const degreeMap = new Map<string, number>();

    majorScaleFormula.forEach((interval, index) => {
        const noteName = CHROMATIC_SCALE[(rootIndex + interval) % 12];
        const degree = index + 1;
        degreeMap.set(noteName, degree);
    });
    
    return degreeMap;
}

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