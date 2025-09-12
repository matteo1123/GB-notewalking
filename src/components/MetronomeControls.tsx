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
        <Button
          variant="outline"
          onClick={onRestart}
          size="sm"
          className="h-8"
          title="Restart"
        >
          <Repeat className="h-4 w-4" />
        </Button>
        <Button
          variant={loop ? "secondary" : "outline"}
          onClick={() => onLoopChange(!loop)}
          size="sm"
          className="h-8"
          title="Loop"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

    </div>
  );
}
