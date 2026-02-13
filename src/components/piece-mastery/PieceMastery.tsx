import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Play, Pause, ChevronLeft, ChevronRight, RotateCcw, ArrowLeft, Mic, Volume2, Music, Settings2, PlusCircle, Save, X, Timer } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { usePieceMastery, PracticePhase } from "@/hooks/usePieceMastery";
import { Piece } from "./types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface PieceMasteryProps {
    piece: Piece;
    onBack: () => void;
    // Exit callback for standalone/freeplay mode
    onExit?: () => void;
    // Persistence for loop settings
    moduleConfig?: { offset?: number; segmentSeconds?: number; pitchShift?: number; quickRecordMode?: boolean; recordDuration?: number };
    onConfigChange?: (config: { offset: number; segmentSeconds: number; pitchShift: number; quickRecordMode?: boolean; recordDuration?: number }) => void;
}

export function PieceMastery({ piece, onBack, onExit, moduleConfig, onConfigChange }: PieceMasteryProps) {
    const [autoAdvance, setAutoAdvance] = useState(false);
    const [notes, setNotes] = useState(piece.notes || "");
    const [quickRecordMode, setQuickRecordMode] = useState(moduleConfig?.quickRecordMode ?? false);
    const [recordDuration, setRecordDuration] = useState(moduleConfig?.recordDuration ?? 30);
    const { toast } = useToast();

    const { state, controls } = usePieceMastery({
        audioUrl: piece.audio_url,
        segmentSeconds: moduleConfig?.segmentSeconds || piece.segment_seconds || 5,
        initialOffset: moduleConfig?.offset || 0,
        initialPitchShift: moduleConfig?.pitchShift || 0,
        skipPiecePhase: quickRecordMode,
        recordDurationSeconds: recordDuration,
        onLoopComplete: (blockIndex, loopCount) => {
            // Optional: Auto-advance logic
            if (autoAdvance && loopCount >= 3) controls.nextBlock();
        }
    });

    const { phase, isPlaying, currentBlockIndex, loopRange, currentTime, duration, loopCount, offset, segmentSeconds, pitchShift } = state;

    // Calculate progress percentages for visualization
    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
    const loopStartPercent = duration > 0 ? (loopRange.start / duration) * 100 : 0;
    const loopWidthPercent = duration > 0 ? ((loopRange.end - loopRange.start) / duration) * 100 : 0;

    const getPhaseColor = (p: PracticePhase) => {
        switch (p) {
            case 'piece': return "text-blue-500 bg-blue-100 dark:bg-blue-900/30";
            case 'user': return "text-red-500 bg-red-100 dark:bg-red-900/30 animate-pulse";
            case 'playback': return "text-green-500 bg-green-100 dark:bg-green-900/30";
            default: return "text-muted-foreground bg-muted";
        }
    };

    const getPhaseLabel = (p: PracticePhase) => {
        switch (p) {
            case 'piece': return "Listen";
            case 'user': return "Your Turn";
            case 'playback': return "Review";
            default: return "Ready";
        }
    };

    const PhaseIcon = ({ p }: { p: PracticePhase }) => {
        switch (p) {
            case 'piece': return <Music className="w-12 h-12 mb-2" />;
            case 'user': return <Mic className="w-12 h-12 mb-2" />;
            case 'playback': return <Volume2 className="w-12 h-12 mb-2" />;
            default: return <Play className="w-12 h-12 mb-2" />;
        }
    };

    // Handle Note Appending
    const handleAddTimestampedNote = () => {
        const timestamp = formatTime(currentTime);
        const blockLabel = `Block ${currentBlockIndex + 1}`;
        const newNoteLine = `\n[${blockLabel} - ${timestamp}] `;
        setNotes(prev => prev + newNoteLine);
        toast({ title: "Timestamp added to notes" });
    };

    // Handle Range Slider Change
    // value[0] = offset (start)
    // value[1] = offset + segmentSeconds (end)
    const handleRangeChange = (values: number[]) => {
        if (values.length === 2) {
            const [newStart, newEnd] = values;
            const newOffset = Math.round(newStart);
            // Minimum 2 seconds to prevent thumb overlap issues
            const newDuration = Math.max(2, Math.round(newEnd - newStart));
            controls.setOffset(newOffset);
            controls.setSegmentSeconds(newDuration);
            // Persist config
            onConfigChange?.({
                offset: newOffset,
                segmentSeconds: newDuration,
                pitchShift: state.pitchShift
            });
        }
    };

    return (
        <div className="flex flex-col h-full max-h-screen">
            {/* Header */}
            <div className="flex items-center gap-4 p-4 border-b bg-card">
                <Button variant="ghost" size="icon" onClick={onBack}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <h2 className="text-xl font-bold">{piece.name}</h2>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                        Block {currentBlockIndex + 1} • {loopRange.label}
                        {loopCount > 0 && <Badge variant="secondary" className="text-xs">Loop {loopCount}</Badge>}
                    </p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <Button variant={autoAdvance ? "secondary" : "ghost"} size="sm" onClick={() => setAutoAdvance(!autoAdvance)} className="gap-2">
                        <RotateCcw className="w-4 h-4" />
                        Auto-Advance: {autoAdvance ? 'ON' : 'OFF'}
                    </Button>
                    {onExit && (
                        <Button size="sm" variant="ghost" className="gap-1" onClick={onExit}>
                            <X className="w-4 h-4" /> Exit
                        </Button>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">

                {/* Left: Visualization & Controls */}
                <div className="flex-1 p-6 flex flex-col justify-center items-center space-y-8 bg-background/50">

                    {/* Phase Indicator */}
                    <div className={cn(
                        "w-64 h-64 rounded-full flex flex-col items-center justify-center border-4 transition-all duration-300",
                        getPhaseColor(phase),
                        isPlaying ? "scale-105 shadow-xl" : "scale-100 opacity-80"
                    )}>
                        <PhaseIcon p={phase} />
                        <span className="text-3xl font-black uppercase tracking-wider">
                            {getPhaseLabel(phase)}
                        </span>
                        <div className="mt-2 text-sm font-mono opacity-80">
                            {formatTimeMinutes(currentTime)}
                        </div>
                    </div>

                    {/* Timeline Bar */}
                    <div className="w-full max-w-2xl space-y-6">
                        {/* Combined Offset & Size Slider */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                <span className="flex items-center gap-1"><Settings2 className="w-3 h-3" /> Loop Region</span>
                                <span>Start: {formatTime(offset)} • Size: {Math.round(segmentSeconds)}s</span>
                            </div>
                            <Slider
                                value={[offset, offset + segmentSeconds]}
                                min={0}
                                max={duration || 100} // Fallback if duration 0
                                step={1}
                                minStepsBetweenThumbs={1}
                                onValueChange={handleRangeChange}
                                className="py-2"
                            />
                        </div>

                        {/* Progress Container (Static Visualization) */}
                        <div className="relative h-12 bg-secondary rounded-lg overflow-hidden border">
                            {/* Loop Range Highlight */}
                            <div
                                className="absolute h-full bg-primary/10 border-x-2 border-primary/30"
                                style={{ left: `${loopStartPercent}%`, width: `${loopWidthPercent}%` }}
                            />

                            {/* Playhead */}
                            <div
                                className="absolute top-0 bottom-0 w-1 bg-primary z-10 transition-all duration-100"
                                style={{ left: `${progressPercent}%` }}
                            />

                            {/* Time Labels */}
                            <span className="absolute bottom-1 left-2 text-[10px] text-muted-foreground">0:00</span>
                            <span className="absolute bottom-1 right-2 text-[10px] text-muted-foreground">{formatTime(duration)}</span>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-6">
                        <Button variant="outline" size="icon" onClick={controls.prevBlock} disabled={currentBlockIndex === 0}>
                            <ChevronLeft className="h-6 w-6" />
                        </Button>

                        <Button
                            className={cn("h-20 w-20 rounded-full text-2xl shadow-lg hover:scale-105 transition-transform", isPlaying ? "bg-red-500 hover:bg-red-600" : "")}
                            onClick={controls.togglePlay}
                        >
                            {isPlaying ? <Pause className="h-8 w-8 text-white" /> : <Play className="h-8 w-8 ml-1" />}
                        </Button>

                        <Button variant="outline" size="icon" onClick={controls.nextBlock}>
                            <ChevronRight className="h-6 w-6" />
                        </Button>
                    </div>

                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => controls.setBlock(currentBlockIndex)}>
                            <RotateCcw className="h-4 w-4 mr-2" /> Restart Block
                        </Button>
                    </div>

                    {/* Pitch Shift Control */}
                    <div className="bg-muted/50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium flex items-center gap-2">
                                🎵 Pitch Shift
                            </span>
                            <Badge variant={pitchShift === 0 ? "secondary" : "default"}>
                                {pitchShift === 0 ? "Original" : `${pitchShift > 0 ? "+" : ""}${pitchShift} semitone${Math.abs(pitchShift) !== 1 ? "s" : ""}`}
                            </Badge>
                        </div>
                        <Slider
                            value={[pitchShift]}
                            min={-6}
                            max={6}
                            step={1}
                            onValueChange={([value]) => {
                                controls.setPitchShift(value);
                                onConfigChange?.({
                                    offset: state.offset,
                                    segmentSeconds: state.segmentSeconds,
                                    pitchShift: value
                                });
                            }}
                            className="py-2"
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                            <span>-6</span>
                            <span>0</span>
                            <span>+6</span>
                        </div>
                    </div>

                    {/* Quick Record Mode Control */}
                    <div className="bg-muted/50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Timer className="w-4 h-4" />
                                <Label htmlFor="quick-record-toggle" className="text-sm font-medium cursor-pointer">
                                    Quick Record
                                </Label>
                            </div>
                            <Switch
                                id="quick-record-toggle"
                                checked={quickRecordMode}
                                onCheckedChange={(checked) => {
                                    setQuickRecordMode(checked);
                                    onConfigChange?.({
                                        offset: state.offset,
                                        segmentSeconds: state.segmentSeconds,
                                        pitchShift: state.pitchShift,
                                        quickRecordMode: checked,
                                        recordDuration
                                    });
                                }}
                            />
                        </div>
                        {quickRecordMode && (
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Duration</span>
                                    <Badge variant="secondary">{recordDuration}s</Badge>
                                </div>
                                <Slider
                                    value={[recordDuration]}
                                    min={10}
                                    max={60}
                                    step={5}
                                    onValueChange={([value]) => {
                                        setRecordDuration(value);
                                        onConfigChange?.({
                                            offset: state.offset,
                                            segmentSeconds: state.segmentSeconds,
                                            pitchShift: state.pitchShift,
                                            quickRecordMode,
                                            recordDuration: value
                                        });
                                    }}
                                    className="py-2"
                                />
                                <div className="flex justify-between text-[10px] text-muted-foreground">
                                    <span>10s</span>
                                    <span>30s</span>
                                    <span>60s</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    Skip listening phase—just record and playback.
                                </p>
                            </div>
                        )}
                    </div>

                </div>

                {/* Right: Notes Panel */}
                <div className="md:w-96 border-l bg-card flex flex-col h-full">
                    <div className="p-4 border-b bg-muted/20 flex justify-between items-center">
                        <h3 className="font-semibold flex items-center gap-2">
                            <Music className="w-4 h-4" /> Notes & Chords
                        </h3>
                        <Button size="sm" variant="outline" onClick={handleAddTimestampedNote} title="Add timestamped note">
                            <PlusCircle className="w-4 h-4 mr-2" /> Add Note
                        </Button>
                    </div>

                    <div className="flex-1 p-4 overflow-hidden flex flex-col gap-2">
                        <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="flex-1 font-mono text-sm leading-relaxed resize-none bg-background/50"
                            placeholder="Add your tabs, chords, or notes here..."
                        />
                        <Button className="w-full" disabled={notes === piece.notes}>
                            <Save className="w-4 h-4 mr-2" /> Save Notes
                        </Button>
                    </div>
                </div>

            </div>
        </div>
    );
}

function formatTimeMinutes(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
}

function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}
