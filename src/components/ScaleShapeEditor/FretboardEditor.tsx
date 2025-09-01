import React from 'react';
import { FRET_COUNT, STRING_COUNT } from '@/lib/fretboard';
import './FretboardEditor.css';

interface Note {
  string: number;
  fret: number;
}

interface FretboardEditorProps {
  selectedNotes: Note[];
  rootNote: Note | null;
  highlightedNotes: Note[];
  toggleNote: (string: number, fret: number) => void;
  setAsRoot: (string: number, fret: number) => void;
}

const FretboardEditor: React.FC<FretboardEditorProps> = ({
  selectedNotes,
  rootNote,
  highlightedNotes,
  toggleNote,
  setAsRoot,
}) => {
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
        const isHighlighted = highlightedNotes.some(n => n.string === s && n.fret === f);

        notesToRender.push(
          <div
            key={`${s}-${f}`}
            className={`note ${isSelected ? 'selected' : ''} ${isRoot ? 'root' : ''} ${isHighlighted ? 'highlighted' : ''}`}
            style={{
              gridColumn: isOpenNotesOnly ? 1 : f,
              gridRow: s,
            }}
            onClick={() => toggleNote(s, f)}
            onContextMenu={e => {
              e.preventDefault();
              setAsRoot(s, f);
            }}
          />
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

export default FretboardEditor;