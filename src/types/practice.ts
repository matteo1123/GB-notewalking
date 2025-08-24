import { MetronomeMode } from "@/components/MetronomeControls";

export interface ExerciseSettings {
  mode: MetronomeMode;
  startBpm: number;
  endBpm: number;
  increments: number; // number of BPM increments
  measuresPerIncrement: number; // measures to linger at each increment
  progressiveStepBpm?: number; // default 5
}

export interface ExerciseStatus {
  currentBeat: number;
  currentMeasure: number;
  currentBpm: number;
  progressiveRound: number;
  totalPlannedMeasures: number;
}

export interface LessonStep {
  id: string;
  name?: string;
  settings: ExerciseSettings;
  // Optional constraints to auto-advance this step
  maxMeasures?: number; // stop after N measures (overrides increments if smaller)
  maxSeconds?: number; // stop after N seconds (alternative to measures)
}

export interface LessonPlan {
  id: string;
  name: string;
  steps: LessonStep[];
}
