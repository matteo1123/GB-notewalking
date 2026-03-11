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
import { Check, Settings, Guitar, Play, Pause, Volume2, VolumeX, Clock, SkipForward, X } from "lucide-react";
import Fretboard from "./Fretboard";
import { FretboardPainter } from "./FretboardPainter";
import { useSession } from "@/contexts/SessionContext";
import { createDegreeMap, findAllNoteOccurrences } from "@/lib/musicTheory";
import { getChordTones, calculateDegreeFromRoot, getChordInfo } from "@/lib/chordProgression";
import { ChordNumeral } from "@/types/chords";
import { ForceLandscapeWrapper } from "./ForceLandscapeWrapper";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";

// Helpers for top banners & chord tracking
const getFormattedChordName = (key: string, numeral: ChordNumeral) => {
    const info = getChordInfo(key, numeral);
    const isMinor = numeral.toLowerCase() === numeral && !numeral.endsWith('°');
    const isDim = numeral.endsWith('°');
    return `${info.rootNote}${isMinor ? 'm' : isDim ? 'dim' : ''}`;
};

const getFormattedChordTones = (numeral: ChordNumeral) => {
    return getChordTones(numeral).join(", ");
};

const DEFAULT_SETTINGS: ChordProgressionSettings = {
    key: "C",
    selectedChords: ["I", "IV"],
    measuresPerChord: 4,
    droneEnabled: true,
    droneVolume: 0.5,
    promptFretboardPainter: true,
    droneMode: "chord-major",
    scaleView: "major",
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
    // Configuration sync
    moduleConfig?: NotewalkingModuleConfig;
    onConfigChange?: (config: NotewalkingModuleConfig) => void;
}

