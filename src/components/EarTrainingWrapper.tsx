import { useState, useEffect, useMemo, useCallback } from "react";
import { useNotePlayer } from "@/hooks/useNotePlayer";
import { useEarTraining } from "@/hooks/useEarTraining";
import { usePitchDetection } from "@/hooks/usePitchDetection";
import { EarTrainingSettings } from "@/types/practice";
import { EarTrainingControls } from "@/components/EarTrainingControls";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Ear, Mic, MousePointer } from "lucide-react";
import Fretboard from "@/components/Fretboard";
import { createDegreeMap, getNoteFromFret } from "@/lib/musicTheory";

interface EarTrainingWrapperProps {
    notes: { string: number; fret: number; time: number }[];
    major_key?: string;
    tonalContext?: string;
    displayMode?: "fretboard" | "tablature" | "grid";
    scaleShapeNotes?: { string: number; fret: number }[]; // Optional: unique notes from scale shape for ear training
}

export function EarTrainingWrapper({
    notes,
    major_key,
    tonalContext,
    displayMode = "fretboard",
    scaleShapeNotes,
}: EarTrainingWrapperProps) {
    const [earTrainingEnabled, setEarTrainingEnabled] = useState(false);
    const [earTrainingSettings, setEarTrainingSettings] = useState<EarTrainingSettings>({
        enabled: false,
        mode: 'sing-back',
        level: 12, // Start with all notes available
        notesPerPhrase: 4,
        playbackSpeed: 1.0,
        responseTimeMs: 3000,
        sensitivity: 0.7,
        showFeedback: true,
    });

    const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
    const { playSequence, playNote, stop: stopPlayback } = useNotePlayer(audioContext);

    useEffect(() => {
        if (earTrainingEnabled && !audioContext) {
            const ctx = new AudioContext();
            setAudioContext(ctx);
        }
        return () => {
            if (audioContext) {
                audioContext.close();
            }
        };
    }, [earTrainingEnabled]);

    const simpleNotes = useMemo(() => {
        return notes.map((n) => ({ string: n.string, fret: n.fret }));
    }, [notes]);

    // Use scale shape notes for ear training if provided (no duplicates)
    // Otherwise fall back to sequence notes
    const earTrainingNotes = useMemo(() => {
        if (scaleShapeNotes && scaleShapeNotes.length > 0) {
            return scaleShapeNotes;
        }
        // Remove duplicates from sequence notes
        const uniqueNotes = simpleNotes.filter((note, index, self) =>
            index === self.findIndex((n) => n.string === note.string && n.fret === note.fret)
        );
        return uniqueNotes;
    }, [scaleShapeNotes, simpleNotes]);

    // Single note player for identify mode
    const handlePlayNote = useCallback(async (note: { string: number; fret: number }) => {
        if (!audioContext) return;

        const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        const openNotes = ["E4", "B3", "G3", "D3", "A2", "E2"];

        const openNote = openNotes[note.string - 1];
        const noteMatch = openNote.match(/([A-G]#?)(\d)/);
        if (!noteMatch) return;

        const [, noteName, octaveStr] = noteMatch;
        let octave = parseInt(octaveStr);
        let noteIndex = noteNames.indexOf(noteName);

        noteIndex = (noteIndex + note.fret) % 12;
        octave += Math.floor((noteNames.indexOf(noteName) + note.fret) / 12);

        const finalNote = `${noteNames[noteIndex]}${octave}`;

        // Convert sharps to flats for file naming
        const flatNote = finalNote.replace('C#', 'Db').replace('D#', 'Eb').replace('F#', 'Gb').replace('G#', 'Ab').replace('A#', 'Bb');

        await playNote(flatNote);
    }, [audioContext, playNote]);

    const earTraining = useEarTraining({
        notes: earTrainingNotes,
        settings: { ...earTrainingSettings, enabled: earTrainingEnabled },
        onPlaySequence: playSequence,
        onPlayNote: handlePlayNote,
        onPitchDetected: () => { },
    });

    const handlePitchDetected = (result: {
        frequency: number;
        note: string;
        string: number;
        fret: number;
        confidence: number;
    }) => {
        if (earTrainingEnabled && earTraining.isListening && earTrainingSettings.mode === 'sing-back') {
            earTraining.handleDetectedNote(result);
        }
    };

    usePitchDetection({
        isEnabled: earTrainingEnabled && earTraining.isListening && earTrainingSettings.mode === 'sing-back',
        onNoteDetected: handlePitchDetected,
        sensitivity: earTrainingSettings.sensitivity,
    });

    const degreeMap = useMemo(
        () => (major_key ? createDegreeMap(major_key, tonalContext) : null),
        [major_key, tonalContext]
    );

    // Handle fretboard click for identify mode
    const handleFretboardClick = useCallback((clickedNote: { string: number; fret: number }) => {
        if (earTrainingEnabled && earTraining.waitingForClick && earTrainingSettings.mode === 'identify') {
            earTraining.handleFretboardClick(clickedNote);
        }
    }, [earTrainingEnabled, earTraining.waitingForClick, earTraining, earTrainingSettings.mode]);

    // Filter notes to show only current phrase in ear training mode
    const displayNotes = useMemo(() => {
        if (!earTrainingEnabled || !earTraining.currentPhrase) {
            return simpleNotes;
        }
        return earTraining.currentPhrase.notes;
    }, [earTrainingEnabled, earTraining.currentPhrase, simpleNotes]);

    return (
        <div className="space-y-4">
            {/* Ear Training Toggle & Mode Indicator */}
            <div className="flex justify-between items-center">
                {earTrainingEnabled && (
                    <div className="flex items-center gap-3">
                        <Badge variant="default" className="gap-2 py-2 px-3">
                            {earTrainingSettings.mode === 'sing-back' ? (
                                <><Mic className="w-4 h-4" /> Sing-Back Mode</>
                            ) : (
                                <><MousePointer className="w-4 h-4" /> Identify Mode</>
                            )}
                        </Badge>
                        <p className="text-sm text-muted-foreground">
                            {earTrainingSettings.mode === 'sing-back'
                                ? '🎵 Listen to the notes, then sing them back into your microphone'
                                : '🎯 Listen to the note, then click it on the fretboard'}
                        </p>
                    </div>
                )}
                <Button
                    variant={earTrainingEnabled ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                        const newEnabled = !earTrainingEnabled;
                        setEarTrainingEnabled(newEnabled);
                        if (!newEnabled) {
                            earTraining.reset();
                            stopPlayback();
                        }
                    }}
                    className="gap-2 ml-auto"
                >
                    <Ear className="w-4 h-4" />
                    {earTrainingEnabled ? "Exit Ear Training" : "Ear Training Mode"}
                </Button>
            </div>

            {/* Ear Training Controls */}
            {earTrainingEnabled && (
                <EarTrainingControls
                    settings={earTrainingSettings}
                    progress={earTraining.progress}
                    isPlaying={earTraining.isPlaying}
                    isListening={earTraining.isListening}
                    waitingForClick={earTraining.waitingForClick}
                    maxLevel={earTrainingNotes.length}
                    onSettingsChange={(newSettings) =>
                        setEarTrainingSettings((prev) => ({ ...prev, ...newSettings }))
                    }
                    onPlay={earTraining.playCurrentPhrase}
                    onNext={earTraining.goToNextPhrase}
                    onPrevious={earTraining.goToPreviousPhrase}
                    onReset={earTraining.reset}
                    compact
                />
            )}

            {/* Fretboard with ear training visual feedback */}
            {displayMode === "fretboard" && (
                <Fretboard
                    selectedNotes={displayNotes.map((n, idx) => {
                        const phraseLocalIndex = idx;
                        const isPlayingNote =
                            earTrainingEnabled && earTraining.playingNoteIndex === phraseLocalIndex;
                        const sungResult =
                            earTrainingEnabled && phraseLocalIndex >= 0
                                ? earTraining.sungResults[phraseLocalIndex]
                                : null;

                        return {
                            ...n,
                            // Add visual feedback classes via custom rendering
                            isPlaying: isPlayingNote,
                            sungCorrect: sungResult?.isCorrect,
                            sungIncorrect: sungResult && !sungResult.isCorrect,
                        };
                    })}
                    degreeMap={degreeMap}
                    showDegreeNumbers={true}
                    isEditable={earTrainingSettings.mode === 'identify' && earTraining.waitingForClick}
                    rootNote={simpleNotes.find(
                        (n) => getNoteFromFret(n.string, n.fret) === major_key
                    )}
                    onNoteClick={earTrainingSettings.mode === 'identify' && earTraining.waitingForClick
                        ? (string, fret) => handleFretboardClick({ string, fret })
                        : undefined}
                />
            )}
        </div>
    );
}

export default EarTrainingWrapper;
