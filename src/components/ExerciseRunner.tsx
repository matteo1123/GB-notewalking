import { useEffect, useRef, useState } from "react";
import MetronomeScreen from "@/components/MetronomeScreen";
import { ExerciseSettings, ExerciseStatus } from "@/types/practice";

interface ExerciseRunnerProps {
  settings: ExerciseSettings;
  autoStart?: boolean;
  hideControls?: boolean;
  onStatus?: (status: ExerciseStatus) => void;
  onComplete?: () => void;
}

export function ExerciseRunner({
  settings,
  autoStart = false,
  hideControls = false,
  onStatus,
  onComplete,
}: ExerciseRunnerProps) {
  const controlsRef = useRef<{
    start: () => void;
    pause: () => void;
    stop: () => void;
    togglePlayPause: () => void;
  } | null>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!autoStart || !controlsRef.current) return;
    controlsRef.current.start();
  }, [autoStart]);

  const handleProgress = (info: ExerciseStatus) => {
    onStatus?.(info);
    if (!completed && settings.mode !== "regular") {
      if (info.currentMeasure > info.totalPlannedMeasures) {
        setCompleted(true);
        onComplete?.();
      }
    }
  };

  return (
    <MetronomeScreen
      initialMode={settings.mode}
      initialStartBpm={settings.startBpm}
      initialEndBpm={settings.endBpm}
      initialIncrements={settings.increments}
      initialMeasuresPerIncrement={settings.measuresPerIncrement}
      progressiveStepBpm={settings.progressiveStepBpm}
      showControls={!hideControls}
      autoStart={autoStart}
      exposeControlsRef={
        controlsRef as React.MutableRefObject<{
          start: () => void;
          pause: () => void;
          stop: () => void;
          togglePlayPause: () => void;
        } | null>
      }
      onProgress={handleProgress}
    />
  );
}

export default ExerciseRunner;
