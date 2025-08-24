import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { MetronomeMode } from "./MetronomeControls";

interface ProgressIndicatorProps {
  mode: MetronomeMode;
  currentMeasure: number;
  totalMeasures: number; // total planned measures within a cycle
  progressiveRound: number;
  currentBpm: number;
  targetBpm: number;
  isPlaying: boolean;
  startBpmBase?: number;
  progressiveStepBpm?: number;
}

export function ProgressIndicator({
  mode,
  currentMeasure,
  totalMeasures,
  progressiveRound,
  currentBpm,
  targetBpm,
  isPlaying,
  startBpmBase = 0,
  progressiveStepBpm = 5,
}: ProgressIndicatorProps) {
  if (mode === "regular") return null;

  const measureProgress = Math.max(
    0,
    Math.min(100, (currentMeasure / Math.max(1, totalMeasures)) * 100)
  );

  // Calculate effective start/target for display
  const effectiveStart =
    mode === "progressive"
      ? startBpmBase + (progressiveRound - 1) * progressiveStepBpm
      : startBpmBase;
  const effectiveTarget = targetBpm;
  const bpmProgress = Math.max(
    0,
    Math.min(
      100,
      ((currentBpm - effectiveStart) /
        Math.max(1, effectiveTarget - effectiveStart)) *
        100
    )
  );

  return (
    <Card className="p-4 bg-gradient-to-r from-card/50 to-card border-border/50">
      <div className="space-y-4">
        {/* Measure Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Measure Progress</span>
            <span className="font-medium">
              {currentMeasure} / {totalMeasures}
            </span>
          </div>
          <Progress value={measureProgress} className="h-2" />
        </div>

        {/* Progressive Round Indicator */}
        {mode === "progressive" && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Round</span>
            <span className="font-bold text-accent">{progressiveRound}</span>
          </div>
        )}

        {/* Status */}
        <div className="text-center">
          <div className="text-sm text-muted-foreground">
            {isPlaying
              ? mode === "progressive"
                ? `Round ${progressiveRound}: ${Math.round(
                    currentBpm
                  )} → ${targetBpm} BPM`
                : `${Math.round(currentBpm)} → ${targetBpm} BPM`
              : "Stopped"}
          </div>
        </div>
      </div>
    </Card>
  );
}
