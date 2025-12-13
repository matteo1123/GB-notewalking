import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    EarTrainingSettings,
    EarTrainingProgress,
    EarTrainingMode,
} from "@/types/practice";
import { Play, Pause, SkipForward, SkipBack, RotateCcw, Ear, MousePointer, Mic } from "lucide-react";

interface EarTrainingControlsProps {
    settings: EarTrainingSettings;
    progress: EarTrainingProgress;
    isPlaying: boolean;
    isListening: boolean;
    waitingForClick?: boolean;
    maxLevel?: number; // Maximum level based on available notes
    onSettingsChange: (settings: Partial<EarTrainingSettings>) => void;
    onPlay: () => void;
    onNext: () => void;
    onPrevious: () => void;
    onReset: () => void;
    compact?: boolean;
}

export function EarTrainingControls({
    settings,
    progress,
    isPlaying,
    isListening,
    waitingForClick = false,
    maxLevel = 12,
    onSettingsChange,
    onPlay,
    onNext,
    onPrevious,
    onReset,
    compact = false,
}: EarTrainingControlsProps) {
    const [showSettings, setShowSettings] = useState(false);

    const modeInfo = {
        'sing-back': { label: 'Sing-Back', icon: Mic, desc: 'Listen and sing back' },
        'identify': { label: 'Identify', icon: MousePointer, desc: 'Click the note on fretboard' },
    };

    const accuracyColor = (accuracy: number) => {
        if (accuracy >= 80) return "text-green-500";
        if (accuracy >= 60) return "text-yellow-500";
        return "text-red-500";
    };

    if (compact) {
        return (
            <Card className="bg-card/50">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <Ear className="w-5 h-5 text-primary" />
                            <div className="text-sm">
                                <div className="font-semibold">Ear Training Mode</div>
                                <div className="text-xs text-muted-foreground">
                                    Phrase {progress.currentPhraseIndex + 1} of {progress.totalPhrases}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="text-sm text-center">
                                <div className="text-xs text-muted-foreground">Accuracy</div>
                                <div className={`font-bold ${accuracyColor(progress.overallAccuracy)}`}>
                                    {progress.overallAccuracy.toFixed(0)}%
                                </div>
                            </div>

                            <div className="flex gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onPrevious}
                                    disabled={progress.currentPhraseIndex === 0 || isPlaying || isListening}
                                    title="Previous phrase"
                                >
                                    <SkipBack className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant={isPlaying || isListening ? "destructive" : "default"}
                                    size="icon"
                                    onClick={onPlay}
                                    disabled={isPlaying || isListening}
                                    title="Play current phrase"
                                >
                                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onNext}
                                    disabled={progress.currentPhraseIndex >= progress.totalPhrases - 1 || isPlaying || isListening}
                                    title="Next phrase"
                                >
                                    <SkipForward className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onReset}
                                    disabled={isPlaying || isListening}
                                    title="Reset to first phrase"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowSettings(!showSettings)}
                        >
                            Settings
                        </Button>
                    </div>

                    {isListening && (
                        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-green-500">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            Listening... Sing the notes back!
                        </div>
                    )}

                    {waitingForClick && (
                        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-blue-500">
                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                            Click the note on the fretboard!
                        </div>
                    )}

                    {showSettings && (
                        <div className="mt-4 pt-4 border-t border-border space-y-4">
                            <div className="space-y-2">
                                <Label>Mode</Label>
                                <Tabs value={settings.mode} onValueChange={(value) => onSettingsChange({ mode: value as EarTrainingMode })}>
                                    <TabsList className="grid w-full grid-cols-2">
                                        <TabsTrigger value="sing-back" className="gap-2">
                                            <Mic className="w-4 h-4" />
                                            Sing-Back
                                        </TabsTrigger>
                                        <TabsTrigger value="identify" className="gap-2">
                                            <MousePointer className="w-4 h-4" />
                                            Identify
                                        </TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>

                            {settings.mode === 'sing-back' && (
                                <div className="space-y-2">
                                    <Label>Notes per phrase: {settings.notesPerPhrase}</Label>
                                    <Slider
                                        value={[settings.notesPerPhrase]}
                                        min={1}
                                        max={8}
                                        step={1}
                                        onValueChange={([value]) =>
                                            onSettingsChange({ notesPerPhrase: value })
                                        }
                                        disabled={isPlaying || isListening}
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Level: {settings.level} ({settings.level + 1} notes)</Label>
                                <Slider
                                    value={[settings.level]}
                                    min={1}
                                    max={maxLevel - 1}
                                    step={1}
                                    onValueChange={([value]) =>
                                        onSettingsChange({ level: value })
                                    }
                                    disabled={isPlaying || isListening}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Uses root + {settings.level} notes from this exercise only (max {maxLevel} notes available)
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label>Playback speed: {settings.playbackSpeed.toFixed(1)}x</Label>
                                <Slider
                                    value={[settings.playbackSpeed]}
                                    min={0.5}
                                    max={2}
                                    step={0.1}
                                    onValueChange={([value]) =>
                                        onSettingsChange({ playbackSpeed: value })
                                    }
                                    disabled={isPlaying || isListening}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Sensitivity: {(settings.sensitivity * 100).toFixed(0)}%</Label>
                                <Slider
                                    value={[settings.sensitivity]}
                                    min={0.3}
                                    max={1}
                                    step={0.1}
                                    onValueChange={([value]) =>
                                        onSettingsChange({ sensitivity: value })
                                    }
                                    disabled={isPlaying || isListening}
                                />
                            </div>

                            {settings.mode === 'sing-back' && (
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        id="show-feedback"
                                        checked={settings.showFeedback}
                                        onCheckedChange={(checked) =>
                                            onSettingsChange({ showFeedback: checked })
                                        }
                                        disabled={isPlaying || isListening}
                                    />
                                    <Label htmlFor="show-feedback">Show visual feedback</Label>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    }

    // Full version (non-compact)
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Ear className="w-5 h-5" />
                    Ear Training Mode
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Progress */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span>
                            Phrase {progress.currentPhraseIndex + 1} of {progress.totalPhrases}
                        </span>
                        <span className={accuracyColor(progress.overallAccuracy)}>
                            {progress.overallAccuracy.toFixed(0)}% Accuracy
                        </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                        <div
                            className="bg-primary rounded-full h-2 transition-all"
                            style={{
                                width: `${(progress.phrasesCompleted / progress.totalPhrases) * 100}%`,
                            }}
                        />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{progress.notesCorrect} / {progress.notesTotal} correct</span>
                        <span>Current: {progress.currentPhraseAccuracy.toFixed(0)}%</span>
                    </div>
                </div>

                {/* Playback controls */}
                <div className="flex justify-center gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={onPrevious}
                        disabled={progress.currentPhraseIndex === 0 || isPlaying || isListening}
                    >
                        <SkipBack className="w-4 h-4" />
                    </Button>
                    <Button
                        variant={isPlaying || isListening ? "destructive" : "default"}
                        onClick={onPlay}
                        disabled={isPlaying || isListening}
                        className="w-32"
                    >
                        {isPlaying ? (
                            <>
                                <Pause className="w-4 h-4 mr-2" />
                                Playing...
                            </>
                        ) : (
                            <>
                                <Play className="w-4 h-4 mr-2" />
                                Play Phrase
                            </>
                        )}
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={onNext}
                        disabled={progress.currentPhraseIndex >= progress.totalPhrases - 1 || isPlaying || isListening}
                    >
                        <SkipForward className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={onReset}
                        disabled={isPlaying || isListening}
                    >
                        <RotateCcw className="w-4 h-4" />
                    </Button>
                </div>

                {isListening && (
                    <div className="flex items-center justify-center gap-2 text-green-500 font-medium">
                        <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                        Listening... Sing the notes back!
                    </div>
                )}

                {waitingForClick && (
                    <div className="flex items-center justify-center gap-2 text-blue-500 font-medium">
                        <span className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></span>
                        Click the note on the fretboard!
                    </div>
                )}

                {/* Settings */}
                <div className="space-y-4 pt-4 border-t border-border">
                    <div className="space-y-2">
                        <Label>Mode</Label>
                        <Tabs value={settings.mode} onValueChange={(value) => onSettingsChange({ mode: value as EarTrainingMode })}>
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="sing-back" className="gap-2">
                                    <Mic className="w-4 h-4" />
                                    Sing-Back
                                </TabsTrigger>
                                <TabsTrigger value="identify" className="gap-2">
                                    <MousePointer className="w-4 h-4" />
                                    Identify
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                        <p className="text-xs text-muted-foreground">
                            {modeInfo[settings.mode].desc}
                        </p>
                    </div>

                    {settings.mode === 'sing-back' && (
                        <div className="space-y-2">
                            <Label>Notes per phrase: {settings.notesPerPhrase}</Label>
                            <Slider
                                value={[settings.notesPerPhrase]}
                                min={1}
                                max={8}
                                step={1}
                                onValueChange={([value]) =>
                                    onSettingsChange({ notesPerPhrase: value })
                                }
                                disabled={isPlaying || isListening}
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>Level: {settings.level} ({settings.level + 1} notes)</Label>
                        <Slider
                            value={[settings.level]}
                            min={1}
                            max={maxLevel - 1}
                            step={1}
                            onValueChange={([value]) =>
                                onSettingsChange({ level: value })
                            }
                            disabled={isPlaying || isListening}
                        />
                        <p className="text-xs text-muted-foreground">
                            Uses root + {settings.level} notes from this exercise only (max {maxLevel} notes available)
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label>Playback speed: {settings.playbackSpeed.toFixed(1)}x</Label>
                        <Slider
                            value={[settings.playbackSpeed]}
                            min={0.5}
                            max={2}
                            step={0.1}
                            onValueChange={([value]) =>
                                onSettingsChange({ playbackSpeed: value })
                            }
                            disabled={isPlaying || isListening}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Sensitivity: {(settings.sensitivity * 100).toFixed(0)}%</Label>
                        <Slider
                            value={[settings.sensitivity]}
                            min={0.3}
                            max={1}
                            step={0.1}
                            onValueChange={([value]) =>
                                onSettingsChange({ sensitivity: value })
                            }
                            disabled={isPlaying || isListening}
                        />
                    </div>

                    {settings.mode === 'sing-back' && (
                        <div className="flex items-center space-x-2">
                            <Switch
                                id="show-feedback-full"
                                checked={settings.showFeedback}
                                onCheckedChange={(checked) =>
                                    onSettingsChange({ showFeedback: checked })
                                }
                                disabled={isPlaying || isListening}
                            />
                            <Label htmlFor="show-feedback-full">Show visual feedback</Label>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

export default EarTrainingControls;
