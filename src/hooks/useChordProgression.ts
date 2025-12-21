import { useState, useCallback, useEffect } from "react";
import { ChordNumeral, ChordProgressionSettings } from "@/types/chords";
import { getChordInfo } from "@/lib/chordProgression";
import { MetronomeState } from "./useMetronome";

interface UseChordProgressionProps {
    settings: ChordProgressionSettings;
    onChordChange?: (chordIndex: number, rootNote: string) => void;
}

export function useChordProgression({
    settings,
    onChordChange,
}: UseChordProgressionProps) {
    const [currentChordIndex, setCurrentChordIndex] = useState(0);
    const [lastMeasureProcessed, setLastMeasureProcessed] = useState(0);

    // Get current chord info
    const currentChord = settings.selectedChords[currentChordIndex];
    const currentChordInfo = getChordInfo(settings.key, currentChord);

    /**
     * Handle metronome tick - advance chord when appropriate
     */
    const handleMetronomeTick = useCallback(
        (state: MetronomeState) => {
            const { currentBeat, currentMeasure } = state;

            // Only process on beat 1 of a measure
            if (currentBeat !== 1) return;

            // Avoid processing the same measure twice
            if (currentMeasure === lastMeasureProcessed) return;
            setLastMeasureProcessed(currentMeasure);

            // Check if we should advance to next chord
            // Advance when we've completed measuresPerChord measures
            if (currentMeasure % settings.measuresPerChord === 0) {
                // Only advance if we have more than one chord
                if (settings.selectedChords.length > 1) {
                    const nextIndex =
                        (currentChordIndex + 1) % settings.selectedChords.length;
                    setCurrentChordIndex(nextIndex);

                    // Get next chord info and notify
                    const nextChord = settings.selectedChords[nextIndex];
                    const nextChordInfo = getChordInfo(settings.key, nextChord);
                    onChordChange?.(nextIndex, nextChordInfo.rootNote);
                } else {
                    // Single chord - still notify on each cycle for drone refresh
                    onChordChange?.(0, currentChordInfo.rootNote);
                }
            }
        },
        [
            settings.selectedChords,
            settings.key,
            settings.measuresPerChord,
            currentChordIndex,
            lastMeasureProcessed,
            currentChordInfo.rootNote,
            onChordChange,
        ]
    );

    /**
     * Reset to first chord when settings change
     */
    useEffect(() => {
        setCurrentChordIndex(0);
        setLastMeasureProcessed(0);
    }, [settings.key, settings.selectedChords, settings.measuresPerChord]);

    /**
     * Get the next chord in the progression (for preview)
     */
    const getNextChord = useCallback(() => {
        if (settings.selectedChords.length <= 1) {
            return currentChordInfo;
        }
        const nextIndex = (currentChordIndex + 1) % settings.selectedChords.length;
        const nextChord = settings.selectedChords[nextIndex];
        return getChordInfo(settings.key, nextChord);
    }, [settings.selectedChords, settings.key, currentChordIndex, currentChordInfo]);

    /**
     * Manually set the current chord index
     */
    const setChord = useCallback(
        (index: number) => {
            if (index >= 0 && index < settings.selectedChords.length) {
                setCurrentChordIndex(index);
                const chord = settings.selectedChords[index];
                const chordInfo = getChordInfo(settings.key, chord);
                onChordChange?.(index, chordInfo.rootNote);
            }
        },
        [settings.selectedChords, settings.key, onChordChange]
    );

    return {
        currentChordIndex,
        currentChord: currentChordInfo,
        nextChord: getNextChord(),
        handleMetronomeTick,
        setChord,
    };
}
