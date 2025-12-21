import { useMemo } from "react";
import { ChordInfo } from "@/types/chords";
import { calculateDegreeFromRoot } from "@/lib/chordProgression";
import { DEGREE_COLORS } from "@/lib/musicTheory";

interface DegreeTunerProps {
    currentChord: ChordInfo;
    detectedNote: string | null;
    confidence?: number;
}

export function DegreeTuner({
    currentChord,
    detectedNote,
    confidence = 0,
}: DegreeTunerProps) {
    // Calculate scale degree from detected note relative to current chord root
    const scaleDegree = useMemo(() => {
        if (!detectedNote) return null;
        return calculateDegreeFromRoot(detectedNote, currentChord.rootNote);
    }, [detectedNote, currentChord.rootNote]);

    // Get color for the degree
    const degreeColor = scaleDegree
        ? DEGREE_COLORS[scaleDegree as keyof typeof DEGREE_COLORS]
        : "#666";

    return (
        <div className="bg-card border border-border rounded-lg p-6 shadow-lg">
            {/* Header */}
            <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-foreground mb-1">
                    Degree Tuner
                </h3>
                <p className="text-sm text-muted-foreground">
                    Current Chord: <span className="font-bold">{currentChord.numeral}</span>{" "}
                    ({currentChord.rootNote})
                </p>
            </div>

            {/* Degree Display */}
            <div className="flex flex-col items-center justify-center min-h-[200px]">
                {scaleDegree !== null ? (
                    <>
                        {/* Large Degree Number */}
                        <div
                            className="w-32 h-32 rounded-full flex items-center justify-center text-6xl font-bold shadow-xl border-4 transition-all duration-200"
                            style={{
                                backgroundColor: degreeColor,
                                borderColor: degreeColor,
                                color: ["#FFD700", "#ADFF2F", "#40E0D0"].includes(degreeColor)
                                    ? "#000"
                                    : "#fff",
                            }}
                        >
                            {scaleDegree}
                        </div>

                        {/* Detected Note Info */}
                        <div className="mt-6 text-center">
                            <p className="text-xl font-semibold text-foreground">
                                You played: {detectedNote}
                            </p>
                            {confidence > 0 && (
                                <p className="text-sm text-muted-foreground mt-1">
                                    Confidence: {Math.round(confidence * 100)}%
                                </p>
                            )}
                        </div>
                    </>
                ) : detectedNote ? (
                    // Chromatic note (not in major scale)
                    <div className="text-center">
                        <div className="w-32 h-32 rounded-full flex items-center justify-center text-4xl font-bold bg-muted border-4 border-muted-foreground/30 text-muted-foreground">
                            ♯/♭
                        </div>
                        <div className="mt-6">
                            <p className="text-xl font-semibold text-foreground">
                                {detectedNote}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Chromatic note
                            </p>
                        </div>
                    </div>
                ) : (
                    // No pitch detected
                    <div className="text-center">
                        <div className="w-32 h-32 rounded-full flex items-center justify-center border-4 border-dashed border-muted-foreground/30 bg-muted/50">
                            <span className="text-4xl text-muted-foreground">?</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-6">
                            Play a note to see its degree
                        </p>
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="mt-8 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground text-center">
                    Shows the scale degree of your note relative to the current chord's root
                </p>
            </div>
        </div>
    );
}
