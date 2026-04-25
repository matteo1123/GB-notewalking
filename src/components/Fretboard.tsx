import React, { useMemo } from 'react';
import { FRET_COUNT, STRING_COUNT, getNoteFromFret, createChromaticDegreeMap, CHROMATIC_DEGREE_COLORS, DEGREE_COLORS } from '@/lib/musicTheory';
import { CagedConstellationFill } from './CagedConstellation';
import { NoteParticles } from './NoteParticles';
import {
  CAGED_SHAPES,
  CAGED_SHAPE_HEX,
  getShapeVoicingPositions,
  type CagedShape,
  type ChordToneNode,
} from '@/lib/cagedSystem';
import './Fretboard.css';

const FRET_NUMBER_MARKERS = [3, 5, 7, 9, 12, 15, 17, 19, 21];

/**
 * Renders the row of fret numbers + per-shape letter labels that sits BELOW
 * the fretboard. Lives in a real in-flow grid (not an SVG overflow band) so
 * sizing is reliable across the various fretboard parents — overflow gymnastics
 * with absolutely-positioned SVGs gets clipped/scrolled by ancestor overflow
 * rules (overflow-x: hidden implicitly promotes overflow-y: visible to auto).
 */
function FretboardLabelsStrip({
  cagedKey,
  onShapeLabelClick,
}: {
  cagedKey: string;
  onShapeLabelClick?: (shape: CagedShape) => void;
}) {
  const shapeLabels = useMemo(() => {
    // One label PER OCTAVE PER SHAPE — the CAGED letters tile the full
    // fretboard so a player scanning the neck sees which shape they're inside
    // no matter where they look, not just at one "home" position.
    return CAGED_SHAPES.flatMap((shape) => {
      const tones = getShapeVoicingPositions(cagedKey, shape, FRET_COUNT).filter(
        (t) => t.fret >= 1 && t.fret <= FRET_COUNT,
      );
      if (tones.length === 0) return [];
      const byOct = new Map<number, ChordToneNode[]>();
      for (const t of tones) {
        const arr = byOct.get(t.octaveShift) ?? [];
        arr.push(t);
        byOct.set(t.octaveShift, arr);
      }
      return [...byOct.entries()].map(([octaveShift, points]) => ({
        shape,
        octaveShift,
        minF: Math.min(...points.map((t) => t.fret)),
        maxF: Math.max(...points.map((t) => t.fret)),
      }));
    });
  }, [cagedKey]);

  return (
    <div className="fretboard-fret-labels">
      {FRET_NUMBER_MARKERS.filter((f) => f <= FRET_COUNT).map((f) => (
        <div
          key={`fnum-${f}`}
          className="fret-num"
          style={{ gridColumn: f, gridRow: 1 }}
        >
          {f}
        </div>
      ))}
      {shapeLabels.map(({ shape, octaveShift, minF, maxF }) => {
        const clickable = !!onShapeLabelClick;
        const className = `shape-lbl${clickable ? ' shape-lbl-clickable' : ''}`;
        const style: React.CSSProperties = {
          gridColumn: `${minF} / ${maxF + 1}`,
          gridRow: 2,
          color: CAGED_SHAPE_HEX[shape],
        };
        if (clickable) {
          return (
            <button
              key={`shp-${shape}-${octaveShift}`}
              type="button"
              className={className}
              style={style}
              onClick={() => onShapeLabelClick(shape)}
              title={`Spotlight ${shape}-shape`}
            >
              {shape}
            </button>
          );
        }
        return (
          <div key={`shp-${shape}-${octaveShift}`} className={className} style={style}>
            {shape}
          </div>
        );
      })}
    </div>
  );
}

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
  cagedKey?: string; // If set, renders the chord-tone constellation overlay
  /** Set of "string-fret" cells currently sounding (active chord). Drives
   * the constellation's chord-aware throb — only these tones twinkle. */
  activeTones?: Set<string>;
  onShapeLabelClick?: (shape: CagedShape) => void;
  /** Concurrently-rendered sparkle bursts. Each burst freezes the cells it
   * paints at trigger time so a burst that started on note A keeps spraying
   * over A's frets even if the detected pitch has since moved to G. The
   * parent pushes new bursts and prunes expired ones so overlapping
   * sparkles co-exist (continuous "crazy" feel rather than one flash). */
  sparkleBursts?: Array<{
    id: number;
    points: Array<{ string: number; fret: number }>;
  }>;
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
  cagedKey,
  activeTones,
  onShapeLabelClick,
  sparkleBursts,
}) => {
  const chromaticDegreeMap = rootNote ? createChromaticDegreeMap(getNoteFromFret(rootNote.string, rootNote.fret)) : null;

  const renderChordConstellations = () => {
    if (!cagedKey) return null;
    // Stars + lines only — fret numbers and shape labels are rendered as an
    // in-flow strip BELOW the fretboard (see FretboardLabelsStrip) so they
    // don't fight the absolutely-positioned SVG's clipping/scroll behavior.
    return (
      <CagedConstellationFill
        className="caged-constellation-layer"
        cagedKey={cagedKey}
        fretCount={FRET_COUNT}
        showLabels={false}
        showFretNumbers={false}
        activeTones={activeTones}
      />
    );
  };

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
        const selectedNote = selectedNotes.find(n => n.string === s && n.fret === f);
        const isSelected = !!selectedNote;
        const isRoot = rootNote && rootNote.string === s && rootNote.fret === f;
        const isHighlighted = highlightedNote && highlightedNote.string === s && highlightedNote.fret === f;
        const isAnimated = animatedNote && animatedNote.string === s && animatedNote.fret === f;

        // Ear training properties
        const isExpected = selectedNote && (selectedNote as any).isExpected;
        const isPlaying = selectedNote && (selectedNote as any).isPlaying;
        const sungCorrect = selectedNote && (selectedNote as any).sungCorrect;
        const sungIncorrect = selectedNote && (selectedNote as any).sungIncorrect;

        const noteName = getNoteFromFret(s, f);
        const degree = degreeMap ? degreeMap.get(noteName) : null;
        const chromaticDegree = chromaticDegreeMap ? chromaticDegreeMap.get(noteName) : null;

        let color = (selectedNote as any)?.color;
        if (!color) {
          color = '#fff';
          if (showDegreeNumbers && chromaticDegree) {
            color = CHROMATIC_DEGREE_COLORS[chromaticDegree as keyof typeof CHROMATIC_DEGREE_COLORS] || '#fff';
          } else if (degree) {
            color = DEGREE_COLORS[degree as keyof typeof DEGREE_COLORS] || '#fff';
          } else if (chromaticDegree) {
            color = CHROMATIC_DEGREE_COLORS[chromaticDegree as keyof typeof CHROMATIC_DEGREE_COLORS] || '#fff';
          }
        }

        notesToRender.push(
          <div
            key={`${s}-${f}`}
            className={`note-container ${isEditable ? 'clickable' : ''}`}
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
              if (degree || (chromaticDegree && rootNote)) {
                // This is an in-scale note that is part of the exercise
                const noteClasses = ['dot'];
                const isStructure = selectedNote && (selectedNote as any).isStructure;
                const isActive = selectedNote && (selectedNote as any).isActive;

                if (isRoot) noteClasses.push('root');
                if (isHighlighted) noteClasses.push('highlighted');
                if (isAnimated) noteClasses.push('animated');
                if (isExpected) noteClasses.push('expected-note');
                if (isPlaying) noteClasses.push('playing-note');
                if (sungCorrect) noteClasses.push('sung-correct');
                if (sungIncorrect) noteClasses.push('sung-incorrect');
                if (isStructure) noteClasses.push('structure-note');
                if (isActive) noteClasses.push('active-note');

                return (
                  <div
                    className={noteClasses.join(' ')}
                    style={{ backgroundColor: color }}
                  >
                    {showDegreeNumbers && (degree || chromaticDegree) && (
                      <span className="degree-number">{degree || chromaticDegree}</span>
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

  const renderSparkles = () => {
    if (!sparkleBursts || sparkleBursts.length === 0) return null;
    // Each burst renders its own <NoteParticles> for every frozen cell —
    // bursts overlap until React unmounts them when the parent prunes
    // their id from the array. Skip fret 0 (open strings live in a
    // sibling container, not this grid).
    return sparkleBursts.flatMap((burst) =>
      burst.points
        .filter(
          (p) =>
            p.fret >= 1 &&
            p.fret <= FRET_COUNT &&
            p.string >= 1 &&
            p.string <= STRING_COUNT,
        )
        .map((p) => (
          <div
            key={`sparkle-${burst.id}-${p.string}-${p.fret}`}
            className="sparkle-cell"
            style={{ gridColumn: p.fret, gridRow: p.string }}
          >
            <NoteParticles burstId={burst.id} />
          </div>
        )),
    );
  };

  const fretMarkers = {
    3: 'single', 5: 'single', 7: 'single', 9: 'single', 12: 'double',
    15: 'single', 17: 'single', 19: 'single', 21: 'single',
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
          {renderChordConstellations()}
          {renderFrets()}
          {renderStrings()}
          {renderMarkers()}
          {renderNotes(false)}
          {renderSparkles()}
        </div>
        {cagedKey && (
          <FretboardLabelsStrip cagedKey={cagedKey} onShapeLabelClick={onShapeLabelClick} />
        )}
      </div>
    </div>
  );
};

export default Fretboard;
