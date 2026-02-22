import { useState } from "react";
import { ChordNumeral, ChordProgressionSettings } from "@/types/chords";
import { getDiatonicChords } from "@/lib/chordProgression";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";
import { Checkbox } from "./ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";
import { Play, Pause, Volume2, Headphones, ArrowRightLeft } from "lucide-react";

interface ChordProgressionControlsProps {
    settings: ChordProgressionSettings;
    onSettingsChange: (settings: Partial<ChordProgressionSettings>) => void;
    isPlaying: boolean;
    onPlayPause: () => void;
    currentBpm: number;
}

const KEYS = [
    { value: "C", label: "C" },
    { value: "C#", label: "C♯ / D♭" },
    { value: "D", label: "D" },
    { value: "D#", label: "D♯ / E♭" },
    { value: "E", label: "E" },
    { value: "F", label: "F" },
    { value: "F#", label: "F♯ / G♭" },
    { value: "G", label: "G" },
    { value: "G#", label: "G♯ / A♭" },
    { value: "A", label: "A" },
    { value: "A#", label: "A♯ / B♭" },
    { value: "B", label: "B" },
];

export function ChordProgressionControls({
    settings,
    onSettingsChange,
    isPlaying,
    onPlayPause,
    currentBpm,
}: ChordProgressionControlsProps) {
    const diatonicChords = getDiatonicChords();
    const [activeSlot, setActiveSlot] = useState<0 | 1>(0);

    const handleChordSelect = (chord: ChordNumeral) => {
        // Ensure we always have exactly 2 chords
        let newChords = [...(settings.selectedChords || ["I", "IV"])];

        // Truncate to exactly 2 if an old config had more
        if (newChords.length > 2) {
            newChords = [newChords[0], newChords[1]];
        }

        // Fill if somehow less than 2
        if (newChords.length < 2) {
            newChords.push("I");
            if (newChords.length < 2) newChords.push("IV");
        }

        // Update the active slot
        newChords[activeSlot] = chord;

        onSettingsChange({ selectedChords: newChords });
    };

    const currentChordA = settings.selectedChords[0] || "I";
    const currentChordB = settings.selectedChords[1] || "IV";

    return (
        <div className="bg-card border border-border rounded-lg p-3 space-y-3 shadow-lg">
            {/* Header */}
            <div>
                <h2 className="text-lg font-bold mb-0.5">Notewalking</h2>
                <p className="text-xs text-muted-foreground">
                    Master the relationship between two chords
                </p>
            </div>

            {/* Headphone Warning */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 flex items-start gap-2">
                <Headphones className="w-4 h-4 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                    <p className="font-semibold text-yellow-700 dark:text-yellow-400">
                        Use headphones!
                    </p>
                    <p className="text-yellow-600 dark:text-yellow-500 text-[10px] mt-0.5">
                        Prevent drone from interfering with microphone
                    </p>
                </div>
            </div>

            {/* Key Selection */}
            <div className="space-y-1">
                <Label htmlFor="key-select" className="text-xs">Key</Label>
                <Select
                    value={settings.key}
                    onValueChange={(value) => onSettingsChange({ key: value })}
                >
                    <SelectTrigger id="key-select" className="w-full h-8">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {KEYS.map((key) => (
                            <SelectItem key={key.value} value={key.value}>
                                {key.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Two-Chord Slot Selection */}
            <div className="space-y-2">
                <Label className="text-xs">Chord Relationship</Label>
                <div className="flex items-center gap-2">
                    {/* Slot A */}
                    <div
                        className={`flex-1 p-3 rounded-lg border-2 cursor-pointer transition-all text-center ${activeSlot === 0
                            ? "border-primary bg-primary/10 ring-1 ring-primary/50"
                            : "border-border hover:border-primary/50"
                            }`}
                        onClick={() => setActiveSlot(0)}
                    >
                        <span className="text-xs text-muted-foreground block mb-1">Chord A</span>
                        <span className="text-2xl font-bold">{currentChordA}</span>
                    </div>

                    <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />

                    {/* Slot B */}
                    <div
                        className={`flex-1 p-3 rounded-lg border-2 cursor-pointer transition-all text-center ${activeSlot === 1
                            ? "border-primary bg-primary/10 ring-1 ring-primary/50"
                            : "border-border hover:border-primary/50"
                            }`}
                        onClick={() => setActiveSlot(1)}
                    >
                        <span className="text-xs text-muted-foreground block mb-1">Chord B</span>
                        <span className="text-2xl font-bold">{currentChordB}</span>
                    </div>
                </div>
            </div>

            {/* Diatonic Chord Grid (Selector) */}
            <div className="space-y-1.5 pt-2 border-t border-border">
                <Label className="text-xs">
                    Select Chord for <span className="text-primary font-bold">Slot {activeSlot === 0 ? "A" : "B"}</span>
                </Label>
                <div className="grid grid-cols-4 gap-1.5">
                    {diatonicChords.map((chord) => {
                        const isSelectedInCurrentSlot =
                            (activeSlot === 0 && currentChordA === chord) ||
                            (activeSlot === 1 && currentChordB === chord);

                        return (
                            <Button
                                key={chord}
                                variant={isSelectedInCurrentSlot ? "default" : "outline"}
                                className={`h-9 text-sm font-bold ${isSelectedInCurrentSlot ? "" : "hover:bg-primary/20 hover:text-primary"}`}
                                onClick={() => handleChordSelect(chord)}
                            >
                                {chord}
                            </Button>
                        );
                    })}
                </div>
            </div>

            {/* Measures Per Chord */}
            <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                    <Label htmlFor="measures-slider" className="text-xs">Measures per chord</Label>
                    <span className="text-xs font-semibold text-foreground">
                        {settings.measuresPerChord}
                    </span>
                </div>
                <Slider
                    id="measures-slider"
                    min={1}
                    max={16}
                    step={1}
                    value={[settings.measuresPerChord]}
                    onValueChange={([value]) =>
                        onSettingsChange({ measuresPerChord: value })
                    }
                    className="w-full"
                />
            </div>

            {/* Drone Volume */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="volume-slider" className="flex items-center gap-1.5 text-xs">
                        <Volume2 className="w-3 h-3" />
                        Drone volume
                    </Label>
                    <span className="text-xs font-semibold text-foreground">
                        {Math.round(settings.droneVolume * 100)}%
                    </span>
                </div>
                <Slider
                    id="volume-slider"
                    min={0}
                    max={100}
                    step={1}
                    value={[settings.droneVolume * 100]}
                    onValueChange={([value]) =>
                        onSettingsChange({ droneVolume: value / 100 })
                    }
                    className="w-full"
                />
            </div>

            {/* Drone Enable/Disable */}
            <div className="flex items-center space-x-2 bg-muted/50 rounded p-2">
                <Checkbox
                    id="drone-enabled"
                    checked={settings.droneEnabled}
                    onCheckedChange={(checked) =>
                        onSettingsChange({ droneEnabled: checked as boolean })
                    }
                />
                <Label htmlFor="drone-enabled" className="cursor-pointer flex-1 text-xs">
                    Enable drone note
                </Label>
            </div>

            {/* Fretboard Painter Enable/Disable */}
            <div className="flex items-center space-x-2 bg-muted/50 rounded p-2">
                <Checkbox
                    id="painter-enabled"
                    checked={settings.promptFretboardPainter}
                    onCheckedChange={(checked) =>
                        onSettingsChange({ promptFretboardPainter: checked as boolean })
                    }
                />
                <Label htmlFor="painter-enabled" className="cursor-pointer flex-1 text-xs">
                    Prompt Fretboard Painter at End
                </Label>
            </div>

            {/* Play/Pause Button */}
            <div className="pt-2 border-t border-border">
                <Button
                    onClick={onPlayPause}
                    className="w-full h-10 text-base font-semibold"
                    size="lg"
                >
                    {isPlaying ? (
                        <>
                            <Pause className="w-4 h-4 mr-2" />
                            Pause
                        </>
                    ) : (
                        <>
                            <Play className="w-4 h-4 mr-2" />
                            Start Practice
                        </>
                    )}
                </Button>
                <p className="text-[10px] text-center text-muted-foreground mt-1.5">
                    Current BPM: {currentBpm}
                </p>
            </div>
        </div>
    );
}