export function ChordProgressionExercise({ autoStart = true, sessionId, onExit, moduleConfig, onConfigChange }: ChordProgressionExerciseProps) {
    const [settings, setSettings] = useState<ChordProgressionSettings>(() => {
        let initChords = (moduleConfig?.chords as any) || DEFAULT_SETTINGS.selectedChords;
        if (Array.isArray(initChords)) {
            initChords = initChords.slice(0, 2);
            if (initChords.length === 0) initChords = ["I", "IV"];
            if (initChords.length === 1) initChords = [initChords[0], "IV"];
        }
        return {
            ...DEFAULT_SETTINGS,
            key: moduleConfig?.key || DEFAULT_SETTINGS.key,
            selectedChords: initChords,
            measuresPerChord: moduleConfig?.measures_per_chord || DEFAULT_SETTINGS.measuresPerChord,
            droneEnabled: DEFAULT_SETTINGS.droneEnabled,
            promptFretboardPainter: moduleConfig?.prompt_fretboard_painter ?? DEFAULT_SETTINGS.promptFretboardPainter,
            droneMode: moduleConfig?.drone_mode ?? DEFAULT_SETTINGS.droneMode,
            scaleView: moduleConfig?.scale_view ?? DEFAULT_SETTINGS.scaleView,
        };
    });
    const [isPlaying, setIsPlaying] = useState(autoStart);
    const [bpm, setBpm] = useState(moduleConfig?.metronome?.bpm ?? 80);
    const [mode, setMode] = useState<MetronomeMode>((moduleConfig?.metronome?.mode as MetronomeMode) || "regular");
    const [loop, setLoop] = useState(moduleConfig?.metronome?.loop ?? true);

    // Sync from config props
    useEffect(() => {
        if (moduleConfig) {
            setSettings(prev => {
                let syncedChords = prev.selectedChords;
                if (Array.isArray(moduleConfig.chords)) {
                    const newChords = moduleConfig.chords.slice(0, 2) as ChordNumeral[];
                    if (newChords.length === 0) newChords.push("I", "IV");
                    if (newChords.length === 1) newChords.push(newChords[0], "IV");

                    if (newChords[0] !== prev.selectedChords[0] || newChords[1] !== prev.selectedChords[1]) {
                        syncedChords = newChords;
                    }
                }

                const newKey = moduleConfig.key || prev.key;
                const newMeasures = moduleConfig.measures_per_chord || prev.measuresPerChord;
                const newPainter = moduleConfig.prompt_fretboard_painter ?? prev.promptFretboardPainter;
                const newDroneMode = moduleConfig.drone_mode ?? prev.droneMode;
                const newScaleView = moduleConfig.scale_view ?? prev.scaleView;

                // Stop the Infinite Loop: Bail out if nothing actually changed
                if (
                    syncedChords === prev.selectedChords &&
                    newKey === prev.key &&
                    newMeasures === prev.measuresPerChord &&
                    newPainter === prev.promptFretboardPainter &&
                    newDroneMode === prev.droneMode &&
                    newScaleView === prev.scaleView
                ) {
                    return prev;
                }

                return {
                    ...prev,
                    key: newKey,
                    selectedChords: syncedChords,
                    measuresPerChord: newMeasures,
                    promptFretboardPainter: newPainter,
                    droneMode: newDroneMode,
                    scaleView: newScaleView,
                    // droneEnabled not in config
                };
            });

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
    const [coachAdvice, setCoachAdvice] = useState<string | null>(null);
    const [isLoadingAdvice, setIsLoadingAdvice] = useState<boolean>(true);

    // Fetch pre-session coach advice
    useEffect(() => {
        const fetchAdvice = async () => {
            setIsLoadingAdvice(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;

                const SUPABASE_URL = "https://idsufbsfywgmcrhldqxq.supabase.co";
                const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-coach-focus`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({ module_type: 'notewalking' })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.advice) setCoachAdvice(data.advice);
                }
            } catch (err) {
                console.error("Error fetching coach advice:", err);
            } finally {
                setIsLoadingAdvice(false);
            }
        };

        fetchAdvice();
    }, []);

    let sessionContext: any = null;
    try {
        sessionContext = useSession();
    } catch (e) {
        // Not wrapped in SessionProvider (e.g., Freeplay mode)
    }

    const { timer, nextBlock, pauseSession, setAutoAdvanceEnabled } = sessionContext || {};
    const [showPainter, setShowPainter] = useState(false);

    useEffect(() => {
        if (settings.promptFretboardPainter) {
            setAutoAdvanceEnabled?.(false);
        } else {
            setAutoAdvanceEnabled?.(true);
        }

        // Cleanup - ensure we don't permanently break auto-advance if they exit early
        return () => {
            setAutoAdvanceEnabled?.(true);
        }
    }, [settings.promptFretboardPainter, setAutoAdvanceEnabled]);

    useEffect(() => {
        // When timer hits zero, if the painter is enabled, pause and show it
        // BUG FIX: Only trigger this if we are in an ACTIVE Session (not Freeplay)
        if (sessionContext?.isActive && timer?.timeRemaining === 0 && settings.promptFretboardPainter && !showPainter) {
            pauseSession?.();
            setShowPainter(true);
        }
    }, [timer?.timeRemaining, settings.promptFretboardPainter, showPainter, pauseSession, sessionContext?.isActive]);

    const handlePainterDone = () => {
        setShowPainter(false);
        setAutoAdvanceEnabled?.(true);

        if (sessionContext?.isActive) {
            nextBlock?.();
        } else if (onExit) {
            // If we're in Freeplay mode, the painter fires on exit, so now we actually exit.
            onExit();
        }
    };

    // Freeplay Exit Interception
    const handleFreeplayExit = () => {
        if (!sessionContext?.isActive && settings.promptFretboardPainter) {
            setShowPainter(true);
        } else if (onExit) {
            onExit();
        }
    };

    const { autoRecordEnabled } = useAutoRecord();

    useEffect(() => {
        const ctx = new AudioContext();
        setAudioContext(ctx);
        return () => { ctx.close(); };
    }, []);

    const { playNote, playChord } = useNotePlayer(audioContext);

    const {
        currentChordIndex,
        currentChord,
        handleMetronomeTick: handleChordTick,
        setChord
    } = useChordProgression({
        settings,
        onChordChange: (idx, rootNote) => { }
    });

    const [detectedPitch, setDetectedPitch] = useState<string | null>(null);
    const [simulatedNote, setSimulatedNote] = useState<string | null>(null);
    const [fretboardNotes, setFretboardNotes] = useState<any[]>([]);
    const [degreeMap, setDegreeMap] = useState<Map<string, number>>(new Map());
    const [scale, setScale] = useState(1);
    const [revealedFrets, setRevealedFrets] = useState<Set<string>>(() => {
        const initial = new Set<string>();
        // Default fog focus: Frets 2-5 on strings 3-5 (center of fretboard)
        for (let s = 3; s <= 5; s++) {
            for (let f = 2; f <= 5; f++) {
                initial.add(`${s}-${f}`);
            }
        }
        return initial;
    });

    const getGuitarPitch = useCallback((stringNum: number, fret: number): string => {
        const stringMidiNotes: Record<number, number> = {
            1: 64, // High E (E4)
            2: 59, // B3
            3: 55, // G3
            4: 50, // D3
            5: 45, // A2
            6: 40  // Low E (E2)
        };
        const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        const midiNote = stringMidiNotes[stringNum] + fret;
        const octave = Math.floor(midiNote / 12) - 1;
        const noteName = noteNames[midiNote % 12];
        return `${noteName}${octave}`;
    }, []);

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
        const majorMap = createDegreeMap(settings.key, "major");
        const minorMap = createDegreeMap(settings.key, "minor");
        const dMap = new Map<string, number>();

        if (settings.scaleView === "minor") {
            minorMap.forEach((v, k) => dMap.set(k, v));
        } else if (settings.scaleView === "both") {
            majorMap.forEach((v, k) => dMap.set(k, v));
            minorMap.forEach((v, k) => dMap.set(k, v));
        } else {
            // default major
            majorMap.forEach((v, k) => dMap.set(k, v));
        }

        setDegreeMap(dMap);
        const notes: any[] = [];
        const noteNames = Array.from(dMap.keys());

        // Build multi-map for degree -> notes (allows flat 3rd AND natural 3rd to both be active "3"s)
        const degreeToNotes = new Map<number, string[]>();
        dMap.forEach((degree, note) => {
            if (!degreeToNotes.has(degree)) degreeToNotes.set(degree, []);
            degreeToNotes.get(degree)!.push(note);
        });

        const structureNotes = new Set<string>();
        settings.selectedChords.forEach(numeral => {
            const tones = getChordTones(numeral as ChordNumeral);
            tones.forEach(t => {
                const nList = degreeToNotes.get(t);
                if (nList) nList.forEach(n => structureNotes.add(n));
            });
        });

        const activeNotes = new Set<string>();
        if (settings.selectedChords[currentChordIndex]) {
            const tones = getChordTones(settings.selectedChords[currentChordIndex] as ChordNumeral);
            tones.forEach(t => {
                const nList = degreeToNotes.get(t);
                if (nList) nList.forEach(n => activeNotes.add(n));
            });
        }

        // --- KEYBOARD SHORTCUTS FOR NOTEWALKING ---
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only capture raw numbers 1-7 if user isn't typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            const num = parseInt(e.key, 10);
            if (num >= 1 && num <= 7) {
                const targetNotes = degreeToNotes.get(num);
                if (targetNotes && targetNotes.length > 0) {
                    // Just take the first one for simulated keyboard pressing (since keyboard input is simple 1-7)
                    if (targetNotes[0] !== simulatedNote) {
                        setSimulatedNote(targetNotes[0]);
                    }
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const num = parseInt(e.key, 10);
            if (num >= 1 && num <= 7) {
                setSimulatedNote(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        noteNames.forEach(noteName => {
            const positions = findAllNoteOccurrences(noteName);
            positions.forEach(pos => {
                // Determine if this is the EXACT pitch played within the revealed frets
                const pitch = getGuitarPitch(pos.string, pos.fret);

                // Mic pitch needs exact string/fret match. Keyboard just needs the base note name.
                const isCurrentlyPlaying =
                    (detectedPitch === pitch || simulatedNote === noteName) &&
                    revealedFrets.has(`${pos.string}-${pos.fret}`);

                notes.push({
                    string: pos.string,
                    fret: pos.fret,
                    isStructure: structureNotes.has(noteName),
                    isActive: activeNotes.has(noteName),
                    isPlaying: isCurrentlyPlaying,
                    color: '#3f3f46'
                });
            });
        });

        // Fog of War is permanently ON
        const filteredNotes = notes.filter(n => n.isPlaying || revealedFrets.has(`${n.string}-${n.fret}`));

        setFretboardNotes(filteredNotes);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [settings.key, settings.selectedChords, settings.scaleView, currentChordIndex, detectedPitch, simulatedNote, revealedFrets, getGuitarPitch]);

    const metronomeSettings: MetronomeSettings = {
        mode,
        startBpm: bpm,
        endBpm: bpm,
        measures: 999,
        muted: metronomeMuted,
        drumBeat: moduleConfig?.metronome?.drum_beat || false, // Wired from config
        onTick: (state) => {
            setTickCount(prev => prev + 1);
            handleChordTick(state);
            recording.handleTick(tickCount);
            if (settings.droneEnabled && state.currentBeat === 1) {
                if (settings.droneMode === "pedal") {
                    const droneNote = currentChord.rootNote.replace("#", "b") + "3";
                    playNote(droneNote, settings.droneVolume);
                } else {
                    // Calculate if Major or Minor based on Diatonic rules
                    // Major Key rules (chord-major): 1,4,5 are Major. 2,3,6,7 are Minor
                    // Minor Key rules (chord-minor): 1,4,5 are Minor. 3,6,7 are Major. 2 is Diminished (we'll use minor as requested)

                    let isMinor = false;
                    const d = currentChord.degree; // 1-7

                    if (settings.droneMode === "chord-major") {
                        isMinor = [2, 3, 6, 7].includes(d);
                    } else if (settings.droneMode === "chord-minor") {
                        isMinor = [1, 2, 4, 5].includes(d);
                    }

                    const chordName = currentChord.rootNote + (isMinor ? "m" : "");
                    playChord?.(chordName, settings.droneVolume);
                }
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
        isEnabled: true, // Always enabled
    });

    const handlePitchDetected = useCallback(
        (result: { frequency: number; note: string; string: number; fret: number; confidence: number; }) => {
            setDetectedNote(result.note.replace(/\d/g, ""));
            setDetectedPitch(result.note);
            setPitchConfidence(result.confidence);
        },
        []
    );

    const pitchDetection = usePitchDetection({
        isEnabled: isPlaying,
        onNoteDetected: handlePitchDetected,
        sensitivity: 0.7,
    });

    // Build current context string for AI feedback (e.g., "C major - I chord")
    const currentContextString = currentChord
        ? `${currentChord.rootNote} (${settings.selectedChords[currentChordIndex]} in key of ${settings.key})`
        : null;

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
        currentContext: currentContextString, // Track chord changes for AI feedback
        currentPitch: detectedPitch || null, // Track pitch changes for AI feedback
        coachAdvice: coachAdvice, // Pass advice for contextual evaluation
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
                        measures_per_chord: updated.measuresPerChord,
                        prompt_fretboard_painter: updated.promptFretboardPainter,
                        drone_mode: updated.droneMode,
                        scale_view: updated.scaleView
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
        if (metronome.state.isPlaying) {
            metronome.stop();
            setTimeout(() => metronome.start(), 100);
        }
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

        // Provide immediate audio feedback on the clicked chord
        const info = getChordInfo(settings.key, chord);
        const isMinor = chord.toLowerCase() === chord && !chord.endsWith('°');
        const chordName = info.rootNote + (isMinor ? "m" : "");
        playChord?.(chordName, settings.droneVolume);
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
            {/* @LANDSCAPE-LOCK: Do not remove ForceLandscapeWrapper — it forces landscape on mobile phones */}
            <ForceLandscapeWrapper>
                <div className="flex flex-col h-full w-full bpm-control-area overflow-hidden">
                    {/* Coach Advice Banner */}
                    {coachAdvice && (
                        <div className="bg-blue-900/40 border-b border-blue-500/30 px-3 py-1.5 flex items-center gap-2 text-xs md:text-sm shadow-md z-10 shrink-0">
                            <span className="text-xl">🎸</span>
                            <div className="flex-1 font-medium text-blue-100 italic">
                                "{coachAdvice}"
                            </div>
                        </div>
                    )}

                    {/* MOBILE LANDSCAPE LAYOUT - 3 Columns */}
                    <div className="flex-1 flex flex-row gap-1 p-1 min-h-0 overflow-hidden">

                        {/* LEFT: Settings (Desktop only, 15% width) */}
                        <div className="hidden lg:flex w-1/5 min-w-[120px] max-w-[150px] flex-shrink-0 flex-col gap-1 overflow-hidden bg-card border rounded p-1">
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

                            {/* Drone Style */}
                            <div className="flex items-center justify-between gap-1 w-full bg-muted/50 rounded p-1 border">
                                <button
                                    className={`h-6 flex-1 text-[10px] rounded flex flex-col items-center justify-center gap-0.5 leading-none transition-colors ${settings.droneEnabled ? "bg-green-600 text-white shadow-sm" : "bg-muted text-muted-foreground"}`}
                                    onClick={() => handleSettingsChange({ droneEnabled: !settings.droneEnabled })}
                                    title="Toggle Drone/Chords"
                                >
                                    {settings.droneEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                                    <span>{settings.droneEnabled ? "ON" : "OFF"}</span>
                                </button>

                                <Select
                                    value={settings.droneMode}
                                    onValueChange={(v: "pedal" | "chord-major" | "chord-minor") => {
                                        const update: Partial<ChordProgressionSettings> = { droneMode: v };
                                        if (v === "chord-major") update.scaleView = "major";
                                        if (v === "chord-minor") update.scaleView = "minor";
                                        handleSettingsChange(update);
                                    }}
                                    disabled={!settings.droneEnabled}
                                >
                                    <SelectTrigger className="h-6 text-[10px] px-1 w-20 bg-background text-left">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pedal" className="text-[10px] py-1">Pedal</SelectItem>
                                        <SelectItem value="chord-major" className="text-[10px] py-1">Major Key</SelectItem>
                                        <SelectItem value="chord-minor" className="text-[10px] py-1">Minor Key</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Scale View */}
                            <div className="flex items-center justify-between gap-1 w-full bg-muted/50 rounded p-1 border mt-1">
                                <span className="text-[10px] text-muted-foreground ml-1 font-bold">Scale View</span>
                                <Select
                                    value={settings.scaleView}
                                    onValueChange={(v: "major" | "minor" | "both") => handleSettingsChange({ scaleView: v })}
                                >
                                    <SelectTrigger className="h-6 text-[10px] px-1 w-20 bg-background text-left">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="major" className="text-[10px] py-1">Major</SelectItem>
                                        <SelectItem value="minor" className="text-[10px] py-1">Minor</SelectItem>
                                        <SelectItem value="both" className="text-[10px] py-1">Both</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* CENTER: Contextual Fretboard Area */}
                        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#0a0a0a] border rounded relative">
                            {/* Inner Top Header: Chord A | Mic Tuner | Chord B */}
                            <div className="h-[40px] md:h-auto flex flex-row shrink-0 border-b border-gray-800">
                                {/* Chord A */}
                                <button
                                    onClick={() => setActiveSlot(0)}
                                    className={`relative flex-1 flex justify-center items-center py-1 transition-all duration-300 gap-3 border-r border-gray-800 ${activeSlot === 0 ? 'bg-blue-900/30 ring-2 ring-inset ring-blue-500 shadow-[inset_0_0_15px_rgba(59,130,246,0.3)] z-10' : 'hover:bg-gray-800/50'
                                        } ${currentChordIndex === 0 && isPlaying ? 'bg-yellow-500/20' : ''}`}
                                >
                                    {currentChordIndex === 0 && isPlaying && (
                                        <div className="absolute top-1 left-2 text-[10px] font-black text-yellow-400 animate-pulse tracking-widest hidden md:block">
                                            ▶ PLAYING
                                        </div>
                                    )}
                                    <div className="flex flex-col items-end text-right">
                                        <h4 className="text-[10px] md:text-xs font-bold text-gray-400">Chord A</h4>
                                        <div className="text-[9px] md:text-[11px] font-black text-white">{getFormattedChordName(settings.key, currentChordA as ChordNumeral)}</div>
                                        <div className="text-[8px] md:text-[9px] font-mono text-gray-500">Tones: {getFormattedChordTones(currentChordA as ChordNumeral)}</div>
                                    </div>
                                    <div className={`text-2xl md:text-3xl font-black ${currentChordIndex === 0 && isPlaying ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]' :
                                        activeSlot === 0 ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]' : 'text-gray-500'
                                        }`}
                                    >
                                        {currentChordA}
                                    </div>
                                </button>

                                {/* Floating Tiny Tuner */}
                                <div className="w-[120px] shrink-0 border-l border-r border-gray-800 bg-black flex flex-col relative justify-center items-center z-10 shadow-xl">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button size="icon" variant="ghost" className="lg:hidden absolute top-1 left-1 h-6 w-6 bg-slate-800/80 hover:bg-slate-700 z-20 m-1 rounded border border-slate-600">
                                                <Settings className="w-3 h-3 text-white" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-64 p-2 bg-card border-slate-700 shadow-2xl" side="bottom" align="center">
                                            {/* Mobile Settings Content inside Popover */}
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-medium w-12">Key</span>
                                                    <Select value={settings.key} onValueChange={(v) => handleSettingsChange({ key: v })}>
                                                        <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                                                        <SelectContent>{KEYS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="grid grid-cols-4 gap-1 py-1">
                                                    {DIATONIC_CHORDS.map((chord) => {
                                                        const isSelected = (activeSlot === 0 && currentChordA === chord) || (activeSlot === 1 && currentChordB === chord);
                                                        return (
                                                            <button
                                                                key={chord}
                                                                className={`h-8 text-xs font-bold rounded ${isSelected ? "bg-primary text-white" : "bg-muted hover:bg-muted/80"}`}
                                                                onClick={() => handleChordSelect(chord)}
                                                            >
                                                                {chord}
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                <div className="flex items-center justify-between gap-2 bg-muted/30 p-1.5 rounded">
                                                    <button
                                                        className={`h-8 px-2 flex-1 text-xs rounded transition-colors ${settings.droneEnabled ? "bg-green-600 text-white" : "bg-muted"}`}
                                                        onClick={() => handleSettingsChange({ droneEnabled: !settings.droneEnabled })}
                                                    >
                                                        {settings.droneEnabled ? "Audio ON" : "Audio OFF"}
                                                    </button>
                                                    <Select
                                                        value={settings.droneMode}
                                                        onValueChange={(v: "pedal" | "chord-major" | "chord-minor") => {
                                                            const update: Partial<ChordProgressionSettings> = { droneMode: v };
                                                            if (v === "chord-major") update.scaleView = "major";
                                                            if (v === "chord-minor") update.scaleView = "minor";
                                                            handleSettingsChange(update);
                                                        }}
                                                        disabled={!settings.droneEnabled}
                                                    >
                                                        <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="pedal">Pedal</SelectItem>
                                                            <SelectItem value="chord-major">Chord (Maj)</SelectItem>
                                                            <SelectItem value="chord-minor">Chord (Min)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="flex items-center justify-between gap-2 overflow-hidden bg-muted/30 p-1.5 rounded">
                                                    <span className="text-xs font-medium w-16">Scale</span>
                                                    <Select
                                                        value={settings.scaleView}
                                                        onValueChange={(v: "major" | "minor" | "both") => handleSettingsChange({ scaleView: v })}
                                                    >
                                                        <SelectTrigger className="h-8 text-xs flex-1 text-left"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="major">Major Scale</SelectItem>
                                                            <SelectItem value="minor">Minor Scale</SelectItem>
                                                            <SelectItem value="both">Both</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        </PopoverContent>
                                    </Popover>

                                    <div
                                        className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-black shadow-lg border-2 z-10 bg-[#222]"
                                        style={{
                                            borderColor: scaleDegree ? degreeColor : "#555",
                                            color: scaleDegree ? "#fff" : "#888",
                                            boxShadow: scaleDegree ? `0 0 10px ${degreeColor}40` : 'none'
                                        }}
                                    >
                                        {scaleDegree || "?"}
                                    </div>
                                    <div className="text-[12px] font-bold text-gray-300 mt-1 whitespace-nowrap overflow-hidden text-clip w-full text-center">
                                        {detectedPitch || "---"}
                                    </div>

                                    {/* Exit Freeplay */}
                                    {onExit && (
                                        <Button size="icon" variant="ghost" className="absolute top-0 right-0 h-4 w-4 bg-red-900/40 hover:bg-red-900 z-20 m-1 rounded-sm border border-red-500/50" onClick={handleFreeplayExit} title="Exit">
                                            <X className="w-3 h-3 text-red-100" />
                                        </Button>
                                    )}
                                </div>

                                {/* Chord B */}
                                <button
                                    onClick={() => setActiveSlot(1)}
                                    className={`relative flex-1 flex justify-center items-center py-1 transition-all duration-300 gap-3 ${activeSlot === 1 ? 'bg-orange-900/30 ring-2 ring-inset ring-orange-500 shadow-[inset_0_0_15px_rgba(249,115,22,0.3)] z-10' : 'hover:bg-gray-800/50'
                                        } ${currentChordIndex === 1 && isPlaying ? 'bg-yellow-500/20' : ''}`}
                                >
                                    {currentChordIndex === 1 && isPlaying && (
                                        <div className="absolute top-1 right-2 text-[10px] font-black text-yellow-400 animate-pulse tracking-widest hidden md:block">
                                            PLAYING ◀
                                        </div>
                                    )}
                                    <div className={`text-2xl md:text-3xl font-black ${currentChordIndex === 1 && isPlaying ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]' :
                                        activeSlot === 1 ? 'text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]' : 'text-gray-500'
                                        }`}
                                    >
                                        {currentChordB}
                                    </div>
                                    <div className="flex flex-col items-start text-left">
                                        <h4 className="text-[10px] md:text-xs font-bold text-gray-400">Chord B</h4>
                                        <div className="text-[9px] md:text-[11px] font-black text-white">{getFormattedChordName(settings.key, currentChordB as ChordNumeral)}</div>
                                        <div className="text-[8px] md:text-[9px] font-mono text-gray-500">Tones: {getFormattedChordTones(currentChordB as ChordNumeral)}</div>
                                    </div>
                                </button>
                            </div>

                            {/* The Fretboard */}
                            <div className="flex-1 overflow-auto flex items-center justify-center p-2 relative min-h-0">
                                {/* We inject the active-chord-* CSS class dynamically to colorize the notes! */}
                                <div className={`w-full h-full max-w-[1200px] flex items-center justify-center notewalking-fretboard-override ${activeSlot === 0 ? 'active-chord-a' : 'active-chord-b'}`}>
                                    <Fretboard
                                        selectedNotes={fretboardNotes}
                                        degreeMap={degreeMap}
                                        showDegreeNumbers
                                        isEditable={true}
                                        onNoteClick={(string, fret) => {
                                            setRevealedFrets(prev => {
                                                const next = new Set(prev);
                                                const clickedKey = `${string}-${fret}`;
                                                // If the center is hidden, we reveal the area. If center is revealed, we hide the area.
                                                const isRevealing = !next.has(clickedKey);

                                                // Wide brush: +/- 1 string, +/- 2 frets
                                                for (let s = Math.max(1, string - 1); s <= Math.min(6, string + 1); s++) {
                                                    for (let f = Math.max(0, fret - 2); f <= Math.min(24, fret + 2); f++) {
                                                        const key = `${s}-${f}`;
                                                        if (isRevealing) {
                                                            next.add(key);
                                                        } else {
                                                            next.delete(key);
                                                        }
                                                    }
                                                }
                                                return next;
                                            });
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: Metronome (25% width) */}
                        <div className="w-1/4 min-w-[160px] max-w-[220px] flex-shrink-0 flex flex-col gap-1 overflow-hidden bg-card border rounded p-1">
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
                                    drumBeat={moduleConfig?.metronome?.drum_beat || false}
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
                                                    loop: newState.loop,
                                                    drum_beat: newState.drumBeat || false
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
                                        drumBeat: moduleConfig?.metronome?.drum_beat || false,
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

            {showPainter && (
                <FretboardPainter
                    sessionKey={settings.key}
                    chordPair={settings.selectedChords}
                    revealedFrets={revealedFrets}
                    aiFeedback={recording.feedback}
                    onSave={handlePainterDone}
                    onSkip={handlePainterDone}
                />
            )}
        </>
    );
}
