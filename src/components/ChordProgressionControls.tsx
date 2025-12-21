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
import { Play, Pause, Volume2, Headphones } from "lucide-react";

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

    const handleChordToggle = (chord: ChordNumeral, checked: boolean) => {
        let newChords: ChordNumeral[];

        if (checked) {
            // Add chord in diatonic order
            newChords = [...settings.selectedChords, chord].sort(
                (a, b) => diatonicChords.indexOf(a) - diatonicChords.indexOf(b)
            );
        } else {
            newChords = settings.selectedChords.filter((c) => c !== chord);
        }

        // Ensure at least one chord is selected
        if (newChords.length === 0) {
            newChords = ["I"];
        }

        onSettingsChange({ selectedChords: newChords });
    };

    return (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4 shadow-lg">
            {/* Header */}
            <div>
                <h2 className="text-xl font-bold mb-1">Chord Progression Practice</h2>
                <p className="text-xs text-muted-foreground">
                    Practice scale degrees over different chord changes
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
            <div className="space-y-2">
                <Label htmlFor="key-select">Key</Label>
                <Select
                    value={settings.key}
                    onValueChange={(value) => onSettingsChange({ key: value })}
                >
                    <SelectTrigger id="key-select" className="w-full">
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

            {/* Chord Selection */}
            <div className="space-y-3">
                <Label>Select Chords</Label>
                <div className="grid grid-cols-4 gap-2">
                    {diatonicChords.map((chord) => {
                        const isChecked = settings.selectedChords.includes(chord);
                        return (
                            <div
                                key={chord}
                                className="flex items-center space-x-2 bg-muted/50 rounded p-2 hover:bg-muted transition-colors"
                            >
                                <Checkbox
                                    id={`chord-${chord}`}
                                    checked={isChecked}
                                    onCheckedChange={(checked) =>
                                        handleChordToggle(chord, checked as boolean)
                                    }
                                />
                                <Label
                                    htmlFor={`chord-${chord}`}
                                    className="text-sm font-medium cursor-pointer flex-1"
                                >
                                    {chord}
                                </Label>
                            </div>
                        );
                    })}
                </div>
                <p className="text-xs text-muted-foreground">
                    {settings.selectedChords.length === 1
                        ? "Single chord selected - play over one chord"
                        : `${settings.selectedChords.length} chords - will alternate every ${settings.measuresPerChord} measure(s)`}
                </p>
            </div>

            {/* Measures Per Chord */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label htmlFor="measures-slider">Measures per chord</Label>
                    <span className="text-sm font-semibold text-foreground">
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
                <p className="text-xs text-muted-foreground">
                    {settings.selectedChords.length > 1 &&
                        `Full cycle: ${settings.measuresPerChord * settings.selectedChords.length} measures`}
                </p>
            </div>

            {/* Drone Volume */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label htmlFor="volume-slider" className="flex items-center gap-2">
                        <Volume2 className="w-4 h-4" />
                        Drone volume
                    </Label>
                    <span className="text-sm font-semibold text-foreground">
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
            <div className="flex items-center space-x-2 bg-muted/50 rounded p-3">
                <Checkbox
                    id="drone-enabled"
                    checked={settings.droneEnabled}
                    onCheckedChange={(checked) =>
                        onSettingsChange({ droneEnabled: checked as boolean })
                    }
                />
                <Label htmlFor="drone-enabled" className="cursor-pointer flex-1">
                    Enable drone note
                </Label>
            </div>

            {/* Play/Pause Button */}
            <div className="pt-4 border-t border-border">
                <Button
                    onClick={onPlayPause}
                    className="w-full h-12 text-lg font-semibold"
                    size="lg"
                >
                    {isPlaying ? (
                        <>
                            <Pause className="w-5 h-5 mr-2" />
                            Pause
                        </>
                    ) : (
                        <>
                            <Play className="w-5 h-5 mr-2" />
                            Start Practice
                        </>
                    )}
                </Button>
                <p className="text-xs text-center text-muted-foreground mt-2">
                    Current BPM: {currentBpm}
                </p>
            </div>
        </div>
    );
}
