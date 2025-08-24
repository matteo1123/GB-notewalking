import { useEffect, useMemo, useState } from "react";
import ExerciseRunner from "@/components/ExerciseRunner";
import { LessonPlan, LessonStep, ExerciseStatus } from "@/types/practice";

interface LessonRunnerProps {
  lesson: LessonPlan;
  autoStart?: boolean;
  hideControls?: boolean;
  onStepChange?: (stepIndex: number, step: LessonStep) => void;
  onComplete?: () => void;
}

export function LessonRunner({
  lesson,
  autoStart = false,
  hideControls = false,
  onStepChange,
  onComplete,
}: LessonRunnerProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = useMemo(
    () => lesson.steps[stepIndex],
    [lesson.steps, stepIndex]
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    onStepChange?.(stepIndex, step);
    setElapsedSeconds(0);
  }, [stepIndex, step, onStepChange]);

  const goNext = () => {
    if (stepIndex + 1 < lesson.steps.length) {
      setStepIndex(stepIndex + 1);
    } else {
      onComplete?.();
    }
  };

  const handleStatus = (status: ExerciseStatus) => {
    // Advance conditions (optional per step): maxMeasures or maxSeconds
    if (
      typeof step.maxMeasures === "number" &&
      status.currentMeasure > step.maxMeasures
    ) {
      goNext();
      return;
    }
    if (typeof step.maxSeconds === "number") {
      setElapsedSeconds((prev) => {
        const next =
          prev +
          (60 / Math.max(status.currentBpm, 1)) *
            (status.currentBeat === 1 ? 1 : 0);
        if (next >= step.maxSeconds!) {
          goNext();
        }
        return next;
      });
    }
  };

  return (
    <ExerciseRunner
      settings={{
        mode: step.settings.mode,
        startBpm: step.settings.startBpm,
        endBpm: step.settings.endBpm,
        increments: step.settings.increments,
        measuresPerIncrement: step.settings.measuresPerIncrement,
        progressiveStepBpm: step.settings.progressiveStepBpm,
      }}
      autoStart={autoStart}
      hideControls={hideControls}
      onStatus={handleStatus}
      onComplete={goNext}
    />
  );
}

export default LessonRunner;
