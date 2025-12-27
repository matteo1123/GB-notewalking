import { useState, useCallback, useEffect } from "react";
import { generateRhythmPattern, patternToNotation, getSubdivisionLabels, type RhythmPattern } from "@/lib/rhythmGenerator";
import { useMetronome, MetronomeSettings } from "@/hooks/useMetronome";
import { useBpmControls } from "@/hooks/useBpmControls";
import { useAutoRecording } from "@/hooks/useAutoRecording";
import { supabase } from "@/integrations/supabase/client";
import { MetronomeControls, MetronomeMode } from "./MetronomeControls";
import { BeatVisualizer } from "./BeatVisualizer";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { SkipForward, ChevronLeft, ChevronRight, Check } from "lucide-react";

export function RhythmTraining() {
    const [level, setLevel] = useState(0);
    const [pattern, setPattern] = useState<RhythmPattern>(() => generateRhythmPattern(0));
    const [isPlaying, setIsPlaying] = useState(false);
    const [bpm, setBpm] = useState(60); // Start slower for rhythm practice
    const [mode, setMode] = useState<MetronomeMode>("regular");
    const [loop, setLoop] = useState(true);
    const [autoRecordEnabled, setAutoRecordEnabled] = useState(false);
    const [tickCount, setTickCount] = useState(0);

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

    // Auto-recording
    const recording = useAutoRecording({
        enabled: autoRecordEnabled && isPlaying,
        moduleType: 'rhythm',
        moduleConfig: {
            rhythm_level: level,
            duration_minutes: 5,
        },
    });

    // Metronome setup
    const metronomeSettings: MetronomeSettings = {
        mode,
        startBpm: bpm,
        endBpm: bpm,
        measures: 999,
        onTick: (state) => {
            setTickCount(prev => prev + 1);
            recording.handleTick(state.currentBeat + (state.currentMeasure - 1) * 4);
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
    }, []);

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
        <div className="flex flex-col h-full bpm-control-area">
            <div className="flex-1 flex flex-col p-3 min-h-0 overflow-hidden">
                {/* Header */}
                <div className="flex-shrink-0 flex justify-between items-center mb-3">
                    <div>
                        <h1 className="text-2xl font-bold">Rhythm Training</h1>
                        <p className="text-sm text-muted-foreground">
                            Master 16th note strumming patterns
                        </p>
                    </div>
                    <BeatVisualizer
                        currentBeat={metronome.state.currentBeat}
                        isPlaying={metronome.state.isPlaying}
                        currentBpm={metronome.state.isPlaying ? metronome.state.currentBpm : bpm}
                    />
                </div>

                {/* Recording Countdown */}
                {recording.countdown && (
                    <div className="flex-shrink-0 mb-2 bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-2 flex items-center justify-center">
                        <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 animate-pulse">
                            Recording in {recording.countdown} clicks...
                        </span>
                    </div>
                )}

                {/* Recording Indicator */}
                {recording.isRecording && (
                    <div className="flex-shrink-0 mb-2 bg-red-500/20 border border-red-500/50 rounded-lg p-2 flex items-center justify-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-sm font-semibold text-red-700 dark:text-red-400">
                            RECORDING
                        </span>
                    </div>
                )}

                {/* Pattern Display - takes remaining space */}
                <div className="flex-1 bg-card border border-border rounded-lg p-6 mb-3 flex flex-col items-center justify-center min-h-0 overflow-auto">
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-semibold mb-2">{pattern.name}</h2>
                        <p className="text-base text-muted-foreground">{pattern.description}</p>
                        <p className="text-sm text-muted-foreground mt-2">
                            Level {pattern.level} • {pattern.deviationCount} {pattern.deviationCount === 1 ? 'deviation' : 'deviations'}
                        </p>
                    </div>

                    {/* Subdivision Labels */}
                    <div className="text-xl font-mono text-muted-foreground mb-2 tracking-wider">
                        {getSubdivisionLabels()}
                    </div>

                    {/* Rhythm Notation */}
                    <div className="text-5xl font-mono mb-6 tracking-wider font-bold">
                        {patternToNotation(pattern)}
                    </div>

                    {/* Legend */}
                    <div className="flex gap-6 text-sm text-muted-foreground">
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

                {/* Controls - fixed height at bottom */}
                <div className="flex-shrink-0 grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {/* Left: Level Control */}
                    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
                        {/* Level slider with prev/next buttons */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <Label>Difficulty Level</Label>
                                <span className="text-sm font-semibold">{level}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={handlePreviousLevel}
                                    disabled={level === 0}
                                    className="h-8 w-8"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Slider
                                    min={0}
                                    max={50}
                                    step={1}
                                    value={[level]}
                                    onValueChange={([value]) => handleLevelChange(value)}
                                    className="flex-1"
                                />
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={handleNextLevel}
                                    className="h-8 w-8"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                {level === 0 ? "Start here: all 16 strums" : `${pattern.deviationCount} skip${pattern.deviationCount > 1 ? 's' : ''} to master`}
                            </p>
                        </div>

                        {/* Auto-Record Toggle */}
                        <div className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
                            <div className="flex items-center gap-2">
                                <Label htmlFor="auto-record-rhythm">Auto-Record</Label>
                                {recording.hasRecorded && (
                                    <Check className="w-4 h-4 text-green-500" />
                                )}
                            </div>
                            <Switch
                                id="auto-record-rhythm"
                                checked={autoRecordEnabled}
                                onCheckedChange={setAutoRecordEnabled}
                            />
                        </div>

                        <Button
                            onClick={handleNext}
                            variant="outline"
                            className="w-full"
                        >
                            <SkipForward className="w-4 h-4 mr-2" />
                            Generate New Pattern
                        </Button>
                    </div>

                    {/* Right: Metronome Controls */}
                    <div>
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
    );
}
