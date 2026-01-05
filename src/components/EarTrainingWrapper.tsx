import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
    notes: { string: number; fret: number; time: number; duration?: number }[];
    major_key?: string;
    tonalContext?: string;
    displayMode?: "fretboard" | "tablature" | "grid";
    scaleShapeNotes?: { string: number; fret: number }[]; // Optional: unique notes from scale shape for ear training
    currentPosition?: number;
    tickCount?: number;
    onEnsurePlaying?: () => void;
}

export function EarTrainingWrapper({
    notes,
    major_key,
    tonalContext,
    displayMode = "fretboard",
    scaleShapeNotes,
    currentPosition = 0,
    tickCount = 0,
    onEnsurePlaying,
}: EarTrainingWrapperProps) {
    const [earTrainingEnabled, setEarTrainingEnabled] = useState(false);
    const [earTrainingSettings, setEarTrainingSettings] = useState<EarTrainingSettings>({
        enabled: false,
        mode: 'identify',
        level: 12, // Start with all notes available
        notesPerPhrase: 4,
        playbackSpeed: 1.0,
        responseTimeMs: 3000,
        sensitivity: 0.7,
        showFeedback: true,
    });

    const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
    const { playSequence, playNote, stop: stopPlayback } = useNotePlayer(audioContext);

    // Track the last tick we played on to avoid duplicate triggers
    const lastPlayedTickRef = useRef<number>(-1);

    useEffect(() => {
        if (earTrainingEnabled && !audioContext) {
            const ctx = new AudioContext();
            setAudioContext(ctx);
        }

        // Auto-start the metronome when enabled if provided
        if (earTrainingEnabled && onEnsurePlaying) {
            onEnsurePlaying();
        }

        // Loop logic: Trigger playback on Beat 1 (every 4 ticks assuming 4/4)
        if (earTrainingEnabled && earTrainingSettings.mode === 'identify') {
            if (tickCount !== lastPlayedTickRef.current) {
                lastPlayedTickRef.current = tickCount;

                if (tickCount % 4 === 0) {
                    // If currently asking a question (waiting for click), repeat the target note
                    if (earTraining.waitingForClick && earTraining.currentPhrase) {
                        const targetNote = earTraining.currentPhrase.notes[0];
                        handlePlayNote(targetNote);
                    } else if (!earTraining.waitingForClick && !earTraining.isPlaying) {
                        // If not waiting and not playing, start new phrase
                        earTraining.playCurrentPhrase();
                    }
                }
            }
        }

        return () => {
            if (audioContext) {
                audioContext.close();
            }
        };
    }, [earTrainingEnabled, tickCount, onEnsurePlaying, earTrainingSettings.mode, earTraining.isPlaying, earTraining.waitingForClick, earTraining.currentPhrase]);

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

        // CRITICAL: Convert sharps to flats for file naming to prevent URL encoding issues
        // The '#' character breaks URLs
        const flatNote = finalNote.replace('C#', 'Db')
            .replace('D#', 'Eb')
            .replace('F#', 'Gb')
            .replace('G#', 'Ab')
            .replace('A#', 'Bb');

        await playNote(flatNote);
    }, [audioContext, playNote]);

    const earTraining = useEarTraining({
        notes: earTrainingNotes,
        settings: { ...earTrainingSettings, enabled: earTrainingEnabled },
        onPlaySequence: playSequence,
        onPlayNote: handlePlayNote,
        onPitchDetected: () => { },
    });

    // Metronome sync effect - must track earTraining state
    useEffect(() => {
        // Auto-start the metronome when enabled if provided
        if (earTrainingEnabled && onEnsurePlaying) {
            onEnsurePlaying();
        }

        // Loop logic: Trigger playback on Beat 1 (every 4 ticks assuming 4/4)
        if (earTrainingEnabled && earTrainingSettings.mode === 'identify') {
            if (tickCount !== lastPlayedTickRef.current) {
                lastPlayedTickRef.current = tickCount;

                if (tickCount % 4 === 0) {
                    // If currently asking a question (waiting for click), repeat the target note
                    if (earTraining.waitingForClick && earTraining.currentPhrase) {
                        const targetNote = earTraining.currentPhrase.notes[0];
                        handlePlayNote(targetNote);
                    } else if (!earTraining.waitingForClick && !earTraining.isPlaying) {
                        // If not waiting and not playing, start new phrase
                        earTraining.playCurrentPhrase();
                    }
                }
            }
        }
    }, [earTrainingEnabled, tickCount, onEnsurePlaying, earTrainingSettings.mode, earTraining.isPlaying, earTraining.waitingForClick, earTraining.currentPhrase, handlePlayNote, earTraining]);

    // Pitch detection removed for simplified Identify-only mode
    const [detectedPitch, setDetectedPitch] = useState<{ string: number; fret: number } | null>(null);

    const degreeMap = useMemo(
        () => (major_key ? createDegreeMap(major_key, tonalContext) : null),
        [major_key, tonalContext]
    );

    // State for visual feedback on incorrect guesses
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

    // Handle fretboard click for identify mode
    const handleFretboardClick = useCallback((clickedNote: { string: number; fret: number }) => {
        if (earTrainingEnabled && earTraining.waitingForClick && earTrainingSettings.mode === 'identify' && earTraining.currentPhrase) {

            const targetNote = earTraining.currentPhrase.notes[0];

            // Logic to check correctness handled by useEarTraining, 
            // BUT we want to provide immediate directional feedback and intercept if incorrect to prevent advancing?
            // Actually useEarTraining advances automatically on correct.
            // On incorrect, it might just log it.
            // Let's check useEarTraining behavior. 
            // It calls setSungResults. If correct, it calls goToNextPhrase.
            // If incorrect, it just logs it.
            // So we can check correctness here too.

            const isCorrect = clickedNote.string === targetNote.string && clickedNote.fret === targetNote.fret;

            if (isCorrect) {
                setFeedbackMessage("Correct! 🎉");
                setTimeout(() => setFeedbackMessage(null), 1500);
            } else {
                // Calculate semitone difference
                // We need absolute pitch value.
                // Easiest is to convert both to MIDI note numbers or linear index.
                // Standard tuning: E2=40, A2=45, D3=50, G3=55, B3=59, E4=64
                const stringOffsets = [64, 59, 55, 50, 45, 40]; // High E (string 1) to Low E (string 6)

                const targetPitch = stringOffsets[targetNote.string - 1] + targetNote.fret;
                const clickedPitch = stringOffsets[clickedNote.string - 1] + clickedNote.fret;

                const diff = clickedPitch - targetPitch;

                if (diff > 0) {
                    setFeedbackMessage("Too High! 👇");
                } else {
                    setFeedbackMessage("Too Low! 👆");
                }
            }

            earTraining.handleFretboardClick(clickedNote);
        }
    }, [earTrainingEnabled, earTraining.waitingForClick, earTraining, earTrainingSettings.mode]);

    // Handle general fretboard click for playing notes (always available except during ear training questions)
    const handleGeneralFretboardClick = useCallback((string: number, fret: number) => {
        // Don't play if ear training is active and waiting for answer
        const isEarTrainingQuestion = earTrainingEnabled && (
            earTraining.waitingForClick ||
            earTraining.isListening ||
            earTraining.isPlaying
        );

        if (isEarTrainingQuestion) {
            // If in identify mode and waiting for answer, handle as ear training response
            if (earTrainingSettings.mode === 'identify' && earTraining.waitingForClick) {
                handleFretboardClick({ string, fret });
            }
            return;
        }

        // Otherwise, just play the note
        handlePlayNote({ string, fret });
    }, [earTrainingEnabled, earTraining.waitingForClick, earTraining.isListening, earTraining.isPlaying, earTrainingSettings.mode, handleFretboardClick, handlePlayNote]);

    // Filter notes to show only current phrase in ear training mode
    // UPDATE: For Identify mode, we want to show ALL notes (the candidate set) so the user can guess.
    const displayNotes = useMemo(() => {
        return simpleNotes;
    }, [simpleNotes]);

    return (
        <div className="space-y-4">
            {/* Ear Training Toggle & Mode Indicator */}
            <div className="flex justify-between items-center">
                {/* Badge removed as requested since Identify is the only mode */}
                <div className="flex-1" />
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

            {/* Instructions */}
            {earTrainingEnabled && (
                <div className="mb-4 p-4 bg-muted/50 rounded-lg border border-border">
                    {earTraining.isPlaying && (
                        <p className="text-center text-lg font-medium">
                            🎵 Listen to the note...
                        </p>
                    )}
                    <p className="text-center text-lg font-medium text-blue-600">
                        👆 Click the note you just heard on the fretboard!
                    </p>

                    {feedbackMessage && (
                        <p className={`text-center text-xl font-bold mt-2 ${feedbackMessage.includes("Correct") ? "text-green-600" : "text-amber-500"}`}>
                            {feedbackMessage}
                        </p>
                    )}
                </div>
            )}

            {/* Fretboard with ear training visual feedback */}
            {displayMode === "fretboard" && (
                <Fretboard
                    selectedNotes={displayNotes.map((n, idx) => {
                        // In Identify mode, we DO NOT want to highlight the note being played (that's the answer!)
                        // So isPlayingNote is always false.
                        const isPlayingNote = false;

                        // We also likely don't want to show 'isExpected' as that might give it away too?
                        // Unless isExpected is used for something else. checks... 
                        // It was "Highlight the note user should sing". In identify mode, we don't want to show the target.
                        const isExpectedNote = false;

                        const sungResult = null; // No singing

                        // Standard practice mode highlighting
                        const isCurrent = !earTrainingEnabled && Math.abs((n as any).time - currentPosition) < 0.1;

                        return {
                            ...n,
                            // Add visual feedback classes via custom rendering
                            isPlaying: isPlayingNote,
                            isExpected: isExpectedNote,
                            sungCorrect: false,
                            sungIncorrect: false,
                            isActive: isCurrent, // Use standard active highlighting when not in ear training
                        };
                    })}
                    degreeMap={degreeMap}
                    showDegreeNumbers={true}
                    highlightedNote={detectedPitch} // NEW: Show detected pitch
                    isEditable={true} // Always editable for click-to-play
                    rootNote={simpleNotes.find(
                        (n) => getNoteFromFret(n.string, n.fret) === major_key
                    )}
                    onNoteClick={handleGeneralFretboardClick}
                />
            )}
        </div>
    );
}
