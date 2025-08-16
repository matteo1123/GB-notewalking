import { Note } from '@/types/repertoire';

interface GuitarTablatureProps {
  notes: Note[];
  className?: string;
  currentPosition?: number; // Current time position for highlighting
  detectedNote?: { string: number; fret: number }; // Currently detected note
}

const GuitarTablature = ({ notes, className = '', currentPosition = 0, detectedNote }: GuitarTablatureProps) => {
  const strings = [1, 2, 3, 4, 5, 6]; // High E to Low E
  
  // Calculate max time for positioning and minimum width
  const maxTime = notes.length > 0 ? Math.max(...notes.map(n => n.time + (n.duration || 0.5))) : 1;
  
  // Calculate minimum width based on note density - ensure enough space between notes
  const noteCount = notes.length;
  const minWidthPerNote = 60; // Minimum 60px per note to prevent overlap
  const minWidth = Math.max(800, noteCount * minWidthPerNote); // At least 800px, more if needed

  return (
    <div className={`bg-card rounded-lg border border-border p-4 ${className}`}>
      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <div className="space-y-2" style={{ minWidth: `${minWidth}px` }}>
          {strings.map(string => (
            <div key={string} className="flex items-center space-x-2">
              {/* String number - sticky on left */}
              <div className="w-6 text-sm text-muted-foreground font-mono shrink-0 sticky left-0 bg-card z-10">
                {string}
              </div>
              
              {/* String line */}
              <div className="flex-1 relative min-h-8">
                <div className="h-px bg-border absolute top-1/2 w-full"></div>
                
                {/* Fret positions for this string */}
                <div className="absolute inset-0">
                  {notes
                    .filter(note => note.string === string)
                    .map((note, index) => {
                      const position = (note.time / maxTime) * 100;
                      const isHighlighted = note.accent || note.highlight;
                      const isCurrentNote = Math.abs(note.time - currentPosition) < 0.2; // Within 200ms
                      const isDetectedNote = detectedNote && detectedNote.string === note.string && detectedNote.fret === note.fret;
                      
                      return (
                        <div
                          key={index}
                          className={`absolute -translate-y-1/2 top-1/2 -translate-x-1/2 w-7 h-7 rounded text-xs font-mono flex items-center justify-center transition-all duration-150 ${
                            isDetectedNote
                              ? 'bg-green-500 text-white border-2 border-green-400 scale-110'
                              : isCurrentNote
                              ? 'bg-blue-500 text-white border-2 border-blue-400'
                              : isHighlighted
                              ? 'bg-accent text-accent-foreground border-2 border-accent-foreground/20'
                              : 'bg-muted text-muted-foreground'
                          }`}
                          style={{ left: `${position}%` }}
                          title={`Time: ${note.time}s, Duration: ${note.duration || 0.5}s`}
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
      
      {/* Legend */}
      <div className="mt-4 text-xs text-muted-foreground text-center">
        String numbers (1 = High E, 6 = Low E) • Numbers on strings = Fret positions<br/>
        <span className="inline-block w-3 h-3 bg-green-500 rounded mr-1"></span>Detected • 
        <span className="inline-block w-3 h-3 bg-blue-500 rounded mr-1 ml-2"></span>Current • 
        <span className="inline-block w-3 h-3 bg-accent border border-accent-foreground/20 rounded mr-1 ml-2"></span>Highlighted • 
        <span className="inline-block w-3 h-3 bg-muted rounded ml-2"></span>Regular
      </div>
    </div>
  );
};

export default GuitarTablature;