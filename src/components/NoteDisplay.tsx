import { Note } from "@/types/repertoire";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createDegreeMap,
  DEGREE_COLORS,
  getNoteFromFret,
} from "@/lib/musicTheory";
import { usePitchDetection } from "@/hooks/usePitchDetection";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Fretboard from "./Fretboard";
import { EarTrainingWrapper } from "@/components/EarTrainingWrapper";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { Input } from "./ui/input";

interface NoteDisplayProps {
  notes: Note[];
  major_key?: string;
  tonalContext?: string;
  className?: string;
  currentPosition?: number; // Current time position for highlighting
  enableListening?: boolean;
  mode?: 'tablature' | 'grid' | 'fretboard'; // Display mode
  isLearning?: boolean;
  setIsLearning?: (isLearning: boolean) => void;
  learnRepetitions?: number;
  setLearnRepetitions?: (repetitions: number) => void;
  setMetronomeBpm?: (bpm: number) => void;
  handlePlay?: () => void;
  learnTimeline?: { label: string | number, startIndex: number, endIndex: number }[];
  currentLearnIndex?: number;
  setNoteIndex?: (index: number) => void;
  setCurrentLearnIndex?: (index: number) => void;
  scaleShapeNotes?: { string: number; fret: number }[]; // Unique notes from scale shape for ear training
}

