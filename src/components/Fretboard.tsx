import React from 'react';
import './Fretboard.css';

interface Note {
  string: number;
  fret: number;
}

import { DEGREE_COLORS, getNoteFromFret } from '@/lib/musicTheory';

interface FretboardProps {
  frets: number;
  selectedNotes: Note[];
  onNoteClick: (string: number, fret: number) => void;
  highlightedNote?: Note;
  degreeMap?: Map<string, number> | null;
}

const Fretboard: React.FC<FretboardProps> = ({ frets, selectedNotes, onNoteClick, highlightedNote, degreeMap }) => {
  const strings = 6;

  const getNoteData = (string: number, fret: number) => {
    const note = selectedNotes.find(n => n.string === string && n.fret === fret);
    if (!note) return null;

    const noteName = getNoteFromFret(string + 1, fret);
    const degree = degreeMap ? degreeMap.get(noteName) : null;
    const color = degree ? DEGREE_COLORS[degree as keyof typeof DEGREE_COLORS] : '#fff';
    const isHighlighted = highlightedNote && highlightedNote.string - 1 === string && highlightedNote.fret === fret;

    return { color, isHighlighted };
  };

  return (
    <div className="fretboard">
      {Array.from({ length: strings }, (_, stringIndex) => (
        <div key={stringIndex} className="string">
          {Array.from({ length: frets + 1 }, (_, fretIndex) => {
            const noteData = getNoteData(stringIndex, fretIndex);
            return (
              <div
                key={fretIndex}
                className="fret"
                onClick={() => onNoteClick(stringIndex, fretIndex)}
              >
                {noteData && (
                  <div
                    className={`dot ${noteData.isHighlighted ? 'highlighted' : ''}`}
                    style={{ backgroundColor: noteData.color }}
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default Fretboard;