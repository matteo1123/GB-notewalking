import { useState, useCallback, useEffect, useRef } from "react";
import {
    generateRhythmPattern,
    patternToNotation,
    getSubdivisionLabels,
    getNextSystematicIndex,
    SYSTEMATIC_SEQUENCE_LENGTH,
    type RhythmPattern,
    type RhythmMode,
    type DeviationOptions,
} from "@/lib/rhythmGenerator";
import { useMetronome, MetronomeSettings } from "@/hooks/useMetronome";
import { useBpmControls } from "@/hooks/useBpmControls";
import { useAutoRecording } from "@/hooks/useAutoRecording";
import { useAutoRecord } from "@/contexts/AutoRecordContext";
import { supabase } from "@/integrations/supabase/client";
import { MetronomeControls, MetronomeMode } from "./MetronomeControls";
import { BeatVisualizer } from "./BeatVisualizer";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Checkbox } from "./ui/checkbox";
import { SkipForward, ChevronLeft, ChevronRight, Check, Mic, Settings, Shuffle, ListOrdered, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { ForceLandscapeWrapper } from "./ForceLandscapeWrapper";
import { RhythmModuleConfig } from "@/types/practice"; // Import config type

interface RhythmTrainingProps {
    autoStart?: boolean;
    sessionId?: string;
    // Exit callback for standalone/freeplay mode
    onExit?: () => void;
    // Optional configuration for bidirectional sync
    moduleConfig?: RhythmModuleConfig;
    onConfigChange?: (config: RhythmModuleConfig) => void;
}

export function RhythmTraining({ autoStart = false, sessionId, onExit, moduleConfig, onConfigChange }: RhythmTrainingProps) {
    // Rhythm mode and deviation types
    const [rhythmMode, setRhythmMode] = useState<RhythmMode>('random');
    const [deviationTypes, setDeviationTypes] = useState<DeviationOptions>({ skip: true, triplet: false });
    const [systematicIndex, setSystematicIndex] = useState(0);

    // Pattern state
    // Initialize level from config if available, otherwise 0
    const [level, setLevel] = useState(moduleConfig?.rhythm_level ?? 0);

    // Sync level from config prop updates
    useEffect(() => {
        if (moduleConfig?.rhythm_level !== undefined && moduleConfig.rhythm_level !== level) {
            setLevel(moduleConfig.rhythm_level);
        }
    }, [moduleConfig?.rhythm_level]);

    const [pattern, setPattern] = useState<RhythmPattern>(() => generateRhythmPattern({
        mode: 'random',
        deviationTypes: { skip: true, triplet: false },
        level: moduleConfig?.rhythm_level ?? 0,
    }));
    const [isPlaying, setIsPlaying] = useState(false);

    // Metronome state - init from config
    const [bpm, setBpm] = useState(moduleConfig?.metronome?.bpm ?? 60);
    const [metronomeMode, setMetronomeMode] = useState<MetronomeMode>((moduleConfig?.metronome?.mode as MetronomeMode) || "regular");
    const [loop, setLoop] = useState(moduleConfig?.metronome?.loop ?? true);
    const [drumBeat, setDrumBeat] = useState(moduleConfig?.metronome?.drum_beat ?? false);

    // Sync metronome from config prop updates
    useEffect(() => {
        if (moduleConfig?.metronome) {
            if (moduleConfig.metronome.bpm !== undefined && moduleConfig.metronome.bpm !== bpm) setBpm(moduleConfig.metronome.bpm);
            if (moduleConfig.metronome.mode && moduleConfig.metronome.mode !== metronomeMode) setMetronomeMode(moduleConfig.metronome.mode as MetronomeMode);
            if (moduleConfig.metronome.loop !== undefined && moduleConfig.metronome.loop !== loop) setLoop(moduleConfig.metronome.loop);
            if (moduleConfig.metronome.drum_beat !== undefined && moduleConfig.metronome.drum_beat !== drumBeat) setDrumBeat(moduleConfig.metronome.drum_beat);
        }
    }, [moduleConfig?.metronome]); // Deep dependency check might be needed if object ref changes, but accessors helps

    const [tickCount, setTickCount] = useState(0);


    // Global auto-record setting from context
    const { autoRecordEnabled } = useAutoRecord();

    // Confirmation flow state
    const [hasConfirmed, setHasConfirmed] = useState(false);

    // Auto-switch settings
    const [autoSwitch, setAutoSwitch] = useState(false);
    const [switchMeasures, setSwitchMeasures] = useState(4);
    const [changeBpm, setChangeBpm] = useState(false);  // Variance BPM feature
    const [practiceCount, setPracticeCount] = useState(0); // How many patterns practiced
    const [measureCount, setMeasureCount] = useState(0);
    const [settingsOpen, setSettingsOpen] = useState(false);

    // Track beats for auto-switch (4 beats per measure)
    const beatCountRef = useRef(0);

    // CRITICAL: Use refs for values accessed in onTick callback to avoid stale closures
    const autoSwitchRef = useRef(autoSwitch);
    const hasConfirmedRef = useRef(hasConfirmed);
    const switchMeasuresRef = useRef(switchMeasures);
    const changeBpmRef = useRef(changeBpm);
    const practiceCountRef = useRef(practiceCount);
    const rhythmModeRef = useRef(rhythmMode);
    const deviationTypesRef = useRef(deviationTypes);
    const levelRef = useRef(level);

    // Keep refs in sync with state
    useEffect(() => { autoSwitchRef.current = autoSwitch; }, [autoSwitch]);
    useEffect(() => { hasConfirmedRef.current = hasConfirmed; }, [hasConfirmed]);
    useEffect(() => { switchMeasuresRef.current = switchMeasures; }, [switchMeasures]);
    useEffect(() => { changeBpmRef.current = changeBpm; }, [changeBpm]);
    useEffect(() => { practiceCountRef.current = practiceCount; }, [practiceCount]);
    useEffect(() => { rhythmModeRef.current = rhythmMode; }, [rhythmMode]);
    useEffect(() => { deviationTypesRef.current = deviationTypes; }, [deviationTypes]);
    useEffect(() => { levelRef.current = level; }, [level]);

    // Reset beat counter when auto-switch is enabled or switchMeasures changes
    // This ensures auto-switch starts counting fresh immediately
    useEffect(() => {
        if (autoSwitch) {
            beatCountRef.current = 0;
        }
    }, [autoSwitch, switchMeasures]);

    // Auto-recording (uses global context setting)
    const recording = useAutoRecording({
        enabled: autoRecordEnabled && isPlaying,
        moduleType: 'rhythm',
        sessionId,
        moduleConfig: {
            module_type: 'rhythm',
            rhythm_level: level,
            duration_minutes: 5,
        },
        metronomeConfig: {
            mode: metronomeMode,
            bpm,
            drum_beat: drumBeat,
            auto_record: autoRecordEnabled,
        },
    });

    // Handle auto-start
    useEffect(() => {
        if (autoStart) {
            const timer = setTimeout(() => {
                if (metronome.audioContext && metronome.audioContext.state === 'suspended') {
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
    }, [autoStart]);

    // Metronome setup with auto-switch logic
    const metronomeSettings: MetronomeSettings = {
        mode: metronomeMode,
        startBpm: bpm,
        endBpm: bpm,
        measures: 999,
        drumBeat,
        onTick: (state) => {
            setTickCount(prev => prev + 1);
            recording.handleTick(state.currentBeat + (state.currentMeasure - 1) * 4);

            // Auto-switch logic: count beats (4 beats per measure)
            // Use refs to get current values (avoid stale closure)
            if (autoSwitchRef.current && !hasConfirmedRef.current) {
                beatCountRef.current += 1;
                // Each measure = 4 beats, switch after switchMeasures * 4 beats
                if (beatCountRef.current >= switchMeasuresRef.current * 4) {
                    beatCountRef.current = 0;
                    setMeasureCount(prev => prev + 1);
                    setPracticeCount(prev => prev + 1);

                    // Generate new random pattern at current level
                    setPattern(generateRhythmPattern({
                        mode: rhythmModeRef.current,
                        deviationTypes: deviationTypesRef.current,
                        level: levelRef.current,
                        systematicIndex: rhythmModeRef.current === 'systematic' ? (levelRef.current + 1) % 16 : undefined
                    }));

                    // If systematic mode, also advance the level
                    if (rhythmModeRef.current === 'systematic') {
                        setLevel(prev => (prev + 1) % 16);
                    }

                    // If BPM variance is enabled, randomize the tempo
                    if (changeBpmRef.current) {
                        // BPM range grows with practice count: 60 + random() * (practiceCount * 2)
                        const maxVariance = Math.min(practiceCountRef.current * 2, 80); // Cap at 80 BPM variance
                        const newBpm = 60 + Math.floor(Math.random() * (maxVariance + 1));
                        setBpm(newBpm);
                    }
                }
            }
        },
    };

    const metronome = useMetronome(metronomeSettings);

    // BPM change handler for scroll/touch/drag controls
    const handleBpmChange = useCallback(
        (newBpm: number) => {
            const wasPlaying = metronome.state.isPlaying;
            setBpm(newBpm);

            // Sync changes back to moduleConfig if provided
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

    // Global BPM adjustment controls (scroll, touch, drag, keyboard)
    useBpmControls({
        currentBpm: bpm,
        onBpmChange: handleBpmChange,
        isEnabled: true,
    });

    // Generate new pattern based on current settings
    const generateNewPattern = useCallback(() => {
        setPattern(generateRhythmPattern({
            mode: rhythmMode,
            deviationTypes,
            level: level,
            systematicIndex: level
        }));
        setHasConfirmed(false);
        beatCountRef.current = 0;
    }, [level, rhythmMode, deviationTypes]);

    // Handle play/pause
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

    // Handle next pattern
    const handleNext = useCallback(() => {
        if (rhythmMode === 'systematic') {
            // In systematic mode, next means next index
            const nextIndex = getNextSystematicIndex(level);
            setLevel(nextIndex);
            // generateNewPattern will be called by effect or we call it directly with new level
            // Better to just set level and let effect handle it, OR call generator directly
            setPattern(generateRhythmPattern({
                mode: 'systematic',
                deviationTypes,
                level: nextIndex,
                systematicIndex: nextIndex
            }));
            setHasConfirmed(false);
            beatCountRef.current = 0;
        } else {
            generateNewPattern();
        }
    }, [rhythmMode, level, deviationTypes, generateNewPattern]);

    // Handle level change
    const handleLevelChange = useCallback((newLevel: number) => {
        setLevel(newLevel);

        // Sync level change back to config
        if (onConfigChange && moduleConfig) {
            onConfigChange({
                ...moduleConfig,
                rhythm_level: newLevel
            });
        }

        setPattern(generateRhythmPattern({
            mode: rhythmMode,
            deviationTypes,
            level: newLevel,
            systematicIndex: newLevel
        }));
        setHasConfirmed(false);
        beatCountRef.current = 0;
    }, [rhythmMode, deviationTypes, onConfigChange, moduleConfig]);

    // Handle settings changes
    const toggleMode = () => {
        const newMode = rhythmMode === 'random' ? 'systematic' : 'random';
        setRhythmMode(newMode);
        // Reset level to 0 when switching modes for clarity
        setLevel(0);
        setPattern(generateRhythmPattern({
            mode: newMode,
            deviationTypes,
            level: 0,
            systematicIndex: 0
        }));
    };

    const toggleDeviation = (type: 'skip' | 'triplet') => {
        const newTypes = { ...deviationTypes, [type]: !deviationTypes[type] };
        // Ensure at least one is selected
        if (!newTypes.skip && !newTypes.triplet) return;

        setDeviationTypes(newTypes);
        setPattern(generateRhythmPattern({
            mode: rhythmMode,
            deviationTypes: newTypes,
            level,
            systematicIndex: level
        }));
    };


    // Handle user confirmation - they played it correctly
    const handleConfirm = useCallback(() => {
        setHasConfirmed(true);
    }, []);

    // Handle "Next Rhythm" - move to harder level
    const handleNextRhythm = useCallback(() => {
        const newLevel = Math.min(level + 1, 15); // Cap at 15
        handleLevelChange(newLevel);
    }, [level, handleLevelChange]);

    // Handle recording via the existing auto-recording hook
    const handleRecord = useCallback(() => {
        recording.startManualRecording();
    }, [recording]);

    // Navigate levels
    const handlePreviousLevel = useCallback(() => {
        if (level > 0) {
            handleLevelChange(level - 1);
        }
    }, [level, handleLevelChange]);

    const handleNextLevel = useCallback(() => {
        handleLevelChange(level + 1);
    }, [level, handleLevelChange]);

    return (
        <ForceLandscapeWrapper>
            <div className="flex flex-col h-full bpm-control-area">
                <div className="flex-1 flex flex-col p-2 sm:p-3 min-h-0 overflow-hidden">
                    {/* Header - ULTRA compact on mobile, hide subtitle */}
                    <div className="flex-shrink-0 flex justify-between items-center mb-1 sm:mb-3">
                        <div className="flex items-center gap-2">
                            <h1 className="text-sm sm:text-2xl font-bold">Rhythm</h1>
                            <span className="text-xs bg-muted px-1.5 py-0.5 rounded">L{level}</span>
                        </div>

                        {/* Center: Session controls or Exit button */}
                        <div className="flex items-center gap-2">
                            {onExit && (
                                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1" onClick={onExit}>
                                    <X className="w-3 h-3" /> Exit
                                </Button>
                            )}
                        </div>

                        <BeatVisualizer
                            currentBeat={metronome.state.currentBeat}
                            isPlaying={metronome.state.isPlaying}
                            currentBpm={metronome.state.isPlaying ? metronome.state.currentBpm : bpm}
                        />
                    </div>

                    {/* Recording indicators - hidden on mobile to save space */}
                    {recording.countdown && (
                        <div className="hidden sm:flex flex-shrink-0 mb-2 bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-2 items-center justify-center">
                            <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 animate-pulse">
                                Recording in {recording.countdown} clicks...
                            </span>
                        </div>
                    )}

                    {recording.isRecording && (
                        <div className="flex-shrink-0 mb-1 sm:mb-2 bg-red-500/20 border border-red-500/50 rounded-lg p-1 sm:p-2 flex items-center justify-center gap-1 sm:gap-2">
                            <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-xs sm:text-sm font-semibold text-red-700 dark:text-red-400">
                                REC
                            </span>
                        </div>
                    )}

                    {/* RHYTHM NOTATION - THE MAIN CONTENT - Flexible height instead of forced */}
                    <div className="flex-1 bg-card border border-border rounded-lg p-1 sm:p-6 mb-1 flex flex-col items-center justify-center min-h-0">
                        {/* Pattern name - minimal on mobile */}
                        <div className="text-center mb-1 sm:mb-6">
                            <h2 className="text-xs sm:text-2xl font-semibold">{pattern.name}</h2>
                            {/* Description removed as requested */}
                        </div>

                        {/* Subdivision Labels - small on mobile */}
                        <div className="text-xs sm:text-xl font-mono text-muted-foreground mb-1 sm:mb-2 tracking-wide sm:tracking-wider">
                            {getSubdivisionLabels()}
                        </div>

                        {/* ========== RHYTHM NOTATION - MASSIVE ON MOBILE ========== */}
                        <div className="text-2xl sm:text-5xl font-mono mb-1 sm:mb-6 tracking-tight sm:tracking-wider font-bold leading-tight">
                            {patternToNotation(pattern)}
                        </div>

                        {/* Deviations count - compact mobile */}
                        <p className="text-xs text-muted-foreground">
                            {pattern.deviationCount} {pattern.deviationCount === 1 ? 'skip' : 'skips'}
                        </p>

                        {/* Legend - hide on mobile */}
                        <div className="hidden sm:flex gap-6 text-sm text-muted-foreground mt-4">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">↓</span>
                                Down strum
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">↑</span>
                                Up strum
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">·</span>
                                Skip (rest)
                            </div>
                        </div>
                    </div>

                    {/* Controls - MINIMAL on mobile */}
                    <div className="flex-shrink-0 flex flex-col sm:grid sm:grid-cols-2 gap-1 sm:gap-3">
                        {/* Mobile: Just the essentials - stacked buttons */}
                        <div className="bg-card border border-border rounded-lg p-2 sm:p-4 space-y-2 sm:space-y-4">
                            {/* Mode & Deviation Toggles */}
                            <div className="flex flex-col gap-2">
                                {/* Mode Toggle */}
                                <div className="flex bg-muted/30 p-1 rounded-lg">
                                    <Button
                                        variant={rhythmMode === 'systematic' ? 'default' : 'ghost'}
                                        size="sm"
                                        onClick={() => rhythmMode !== 'systematic' && toggleMode()}
                                        className="flex-1 h-7 text-xs"
                                    >
                                        <ListOrdered className="w-3 h-3 mr-1" />
                                        Systematic
                                    </Button>
                                    <Button
                                        variant={rhythmMode === 'random' ? 'default' : 'ghost'}
                                        size="sm"
                                        onClick={() => rhythmMode !== 'random' && toggleMode()}
                                        className="flex-1 h-7 text-xs"
                                    >
                                        <Shuffle className="w-3 h-3 mr-1" />
                                        Random
                                    </Button>
                                </div>

                                {/* Deviation Types */}
                                <div className="flex items-center justify-between px-1">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="dev-triplet"
                                            checked={deviationTypes.triplet}
                                            onCheckedChange={() => toggleDeviation('triplet')}
                                        />
                                        <Label htmlFor="dev-triplet" className="text-xs sm:text-sm cursor-pointer">Triplet</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="dev-skip"
                                            checked={deviationTypes.skip}
                                            onCheckedChange={() => toggleDeviation('skip')}
                                        />
                                        <Label htmlFor="dev-skip" className="text-xs sm:text-sm cursor-pointer">Skip</Label>
                                    </div>
                                </div>
                            </div>

                            <div className="h-px bg-border" />
                            {/* Level nav - inline on mobile */}
                            <div className="flex items-center gap-1 sm:gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={handlePreviousLevel}
                                    disabled={level === 0}
                                    className="h-7 w-7 sm:h-8 sm:w-8"
                                >
                                    <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                                </Button>
                                {/* Hide slider on mobile, show inline level */}
                                <div className="flex-1 hidden sm:block">
                                    <Slider
                                        min={0}
                                        max={15}
                                        step={1}
                                        value={[level]}
                                        onValueChange={([value]) => handleLevelChange(value)}
                                    />
                                </div>
                                <span className="flex-1 text-center text-xs sm:hidden">Level {level}/15</span>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={handleNextLevel}
                                    disabled={level >= 15}
                                    className="h-7 w-7 sm:h-8 sm:w-8"
                                >
                                    <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                                </Button>
                            </div>

                            {/* Confirmation Flow - compact on mobile */}
                            {!hasConfirmed ? (
                                <div className="flex gap-1 sm:flex-col sm:gap-2">
                                    <Button
                                        onClick={handleConfirm}
                                        className="flex-1 bg-green-600 hover:bg-green-700 h-8 sm:h-10 text-xs sm:text-sm"
                                    >
                                        <Check className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                                        <span className="hidden sm:inline">I played it correctly!</span>
                                        <span className="sm:hidden">✓ Correct</span>
                                    </Button>
                                    <Button
                                        onClick={handleNext}
                                        variant="outline"
                                        className="flex-1 h-8 sm:h-10 text-xs sm:text-sm"
                                    >
                                        <SkipForward className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                                        <span className="hidden sm:inline">Generate New</span>
                                        <span className="sm:hidden">New</span>
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-1 sm:space-y-2">
                                    <div className="hidden sm:block bg-green-500/20 border border-green-500/50 rounded-lg p-2 text-center">
                                        <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                                            ✓ Great job! What's next?
                                        </span>
                                    </div>
                                    <div className="flex gap-1 sm:grid sm:grid-cols-2 sm:gap-2">
                                        <Button
                                            onClick={handleRecord}
                                            variant="outline"
                                            className="flex-1 border-red-500/50 hover:bg-red-500/10 h-8 sm:h-10 text-xs sm:text-sm"
                                            disabled={recording.isRecording}
                                        >
                                            <Mic className="w-3 h-3 sm:w-4 sm:h-4 mr-1 text-red-500" />
                                            Rec
                                        </Button>
                                        <Button
                                            onClick={handleNextRhythm}
                                            className="flex-1 bg-blue-600 hover:bg-blue-700 h-8 sm:h-10 text-xs sm:text-sm"
                                        >
                                            <SkipForward className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Settings - Floating Dialog (works on all devices) */}
                            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="w-full flex items-center justify-center gap-2 h-8">
                                        <Settings className="w-4 h-4" />
                                        <span className="text-xs sm:text-sm">Settings</span>
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-sm">
                                    <DialogHeader>
                                        <DialogTitle>Rhythm Settings</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 pt-2">
                                        <div className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
                                            <div>
                                                <Label htmlFor="auto-switch">Auto-Switch</Label>
                                                <p className="text-xs text-muted-foreground">Auto-advance to new pattern</p>
                                            </div>
                                            <Switch id="auto-switch" checked={autoSwitch} onCheckedChange={setAutoSwitch} />
                                        </div>
                                        {autoSwitch && (
                                            <div className="bg-muted/30 rounded-lg p-3">
                                                <div className="flex items-center justify-between mb-2">
                                                    <Label>Measures between switches</Label>
                                                    <span className="text-sm font-semibold">{switchMeasures}</span>
                                                </div>
                                                <Slider
                                                    min={1}
                                                    max={8}
                                                    step={1}
                                                    value={[switchMeasures]}
                                                    onValueChange={([value]) => setSwitchMeasures(value)}
                                                />
                                            </div>
                                        )}
                                        {autoSwitch && (
                                            <div className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
                                                <div>
                                                    <Label htmlFor="change-bpm">Change BPM</Label>
                                                    <p className="text-xs text-muted-foreground">
                                                        Randomize tempo each switch
                                                        {practiceCount > 0 && (
                                                            <span className="block">Range: 60-{60 + Math.min(practiceCount * 2, 80)} BPM</span>
                                                        )}
                                                    </p>
                                                </div>
                                                <Switch id="change-bpm" checked={changeBpm} onCheckedChange={setChangeBpm} />
                                            </div>
                                        )}
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>

                        {/* Metronome Controls */}
                        <div>
                            <MetronomeControls
                                isPlaying={isPlaying}
                                onPlayPause={handlePlayPause}
                                onRestart={handleRestart}
                                drumBeat={drumBeat}
                                onStateChange={(newState) => {
                                    setMetronomeMode(newState.mode);
                                    setBpm(newState.startBpm);
                                    setLoop(newState.loop);
                                    if (newState.drumBeat !== undefined) setDrumBeat(newState.drumBeat);

                                    // Sync changes back to moduleConfig if provided
                                    if (onConfigChange && moduleConfig) {
                                        onConfigChange({
                                            ...moduleConfig,
                                            metronome: {
                                                ...(moduleConfig.metronome || { mode: 'regular', bpm: 60, drum_beat: false, auto_record: false }),
                                                mode: newState.mode,
                                                bpm: newState.startBpm,
                                                loop: newState.loop,
                                                drum_beat: newState.drumBeat,
                                                // Preserve other fields if they exist in state, but simpler to just spread current moduleConfig.metronome
                                                // However moduleConfig.metronome might be partial.
                                                // Let's trust that the ModulePreview passes a full default config usually.
                                                increments: newState.increments,
                                                measures_per_increment: newState.measuresPerIncrement,
                                                step_bpm: newState.progressiveStepBpm
                                            }
                                        });
                                    }
                                }}
                                initialState={{
                                    mode: metronomeMode,
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
        </ForceLandscapeWrapper>
    );
}
