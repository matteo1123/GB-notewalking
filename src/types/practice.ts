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

// Ear Training Types
export type EarTrainingMode = 'sing-back' | 'identify';

export interface EarTrainingSettings {
  enabled: boolean;
  mode: EarTrainingMode; // 'sing-back' or 'identify'
  level: number; // 1-12: number of notes from root that can appear (level 1 = root + 1 note, level 12 = all notes)
  notesPerPhrase: number; // 1-8 (only for sing-back mode)
  playbackSpeed: number; // 0.5 - 2.0
  responseTimeMs: number; // milliseconds user has to respond
  sensitivity: number; // 0-1 pitch detection sensitivity
  showFeedback: boolean; // show visual feedback during singing
}

export interface EarTrainingPhrase {
  notes: { string: number; fret: number }[];
  startIndex: number;
  endIndex: number;
}

export interface EarTrainingProgress {
  currentPhraseIndex: number;
  phrasesCompleted: number;
  totalPhrases: number;
  currentPhraseAccuracy: number; // 0-100
  overallAccuracy: number; // 0-100
  notesCorrect: number;
  notesTotal: number;
}

export interface SungNoteResult {
  expected: { string: number; fret: number };
  sung: {
    frequency: number;
    note: string;
    confidence: number;
  } | null;
  isCorrect: boolean;
  timingMs: number;
}
