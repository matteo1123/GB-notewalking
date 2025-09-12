import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNumberInputControls } from "@/hooks/useNumberInputControls";
import { MetronomeMode } from "./MetronomeControls";

interface SpeedTrainerControlsProps {
  mode: MetronomeMode;
  endBpm: number;
  measures: number;
  measuresPerBpmChange: number;
  onEndBpmChange: (bpm: number) => void;
  onMeasuresChange: (measures: number) => void;
  onMeasuresPerBpmChangeChange: (measures: number) => void;
  progressiveStepBpm?: number;
  onProgressiveStepBpmChange?: (step: number) => void;
}

export function SpeedTrainerControls({
  mode,
  endBpm,
  measures,
  measuresPerBpmChange,
  onEndBpmChange,
  onMeasuresChange,
  onMeasuresPerBpmChangeChange,
  progressiveStepBpm,
  onProgressiveStepBpmChange,
}: SpeedTrainerControlsProps) {
  const endBpmRef = useRef<HTMLInputElement>(null);
  const incrementsRef = useRef<HTMLInputElement>(null);
  const measuresPerBpmRef = useRef<HTMLInputElement>(null);
  const progressiveStepRef = useRef<HTMLInputElement>(null);

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

  if (mode === "regular") {
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
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
  );
}