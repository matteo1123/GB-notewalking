import { useRef, useState, useEffect } from "react";
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
import { Play, Pause, Repeat, RotateCcw } from "lucide-react";
import { useNumberInputControls } from "@/hooks/useNumberInputControls";

export type MetronomeMode = "regular" | "speed-trainer" | "progressive";

export interface MetronomeSettings {
  mode: MetronomeMode;
  startBpm: number;
  endBpm: number;
  increments: number;
  measuresPerIncrement: number;
  progressiveStepBpm: number;
  loop: boolean;
}

interface MetronomeControlsProps {
  compact?: boolean;
  isPlaying: boolean;
  initialState?: Partial<MetronomeSettings>;
  onPlayPause: () => void;
  onRestart: () => void;
  onStateChange: (state: MetronomeSettings) => void;
}

export function MetronomeControls({
  compact = false,
  isPlaying,
  initialState = {},
  onPlayPause,
  onRestart,
  onStateChange,
}: MetronomeControlsProps) {
  const [
    {
      mode,
      startBpm,
      endBpm,
      increments,
      measuresPerIncrement,
      progressiveStepBpm,
      loop,
    },
    setState,
  ] = useState<MetronomeSettings>({
    mode: "regular",
    startBpm: 80,
    endBpm: 120,
    increments: 8,
    measuresPerIncrement: 4,
    progressiveStepBpm: 5,
    loop: false,
    ...initialState,
  });

  const endBpmRef = useRef<HTMLInputElement>(null);
  const incrementsRef = useRef<HTMLInputElement>(null);
  const measuresPerBpmRef = useRef<HTMLInputElement>(null);
  const progressiveStepRef = useRef<HTMLInputElement>(null);

  const updateState = (newState: Partial<MetronomeSettings>) => {
    setState((prevState) => ({ ...prevState, ...newState }));
  };

  useEffect(() => {
    onStateChange({
      mode,
      startBpm,
      endBpm,
      increments,
      measuresPerIncrement,
      progressiveStepBpm,
      loop,
    });
  }, [
    mode,
    startBpm,
    endBpm,
    increments,
    measuresPerIncrement,
    progressiveStepBpm,
    loop,
    onStateChange,
  ]);

  useNumberInputControls({
    inputRef: endBpmRef,
    value: endBpm,
    onChange: (value) => updateState({ endBpm: value }),
    min: 40,
    max: 300,
  });

  useNumberInputControls({
    inputRef: incrementsRef,
    value: increments,
    onChange: (value) => updateState({ increments: value }),
    min: 2,
    max: 100,
  });

  useNumberInputControls({
    inputRef: measuresPerBpmRef,
    value: measuresPerIncrement,
    onChange: (value) => updateState({ measuresPerIncrement: value }),
    min: 1,
    max: 20,
  });

  useNumberInputControls({
    inputRef: progressiveStepRef,
    value: progressiveStepBpm,
    onChange: (value) => updateState({ progressiveStepBpm: value }),
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
        <Select
          value={mode}
          onValueChange={(value) => updateState({ mode: value as MetronomeMode })}
        >
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
          onClick={() => updateState({ loop: !loop })}
          size="sm"
          className="h-8"
          title="Loop"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {mode !== "regular" && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="space-y-1">
            <Label>End BPM</Label>
            <Input
              ref={endBpmRef}
              type="number"
              value={endBpm}
              onChange={(e) => updateState({ endBpm: Number(e.target.value) })}
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
              value={increments}
              onChange={(e) =>
                updateState({ increments: Math.max(2, Number(e.target.value)) })
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
              value={measuresPerIncrement}
              onChange={(e) =>
                updateState({
                  measuresPerIncrement: Number(e.target.value),
                })
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
                value={progressiveStepBpm}
                onChange={(e) =>
                  updateState({
                    progressiveStepBpm: Math.max(1, Number(e.target.value)),
                  })
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
