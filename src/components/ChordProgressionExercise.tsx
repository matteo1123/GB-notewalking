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
    const [metronomeMuted, setMetronomeMuted] = useState(false);
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
        muted: metronomeMuted,
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

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            metronome.stop();
        };
    }, []);

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 flex flex-col p-2 min-h-0 overflow-hidden gap-2">
                {/* Header - just title */}
                <div className="flex-shrink-0">
                    <h1 className="text-xl font-bold">Notewalking</h1>
                </div>

                {/* Main Content */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-2 min-h-0">
                    {/* Left Column: Controls only */}
                    <div className="flex flex-col min-h-0">
                        <div className="flex-1 overflow-y-auto min-h-0">
                            <ChordProgressionControls
                                settings={settings}
                                onSettingsChange={handleSettingsChange}
                                isPlaying={isPlaying}
                                onPlayPause={handlePlayPause}
                                currentBpm={bpm}
                            />
                        </div>
                    </div>

                    {/* Right Column: Matrix, Tuner, and Metronome */}
                    <div className="lg:col-span-2 flex flex-col gap-2 min-h-0">
                        {/* Interval Matrix */}
                        <div className="flex-shrink-0">
                            <IntervalMatrix
                                selectedKey={settings.key}
                                selectedChords={settings.selectedChords}
                                currentChordIndex={chordProgression.currentChordIndex}
                            />
                        </div>

                        {/* Degree Tuner and Metronome side by side */}
                        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-2">
                            {/* Degree Tuner - takes 2/3 */}
                            <div className="lg:col-span-2 min-h-0 flex">
                                <DegreeTuner
                                    currentChord={chordProgression.currentChord}
                                    detectedNote={detectedNote}
                                    confidence={pitchConfidence}
                                    keyRoot={settings.key}
                                />
                            </div>

                            {/* Consolidated Metronome - takes 1/3 */}
                            <div className="flex flex-col gap-2 bg-card border border-border rounded-lg p-3">
                                {/* Beat Visualizer */}
                                <div className="flex-shrink-0">
                                    <BeatVisualizer
                                        currentBeat={metronome.state.currentBeat}
                                        isPlaying={metronome.state.isPlaying}
                                        currentBpm={metronome.state.isPlaying ? metronome.state.currentBpm : bpm}
                                    />
                                </div>

                                {/* Mute Toggle */}
                                <div className="flex items-center justify-between bg-muted/30 rounded p-2">
                                    <span className="text-xs font-medium">Mute Clicks</span>
                                    <button
                                        onClick={() => setMetronomeMuted(!metronomeMuted)}
                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${metronomeMuted ? 'bg-primary' : 'bg-muted'
                                            }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${metronomeMuted ? 'translate-x-5' : 'translate-x-0.5'
                                                }`}
                                        />
                                    </button>
                                </div>

                                {/* Metronome Controls */}
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
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
