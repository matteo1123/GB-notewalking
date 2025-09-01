import { Note } from "@/types/repertoire";
import { Scale } from "@/types/scales";

export const applySequenceToScale = (
  scale: Scale,
  sequence: string,
  note_value: number,
  is_triplet: boolean
): Note[] => {
  if (!scale || !scale.notes_json) {
    return [];
  }

  const sequenceNumbers = sequence.split(' ').map(s => s.trim()).filter(s => s !== '');
  const newNotes: Note[] = [];
  const notesPerBeat = (note_value / 4) * (is_triplet ? 3 : 1);
  let noteTime = 0;

  for (let i = 0; i < sequenceNumbers.length; i++) {
    const numStr = sequenceNumbers[i];
    if (numStr.toLowerCase() === "r") {
      continue;
    }

    const noteIndex = parseInt(numStr, 10) - 1;

    if (noteIndex >= 0 && noteIndex < scale.notes_json.length) {
      const originalNote = scale.notes_json[noteIndex];
      if (
        originalNote &&
        typeof originalNote.fret === "number" &&
        typeof originalNote.string === "number"
      ) {
        newNotes.push({
          ...originalNote,
          time: noteTime,
          duration: 1,
        });
        noteTime += 1 / notesPerBeat;
      }
    }
  }
  return newNotes;
};