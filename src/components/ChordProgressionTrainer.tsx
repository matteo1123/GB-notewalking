import { useState, useEffect, useCallback } from "react";
import { ChordProgressionSettings } from "@/types/chords";
import { useMetronome, MetronomeSettings } from "@/hooks/useMetronome";
import { useBpmControls } from "@/hooks/useBpmControls";
import { useChordProgression } from "@/hooks/useChordProgression";
import { useNotePlayer } from "@/hooks/useNotePlayer";
import { usePitchDetection } from "@/hooks/usePitchDetection";
import { useAutoRecording } from "@/hooks/useAutoRecording";
import { supabase } from "@/integrations/supabase/client";
import { MetronomeControls, MetronomeMode } from "./MetronomeControls";
import { BeatVisualizer } from "./BeatVisualizer";
import { ChordProgressionControls } from "./ChordProgressionControls";
import { ChordDisplay } from "./ChordDisplay"; // New
import { useChordResolver } from "@/hooks/useChordResolver"; // New
import { DegreeTuner } from "./DegreeTuner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { Check } from "lucide-react";

const DEFAULT_SETTINGS: ChordProgressionSettings = {
    key: "C",
    selectedChords: ["I"],
    measuresPerChord: 4,
    droneEnabled: true,
    droneVolume: 0.5,
};

