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
import { Play, Pause, Repeat, RotateCcw, Mic, Drum } from "lucide-react";
import { useNumberInputControls } from "@/hooks/useNumberInputControls";
import { useAutoRecord } from "@/contexts/AutoRecordContext";

export type MetronomeMode = "regular" | "speed-trainer" | "progressive";

export interface MetronomeSettings {
  mode: MetronomeMode;
  startBpm: number;
  endBpm: number;
  increments: number;
  measuresPerIncrement: number;
  progressiveStepBpm: number;
  loop: boolean;
  drumBeat?: boolean; // Play kick on 1, snare on 3
}

interface MetronomeControlsProps {
  compact?: boolean;
  isPlaying: boolean;
  initialState?: Partial<MetronomeSettings>;
  drumBeat?: boolean;
  onPlayPause: () => void;
  onRestart: () => void;
  onStateChange: (state: MetronomeSettings) => void;
}

export function MetronomeControls({
  compact = false,
  isPlaying,
  initialState = {},
  drumBeat: drumBeatProp,
  onPlayPause,
  onRestart,
  onStateChange,
}: MetronomeControlsProps) {
  // Auto-record context
  const { autoRecordEnabled, setAutoRecordEnabled, isPremium } = useAutoRecord();

  // Provide sensible defaults
  const defaultStartBpm = initialState.startBpm ?? 80;
  const defaultEndBpm = initialState.endBpm ?? (initialState.mode !== "regular" ? defaultStartBpm + 40 : defaultStartBpm);

  const [
    {
      mode,
      startBpm,
      endBpm,
      increments,
      measuresPerIncrement,
      progressiveStepBpm,
      loop,
      drumBeat,
    },
    setState,
  ] = useState<MetronomeSettings>({
    mode: initialState.mode ?? "regular",
    startBpm: defaultStartBpm,
    endBpm: defaultEndBpm,
    increments: initialState.increments ?? 8,
    measuresPerIncrement: initialState.measuresPerIncrement ?? 4,
    progressiveStepBpm: initialState.progressiveStepBpm ?? 5,
    loop: initialState.loop ?? false,
    drumBeat: initialState.drumBeat ?? false,
  });

  const syncingFromPropsRef = useRef(false);

  const endBpmRef = useRef<HTMLInputElement>(null);
  const incrementsRef = useRef<HTMLInputElement>(null);
  const measuresPerBpmRef = useRef<HTMLInputElement>(null);
  const progressiveStepRef = useRef<HTMLInputElement>(null);

  const updateState = (newState: Partial<MetronomeSettings>) => {
    setState((prevState) => {
      const updated = { ...prevState, ...newState };

      // Auto-adjust endBpm when switching from regular mode
      if (newState.mode && newState.mode !== "regular" && prevState.mode === "regular") {
        // If switching to speed trainer or progressive, ensure endBpm is higher than startBpm
        if (updated.endBpm <= updated.startBpm) {
          updated.endBpm = updated.startBpm + 40;
        }
      }

      // If switching to regular mode, sync endBpm with startBpm
      if (newState.mode === "regular") {
        updated.endBpm = updated.startBpm;
      }

      return updated;
    });
  };

  useEffect(() => {
    setState((prevState) => {
      let changed = false;
      const nextState: MetronomeSettings = { ...prevState };

      if (initialState.mode !== undefined && initialState.mode !== prevState.mode) {
        nextState.mode = initialState.mode as MetronomeMode;
        changed = true;
      }
      if (
        initialState.startBpm !== undefined &&
        initialState.startBpm !== prevState.startBpm
      ) {
        nextState.startBpm = initialState.startBpm;
        changed = true;
      }
      if (initialState.endBpm !== undefined && initialState.endBpm !== prevState.endBpm) {
        nextState.endBpm = initialState.endBpm;
        changed = true;
      }
      if (
        initialState.increments !== undefined &&
        initialState.increments !== prevState.increments
      ) {
        nextState.increments = initialState.increments;
        changed = true;
      }
      if (
        initialState.measuresPerIncrement !== undefined &&
        initialState.measuresPerIncrement !== prevState.measuresPerIncrement
      ) {
        nextState.measuresPerIncrement = initialState.measuresPerIncrement;
        changed = true;
      }
      if (
        initialState.progressiveStepBpm !== undefined &&
        initialState.progressiveStepBpm !== prevState.progressiveStepBpm
      ) {
        nextState.progressiveStepBpm = initialState.progressiveStepBpm;
        changed = true;
      }
      if (initialState.loop !== undefined && initialState.loop !== prevState.loop) {
        nextState.loop = initialState.loop;
        changed = true;
      }
      if (initialState.drumBeat !== undefined && initialState.drumBeat !== prevState.drumBeat) {
        nextState.drumBeat = initialState.drumBeat;
        changed = true;
      }

      if (changed) {
        syncingFromPropsRef.current = true;
        return nextState;
      }

      return prevState;
    });
  }, [
    initialState.mode,
    initialState.startBpm,
    initialState.endBpm,
    initialState.increments,
    initialState.measuresPerIncrement,
    initialState.progressiveStepBpm,
    initialState.loop,
    initialState.drumBeat,
  ]);

  // Sync drumBeatProp when parent controls it directly
  useEffect(() => {
    if (drumBeatProp !== undefined && drumBeatProp !== drumBeat) {
      updateState({ drumBeat: drumBeatProp });
    }
  }, [drumBeatProp]);

  useEffect(() => {
    if (syncingFromPropsRef.current) {
      syncingFromPropsRef.current = false;
      return;
    }

    onStateChange({
      mode,
      startBpm,
      endBpm,
      increments,
      measuresPerIncrement,
      progressiveStepBpm,
      loop,
      drumBeat,
    });
  }, [
    mode,
    startBpm,
    endBpm,
    increments,
    measuresPerIncrement,
    progressiveStepBpm,
    loop,
    drumBeat,
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
    <div className={cn("space-y-2", compact ? "w-full" : "")}>
      {/* Mode Selection and Play/Stop */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Select
          value={mode}
          onValueChange={(value) => updateState({ mode: value as MetronomeMode })}
        >
          <SelectTrigger className={cn("h-8 text-xs", compact ? "w-28" : "w-full")} data-testid="metronome-mode-select">
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
          className="h-8 px-2"
          data-testid="metronome-start-button"
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
          className="h-8 px-2"
          title="Restart"
          data-testid="metronome-restart-button"
        >
          <Repeat className="h-4 w-4" />
        </Button>
        <Button
          variant={loop ? "secondary" : "outline"}
          onClick={() => updateState({ loop: !loop })}
          size="sm"
          className="h-8 px-2"
          title="Loop"
          data-testid="metronome-loop-button"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        {/* Drum Beat Toggle */}
        <Button
          variant={drumBeat ? "default" : "outline"}
          onClick={() => updateState({ drumBeat: !drumBeat })}
          size="sm"
          className={cn("h-8 px-2", drumBeat && "bg-orange-500 hover:bg-orange-600")}
          title={drumBeat ? "Drum Beat: ON (Kick on 1, Snare on 3)" : "Drum Beat: OFF (click to enable)"}
          data-testid="metronome-drum-button"
        >
          <Drum className={cn("h-4 w-4", drumBeat && "text-white")} />
        </Button>
        {/* Auto-Record Toggle - Premium Only */}
        {isPremium && (
          <Button
            variant={autoRecordEnabled ? "default" : "outline"}
            onClick={() => setAutoRecordEnabled(!autoRecordEnabled)}
            size="sm"
            className={cn("h-8 px-2", autoRecordEnabled && "bg-red-500 hover:bg-red-600")}
            title={autoRecordEnabled ? "Auto-Record: ON (click to disable)" : "Auto-Record: OFF (click to enable)"}
            data-testid="metronome-record-button"
          >
            <Mic className={cn("h-4 w-4", autoRecordEnabled && "text-white")} />
          </Button>
        )}
      </div>

      {mode !== "regular" && (
        <div className={cn(
          "grid gap-1.5 text-xs",
          compact ? "grid-cols-4 items-end" : "grid-cols-2 gap-2"
        )} data-testid="metronome-advanced-fields">
          <div className="space-y-0.5">
            <Label className="text-[10px]">End BPM</Label>
            <Input
              ref={endBpmRef}
              type="number"
              value={endBpm}
              onChange={(e) => updateState({ endBpm: Number(e.target.value) })}
              min={40}
              max={300}
              className="h-7 text-center text-xs px-1"
              data-testid="metronome-end-bpm"
            />
          </div>
          <div className="space-y-0.5">
            <Label className="text-[10px]"># Increments</Label>
            <Input
              ref={incrementsRef}
              type="number"
              value={increments}
              onChange={(e) =>
                updateState({ increments: Math.max(2, Number(e.target.value)) })
              }
              min={2}
              max={100}
              className="h-7 text-center text-xs px-1"
              data-testid="metronome-increments"
            />
          </div>
          <div className="space-y-0.5">
            <Label className="text-[10px]">Measures/Inc</Label>
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
              className="h-7 text-center text-xs px-1"
              data-testid="metronome-measures-per-inc"
            />
          </div>
          {mode === "progressive" && (
            <div className="space-y-0.5" data-testid="metronome-step-bpm-container">
              <Label className="text-[10px]">Step BPM</Label>
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
                className="h-7 text-center text-xs px-1"
                data-testid="metronome-step-bpm"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
