import { Note } from '@/types/repertoire';

interface GuitarTablatureProps {
  notes: Note[];
  currentTime?: number;
  className?: string;
  highlightEvery?: number; // Optional global pattern (e.g., 3 = every 3rd)
  highlightOffset?: number; // Optional offset for the pattern
}

const GuitarTablature = ({ notes, currentTime = 0, className = '', highlightEvery, highlightOffset = 0 }: GuitarTablatureProps) => {
  const strings = [1, 2, 3, 4, 5, 6]; // High E to Low E
  
// Calculate which notes are currently active
const activeNotes = notes.filter(note => 
  currentTime >= note.time && currentTime < note.time + note.duration
);

// Precompute total time for positioning
const totalTime = notes.length > 0
  ? Math.max(...notes.map(n => n.time + n.duration))
  : 0;

// Build a stable global order index (by time, then original index)
const order = notes
  .map((n, i) => ({ n, i }))
  .sort((a, b) => (a.n.time - b.n.time) || (a.i - b.i));

const indexMap = new Map<Note, number>();
order.forEach(({ n }, idx) => indexMap.set(n, idx));

  return (
    <div className={`bg-card rounded-lg border border-border p-4 ${className}`}>
      <div className="space-y-3">
        {strings.map(string => (
          <div key={string} className="flex items-center space-x-2">
            {/* String number */}
            <div className="w-6 text-sm text-muted-foreground font-mono">
              {string}
            </div>
            
            {/* String line */}
            <div className="flex-1 relative">
              <div className="h-px bg-border"></div>
              
              {/* Fret positions for this string */}
              <div className="absolute inset-0 flex">
                {notes
                  .filter(note => note.string === string)
                  .map((note, index) => {
                    const isActive = activeNotes.includes(note);
                    const position = (note.time / Math.max(...notes.map(n => n.time + n.duration))) * 100;
                    
                    return (
                      <div
                        key={index}
                        className={`absolute -translate-y-1/2 top-1/2 min-w-8 h-6 rounded text-xs font-mono flex items-center justify-center transition-all duration-150 ${
                          isActive 
                            ? 'bg-primary text-primary-foreground shadow-[0_0_10px_hsl(var(--primary)/0.5)] scale-110' 
                            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                        }`}
                        style={{ left: `${position}%` }}
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
      
      {/* Legend */}
      <div className="mt-4 text-xs text-muted-foreground text-center">
        String numbers (1 = High E, 6 = Low E) • Numbers on strings = Fret positions
      </div>
    </div>
  );
};

export default GuitarTablature;