export function ChordProgressionTrainer() {
    const [settings, setSettings] = useState<ChordProgressionSettings>(DEFAULT_SETTINGS);
    const [isPlaying, setIsPlaying] = useState(false);
    const [bpm, setBpm] = useState(80);
    const [mode, setMode] = useState<MetronomeMode>("regular");
    const [loop, setLoop] = useState(true);
    const [metronomeMuted, setMetronomeMuted] = useState(false);
    const [detectedNote, setDetectedNote] = useState<string | null>(null);
    const [pitchConfidence, setPitchConfidence] = useState(0);
    const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
    const [autoRecordEnabled, setAutoRecordEnabled] = useState(false);
    const [tickCount, setTickCount] = useState(0);
    const [drumBeat, setDrumBeat] = useState(false);

    // New State for "Real Chords" Mode
    const [progressions, setProgressions] = useState<any[]>([]);
    const [selectedProgressionId, setSelectedProgressionId] = useState<string>("");
    const { resolve, resolvedChords, isLoading: isResolving } = useChordResolver();
    const [currentChordIndex, setCurrentChordIndex] = useState(0);

    // Fetch available progressions
    useEffect(() => {
        const fetchProgressions = async () => {
            const { data } = await supabase.from('chord_progressions' as any).select('*').order('name');
            if (data) {
                const typedData = data as any[];
                setProgressions(typedData);
                if (typedData.length > 0) setSelectedProgressionId(typedData[0].id);
            }
        };
        fetchProgressions();
    }, []);

    // Resolve Chords when selection changes
    useEffect(() => {
        if (!selectedProgressionId) return;
        const prog = progressions.find(p => p.id === selectedProgressionId);
        if (prog) {
            // Parse CSV progression string
            const numerals = prog.progression.split(',').map((s: string) => s.trim());
            resolve(numerals, settings.key);
        }
    }, [selectedProgressionId, settings.key, resolve, progressions]);

    // Load auto-record setting from profile
    useEffect(() => {
        const loadSettings = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile } = await supabase
                .from('profiles')
                .select('settings')
                .eq('id', user.id)
                .single();

            if (profile?.settings) {
                const settings = profile.settings as { autoRecord?: boolean };
                setAutoRecordEnabled(settings.autoRecord || false);
            }
        };
        loadSettings();
    }, []);

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
        drumBeat,
        onTick: (state) => {
            setTickCount(prev => prev + 1);

            // Calculate current chord index based on measures
            // (Current Measure - 1) / MeasuresPerChord
            if (resolvedChords.length > 0) {
                const totalMeasures = (state.currentMeasure - 1);
                const chordIdx = Math.floor(totalMeasures / settings.measuresPerChord) % resolvedChords.length;
                if (chordIdx !== currentChordIndex) {
                    setCurrentChordIndex(chordIdx);
                }
            }

            recording.handleTick(tickCount);

            // Play drone on beat 1 of each measure
            if (settings.droneEnabled && state.currentBeat === 1 && resolvedChords.length > 0) {
                const currentChord = resolvedChords[currentChordIndex];
                if (currentChord) {
                    const rootNote = currentChord.root_note; // Use actual root from DB
                    const droneNote = rootNote.replace("#", "b") + "3";
                    playNote(droneNote);
                }
            }
        },
    };

    const metronome = useMetronome(metronomeSettings);
    const { playNote } = useNotePlayer(audioContext);

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

    // Global BPM adjustment controls (scroll, touch, drag, keyboard)
    useBpmControls({
        currentBpm: bpm,
        onBpmChange: handleBpmChange,
        isEnabled: true,
    });

    // Old chord progression hook removed/ignored in favor of new system
    // We map resolvedChords to the format expected by DegreeTuner
    const currentResolvedChord = resolvedChords[currentChordIndex];
    const tunerChordInfo = currentResolvedChord ? {
        rootNote: currentResolvedChord.root_note,
        quality: currentResolvedChord.chord_quality,
        intervals: [], // Todo: map intervals if needed for tuner
        numeral: currentResolvedChord.numeral as any,
        degree: currentResolvedChord.degree,
    } : { rootNote: 'C', quality: 'major', intervals: [], numeral: 'I' as any, degree: 0 };

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

    // Auto-recording with mic cloning
    const recording = useAutoRecording({
        enabled: autoRecordEnabled && isPlaying,
        moduleType: 'notewalking',
        moduleConfig: {
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
                <div className="flex-shrink-0">
                    <h1 className="text-xl font-bold">Chord Progression Trainer</h1>
                </div>

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
                    <div className="flex flex-col min-h-0 overflow-hidden gap-4">
                        <div className="bg-card border rounded-lg p-4 flex flex-col gap-4">
                            <h2 className="font-semibold text-lg mb-2">Progression</h2>

                            <div className="flex flex-col gap-2">
                                <Label>Key Preference</Label>
                                <Select
                                    value={settings.key}
                                    onValueChange={(k) => handleSettingsChange({ key: k })}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'B', 'F#', 'C#'].map(k => (
                                            <SelectItem key={k} value={k}>{k} Major</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col gap-2">
                                <Label>Template</Label>
                                <Select
                                    value={selectedProgressionId}
                                    onValueChange={setSelectedProgressionId}
                                >
                                    <SelectTrigger><SelectValue placeholder="Select a progression" /></SelectTrigger>
                                    <SelectContent>
                                        {progressions.map(p => (
                                            <SelectItem key={p.id} value={p.id}>
                                                {p.name} ({p.progression})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="pt-4 border-t">
                                <Label>Chords in Sequence</Label>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {resolvedChords.map((rc, idx) => (
                                        <div
                                            key={idx}
                                            className={`px-2 py-1 rounded text-xs border ${idx === currentChordIndex ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground'}`}
                                        >
                                            {rc.numeral}
                                        </div>
                                    ))}
                                    {resolvedChords.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Display & Tuner */}
                    <div className="lg:col-span-2 flex flex-col gap-2 min-h-0">
                        {/* Chord Display */}
                        <div className="flex-shrink-0">
                            <ChordDisplay
                                currentChord={resolvedChords[currentChordIndex]}
                                nextChord={resolvedChords[(currentChordIndex + 1) % resolvedChords.length]}
                            />
                        </div>

                        {/* Degree Tuner and Metronome side by side */}
                        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-2">
                            {/* Degree Tuner - takes 2/3 */}
                            <div className="lg:col-span-2 min-h-0 flex">
                                <DegreeTuner
                                    currentChord={tunerChordInfo}
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

                                {/* Auto-Record Toggle */}
                                <div className="flex items-center justify-between bg-muted/30 rounded p-2">
                                    <div className="flex items-center gap-1">
                                        <Label htmlFor="auto-record-notewalking" className="text-xs font-medium cursor-pointer">Auto-Record</Label>
                                        {recording.hasRecorded && (
                                            <Check className="w-3 h-3 text-green-500" />
                                        )}
                                    </div>
                                    <Switch
                                        id="auto-record-notewalking"
                                        checked={autoRecordEnabled}
                                        onCheckedChange={setAutoRecordEnabled}
                                        className="scale-75"
                                    />
                                </div>

                                {/* Metronome Controls */}
                                <div className="flex-shrink-0">
                                    <MetronomeControls
                                        isPlaying={isPlaying}
                                        onPlayPause={handlePlayPause}
                                        onRestart={handleRestart}
                                        drumBeat={drumBeat}
                                        onStateChange={(newState) => {
                                            setMode(newState.mode);
                                            setBpm(newState.startBpm);
                                            setLoop(newState.loop);
                                            if (newState.drumBeat !== undefined) setDrumBeat(newState.drumBeat);
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
