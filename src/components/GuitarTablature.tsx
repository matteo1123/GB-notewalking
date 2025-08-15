import { Note } from '@/types/repertoire';

interface GuitarTablatureProps {
  notes: Note[];
  currentBeat?: number;
  currentSubdivision?: number;
  className?: string;
}

const GuitarTablature = ({ notes, currentBeat = 0, currentSubdivision = 1, className = '' }: GuitarTablatureProps) => {
  const strings = [1, 2, 3, 4, 5, 6]; // High E to Low E
  
  // Calculate which notes are currently active
  const activeNotes = notes.filter(note => 
    note.beat === currentBeat && note.subdivision === currentSubdivision
  );

  // Extract global highlighting rules from first note that has them
  const globalHighlightEvery = notes.find(n => n.highlightEvery !== undefined)?.highlightEvery;
  const globalHighlightOffset = notes.find(n => n.highlightOffset !== undefined)?.highlightOffset || 0;

  // Build a stable global order index (by beat, then subdivision, then original index)
  const order = notes
    .map((n, i) => ({ n, i }))
    .sort((a, b) => (a.n.beat - b.n.beat) || (a.n.subdivision - b.n.subdivision) || (a.i - b.i));

  const indexMap = new Map<Note, number>();
  order.forEach(({ n }, idx) => indexMap.set(n, idx));

  // Function to determine if a note should be highlighted
  const isNoteHighlighted = (note: Note, globalIndex: number): boolean => {
    // Explicit highlight/accent takes precedence
    if (note.accent !== undefined) return note.accent;
    if (note.highlight !== undefined) return note.highlight;
    
    // Apply global pattern if defined
    if (globalHighlightEvery !== undefined) {
      return (globalIndex - globalHighlightOffset) % globalHighlightEvery === 0;
    }
    
    // Default: highlight all notes if no rules specified
    return true;
  };

  // Calculate max beat for positioning
  const maxBeat = notes.length > 0 ? Math.max(...notes.map(n => n.beat)) : 1;

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
                    const globalIndex = indexMap.get(note) || 0;
                    const isHighlighted = isNoteHighlighted(note, globalIndex);
                    const position = ((note.beat - 1) + (note.subdivision - 1) / 3) / maxBeat * 100;
                    
                    return (
                      <div
                        key={index}
                        className={`absolute -translate-y-1/2 top-1/2 min-w-8 h-6 rounded text-xs font-mono flex items-center justify-center transition-all duration-150 ${
                          isActive 
                            ? 'bg-primary text-primary-foreground shadow-[0_0_10px_hsl(var(--primary)/0.5)] scale-110 z-10' 
                            : isHighlighted
                            ? 'bg-accent text-accent-foreground border-2 border-accent-foreground/20 hover:bg-accent/80'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
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
        String numbers (1 = High E, 6 = Low E) • Numbers on strings = Fret positions<br/>
        <span className="inline-block w-3 h-3 bg-primary rounded mr-1"></span>Active • 
        <span className="inline-block w-3 h-3 bg-accent border border-accent-foreground/20 rounded mr-1 ml-2"></span>Highlighted • 
        <span className="inline-block w-3 h-3 bg-muted rounded ml-2"></span>Regular
      </div>
    </div>
  );
};

export default GuitarTablature;