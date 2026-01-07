import { useState, useEffect, useCallback } from "react";
import { ChordProgressionSettings } from "@/types/chords";
import { useMetronome, MetronomeSettings } from "@/hooks/useMetronome";
import { useBpmControls } from "@/hooks/useBpmControls";
import { useChordProgression } from "@/hooks/useChordProgression";
import { useNotePlayer } from "@/hooks/useNotePlayer";
import { usePitchDetection } from "@/hooks/usePitchDetection";
import { useAutoRecording } from "@/hooks/useAutoRecording";
import { useAutoRecord } from "@/contexts/AutoRecordContext";
import { supabase } from "@/integrations/supabase/client";
import { MetronomeControls, MetronomeMode } from "./MetronomeControls";
import { BeatVisualizer } from "./BeatVisualizer";
import { ChordProgressionControls } from "./ChordProgressionControls";
import { IntervalMatrix } from "./IntervalMatrix";
import { DegreeTuner } from "./DegreeTuner";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Check, Guitar } from "lucide-react"; // Import Guitar icon
import Fretboard from "./Fretboard"; // Import Fretboard
import { createDegreeMap, findAllNoteOccurrences } from "@/lib/musicTheory";
import { getChordTones, calculateDegreeFromRoot } from "@/lib/chordProgression";
import { ChordNumeral } from "@/types/chords";

const DEFAULT_SETTINGS: ChordProgressionSettings = {
    key: "C",
    selectedChords: ["I"],
    measuresPerChord: 4,
    droneEnabled: true,
    droneVolume: 0.5,
};

interface ChordProgressionExerciseProps {
    autoStart?: boolean;
    sessionId?: string; // Practice session ID for linking logs
}

