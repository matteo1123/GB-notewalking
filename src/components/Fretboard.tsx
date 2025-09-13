import React from 'react';
import { FRET_COUNT, STRING_COUNT, getNoteFromFret, createChromaticDegreeMap, CHROMATIC_DEGREE_COLORS, DEGREE_COLORS } from '@/lib/musicTheory';
import './Fretboard.css';

interface Note {
  string: number;
  fret: number;
}

interface FretboardProps {
  selectedNotes: Note[];
  rootNote?: Note | null;
  highlightedNote?: Note;
  onNoteClick?: (string: number, fret: number) => void;
  onNoteRightClick?: (string: number, fret: number) => void;
  isEditable?: boolean;
  showDegreeNumbers?: boolean;
  degreeMap?: Map<string, number> | null;
  animatedNote?: Note;
}

const Fretboard: React.FC<FretboardProps> = ({
  selectedNotes,
  rootNote,
  highlightedNote,
  onNoteClick,
  onNoteRightClick,
  isEditable = false,
  showDegreeNumbers = false,
  degreeMap,
  animatedNote,
}) => {
  const chromaticDegreeMap = rootNote ? createChromaticDegreeMap(getNoteFromFret(rootNote.string, rootNote.fret)) : null;

  const renderFrets = () => {
    const frets = [];
    for (let i = 1; i <= FRET_COUNT; i++) {
      frets.push(<div key={`fret-${i}`} className="fret" style={{ gridColumn: i }} />);
    }
    return frets;
  };

  const renderStrings = () => {
    const strings = [];
    for (let i = 1; i <= STRING_COUNT; i++) {
      strings.push(<div key={`string-${i}`} className="string" style={{ gridRow: i }} />);
    }
    return strings;
  };

  const renderNotes = (isOpenNotesOnly = false) => {
    const notesToRender = [];
    const fretStart = isOpenNotesOnly ? 0 : 1;
    const fretEnd = isOpenNotesOnly ? 0 : FRET_COUNT;

    for (let s = 1; s <= STRING_COUNT; s++) {
      for (let f = fretStart; f <= fretEnd; f++) {
        const isSelected = selectedNotes.some(n => n.string === s && n.fret === f);
        const isRoot = rootNote && rootNote.string === s && rootNote.fret === f;
        const isHighlighted = highlightedNote && highlightedNote.string === s && highlightedNote.fret === f;
        const isAnimated = animatedNote && animatedNote.string === s && animatedNote.fret === f;

        const noteName = getNoteFromFret(s, f);
        const degree = degreeMap ? degreeMap.get(noteName) : null;
        const chromaticDegree = chromaticDegreeMap ? chromaticDegreeMap.get(noteName) : null;

        let color = '#fff';
        if (showDegreeNumbers && chromaticDegree) {
          color = CHROMATIC_DEGREE_COLORS[chromaticDegree as keyof typeof CHROMATIC_DEGREE_COLORS] || '#fff';
        } else if (degree) {
          color = DEGREE_COLORS[degree as keyof typeof DEGREE_COLORS] || '#fff';
        }

        notesToRender.push(
          <div
            key={`${s}-${f}`}
            className={`note-container`}
            style={{
              gridColumn: isOpenNotesOnly ? 1 : f,
              gridRow: s,
            }}
            onClick={() => isEditable && onNoteClick && onNoteClick(s, f)}
            onContextMenu={e => {
              if (isEditable && onNoteRightClick) {
                e.preventDefault();
                onNoteRightClick(s, f);
              }
            }}
          >
            {isSelected && (() => {
              if (degree) {
                // This is an in-scale note that is part of the exercise
                const noteClasses = ['dot'];
                if (isRoot) noteClasses.push('root');
                if (isHighlighted) noteClasses.push('highlighted');
                if (isAnimated) noteClasses.push('animated');

                return (
                  <div
                    className={noteClasses.join(' ')}
                    style={{ backgroundColor: color }}
                  >
                    {showDegreeNumbers && chromaticDegree && (
                      <span className="degree-number">{chromaticDegree}</span>
                    )}
                  </div>
                );
              } else {
                // This is an out-of-scale note that is part of the exercise
                return <div className="dot out-of-scale"></div>;
              }
            })()}
          </div>
        );
      }
    }
    return notesToRender;
  };

  const fretMarkers = {
    3: 'single', 5: 'single', 7: 'single', 9: 'single', 12: 'double',
    15: 'single', 17: 'single', 19: 'single', 21: 'single', 24: 'double',
  };

  const renderMarkers = () => {
    return Object.entries(fretMarkers).map(([fret, type]) => (
      <div key={`marker-${fret}`} className={`marker-wrapper ${type}`} style={{ gridColumn: parseInt(fret, 10) }}>
        <div className="marker" />
        {type === 'double' && <div className="marker" />}
      </div>
    ));
  };

  return (
    <div className="fretboard-area">
      <div className="open-notes-container">
        {renderNotes(true)}
      </div>
      <div className="fretboard-container">
        <div className="fretboard">
          {renderFrets()}
          {renderStrings()}
          {renderMarkers()}
          {renderNotes(false)}
        </div>
      </div>
    </div>
  );
};

export default Fretboard;