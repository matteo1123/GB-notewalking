import { ChordNumeral } from "@/types/chords";
import { getChordInfo, formatProgression, getChordTones } from "@/lib/chordProgression";
import { DEGREE_COLORS } from "@/lib/musicTheory";

interface IntervalMatrixProps {
    selectedKey: string;
    selectedChords: ChordNumeral[];
    currentChordIndex: number;
}

export function IntervalMatrix({
    selectedKey,
    selectedChords,
    currentChordIndex,
}: IntervalMatrixProps) {
    // Handle empty case
    if (selectedChords.length === 0) {
        return (
            <div className="bg-card border border-border rounded-lg p-6">
                <p className="text-center text-muted-foreground">
                    Select chords to see them here
                </p>
            </div>
        );
    }

    // Single chord case
    if (selectedChords.length === 1) {
        const chord = selectedChords[0];
        const chordInfo = getChordInfo(selectedKey, chord);
        const chordTones = getChordTones(chord);
        const degreeColor =
            DEGREE_COLORS[chordInfo.degree as keyof typeof DEGREE_COLORS];

        return (
            <div className="bg-card border border-border rounded-lg p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-center mb-4">
                    Current Progression
                </h3>
                <div className="text-center mb-4">
                    <p className="text-sm text-muted-foreground">
                        Key of {selectedKey}
                    </p>
                </div>

                <div className="flex justify-center">
                    <div
                        className="border-4 rounded-lg p-6 min-w-[200px] shadow-xl transition-all"
                        style={{
                            borderColor: degreeColor,
                            backgroundColor: `${degreeColor}15`,
                        }}
                    >
                        <div className="text-center">
                            <div className="text-4xl font-bold mb-2">{chord}</div>
                            <div className="text-2xl font-semibold text-muted-foreground">
                                ({chordInfo.rootNote})
                            </div>
                            <div className="mt-4 pt-3 border-t border-border">
                                <p className="text-xs text-muted-foreground mb-2">Chord Tones:</p>
                                <div className="flex justify-center gap-2">
                                    {chordTones.map((tone, idx) => (
                                        <div
                                            key={idx}
                                            className="w-8 h-8  rounded-full flex items-center justify-center text-sm font-bold"
                                            style={{
                                                backgroundColor: DEGREE_COLORS[tone as keyof typeof DEGREE_COLORS],
                                                color: ["#FFD700", "#ADFF2F", "#40E0D0"].includes(
                                                    DEGREE_COLORS[tone as keyof typeof DEGREE_COLORS]
                                                )
                                                    ? "#000"
                                                    : "#fff",
                                            }}
                                        >
                                            {tone}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Multiple chords case
    const progression = formatProgression(selectedChords);

    return (
        <div className="bg-card border border-border rounded-lg p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-center mb-2">
                Chord Progression
            </h3>
            <div className="text-center mb-4">
                <p className="text-sm font-medium text-muted-foreground mb-1">
                    {progression}
                </p>
                <p className="text-xs text-muted-foreground">Key of {selectedKey}</p>
            </div>

            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(selectedChords.length, 4)}, 1fr)` }}>
                {selectedChords.map((chord, index) => {
                    const chordInfo = getChordInfo(selectedKey, chord);
                    const chordTones = getChordTones(chord);
                    const degreeColor =
                        DEGREE_COLORS[chordInfo.degree as keyof typeof DEGREE_COLORS];
                    const isCurrent = index === currentChordIndex;

                    return (
                        <div
                            key={`${chord}-${index}`}
                            className={`border-2 rounded-lg p-4 text-center transition-all ${isCurrent ? "border-4 shadow-xl scale-105" : "border-2"
                                }`}
                            style={{
                                borderColor: degreeColor,
                                backgroundColor: isCurrent
                                    ? `${degreeColor}25`
                                    : `${degreeColor}10`,
                            }}
                        >
                            <div className="text-2xl font-bold mb-1">{chord}</div>
                            <div className="text-lg font-semibold text-muted-foreground">
                                ({chordInfo.rootNote})
                            </div>
                            <div className="mt-3 pt-2 border-t border-border/50">
                                <p className="text-xs text-muted-foreground mb-1">Tones:</p>
                                <div className="flex justify-center gap-1">
                                    {chordTones.map((tone, idx) => (
                                        <div
                                            key={idx}
                                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                            style={{
                                                backgroundColor: DEGREE_COLORS[tone as keyof typeof DEGREE_COLORS],
                                                color: ["#FFD700", "#ADFF2F", "#40E0D0"].includes(
                                                    DEGREE_COLORS[tone as keyof typeof DEGREE_COLORS]
                                                )
                                                    ? "#000"
                                                    : "#fff",
                                            }}
                                        >
                                            {tone}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {isCurrent && (
                                <div className="mt-2">
                                    <div className="inline-block px-2 py-1 bg-primary text-primary-foreground rounded text-xs font-semibold">
                                        Now Playing
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
