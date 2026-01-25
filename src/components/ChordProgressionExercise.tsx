import { useState, useEffect, useCallback } from "react";
import { ChordProgressionSettings } from "@/types/chords";
import { NotewalkingModuleConfig } from "@/types/practice";
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
import { Check, Guitar, Play, Pause, Volume2, VolumeX, Clock, SkipForward, X } from "lucide-react";
import Fretboard from "./Fretboard";
import { createDegreeMap, findAllNoteOccurrences } from "@/lib/musicTheory";
import { getChordTones, calculateDegreeFromRoot } from "@/lib/chordProgression";
import { ChordNumeral } from "@/types/chords";
import { ForceLandscapeWrapper } from "./ForceLandscapeWrapper";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";

const DEFAULT_SETTINGS: ChordProgressionSettings = {
    key: "C",
    selectedChords: ["I", "IV"],
    measuresPerChord: 4,
    droneEnabled: true,
    droneVolume: 0.5,
};

const KEYS = [
    { value: "C", label: "C" },
    { value: "C#", label: "C#" },
    { value: "D", label: "D" },
    { value: "D#", label: "D#" },
    { value: "E", label: "E" },
    { value: "F", label: "F" },
    { value: "F#", label: "F#" },
    { value: "G", label: "G" },
    { value: "G#", label: "G#" },
    { value: "A", label: "A" },
    { value: "A#", label: "A#" },
    { value: "B", label: "B" },
];

const DIATONIC_CHORDS: ChordNumeral[] = ["I", "ii", "iii", "IV", "V", "vi", "vii°"];

interface ChordProgressionExerciseProps {
    autoStart?: boolean;
    sessionId?: string;
    // Exit callback for standalone/freeplay mode
    onExit?: () => void;
    // Session control props (optional - for when used in a lesson)
    sessionControls?: {
        timeRemaining: number;
        totalDuration: number; // in minutes
        isPaused: boolean;
        currentBlockIndex: number;
        totalBlocks: number;
        onPause: () => void;
        onResume: () => void;
        onSkip: () => void;
        onExit: () => void;
    };
    // Configuration sync
    moduleConfig?: NotewalkingModuleConfig;
    onConfigChange?: (config: NotewalkingModuleConfig) => void;
}

