import { Note } from "@/types/repertoire";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createDegreeMap,
  DEGREE_COLORS,
  getNoteFromFret,
} from "@/lib/music";
import { usePitchDetection } from "@/hooks/usePitchDetection";

interface NoteDisplayProps {
  notes: Note[];
  major_key?: string;
  className?: string;
  currentPosition?: number; // Current time position for highlighting
  enableListening?: boolean;
}

const NoteDisplay = ({
  notes,
  major_key,
  className = "",
  currentPosition = 0,
  enableListening = false,
}: NoteDisplayProps) => {
  const strings = [1, 2, 3, 4, 5, 6]; // High E to Low E
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [noteIndex, setNoteIndex] = useState(0);
  const [detectedNote, setDetectedNote] = useState<{
    string: number;
    fret: number;
  } | null>(null);

  const { isListening } = usePitchDetection({
    isEnabled: enableListening,
    onNoteDetected: (result) => {
      setDetectedNote({ string: result.string, fret: result.fret });
      if (notes.length > 0) {
        setNoteIndex((prevIndex) => (prevIndex + 1) % notes.length);
      }
      setTimeout(() => setDetectedNote(null), 200);
    },
    sensitivity: 0.6,
  });

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

  const currentTime = useMemo(() => {
    if (enableListening) {
        if (noteIndex >= notes.length) {
            return 0;
        }
        return notes[noteIndex].time;
    }
    return currentPosition;
  }, [noteIndex, notes, enableListening, currentPosition]);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const targetTime = detectedNote
      ? notes.find(
          (n) =>
            n.string === detectedNote.string && n.fret === detectedNote.fret
        )?.time ?? currentTime
      : currentTime;
    const percentage = Math.min(
      1,
      Math.max(0, targetTime / Math.max(1, maxTime))
    );
    const totalWidth = el.scrollWidth - el.clientWidth;
    const targetLeft = totalWidth * percentage;
    el.scrollTo({ left: targetLeft, behavior: "smooth" });
  }, [currentTime, detectedNote, maxTime, notes]);

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

  return (
    <div className={`bg-card rounded-lg border border-border p-4 ${className}`}>
      <div
        ref={containerRef}
        className="overflow-x-auto overflow-y-hidden max-h-96 animated-scrollbar"
      >
        <div className="space-y-2" style={{ minWidth: `${minWidth}px` }}>
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
                        Math.abs(note.time - closestTime) <= 0.08;
                      const isDetectedNote =
                        detectedNote &&
                        detectedNote.string === note.string &&
                        detectedNote.fret === note.fret;

                      const noteName = getNoteFromFret(note.string, note.fret);
                      const degree = degreeMap ? degreeMap.get(noteName) : null;
                      const color = degree
                        ? DEGREE_COLORS[degree as keyof typeof DEGREE_COLORS]
                        : null;

                      const noteStyle = color ? { borderColor: color, borderWidth: '3px' } : {};
                      
                      return (
                        <div
                          key={index}
                          className={`absolute -translate-y-1/2 top-1/2 -translate-x-1/2 w-7 h-7 rounded text-xs font-mono flex items-center justify-center transition-all duration-150 ${
                            isDetectedNote
                              ? "bg-green-500 text-white border-2 border-green-400 scale-110"
                              : isCurrentNote
                              ? "bg-blue-500 text-white"
                              : isHighlighted
                              ? "bg-accent text-accent-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                          style={{ left: `${position}%`, ...noteStyle }}
                          title={`Time: ${note.time}s, Duration: ${
                            note.duration || 0.5
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
      </div>
      <div className="mt-4 text-xs text-muted-foreground text-center">
        String numbers (1 = High E, 6 = Low E) • Numbers on strings = Fret
        positions
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
      <div className="mt-4 flex justify-center space-x-4 text-xs">
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
    </div>
  );
};

export default NoteDisplay;