export function ChordProgressionExercise({ autoStart = false, sessionId }: ChordProgressionExerciseProps) {
    const [settings, setSettings] = useState<ChordProgressionSettings>(DEFAULT_SETTINGS);
    const [isPlaying, setIsPlaying] = useState(autoStart);
    const [bpm, setBpm] = useState(80);
    const [mode, setMode] = useState<MetronomeMode>("regular");
    const [loop, setLoop] = useState(true);
    const [metronomeMuted, setMetronomeMuted] = useState(false);
    const [detectedNote, setDetectedNote] = useState<string | null>(null);
    const [pitchConfidence, setPitchConfidence] = useState(0);
    const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
    const [tickCount, setTickCount] = useState(0);

    // Global auto-record setting from context
    const { autoRecordEnabled } = useAutoRecord();

    // Initialize AudioContext on mount
    useEffect(() => {
        const ctx = new AudioContext();
        setAudioContext(ctx);
        return () => {
            ctx.close();
        };
    }, []);



    const { playNote } = useNotePlayer(audioContext);

    // Chord Progression Logic
    const {
        currentChordIndex,
        currentChord, // { rootNote, quality, intervals, degree }
        handleMetronomeTick: handleChordTick,
        setChord
    } = useChordProgression({
        settings,
        onChordChange: (idx, rootNote) => {
            // Optional: visual feedback trigger?
        }
    });

    // Peek Fretboard State
    const [showFretboard, setShowFretboard] = useState(false);
    const [fretboardNotes, setFretboardNotes] = useState<any[]>([]);
    const [degreeMap, setDegreeMap] = useState<Map<string, number>>(new Map());
    const [scale, setScale] = useState(1);

    // Calculate scale on resize
    useEffect(() => {
        const handleResize = () => {
            const isMobile = window.innerWidth < 768;
            if (isMobile) {
                setScale(1);
            } else {
                const padding = 40; // 20px padding on each side
                const contentWidth = 1250; // Approx fretboard width
                const availableWidth = window.innerWidth - padding;
                const newScale = Math.min(1, availableWidth / contentWidth);
                setScale(newScale);
            }
        };

        handleResize(); // Init
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Calculate Fretboard Notes
    useEffect(() => {
        const dMap = createDegreeMap(settings.key);
        setDegreeMap(dMap);

        // 1. Base Notes (All notes in key)
        const notes: any[] = [];
        const noteNames = Array.from(dMap.keys());

        // Map degrees to note names for lookup
        const degreeToNote = new Map<number, string>();
        dMap.forEach((degree, note) => degreeToNote.set(degree, note));

        // 2. Identify Structure and Active Notes
        const structureNotes = new Set<string>();
        settings.selectedChords.forEach(numeral => {
            const tones = getChordTones(numeral as ChordNumeral);
            tones.forEach(t => {
                const n = degreeToNote.get(t);
                if (n) structureNotes.add(n);
            });
        });

        const activeNotes = new Set<string>();
        if (settings.selectedChords[currentChordIndex]) {
            const tones = getChordTones(settings.selectedChords[currentChordIndex] as ChordNumeral);
            tones.forEach(t => {
                const n = degreeToNote.get(t);
                if (n) activeNotes.add(n);
            });
        }

        // 3. Build Note Objects
        noteNames.forEach(noteName => {
            const positions = findAllNoteOccurrences(noteName);
            positions.forEach(pos => {
                notes.push({
                    string: pos.string,
                    fret: pos.fret,
                    isStructure: structureNotes.has(noteName),
                    isActive: activeNotes.has(noteName)
                });
            });
        });

        setFretboardNotes(notes);
    }, [settings.key, settings.selectedChords, currentChordIndex]);





    // Metronome setup
    const metronomeSettings: MetronomeSettings = {
        mode,
        startBpm: bpm,
        endBpm: bpm,
        measures: 999,
        muted: metronomeMuted,
        onTick: (state) => {
            setTickCount(prev => prev + 1);

            // Delegate chord advancement logic
            handleChordTick(state);

            recording.handleTick(tickCount);

            // Play drone on beat 1 of each measure
            if (settings.droneEnabled && state.currentBeat === 1) {
                const droneNote = currentChord.rootNote.replace("#", "b") + "3";
                playNote(droneNote);
            }
        },
    };

    const metronome = useMetronome(metronomeSettings);

    // Handle auto-start
    useEffect(() => {
        if (autoStart && metronome) {
            const timer = setTimeout(() => {
                if (metronome.audioContext.state === 'suspended') {
                    metronome.audioContext.resume();
                }
                if (!metronome.state.isPlaying) {
                    metronome.start();
                    setIsPlaying(true);
                    setTickCount(0);
                    recording.reset();
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [autoStart, metronome]);

    // BPM change handler for scroll/touch/drag controls
    const handleBpmChange = useCallback(
        (newBpm: number) => {
            const wasPlaying = metronome.state.isPlaying;
            setBpm(newBpm);
            if (wasPlaying) {
                metronome.stop();
                setTimeout(() => metronome.start(), 100);
            }
        },
        [metronome]
    );

    // Global BPM adjustment controls
    useBpmControls({
        currentBpm: bpm,
        onBpmChange: handleBpmChange,
        isEnabled: !showFretboard, // Disable when fretboard is shown to allow scrolling
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

    const pitchDetection = usePitchDetection({
        isEnabled: isPlaying,
        onNoteDetected: handlePitchDetected,
        sensitivity: 0.7,
    });

    // Auto-recording
    const recording = useAutoRecording({
        enabled: autoRecordEnabled && isPlaying,
        moduleType: 'notewalking',
        sessionId,
        moduleConfig: {
            module_type: 'notewalking',
            key: settings.key,
            chords: settings.selectedChords,
            measures_per_chord: settings.measuresPerChord,
        },
        existingMicStream: pitchDetection.audioStream || undefined,
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
            setTickCount(0);
            recording.reset();
        }
    }, [isPlaying, metronome, recording]);

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
        <div className="flex flex-col h-full bpm-control-area">
            <div className="flex-1 flex flex-col p-2 min-h-0 overflow-hidden gap-2">
                {/* Header - just title */}
                <div className="flex-shrink-0 flex justify-between items-center">
                    <h1 className="text-xl font-bold">Notewalking</h1>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-400 hover:text-blue-300 hover:bg-transparent px-2 h-8"
                        onClick={() => setShowFretboard(true)}
                    >
                        <Guitar className="w-4 h-4 mr-2" />
                        Fretboard
                    </Button>
                </div>

                {/* Fretboard Overlay */}
                {showFretboard && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm animate-in fade-in duration-200 cursor-pointer overflow-hidden"
                        onClick={() => setShowFretboard(false)}
                    >
                        {/* Desktop View */}
                        <div
                            className="hidden md:flex bg-background border border-border rounded-xl p-4 shadow-2xl origin-center cursor-default flex-col items-center justify-center"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                transform: `scale(${scale})`,
                            }}
                        >
                            <h3 className="text-center font-bold text-lg mb-2">Key of {settings.key} Reference</h3>
                            <Fretboard
                                selectedNotes={fretboardNotes}
                                degreeMap={degreeMap}
                                showDegreeNumbers
                                isEditable={false}
                                rootNote={fretboardNotes.find(n => n.fret === 0 && createDegreeMap(settings.key).get(getChordTones(settings.selectedChords[currentChordIndex] as ChordNumeral)[0] as any) === 1)}
                            />
                            <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm scale-125 origin-top">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                                    <span className="whitespace-nowrap">Scale Note</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full border-2 border-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>
                                    <span className="whitespace-nowrap">Progression Note</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full border-2 border-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]"></div>
                                    <span className="whitespace-nowrap">Current Chord Note</span>
                                </div>
                            </div>
                        </div>

                        {/* Mobile View (Rotated) */}
                        <div
                            className="md:hidden w-full h-full overflow-y-auto overflow-x-hidden relative"
                            onClick={(e) => {
                                // Close if clicking strictly on the scrolling container (background)
                                if (e.target === e.currentTarget) setShowFretboard(false);
                            }}
                        >
                            <div
                                className="absolute top-4 left-0 right-0 z-10 flex justify-center pointer-events-none"
                            >
                                <div className="bg-background/80 backdrop-blur p-2 rounded-lg border border-border text-xs font-bold pointer-events-auto">
                                    Key: {settings.key}
                                </div>
                            </div>

                            <div className="w-full flex justify-center" style={{ minHeight: '1350px' }}>
                                <div
                                    style={{
                                        width: '240px', // Fretboard height (approx 180 + padding)
                                        height: '1300px', // Fretboard width
                                        position: 'relative',
                                        marginTop: '60px'
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            transformOrigin: 'top left',
                                            transform: 'rotate(90deg) translateY(-100%)',
                                            width: '1300px' // Ensure width for rotation
                                        }}
                                    >
                                        <Fretboard
                                            selectedNotes={fretboardNotes}
                                            degreeMap={degreeMap}
                                            showDegreeNumbers
                                            isEditable={false}
                                            rootNote={fretboardNotes.find(n => n.fret === 0 && createDegreeMap(settings.key).get(getChordTones(settings.selectedChords[currentChordIndex] as ChordNumeral)[0] as any) === 1)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="fixed bottom-8 left-0 right-0 flex justify-center z-50 pointer-events-none">
                                <Button
                                    variant="destructive"
                                    className="pointer-events-auto shadow-xl backdrop-blur bg-red-500/90 hover:bg-red-600 border-2 border-white/20 px-8 py-6 text-lg font-bold rounded-full animate-in slide-in-from-bottom-4"
                                    onClick={() => setShowFretboard(false)}
                                >
                                    Close View
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Recording Countdown */}
                {recording.countdown && (
                    <div className="flex-shrink-0 mx-2 bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-2 flex items-center justify-center">
                        <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 animate-pulse">
                            Recording in {recording.countdown} clicks...
                        </span>
                    </div>
                )}

                {/* Recording Indicator */}
                {recording.isRecording && (
                    <div className="flex-shrink-0 mx-2 bg-red-500/20 border border-red-500/50 rounded-lg p-2 flex items-center justify-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-sm font-semibold text-red-700 dark:text-red-400">
                            RECORDING
                        </span>
                    </div>
                )}

                {/* Main Content */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-2 min-h-0">
                    {/* Left Column: Controls */}
                    <div className="flex flex-col min-h-0 overflow-hidden">
                        <div className="flex-1 overflow-hidden min-h-0">
                            <ChordProgressionControls
                                settings={settings}
                                onSettingsChange={handleSettingsChange}
                                isPlaying={isPlaying}
                                onPlayPause={handlePlayPause}
                                currentBpm={bpm}
                            />
                        </div>
                    </div>

                    {/* Right Column: Matrix Top, Tuner/Metronome Bottom */}
                    <div className="lg:col-span-2 flex flex-col gap-2 min-h-0">
                        {/* Top: Interval Matrix (Full Width) */}
                        <div className="flex-shrink-0 bg-card border rounded-lg p-4">
                            <IntervalMatrix
                                selectedKey={settings.key}
                                selectedChords={settings.selectedChords}
                                currentChordIndex={currentChordIndex}
                            />
                        </div>

                        {/* Bottom: Tuner and Metronome split */}
                        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-2">
                            {/* Degree Tuner */}
                            <div className="bg-card border rounded-lg p-4 overflow-hidden flex flex-col">
                                <DegreeTuner
                                    currentChord={{
                                        ...currentChord,
                                        numeral: settings.selectedChords[currentChordIndex] as any
                                    }}
                                    detectedNote={detectedNote}
                                    confidence={pitchConfidence}
                                    keyRoot={settings.key}
                                />
                            </div>

                            {/* Metronome */}
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
                                            endBpm: bpm + 40,
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
