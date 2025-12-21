import { useState, useEffect, useCallback } from "react";
import { ChordProgressionSettings } from "@/types/chords";
import { useMetronome, MetronomeSettings } from "@/hooks/useMetronome";
import { useChordProgression } from "@/hooks/useChordProgression";
import { useNotePlayer } from "@/hooks/useNotePlayer";
import { usePitchDetection } from "@/hooks/usePitchDetection";
import { MetronomeControls, MetronomeMode } from "./MetronomeControls";
import { BeatVisualizer } from "./BeatVisualizer";
import { ChordProgressionControls } from "./ChordProgressionControls";
import { IntervalMatrix } from "./IntervalMatrix";
import { DegreeTuner } from "./DegreeTuner";

const DEFAULT_SETTINGS: ChordProgressionSettings = {
    key: "C",
    selectedChords: ["I"],
    measuresPerChord: 4,
    droneEnabled: true,
    droneVolume: 0.5,
};

export function ChordProgressionExercise() {
    const [settings, setSettings] = useState<ChordProgressionSettings>(DEFAULT_SETTINGS);
    const [isPlaying, setIsPlaying] = useState(false);
    const [bpm, setBpm] = useState(80);
    const [mode, setMode] = useState<MetronomeMode>("regular");
    const [loop, setLoop] = useState(true);
    const [detectedNote, setDetectedNote] = useState<string | null>(null);
    const [pitchConfidence, setPitchConfidence] = useState(0);
    const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

    // Initialize AudioContext on mount
    useEffect(() => {
        const ctx = new AudioContext();
        setAudioContext(ctx);
        return () => {
            ctx.close();
        };
    }, []);

    // Metronome setup
    const metronomeSettings: MetronomeSettings = {
        mode,
        startBpm: bpm,
        endBpm: bpm,
        measures: 999,
        onTick: (state) => {
            chordProgression.handleMetronomeTick(state);

            // Play drone on beat 1 of each measure
            if (settings.droneEnabled && state.currentBeat === 1) {
                const rootNote = chordProgression.currentChord.rootNote;
                const droneNote = rootNote.replace("#", "b") + "3";
                playNote(droneNote);
            }
        },
    };

    const metronome = useMetronome(metronomeSettings);
    const { playNote } = useNotePlayer(audioContext);

    // Chord progression logic
    const chordProgression = useChordProgression({
        settings,
        onChordChange: () => { },
    });

    // Pitch detection
    const handlePitchDetected = useCallback(
        (result: {
            frequency: number;
            note: string;
            string: number;
            fret: number;
            confidence: number;
        }) => {
            setDetectedNote(result.note.replace(/\d/g, ""));
            setPitchConfidence(result.confidence);
        },
        []
    );

    usePitchDetection({
        isEnabled: isPlaying,
        onNoteDetected: handlePitchDetected,
        sensitivity: 0.7,
    });

    // Handle settings changes
    const handleSettingsChange = useCallback(
        (newSettings: Partial<ChordProgressionSettings>) => {
            setSettings((prev) => ({ ...prev, ...newSettings }));
        },
        []
    );

    // Play/Pause handler
    const handlePlayPause = useCallback(() => {
        if (isPlaying) {
            metronome.pause();
            setIsPlaying(false);
        } else {
            metronome.start();
            setIsPlaying(true);
        }
    }, [isPlaying, metronome]);

    const handleRestart = useCallback(() => {
        metronome.stop();
        setTimeout(() => metronome.start(), 100);
    }, [metronome]);

    const handleBpmChange = useCallback((newBpm: number) => {
        const wasPlaying = metronome.state.isPlaying;
        setBpm(newBpm);
        if (wasPlaying) {
            metronome.stop();
            setTimeout(() => metronome.start(), 100);
        }
    }, [metronome]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            metronome.stop();
        };
    }, []);

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 flex flex-col p-3 min-h-0 overflow-hidden">
                {/* Header */}
                <div className="flex-shrink-0 flex justify-between items-center mb-3">
                    <h1 className="text-2xl font-bold">Notewalking</h1>
                    <BeatVisualizer
                        currentBeat={metronome.state.currentBeat}
                        isPlaying={metronome.state.isPlaying}
                        currentBpm={metronome.state.isPlaying ? metronome.state.currentBpm : bpm}
                    />
                </div>

                {/* Main Content */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-3 min-h-0">
                    {/* Left Column: Controls */}
                    <div className="flex flex-col gap-3 min-h-0">
                        <div className="flex-1 overflow-y-auto min-h-0">
                            <ChordProgressionControls
                                settings={settings}
                                onSettingsChange={handleSettingsChange}
                                isPlaying={isPlaying}
                                onPlayPause={handlePlayPause}
                                currentBpm={bpm}
                            />
                        </div>
                        <div className="flex-shrink-0">
                            <MetronomeControls
                                isPlaying={isPlaying}
                                onPlayPause={handlePlayPause}
                                onRestart={handleRestart}
                                onStateChange={(newState) => {
                                    setMode(newState.mode);
                                    setBpm(newState.startBpm);
                                    setLoop(newState.loop);
                                }}
                                initialState={{
                                    mode,
                                    startBpm: bpm,
                                    endBpm: bpm,
                                    increments: 8,
                                    measuresPerIncrement: 4,
                                    loop,
                                    progressiveStepBpm: 5,
                                }}
                                compact
                            />
                        </div>
                    </div>

                    {/* Right Column: Matrix and Tuner */}
                    <div className="lg:col-span-2 flex flex-col gap-3 min-h-0">
                        <div className="flex-shrink-0">
                            <IntervalMatrix
                                selectedKey={settings.key}
                                selectedChords={settings.selectedChords}
                                currentChordIndex={chordProgression.currentChordIndex}
                            />
                        </div>
                        <div className="flex-1 min-h-0 flex">
                            <DegreeTuner
                                currentChord={chordProgression.currentChord}
                                detectedNote={detectedNote}
                                confidence={pitchConfidence}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
