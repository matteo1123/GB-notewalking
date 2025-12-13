import { useState, useCallback, useRef, useEffect } from "react";
import {
    EarTrainingSettings,
    EarTrainingPhrase,
    EarTrainingProgress,
    SungNoteResult,
} from "@/types/practice";
import { getNoteFromFret } from "@/lib/musicTheory";

interface UseEarTrainingProps {
    notes: { string: number; fret: number }[];
    settings: EarTrainingSettings;
    onPlaySequence: (
        notes: { string: number; fret: number }[],
        tempo: number,
        onNoteStart?: (index: number) => void,
        onComplete?: () => void
    ) => void;
    onPitchDetected: (result: {
        frequency: number;
        note: string;
        string: number;
        fret: number;
        confidence: number;
    }) => void;
    onPlayNote?: (note: { string: number; fret: number }) => void;
}

export const useEarTraining = ({
    notes,
    settings,
    onPlaySequence,
    onPlayNote,
}: UseEarTrainingProps) => {
    const [phrases, setPhrases] = useState<EarTrainingPhrase[]>([]);
    const [progress, setProgress] = useState<EarTrainingProgress>({
        currentPhraseIndex: 0,
        phrasesCompleted: 0,
        totalPhrases: 0,
        currentPhraseAccuracy: 0,
        overallAccuracy: 0,
        notesCorrect: 0,
        notesTotal: 0,
    });
    const [currentNoteIndex, setCurrentNoteIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [sungResults, setSungResults] = useState<SungNoteResult[]>([]);
    const [playingNoteIndex, setPlayingNoteIndex] = useState<number | null>(null);

    const responseTimerRef = useRef<NodeJS.Timeout | null>(null);
    const expectedNoteRef = useRef<{ string: number; fret: number } | null>(null);
    const noteStartTimeRef = useRef<number>(0);
    const [waitingForClick, setWaitingForClick] = useState(false);

    // Generate phrases from notes
    useEffect(() => {
        if (!settings.enabled || notes.length === 0) {
            setPhrases([]);
            return;
        }

        // Filter notes based on level setting
        // Level 1 = root + 1 note (first 2 notes), Level (n-1) = all notes in exercise
        // This ensures we only use notes that exist in the current exercise
        const maxLevel = Math.min(settings.level + 1, notes.length);
        const filteredNotes = notes.slice(0, maxLevel);

        if (filteredNotes.length === 0) {
            setPhrases([]);
            return;
        }

        const newPhrases: EarTrainingPhrase[] = [];

        if (settings.mode === 'identify') {
            // For identify mode, create single-note phrases randomly selected
            const numPhrases = Math.min(20, filteredNotes.length); // Max 20 questions
            for (let i = 0; i < numPhrases; i++) {
                const randomIndex = Math.floor(Math.random() * filteredNotes.length);
                newPhrases.push({
                    notes: [filteredNotes[randomIndex]],
                    startIndex: randomIndex,
                    endIndex: randomIndex,
                });
            }
        } else {
            // For sing-back mode, create sequential phrases
            const phraseSize = settings.notesPerPhrase;
            for (let i = 0; i < filteredNotes.length; i += phraseSize) {
                const phraseNotes = filteredNotes.slice(i, i + phraseSize);
                newPhrases.push({
                    notes: phraseNotes,
                    startIndex: i,
                    endIndex: Math.min(i + phraseSize - 1, filteredNotes.length - 1),
                });
            }
        }

        setPhrases(newPhrases);
        setProgress((prev) => ({
            ...prev,
            totalPhrases: newPhrases.length,
            currentPhraseIndex: 0,
            phrasesCompleted: 0,
            notesCorrect: 0,
            notesTotal: 0,
            overallAccuracy: 0,
            currentPhraseAccuracy: 0,
        }));
        setSungResults([]);
        setCurrentNoteIndex(0);
    }, [notes, settings.notesPerPhrase, settings.enabled, settings.mode, settings.level]);

    // Get current phrase
    const currentPhrase = phrases[progress.currentPhraseIndex] || null;

    // Play current phrase
    const playCurrentPhrase = useCallback(() => {
        if (!currentPhrase || isPlaying) return;

        setIsPlaying(true);
        setPlayingNoteIndex(0);
        setSungResults([]);
        setCurrentNoteIndex(0);
        setWaitingForClick(false);

        if (settings.mode === 'identify') {
            // For identify mode, play single note then wait for click
            if (onPlayNote) {
                onPlayNote(currentPhrase.notes[0]);
            }
            setPlayingNoteIndex(0);
            setTimeout(() => {
                setPlayingNoteIndex(null);
                setIsPlaying(false);
                setWaitingForClick(true);
                expectedNoteRef.current = currentPhrase.notes[0];
                noteStartTimeRef.current = Date.now();

                // Start response timer for identify mode
                if (responseTimerRef.current) {
                    clearTimeout(responseTimerRef.current);
                }
                responseTimerRef.current = setTimeout(() => {
                    handlePhraseTimeout();
                }, settings.responseTimeMs);
            }, 1000); // Give time for note to play
        } else {
            // For sing-back mode, play sequence
            onPlaySequence(
                currentPhrase.notes,
                settings.playbackSpeed,
                (index) => {
                    setPlayingNoteIndex(index);
                },
                () => {
                    setPlayingNoteIndex(null);
                    setIsPlaying(false);
                    setIsListening(true);
                    setCurrentNoteIndex(0);
                    expectedNoteRef.current = currentPhrase.notes[0];
                    noteStartTimeRef.current = Date.now();

                    // Start response timer
                    if (responseTimerRef.current) {
                        clearTimeout(responseTimerRef.current);
                    }
                    responseTimerRef.current = setTimeout(() => {
                        handlePhraseTimeout();
                    }, settings.responseTimeMs * currentPhrase.notes.length);
                }
            );
        }
    }, [currentPhrase, isPlaying, settings, onPlaySequence, onPlayNote]);

    // Handle phrase timeout
    const handlePhraseTimeout = useCallback(() => {
        setIsListening(false);

        // Fill in any missing notes as incorrect
        if (currentPhrase) {
            const remainingResults: SungNoteResult[] = [];
            for (let i = sungResults.length; i < currentPhrase.notes.length; i++) {
                remainingResults.push({
                    expected: currentPhrase.notes[i],
                    sung: null,
                    isCorrect: false,
                    timingMs: 0,
                });
            }

            if (remainingResults.length > 0) {
                setSungResults((prev) => [...prev, ...remainingResults]);
            }
        }

        // Move to next phrase after a delay
        setTimeout(() => {
            goToNextPhrase();
        }, 1000);
    }, [currentPhrase, sungResults]);

    // Handle detected note
    const handleDetectedNote = useCallback(
        (detected: {
            frequency: number;
            note: string;
            string: number;
            fret: number;
            confidence: number;
        }) => {
            if (!isListening || !expectedNoteRef.current || !currentPhrase) return;

            const expectedNote = expectedNoteRef.current;
            const expectedNoteName = getNoteFromFret(expectedNote.string, expectedNote.fret);
            const detectedNoteName = getNoteFromFret(detected.string, detected.fret);

            const isCorrect = expectedNoteName === detectedNoteName;
            const timingMs = Date.now() - noteStartTimeRef.current;

            const result: SungNoteResult = {
                expected: expectedNote,
                sung: {
                    frequency: detected.frequency,
                    note: detected.note,
                    confidence: detected.confidence,
                },
                isCorrect,
                timingMs,
            };

            setSungResults((prev) => [...prev, result]);

            // Update progress
            setProgress((prev) => ({
                ...prev,
                notesCorrect: prev.notesCorrect + (isCorrect ? 1 : 0),
                notesTotal: prev.notesTotal + 1,
            }));

            // Move to next note in phrase
            const nextNoteIndex = currentNoteIndex + 1;
            setCurrentNoteIndex(nextNoteIndex);

            if (nextNoteIndex < currentPhrase.notes.length) {
                // More notes in phrase
                expectedNoteRef.current = currentPhrase.notes[nextNoteIndex];
                noteStartTimeRef.current = Date.now();
            } else {
                // Phrase complete
                setIsListening(false);

                if (responseTimerRef.current) {
                    clearTimeout(responseTimerRef.current);
                }

                // Calculate phrase accuracy
                const phraseResults = [...sungResults, result];
                const correctInPhrase = phraseResults.filter(r => r.isCorrect).length;
                const phraseAccuracy = (correctInPhrase / phraseResults.length) * 100;

                setProgress((prev) => {
                    const overallAccuracy = prev.notesTotal > 0
                        ? ((prev.notesCorrect + (isCorrect ? 1 : 0)) / (prev.notesTotal + 1)) * 100
                        : 0;

                    return {
                        ...prev,
                        currentPhraseAccuracy: phraseAccuracy,
                        overallAccuracy,
                    };
                });

                // Move to next phrase after a delay
                setTimeout(() => {
                    goToNextPhrase();
                }, 1500);
            }
        },
        [isListening, currentPhrase, currentNoteIndex, sungResults]
    );

    // Go to next phrase
    const goToNextPhrase = useCallback(() => {
        setProgress((prev) => {
            const nextIndex = prev.currentPhraseIndex + 1;
            return {
                ...prev,
                currentPhraseIndex: nextIndex,
                phrasesCompleted: prev.phrasesCompleted + 1,
                currentPhraseAccuracy: 0,
            };
        });
        setSungResults([]);
        setCurrentNoteIndex(0);
        setIsListening(false);
        setIsPlaying(false);
        expectedNoteRef.current = null;
    }, []);

    // Go to previous phrase
    const goToPreviousPhrase = useCallback(() => {
        setProgress((prev) => ({
            ...prev,
            currentPhraseIndex: Math.max(0, prev.currentPhraseIndex - 1),
            currentPhraseAccuracy: 0,
        }));
        setSungResults([]);
        setCurrentNoteIndex(0);
        setIsListening(false);
        setIsPlaying(false);
        expectedNoteRef.current = null;
    }, []);

    // Reset ear training
    const reset = useCallback(() => {
        setProgress((prev) => ({
            ...prev,
            currentPhraseIndex: 0,
            phrasesCompleted: 0,
            notesCorrect: 0,
            notesTotal: 0,
            overallAccuracy: 0,
            currentPhraseAccuracy: 0,
        }));
        setSungResults([]);
        setCurrentNoteIndex(0);
        setIsListening(false);
        setIsPlaying(false);
        expectedNoteRef.current = null;

        if (responseTimerRef.current) {
            clearTimeout(responseTimerRef.current);
        }
    }, []);

    // Handle fretboard click in identify mode
    const handleFretboardClick = useCallback((clickedNote: { string: number; fret: number }) => {
        if (!waitingForClick || !expectedNoteRef.current || !currentPhrase) return;

        const expectedNote = expectedNoteRef.current;
        const isCorrect = clickedNote.string === expectedNote.string && clickedNote.fret === expectedNote.fret;
        const timingMs = Date.now() - noteStartTimeRef.current;

        const result: SungNoteResult = {
            expected: expectedNote,
            sung: isCorrect ? {
                frequency: 0,
                note: getNoteFromFret(clickedNote.string, clickedNote.fret),
                confidence: 1,
            } : null,
            isCorrect,
            timingMs,
        };

        setSungResults([result]);
        setWaitingForClick(false);

        // Update progress
        setProgress((prev) => {
            const newNotesCorrect = prev.notesCorrect + (isCorrect ? 1 : 0);
            const newNotesTotal = prev.notesTotal + 1;
            const overallAccuracy = newNotesTotal > 0 ? (newNotesCorrect / newNotesTotal) * 100 : 0;

            return {
                ...prev,
                notesCorrect: newNotesCorrect,
                notesTotal: newNotesTotal,
                currentPhraseAccuracy: isCorrect ? 100 : 0,
                overallAccuracy,
            };
        });

        if (responseTimerRef.current) {
            clearTimeout(responseTimerRef.current);
        }

        // Move to next phrase after a delay
        setTimeout(() => {
            goToNextPhrase();
        }, isCorrect ? 1000 : 2000);
    }, [waitingForClick, currentPhrase]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (responseTimerRef.current) {
                clearTimeout(responseTimerRef.current);
            }
        };
    }, []);

    return {
        phrases,
        currentPhrase,
        progress,
        isPlaying,
        isListening,
        sungResults,
        playingNoteIndex,
        currentNoteIndex,
        playCurrentPhrase,
        handleDetectedNote,
        handleFretboardClick,
        goToNextPhrase,
        goToPreviousPhrase,
        reset,
        waitingForClick,
    };
};
