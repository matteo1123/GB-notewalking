import { useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Play, Pause, Square, Repeat, RotateCcw } from "lucide-react";
import { useNumberInputControls } from "@/hooks/useNumberInputControls";
export type MetronomeMode = "regular" | "speed-trainer" | "progressive";
interface MetronomeControlsProps {
  compact?: boolean;
  mode: MetronomeMode;
  isPlaying: boolean;
  currentBpm: number;
  endBpm: number;
  measures: number;
  measuresPerBpmChange: number;
  onModeChange: (mode: MetronomeMode) => void;
  onPlayPause: () => void;
  onStop: () => void;
  onRestart: () => void;
  loop: boolean;
  onLoopChange: (loop: boolean) => void;
  onEndBpmChange: (bpm: number) => void;
  onMeasuresChange: (measures: number) => void;
  onMeasuresPerBpmChangeChange: (measures: number) => void;
  onCurrentBpmChange: (bpm: number) => void;
  progressiveStepBpm?: number;
  onProgressiveStepBpmChange?: (step: number) => void;
}
export function MetronomeControls({
  compact = false,
  mode,
  isPlaying,
  currentBpm,
  endBpm,
  measures,
  measuresPerBpmChange,
  onModeChange,
  onPlayPause,
  onStop,
  onRestart,
  loop,
  onLoopChange,
  onEndBpmChange,
  onMeasuresChange,
  onMeasuresPerBpmChangeChange,
  onCurrentBpmChange,
  progressiveStepBpm,
  onProgressiveStepBpmChange,
}: MetronomeControlsProps) {
  // Refs for input controls
  const endBpmRef = useRef<HTMLInputElement>(null);
  const incrementsRef = useRef<HTMLInputElement>(null);
  const measuresPerBpmRef = useRef<HTMLInputElement>(null);
  const progressiveStepRef = useRef<HTMLInputElement>(null);

  // Input controls hooks
  useNumberInputControls({
    inputRef: endBpmRef,
    value: endBpm,
    onChange: onEndBpmChange,
    min: 40,
    max: 300,
  });

  useNumberInputControls({
    inputRef: incrementsRef,
    value: measures,
    onChange: onMeasuresChange,
    min: 2,
    max: 100,
  });

  useNumberInputControls({
    inputRef: measuresPerBpmRef,
    value: measuresPerBpmChange,
    onChange: onMeasuresPerBpmChangeChange,
    min: 1,
    max: 20,
  });

  useNumberInputControls({
    inputRef: progressiveStepRef,
    value: progressiveStepBpm ?? 5,
    onChange: (value) => onProgressiveStepBpmChange?.(value),
    min: 1,
    max: 30,
  });

  return (
    <div
      className={cn(
        "space-y-2 text-xs",
        compact ? "flex items-center gap-2" : ""
      )}
    >
      {/* Mode Selection and Play/Stop */}
      <div className="flex items-center gap-2">
        <Select value={mode} onValueChange={onModeChange}>
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="regular">Regular</SelectItem>
            <SelectItem value="speed-trainer">Speed Trainer</SelectItem>
            <SelectItem value="progressive">Progressive</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={isPlaying ? "secondary" : "default"}
          onClick={onPlayPause}
          size="sm"
          className="h-8"
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
        <Button variant="outline" onClick={onRestart} size="sm" className="h-8">
          <Repeat className="h-4 w-4" />
        </Button>
        <Button
          variant={loop ? "secondary" : "outline"}
          onClick={() => onLoopChange(!loop)}
          size="sm"
          className="h-8"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Speed Trainer Controls */}
      {mode !== "regular" && !compact && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label>End BPM</Label>
            <Input
              ref={endBpmRef}
              type="number"
              value={endBpm}
              onChange={(e) => onEndBpmChange(Number(e.target.value))}
              min={40}
              max={300}
              className="h-8 text-center"
            />
          </div>
          <div className="space-y-1">
            <Label># Increments</Label>
            <Input
              ref={incrementsRef}
              type="number"
              value={measures}
              onChange={(e) =>
                onMeasuresChange(Math.max(2, Number(e.target.value)))
              }
              min={2}
              max={100}
              className="h-8 text-center"
            />
          </div>
          <div className="space-y-1">
            <Label>Measures/Inc</Label>
            <Input
              ref={measuresPerBpmRef}
              type="number"
              value={measuresPerBpmChange}
              onChange={(e) =>
                onMeasuresPerBpmChangeChange(Number(e.target.value))
              }
              min={1}
              max={20}
              className="h-8 text-center"
            />
          </div>
          {mode === "progressive" && (
            <div className="space-y-1">
              <Label>Step BPM</Label>
              <Input
                ref={progressiveStepRef}
                type="number"
                value={progressiveStepBpm ?? 5}
                onChange={(e) =>
                  onProgressiveStepBpmChange?.(
                    Math.max(1, Number(e.target.value))
                  )
                }
                min={1}
                max={30}
                className="h-8 text-center"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
