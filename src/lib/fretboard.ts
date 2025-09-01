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