export function ChordProgressionExercise({ autoStart = false, sessionId, onExit, sessionControls, moduleConfig, onConfigChange }: ChordProgressionExerciseProps) {
    const [settings, setSettings] = useState<ChordProgressionSettings>(() => ({
        ...DEFAULT_SETTINGS,
        key: moduleConfig?.key || DEFAULT_SETTINGS.key,
        selectedChords: (moduleConfig?.chords as any) || DEFAULT_SETTINGS.selectedChords,
        measuresPerChord: moduleConfig?.measures_per_chord || DEFAULT_SETTINGS.measuresPerChord,
        droneEnabled: DEFAULT_SETTINGS.droneEnabled,
    }));
    const [isPlaying, setIsPlaying] = useState(autoStart);
    const [bpm, setBpm] = useState(moduleConfig?.metronome?.bpm ?? 80);
    const [mode, setMode] = useState<MetronomeMode>((moduleConfig?.metronome?.mode as MetronomeMode) || "regular");
    const [loop, setLoop] = useState(moduleConfig?.metronome?.loop ?? true);

    // Sync from config props
    useEffect(() => {
        if (moduleConfig) {
            setSettings(prev => ({
                ...prev,
                key: moduleConfig.key || prev.key,
                selectedChords: (moduleConfig.chords as any) || prev.selectedChords,
                measuresPerChord: moduleConfig.measures_per_chord || prev.measuresPerChord,
                // droneEnabled not in config
            }));

            if (moduleConfig.metronome) {
                if (moduleConfig.metronome.bpm !== undefined && moduleConfig.metronome.bpm !== bpm) setBpm(moduleConfig.metronome.bpm);
                if (moduleConfig.metronome.mode && moduleConfig.metronome.mode !== mode) setMode(moduleConfig.metronome.mode as MetronomeMode);
                if (moduleConfig.metronome.loop !== undefined && moduleConfig.metronome.loop !== loop) setLoop(moduleConfig.metronome.loop);
            }
        }
    }, [moduleConfig]); // Dependency check simplified

    const [metronomeMuted, setMetronomeMuted] = useState(false);
    const [detectedNote, setDetectedNote] = useState<string | null>(null);
    const [pitchConfidence, setPitchConfidence] = useState(0);
    const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
    const [tickCount, setTickCount] = useState(0);
    const [activeSlot, setActiveSlot] = useState<0 | 1>(0);

    const { autoRecordEnabled } = useAutoRecord();

    useEffect(() => {
        const ctx = new AudioContext();
        setAudioContext(ctx);
        return () => { ctx.close(); };
    }, []);

    const { playNote } = useNotePlayer(audioContext);

    const {
        currentChordIndex,
        currentChord,
        handleMetronomeTick: handleChordTick,
        setChord
    } = useChordProgression({
        settings,
        onChordChange: (idx, rootNote) => { }
    });

    const [showFretboard, setShowFretboard] = useState(false);
    const [fretboardNotes, setFretboardNotes] = useState<any[]>([]);
    const [degreeMap, setDegreeMap] = useState<Map<string, number>>(new Map());
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const handleResize = () => {
            const padding = 40;
            const contentWidth = 1250;
            const availableWidth = window.innerWidth - padding;
            const newScale = Math.min(1, availableWidth / contentWidth);
            setScale(newScale);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const dMap = createDegreeMap(settings.key);
        setDegreeMap(dMap);
        const notes: any[] = [];
        const noteNames = Array.from(dMap.keys());
        const degreeToNote = new Map<number, string>();
        dMap.forEach((degree, note) => degreeToNote.set(degree, note));

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

        noteNames.forEach(noteName => {
            const positions = findAllNoteOccurrences(noteName);
            positions.forEach(pos => {
                // Check if this note matches the currently detected note
                const isCurrentlyPlaying = detectedNote && noteName.toUpperCase() === detectedNote.toUpperCase();
                notes.push({
                    string: pos.string,
                    fret: pos.fret,
                    isStructure: structureNotes.has(noteName),
                    isActive: activeNotes.has(noteName),
                    isPlaying: isCurrentlyPlaying
                });
            });
        });

        setFretboardNotes(notes);
    }, [settings.key, settings.selectedChords, currentChordIndex, detectedNote]);

    const metronomeSettings: MetronomeSettings = {
        mode,
        startBpm: bpm,
        endBpm: bpm,
        measures: 999,
        muted: metronomeMuted,
        onTick: (state) => {
            setTickCount(prev => prev + 1);
            handleChordTick(state);
            recording.handleTick(tickCount);
            if (settings.droneEnabled && state.currentBeat === 1) {
                const droneNote = currentChord.rootNote.replace("#", "b") + "3";
                playNote(droneNote);
            }
        },
    };

    const metronome = useMetronome(metronomeSettings);

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

    const handleBpmChange = useCallback(
        (newBpm: number) => {
            const wasPlaying = metronome.state.isPlaying;
            setBpm(newBpm);

            // Sync metronome change to config
            if (onConfigChange && moduleConfig) {
                onConfigChange({
                    ...moduleConfig,
                    metronome: {
                        ...(moduleConfig.metronome || { mode: 'regular', bpm: newBpm, drum_beat: false, auto_record: false }),
                        bpm: newBpm
                    }
                });
            }

            if (wasPlaying) {
                metronome.stop();
                setTimeout(() => metronome.start(), 100);
            }
        },
        [metronome, onConfigChange, moduleConfig]
    );

    useBpmControls({
        currentBpm: bpm,
        onBpmChange: handleBpmChange,
        isEnabled: !showFretboard,
    });

    const handlePitchDetected = useCallback(
        (result: { frequency: number; note: string; string: number; fret: number; confidence: number; }) => {
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

    const handleSettingsChange = useCallback(
        (newSettings: Partial<ChordProgressionSettings>) => {
            setSettings((prev) => {
                const updated = { ...prev, ...newSettings };

                // Sync settings change to config
                if (onConfigChange && moduleConfig) {
                    onConfigChange({
                        ...moduleConfig,
                        key: updated.key,
                        chords: updated.selectedChords as string[],
                        measures_per_chord: updated.measuresPerChord
                    });
                }

                return updated;
            });
        },
        [onConfigChange, moduleConfig]
    );

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

    useEffect(() => {
        return () => { metronome.stop(); };
    }, []);

    const handleChordSelect = (chord: ChordNumeral) => {
        const newChords = [...(settings.selectedChords || ["I", "IV"])];
        if (newChords.length < 2) {
            newChords.push("I");
            if (newChords.length < 2) newChords.push("IV");
        }
        newChords[activeSlot] = chord;
        handleSettingsChange({ selectedChords: newChords });
    };

    const currentChordA = settings.selectedChords[0] || "I";
    const currentChordB = settings.selectedChords[1] || "IV";

    // Get degree color for tuner
    const DEGREE_COLORS: Record<number, string> = {
        1: "#FF6B6B", 2: "#4ECDC4", 3: "#45B7D1", 4: "#96CEB4",
        5: "#FFEAA7", 6: "#DDA0DD", 7: "#98D8C8"
    };
    const scaleDegree = detectedNote ? calculateDegreeFromRoot(detectedNote, settings.key) : null;
    const degreeColor = scaleDegree ? DEGREE_COLORS[scaleDegree] || "#666" : "#666";

    return (
        <>
            <ForceLandscapeWrapper>
                <div className="flex flex-col h-full w-full bpm-control-area overflow-hidden">
                    {/* MOBILE LANDSCAPE LAYOUT - 3 Columns */}
                    <div className="flex-1 flex flex-row gap-1 p-1 min-h-0 overflow-hidden">

                        {/* LEFT: Settings (15% width) */}
                        <div className="w-[120px] flex-shrink-0 flex flex-col gap-1 overflow-hidden bg-card border rounded p-1">
                            {/* Key + Chords in minimal space */}
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] text-muted-foreground">Key</span>
                                <Select value={settings.key} onValueChange={(v) => handleSettingsChange({ key: v })}>
                                    <SelectTrigger className="h-6 text-xs px-1 flex-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {KEYS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Chord Slots - Compact */}
                            <div className="flex gap-1">
                                <button
                                    className={`flex-1 py-1 rounded border text-sm font-bold ${activeSlot === 0 ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                                    onClick={() => setActiveSlot(0)}
                                >
                                    {currentChordA}
                                </button>
                                <button
                                    className={`flex-1 py-1 rounded border text-sm font-bold ${activeSlot === 1 ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                                    onClick={() => setActiveSlot(1)}
                                >
                                    {currentChordB}
                                </button>
                            </div>

                            {/* Chord Grid - 4 cols */}
                            <div className="grid grid-cols-4 gap-0.5 flex-1 overflow-y-auto">
                                {DIATONIC_CHORDS.map((chord) => {
                                    const isSelected = (activeSlot === 0 && currentChordA === chord) || (activeSlot === 1 && currentChordB === chord);
                                    return (
                                        <button
                                            key={chord}
                                            className={`h-6 text-[10px] font-bold rounded ${isSelected ? "bg-primary text-white" : "bg-muted hover:bg-muted/80"}`}
                                            onClick={() => handleChordSelect(chord)}
                                        >
                                            {chord}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Drone Toggle */}
                            <button
                                className={`h-6 text-[10px] rounded flex items-center justify-center gap-1 ${settings.droneEnabled ? "bg-green-600 text-white" : "bg-muted"}`}
                                onClick={() => handleSettingsChange({ droneEnabled: !settings.droneEnabled })}
                            >
                                {settings.droneEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                                Drone
                            </button>

                            {/* Fretboard Button */}
                            <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => setShowFretboard(true)}>
                                <Guitar className="w-3 h-3 mr-1" /> Fretboard
                            </Button>
                        </div>

                        {/* CENTER: Tuner (MOST IMPORTANT - ~55%) */}
                        <div className="flex-1 flex flex-col gap-1 min-w-0 overflow-hidden">
                            {/* Top Bar - Split: Chord Info | Session Controls */}
                            <div className="flex-shrink-0 flex gap-1">
                                {/* Left Half: Current Chord Display */}
                                <div className="flex-1 bg-card border rounded px-2 py-1 flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">Playing:</span>
                                    <span className="text-lg font-bold">{settings.selectedChords[currentChordIndex]} ({currentChord.rootNote})</span>
                                    <span className="text-xs text-muted-foreground">Key of {settings.key}</span>
                                </div>

                                {/* Right Half: Session Controls (only if in a lesson) */}
                                {sessionControls && (
                                    <div className="flex-1 bg-card border rounded px-2 py-1 flex items-center justify-between gap-2">
                                        {/* Timer */}
                                        <div className="flex items-center gap-1 text-sm">
                                            <Clock className="w-3 h-3" />
                                            <span className="font-mono font-bold">
                                                {Math.floor(sessionControls.timeRemaining / 60)}:{(sessionControls.timeRemaining % 60).toString().padStart(2, '0')}
                                            </span>
                                        </div>

                                        {/* Progress */}
                                        <span className="text-xs text-muted-foreground">
                                            {sessionControls.currentBlockIndex + 1}/{sessionControls.totalBlocks}
                                        </span>

                                        {/* Controls */}
                                        <div className="flex items-center gap-1">
                                            <Button
                                                size="sm"
                                                variant={sessionControls.isPaused ? "default" : "outline"}
                                                className="h-6 w-6 p-0"
                                                onClick={sessionControls.isPaused ? sessionControls.onResume : sessionControls.onPause}
                                            >
                                                {sessionControls.isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                                            </Button>
                                            <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={sessionControls.onSkip}>
                                                <SkipForward className="w-3 h-3" />
                                            </Button>
                                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={sessionControls.onExit}>
                                                Exit
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Freeplay Exit (when not in session but onExit provided) */}
                                {!sessionControls && onExit && (
                                    <div className="bg-card border rounded px-2 py-1 flex items-center">
                                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1" onClick={onExit}>
                                            <X className="w-3 h-3" /> Exit
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* DEGREE TUNER - Main Visual */}
                            <div className="flex-1 bg-card border rounded flex items-center justify-center gap-4 min-h-0">
                                {/* Large Degree Circle */}
                                <div
                                    className="w-24 h-24 rounded-full flex items-center justify-center text-5xl font-black shadow-lg border-4"
                                    style={{
                                        backgroundColor: scaleDegree ? degreeColor : "#333",
                                        borderColor: scaleDegree ? degreeColor : "#555",
                                        color: scaleDegree ? "#fff" : "#888"
                                    }}
                                >
                                    {scaleDegree || "?"}
                                </div>

                                {/* Note Info */}
                                <div className="text-center">
                                    <p className="text-2xl font-bold">{detectedNote || "---"}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {pitchConfidence > 0 ? `${Math.round(pitchConfidence * 100)}%` : "Play a note"}
                                    </p>
                                </div>
                            </div>

                            {/* Chord Progression Visual - Compact */}
                            <div className="flex-shrink-0 flex gap-1 justify-center">
                                {settings.selectedChords.map((chord, idx) => (
                                    <div
                                        key={idx}
                                        className={`px-3 py-1 rounded text-sm font-bold ${idx === currentChordIndex ? "bg-primary text-white scale-110" : "bg-muted"}`}
                                    >
                                        {chord}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* RIGHT: Metronome (25% width) */}
                        <div className="w-[140px] flex-shrink-0 flex flex-col gap-1 overflow-hidden bg-card border rounded p-1">
                            {/* Beat Visualizer */}
                            <div className="flex-shrink-0">
                                <BeatVisualizer
                                    currentBeat={metronome.state.currentBeat}
                                    isPlaying={metronome.state.isPlaying}
                                    currentBpm={metronome.state.isPlaying ? metronome.state.currentBpm : bpm}
                                />
                            </div>

                            {/* Play/Pause - Big Button */}
                            <Button
                                onClick={handlePlayPause}
                                className={`h-10 text-sm font-bold ${isPlaying ? "bg-red-500 hover:bg-red-600" : ""}`}
                            >
                                {isPlaying ? <><Pause className="w-4 h-4 mr-1" /> Stop</> : <><Play className="w-4 h-4 mr-1" /> Start</>}
                            </Button>

                            {/* BPM Display */}
                            <div className="text-center text-xl font-bold">{bpm} BPM</div>

                            {/* Mute Toggle */}
                            <button
                                className={`h-6 text-[10px] rounded ${metronomeMuted ? "bg-yellow-500 text-black" : "bg-muted"}`}
                                onClick={() => setMetronomeMuted(!metronomeMuted)}
                            >
                                {metronomeMuted ? "Unmute" : "Mute Click"}
                            </button>

                            {/* Metronome Controls - Minimal */}
                            <div className="flex-1 overflow-y-auto">
                                <MetronomeControls
                                    isPlaying={isPlaying}
                                    onPlayPause={handlePlayPause}
                                    onRestart={handleRestart}
                                    onStateChange={(newState) => {
                                        setMode(newState.mode);
                                        setBpm(newState.startBpm);
                                        setLoop(newState.loop);

                                        // Sync metronome state
                                        if (onConfigChange && moduleConfig) {
                                            onConfigChange({
                                                ...moduleConfig,
                                                metronome: {
                                                    ...(moduleConfig.metronome || { mode: 'regular', bpm: 80, drum_beat: false, auto_record: false }),
                                                    mode: newState.mode,
                                                    bpm: newState.startBpm,
                                                    loop: newState.loop
                                                }
                                            });
                                        }
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

                    {/* Recording Indicators */}
                    {recording.countdown && (
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-yellow-500/90 text-black px-3 py-1 rounded-full text-xs font-bold animate-pulse z-40">
                            Recording in {recording.countdown}...
                        </div>
                    )}
                    {recording.isRecording && (
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 z-40">
                            <div className="w-2 h-2 rounded-full bg-white animate-pulse" /> REC
                        </div>
                    )}

                </div>
            </ForceLandscapeWrapper>

            {/* Fretboard Overlay - OUTSIDE ForceLandscapeWrapper to avoid rotation issues */}
            {
                showFretboard && (
                    <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
                        {/* Header */}
                        <div className="flex-shrink-0 flex items-center justify-between p-3 bg-card border-b">
                            <h3 className="font-bold text-lg">Key of {settings.key} - Fretboard Reference</h3>
                            <Button variant="destructive" onClick={() => setShowFretboard(false)}>
                                ✕ Close
                            </Button>
                        </div>

                        {/* Fretboard - Rotated 90° and scrollable */}
                        <div className="flex-1 overflow-auto bg-black flex items-center justify-center">
                            <div
                                className="fretboard-modal-view p-4"
                                style={{
                                    transform: 'rotate(90deg)',
                                    transformOrigin: 'center center',
                                }}
                            >
                                <Fretboard
                                    selectedNotes={fretboardNotes}
                                    degreeMap={degreeMap}
                                    showDegreeNumbers
                                    isEditable={false}
                                />
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="flex-shrink-0 flex gap-4 justify-center p-3 bg-card border-t">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full bg-gray-400"></div>
                                <span className="text-sm">Scale</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full border-2 border-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>
                                <span className="text-sm">Progression</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full border-2 border-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]"></div>
                                <span className="text-sm">Current Chord</span>
                            </div>
                        </div>
                    </div>
                )
            }
        </>
    );
}
