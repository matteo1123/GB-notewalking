import { Note } from '@/types/repertoire';

interface GuitarTablatureProps {
  notes: Note[];
  className?: string;
}

const GuitarTablature = ({ notes, className = '' }: GuitarTablatureProps) => {
  const strings = [1, 2, 3, 4, 5, 6]; // High E to Low E
  
  // Calculate max time for positioning
  const maxTime = notes.length > 0 ? Math.max(...notes.map(n => n.time + (n.duration || 0.5))) : 1;

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
                    const position = (note.time / maxTime) * 100;
                    const isHighlighted = note.accent || note.highlight;
                    
                    return (
                      <div
                        key={index}
                        className={`absolute -translate-y-1/2 top-1/2 min-w-8 h-6 rounded text-xs font-mono flex items-center justify-center transition-all duration-150 ${
                          isHighlighted
                            ? 'bg-accent text-accent-foreground border-2 border-accent-foreground/20 hover:bg-accent/80'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
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
      
      {/* Legend */}
      <div className="mt-4 text-xs text-muted-foreground text-center">
        String numbers (1 = High E, 6 = Low E) • Numbers on strings = Fret positions<br/>
        <span className="inline-block w-3 h-3 bg-accent border border-accent-foreground/20 rounded mr-1"></span>Highlighted • 
        <span className="inline-block w-3 h-3 bg-muted rounded ml-2"></span>Regular
      </div>
    </div>
  );
};

export default GuitarTablature;