const NoteDisplay = ({
  notes,
  major_key,
  tonalContext,
  className = "",
  currentPosition = 0,
  enableListening = false,
  mode = 'fretboard',
  isLearning,
  setIsLearning,
  learnRepetitions,
  setLearnRepetitions,
  setMetronomeBpm,
  handlePlay,
  learnTimeline,
  currentLearnIndex,
  setNoteIndex,
  setCurrentLearnIndex,
  scaleShapeNotes,
}: NoteDisplayProps) => {
  const strings = [1, 2, 3, 4, 5, 6]; // High E to Low E
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [detectedNote, setDetectedNote] = useState<{
    string: number;
    fret: number;
  } | null>(null);
  const [hoveredNotes, setHoveredNotes] = useState<Note[]>([]);
  const [hoveredNoteIndex, setHoveredNoteIndex] = useState(0);
  const hoverIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [displayMode, setDisplayMode] = useState<'tablature' | 'grid' | 'fretboard'>(mode);
  const [showSingleNote, setShowSingleNote] = useState(false);

  // Pitch detection is disabled for performance reasons
  const isListening = false;

  const degreeMap = useMemo(
    () => (major_key ? createDegreeMap(major_key) : null),
    [major_key]
  );

  const maxTime =
    notes.length > 0
      ? Math.max(...notes.map((n) => n.time + (n.duration || 0.5)))
      : 1;

  const noteCount = notes.length;
  const minWidthPerNote = 60;
  const minWidth = Math.max(800, noteCount * minWidthPerNote);

  const currentTime = currentPosition;

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const targetTime = currentTime;
    const percentage = Math.min(
      1,
      Math.max(0, targetTime / Math.max(1, maxTime))
    );
    const totalWidth = el.scrollWidth - el.clientWidth;

    // Introduce an offset to keep the current note from being at the very edge
    const offset = el.clientWidth * 0.2; // 20% of the container width
    const targetLeft = totalWidth * percentage - offset;

    el.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
  }, [currentTime, maxTime, notes]);

  const times = notes.map((n) => n.time).sort((a, b) => a - b);
  let closestTime = currentTime;
  if (times.length > 0) {
    let best = times[0];
    let bestDiff = Math.abs(best - currentTime);
    for (let i = 1; i < times.length; i++) {
      const d = Math.abs(times[i] - currentTime);
      if (d < bestDiff) {
        best = times[i];
        bestDiff = d;
      }
    }
    closestTime = best;
  }

  // For grid mode
  const frets = notes.length > 0 ? Math.max(...notes.map(n => n.fret)) + 1 : 12;
  const minFret = notes.length > 0 ? Math.min(...notes.map(n => n.fret)) : 0;

  return (
    <div className={`bg-card rounded-lg border border-border ${displayMode === 'fretboard' ? 'p-0' : 'p-4'} ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold capitalize">{displayMode}</h3>
        <div className="flex items-center gap-4">
          {displayMode === 'fretboard' && (
            <div className="flex items-center space-x-2">
              <Switch
                id="single-note-mode"
                checked={showSingleNote}
                onCheckedChange={setShowSingleNote}
              />
              <Label htmlFor="single-note-mode">Single Note Mode</Label>
            </div>
          )}
          <Tabs value={displayMode} onValueChange={(value) => setDisplayMode(value as 'tablature' | 'grid' | 'fretboard')} className="w-auto">
            <TabsList>
              <TabsTrigger value="tablature">Tablature</TabsTrigger>
              <TabsTrigger value="grid">Grid</TabsTrigger>
              <TabsTrigger value="fretboard">Fretboard</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      <div
        ref={containerRef}
        className="overflow-x-auto overflow-y-hidden animated-scrollbar h-full"
      >
        {displayMode === 'tablature' ? (
          <div
            className="space-y-2"
            style={{ minWidth: `${minWidth}px` }}
          >
            {strings.map((string) => (
              <div key={string} className="flex items-center space-x-2">
                <div className="w-6 text-sm text-muted-foreground font-mono shrink-0 sticky left-0 bg-card z-10">
                  {string}
                </div>
                <div className="flex-1 relative min-h-8">
                  <div className="h-px bg-border absolute top-1/2 w-full"></div>
                  <div className="absolute inset-0">
                    {notes
                      .filter((note) => note.string === string)
                      .map((note, index) => {
                        const position = (note.time / maxTime) * 100;
                        const isHighlighted = note.accent || note.highlight;
                        const isCurrentNote =
                          Math.abs(note.time - currentTime) <= 0.08;
                        const isDetectedNote = false;

                        const noteName = getNoteFromFret(note.string, note.fret);
                        const degree = degreeMap ? degreeMap.get(noteName) : null;
                        const color = degree
                          ? DEGREE_COLORS[degree as keyof typeof DEGREE_COLORS]
                          : null;

                        const noteStyle = color ? { borderColor: color, borderWidth: '3px' } : {};

                        return (
                          <div
                            key={index}
                            onClick={() => {
                              if (setNoteIndex) {
                                const originalIndex = notes.findIndex(n => n === note);
                                if (originalIndex !== -1) {
                                  setNoteIndex(originalIndex);
                                }
                              }
                            }}
                            className={`absolute -translate-y-1/2 top-1/2 -translate-x-1/2 w-7 h-7 text-xs font-mono flex items-center justify-center transition-all duration-150 cursor-pointer ${isDetectedNote
                              ? "bg-green-500 text-white border-2 border-green-400 scale-110"
                              : isCurrentNote
                                ? "bg-blue-500 text-white"
                                : isHighlighted
                                  ? "bg-accent text-accent-foreground"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            style={{ left: `${position}%`, ...noteStyle }}
                            title={`Time: ${note.time}s, Duration: ${note.duration || 0.5
                              }s`}
                          >
                            {note.fret}
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : displayMode === 'grid' ? (
          <div className="grid-view">
            <div className="mb-2 text-sm text-muted-foreground">
              Pattern starts at fret {minFret}
            </div>
            <div className="flex">
              <div className="w-12"></div>
              {Array.from({ length: frets - minFret }, (_, fretIndex) => (
                <div key={fretIndex} className="w-12 h-8 flex items-center justify-center text-xs font-mono text-muted-foreground">
                  {fretIndex + minFret}
                </div>
              ))}
            </div>
            {strings.map((string) => (
              <div key={string} className="flex">
                <div className="w-12 text-sm text-muted-foreground font-mono flex items-center justify-center">
                  {string}
                </div>
                {Array.from({ length: frets - minFret }, (_, fretIndex) => {
                  const fret = fretIndex + minFret;
                  const note = notes.find(n => n.string === string && n.fret === fret);
                  const isHighlighted = note ? (note.accent || note.highlight) : false;
                  const isCurrentNote = note ? Math.abs(note.time - currentTime) <= 0.08 : false;
                  const isDetectedNote = false;

                  let noteName = '';
                  let color = null;
                  if (note) {
                    noteName = getNoteFromFret(note.string, note.fret);
                    const degree = degreeMap ? degreeMap.get(noteName) : null;
                    color = degree ? DEGREE_COLORS[degree as keyof typeof DEGREE_COLORS] : null;
                  }

                  const noteStyle = color ? { backgroundColor: color, color: ['#FFD700', '#ADFF2F', '#40E0D0'].includes(color) ? 'black' : 'white' } : {};

                  return (
                    <div
                      key={fret}
                      className={`w-12 h-12 border border-border flex items-center justify-center text-sm font-mono ${note
                        ? isDetectedNote
                          ? "bg-green-500 text-white border-2 border-green-400"
                          : isCurrentNote
                            ? "bg-blue-500 text-white"
                            : isHighlighted
                              ? "bg-accent text-accent-foreground"
                              : "bg-muted text-muted-foreground"
                        : "bg-card"
                        }`}
                      style={note ? noteStyle : {}}
                      title={note ? noteName : ''}
                    >
                      {note ? noteName : ''}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-4">
              <Button
                onClick={() => {
                  if (setIsLearning) {
                    const newIsLearning = !isLearning;
                    setIsLearning(newIsLearning);
                    if (newIsLearning) {
                      setShowSingleNote(true);
                      if (setMetronomeBpm) setMetronomeBpm(60);
                      if (handlePlay) handlePlay();
                    }
                  }
                }}
              >
                {isLearning ? "Stop Learning" : "Help Me Learn"}
              </Button>
              {isLearning && (
                <>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="repetitions">Repetitions</Label>
                    <Input
                      id="repetitions"
                      type="number"
                      value={learnRepetitions}
                      onChange={(e) => setLearnRepetitions && setLearnRepetitions(parseInt(e.target.value, 10))}
                      className="w-20"
                    />
                  </div>
                  <div className="flex space-x-2">
                    {learnTimeline?.map((item, index) => (
                      <div
                        key={index}
                        className={`p-2 rounded cursor-pointer ${index === currentLearnIndex ? "bg-blue-500" : "bg-gray-700"
                          }`}
                        onClick={() => {
                          if (setNoteIndex) setNoteIndex(item.startIndex);
                          if (setCurrentLearnIndex) setCurrentLearnIndex(index);
                        }}
                        onMouseEnter={() => {
                          if (hoverIntervalRef.current) {
                            clearInterval(hoverIntervalRef.current);
                          }
                          const sectionNotes = notes.slice(item.startIndex, item.endIndex + 1);
                          setHoveredNotes(sectionNotes);
                          setHoveredNoteIndex(0);
                          hoverIntervalRef.current = setInterval(() => {
                            setHoveredNoteIndex(prevIndex => (prevIndex + 1) % sectionNotes.length);
                          }, 200);
                        }}
                        onMouseLeave={() => {
                          if (hoverIntervalRef.current) {
                            clearInterval(hoverIntervalRef.current);
                          }
                          setHoveredNotes([]);
                          setHoveredNoteIndex(0);
                        }}
                      >
                        {item.label}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            {/* Ear Training always gets all notes, not affected by Single Note Mode or Help Me Learn */}
            <EarTrainingWrapper
              notes={notes.map((n, idx) => ({ ...n, time: idx }))}
              major_key={major_key}
              tonalContext={tonalContext}
              displayMode="fretboard"
              scaleShapeNotes={scaleShapeNotes}
            />
          </>
        )}
      </div>
      <div className="mt-4 text-xs text-muted-foreground text-center">
        {displayMode === 'tablature' ? (
          <>
            String numbers (1 = High E, 6 = Low E) • Numbers on strings = Fret positions
          </>
        ) : (
          <>
            String numbers (1 = High E, 6 = Low E) • Note names on grid = Note positions
          </>
        )}
        <br />
        <span className="inline-block w-3 h-3 bg-green-500 rounded mr-1"></span>
        Detected •
        <span className="inline-block w-3 h-3 bg-blue-500 rounded mr-1 ml-2"></span>
        Current •
        <span className="inline-block w-3 h-3 bg-accent border border-accent-foreground/20 rounded mr-1 ml-2"></span>
        Highlighted •
        <span className="inline-block w-3 h-3 bg-muted rounded ml-2"></span>
        Regular
        {isListening && (
          <span className="ml-2 inline-flex items-center">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1"></span>
            Listening...
          </span>
        )}
      </div>
      {displayMode !== 'fretboard' && (
        <div className="mt-4 flex justify-center space-x-4 text-xs absolute bottom-4 left-1/2 -translate-x-1/2">
          {Object.entries(DEGREE_COLORS).map(([degree, color]) => (
            <div key={degree} className="flex items-center">
              <span
                className="inline-block w-3 h-3 rounded mr-1"
                style={{ backgroundColor: color }}
              ></span>
              <span>{degree}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NoteDisplay;