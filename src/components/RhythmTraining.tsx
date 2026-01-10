import { useState, useCallback, useEffect, useRef } from "react";
import { generateRhythmPattern, patternToNotation, getSubdivisionLabels, type RhythmPattern } from "@/lib/rhythmGenerator";
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
import { SkipForward, ChevronLeft, ChevronRight, Check, Mic, Settings, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { ForceLandscapeWrapper } from "./ForceLandscapeWrapper";

interface RhythmTrainingProps {
    autoStart?: boolean;
    sessionId?: string; // Practice session ID for linking logs
}

export function RhythmTraining({ autoStart = false, sessionId }: RhythmTrainingProps) {
    const [level, setLevel] = useState(0);
    const [pattern, setPattern] = useState<RhythmPattern>(() => generateRhythmPattern(0));
    const [isPlaying, setIsPlaying] = useState(false);
    const [bpm, setBpm] = useState(60); // Start slower for rhythm practice
    const [mode, setMode] = useState<MetronomeMode>("regular");
    const [loop, setLoop] = useState(true);
    const [drumBeat, setDrumBeat] = useState(false);
    const [tickCount, setTickCount] = useState(0);

    // Global auto-record setting from context
    const { autoRecordEnabled } = useAutoRecord();

    // Confirmation flow state
    const [hasConfirmed, setHasConfirmed] = useState(false);

    // Auto-switch settings
    const [autoSwitch, setAutoSwitch] = useState(false);
    const [switchMeasures, setSwitchMeasures] = useState(4);
    const [measureCount, setMeasureCount] = useState(0);
    const [settingsOpen, setSettingsOpen] = useState(false);

    // Track beats for auto-switch (4 beats per measure)
    const beatCountRef = useRef(0);

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
    });

    // Handle auto-start
    useEffect(() => {
        if (autoStart) {
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
    }, [autoStart]);

    // Metronome setup with auto-switch logic
    const metronomeSettings: MetronomeSettings = {
        mode,
        startBpm: bpm,
        endBpm: bpm,
        measures: 999,
        drumBeat,
        onTick: (state) => {
            setTickCount(prev => prev + 1);
            recording.handleTick(state.currentBeat + (state.currentMeasure - 1) * 4);

            // Auto-switch logic: count beats (4 beats per measure)
            if (autoSwitch && !hasConfirmed) {
                beatCountRef.current += 1;
                // Each measure = 4 beats, switch after switchMeasures * 4 beats
                if (beatCountRef.current >= switchMeasures * 4) {
                    beatCountRef.current = 0;
                    setMeasureCount(prev => prev + 1);
                    // Generate new pattern at same level
                    setPattern(generateRhythmPattern(level));
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

    // Generate new pattern for current level
    const generateNewPattern = useCallback(() => {
        const newPattern = generateRhythmPattern(level);
        setPattern(newPattern);
        setHasConfirmed(false);
        beatCountRef.current = 0;
    }, [level]);

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
        generateNewPattern();
    }, [generateNewPattern]);

    // Handle level change
    const handleLevelChange = useCallback((newLevel: number) => {
        setLevel(newLevel);
        setPattern(generateRhythmPattern(newLevel));
        setHasConfirmed(false);
        beatCountRef.current = 0;
    }, []);

    // Handle user confirmation - they played it correctly
    const handleConfirm = useCallback(() => {
        setHasConfirmed(true);
    }, []);

    // Handle "Next Rhythm" - move to harder level
    const handleNextRhythm = useCallback(() => {
        const newLevel = Math.min(level + 1, 15); // Cap at 15
        setLevel(newLevel);
        setPattern(generateRhythmPattern(newLevel));
        setHasConfirmed(false);
        beatCountRef.current = 0;
    }, [level]);

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

                    {/* RHYTHM NOTATION - THE MAIN CONTENT - 40%+ of screen on mobile */}
                    <div className="flex-1 bg-card border border-border rounded-lg p-1 sm:p-6 mb-1 sm:mb-3 flex flex-col items-center justify-center min-h-[40vh] sm:min-h-0">
                        {/* Pattern name - minimal on mobile */}
                        <div className="text-center mb-1 sm:mb-6">
                            <h2 className="text-xs sm:text-2xl font-semibold">{pattern.name}</h2>
                            <p className="text-xs sm:text-base text-muted-foreground hidden sm:block">{pattern.description}</p>
                        </div>

                        {/* Subdivision Labels - small on mobile */}
                        <div className="text-xs sm:text-xl font-mono text-muted-foreground mb-1 sm:mb-2 tracking-wide sm:tracking-wider">
                            {getSubdivisionLabels()}
                        </div>

                        {/* ========== RHYTHM NOTATION - MASSIVE ON MOBILE ========== */}
                        <div className="text-4xl sm:text-5xl font-mono mb-1 sm:mb-6 tracking-tight sm:tracking-wider font-bold leading-tight">
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
                                <span>Down strum</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">↑</span>
                                <span>Up strum</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">·</span>
                                <span>Skip (rest)</span>
                            </div>
                        </div>
                    </div>

                    {/* Controls - MINIMAL on mobile */}
                    <div className="flex-shrink-0 flex flex-col sm:grid sm:grid-cols-2 gap-1 sm:gap-3">
                        {/* Mobile: Just the essentials - stacked buttons */}
                        <div className="bg-card border border-border rounded-lg p-2 sm:p-4 space-y-2 sm:space-y-4">
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

                            {/* Settings - HIDDEN on mobile */}
                            <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen} className="hidden sm:block">
                                <CollapsibleTrigger asChild>
                                    <Button variant="ghost" className="w-full flex items-center justify-between p-2 h-auto">
                                        <div className="flex items-center gap-2">
                                            <Settings className="w-4 h-4" />
                                            <span className="text-sm">Settings</span>
                                        </div>
                                        <ChevronUp className={`w-4 h-4 transition-transform ${settingsOpen ? '' : 'rotate-180'}`} />
                                    </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="space-y-3 pt-2">
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
                                </CollapsibleContent>
                            </Collapsible>
                        </div>

                        {/* Metronome Controls */}
                        <div>
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
        </ForceLandscapeWrapper>
    );
}
