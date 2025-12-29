import React from 'react';
import Fretboard from '@/components/Fretboard';
import { ResolvedChord } from '@/hooks/useChordResolver';

interface ChordDisplayProps {
    currentChord: ResolvedChord | null;
    nextChord: ResolvedChord | null;
    className?: string;
}

export const ChordDisplay: React.FC<ChordDisplayProps> = ({
    currentChord,
    nextChord,
    className
}) => {
    if (!currentChord) {
        return (
            <div className={`p-8 border rounded-lg bg-card text-center ${className}`}>
                <p className="text-muted-foreground">Select a progression and key to start</p>
            </div>
        );
    }

    // Map notes_json to Fretboard format
    // notes_json from DB is usually { string, fret_offset } or simple { string, fret }
    // My generator ScaleShapeEditor output { string, fret, time, duration }
    // Fretboard needs: { string, fret, color? } or just { string, fret }

    // currentChord.notes_json should be Array<{ string: number, fret: number }>
    const fretboardNotes = currentChord.notes_json?.map((n: any) => ({
        string: n.string,
        fret: n.fret,
        color: '#3b82f6' // primary blue
    })) || [];

    return (
        <div className={`flex flex-col gap-4 ${className}`}>
            <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">Current Chord</span>
                    <div className="flex items-baseline gap-2">
                        <h2 className="text-4xl font-bold">{currentChord.name}</h2>
                        <span className="text-xl text-muted-foreground">({currentChord.numeral})</span>
                    </div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">{currentChord.chord_quality}</span>
                    {currentChord.is_movable && <span className="text-xs bg-accent text-accent-foreground px-1 rounded ml-2">Movable</span>}
                </div>

                {nextChord && (
                    <div className="text-right opacity-60">
                        <span className="text-sm text-muted-foreground">Next</span>
                        <div className="text-xl font-semibold">{nextChord.name}</div>
                    </div>
                )}
            </div>

            <div className="w-full h-48 md:h-64 lg:h-80 border rounded-lg overflow-hidden bg-black/20 relative">
                <Fretboard
                    selectedNotes={fretboardNotes}
                    rootNote={{
                        string: fretboardNotes.find((n: any) => n.fret === (currentChord.notes_json.find((x: any) => x.fret === Math.min(...currentChord.notes_json.map((y: any) => y.fret)))?.fret))?.string || 6,
                        fret: 0 // Dummy root for now, or calculate actual root string/fret
                    }}
                    isEditable={false}
                    showDegreeNumbers={true}
                />
            </div>
        </div>
    );
};
