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