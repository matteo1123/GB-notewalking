import React from 'react';
import './Fretboard.css';

interface Note {
  string: number;
  fret: number;
}

interface FretboardProps {
  frets: number;
  selectedNotes: Note[];
  onNoteClick: (string: number, fret: number) => void;
}

const Fretboard: React.FC<FretboardProps> = ({ frets, selectedNotes, onNoteClick }) => {
  const strings = 6;

  const isNoteSelected = (string: number, fret: number) => {
    return selectedNotes.some(note => note.string === string && note.fret === fret);
  };

  return (
    <div className="fretboard">
      {Array.from({ length: strings }, (_, stringIndex) => (
        <div key={stringIndex} className="string">
          {Array.from({ length: frets + 1 }, (_, fretIndex) => (
            <div
              key={fretIndex}
              className="fret"
              onClick={() => onNoteClick(stringIndex, fretIndex)}
            >
              {isNoteSelected(stringIndex, fretIndex) && <div className="dot" />}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default Fretboard;