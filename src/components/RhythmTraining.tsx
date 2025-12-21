import { useState, useCallback } from "react";
import { generateRhythmPattern, rhythmToNotation, type RhythmPattern } from "@/lib/rhythmGenerator";
import { useMetronome, MetronomeSettings } from "@/hooks/useMetronome";
import { MetronomeControls, MetronomeMode } from "./MetronomeControls";
import { BeatVisualizer } from "./BeatVisualizer";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Label } from "./ui/label";
import { SkipForward } from "lucide-react";

export function RhythmTraining() {
    const [level, setLevel] = useState(1);
    const [pattern, setPattern] = useState<RhythmPattern>(() => generateRhythmPattern(1));
    const [isPlaying, setIsPlaying] = useState(false);
    const [bpm, setBpm] = useState(80);
    const [mode, setMode] = useState<MetronomeMode>("regular");
    const [loop, setLoop] = useState(true);

    // Metronome setup
    const metronomeSettings: MetronomeSettings = {
        mode,
        startBpm: bpm,
        endBpm: bpm,
        measures: 999,
        onTick: (state) => {
            // TODO: Add click on rhythm pattern beats
        },
    };

    const metronome = useMetronome(metronomeSettings);

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
        }
    }, [isPlaying, metronome]);

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

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 flex flex-col p-3 min-h-0 overflow-hidden">
                {/* Header */}
                <div className="flex-shrink-0 flex justify-between items-center mb-3">
                    <div>
                        <h1 className="text-2xl font-bold">Rhythm Training</h1>
                        <p className="text-sm text-muted-foreground">
                            Practice increasingly complex rhythm patterns
                        </p>
                    </div>
                    <BeatVisualizer
                        currentBeat={metronome.state.currentBeat}
                        isPlaying={metronome.state.isPlaying}
                        currentBpm={metronome.state.isPlaying ? metronome.state.currentBpm : bpm}
                    />
                </div>

                {/* Pattern Display - takes remaining space */}
                <div className="flex-1 bg-card border border-border rounded-lg p-6 mb-3 flex flex-col items-center justify-center min-h-0">
                    <div className="text-center mb-4">
                        <h2 className="text-xl font-semibold mb-2">{pattern.name}</h2>
                        <p className="text-sm text-muted-foreground">{pattern.description}</p>
                    </div>

                    {/* Rhythm Notation */}
                    <div className="text-6xl font-mono mb-6">
                        {rhythmToNotation(pattern)}
                    </div>

                    <div className="text-sm text-muted-foreground">
                        {pattern.measures} measure{pattern.measures > 1 ? "s" : ""} • Level {pattern.level}
                    </div>
                </div>

                {/* Controls - fixed height at bottom */}
                <div className="flex-shrink-0 grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {/* Left: Level Control */}
                    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <Label>Difficulty Level</Label>
                                <span className="text-sm font-semibold">{level}</span>
                            </div>
                            <Slider
                                min={1}
                                max={20}
                                step={1}
                                value={[level]}
                                onValueChange={([value]) => handleLevelChange(value)}
                                className="w-full"
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
