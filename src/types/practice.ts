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

// ============================================================================
// Practice System Types (New - for intelligent sessions and progress tracking)
// ============================================================================

export type ModuleType =
  | 'scale'
  | 'rhythm'
  | 'notewalking'
  | 'arpeggio'
  | 'riff'
  | 'chord_progressions';

// Module Configurations
export interface ScaleModuleConfig {
  scale_id: string;
  scale_shape_id?: string;
}

export interface RhythmModuleConfig {
  rhythm_level: number;
  duration_minutes?: number;
}

export interface NotewalkingModuleConfig {
  key: string;
  chords: string[];
  measures_per_chord: number;
}

export interface ChordProgressionsModuleConfig {
  progression_id: string;
  key: string;
  target_bpm?: number;
}

export interface ArpeggioModuleConfig {
  arpeggio_id: string;
  pattern?: 'ascending' | 'descending' | 'alternating';
}

export interface RiffModuleConfig {
  repertoire_id: string;
  target_bpm: number;
}

export type ModuleConfig =
  | ScaleModuleConfig
  | RhythmModuleConfig
  | NotewalkingModuleConfig
  | ChordProgressionsModuleConfig
  | ArpeggioModuleConfig
  | RiffModuleConfig;

// Practice Sessions
export interface SessionBlock {
  module_type: ModuleType;
  config: ModuleConfig;
  duration_minutes: number;
  order: number;
}

export interface PracticeSession {
  id: string;
  user_id: string;
  lesson_id?: string;
  started_at: string;
  ended_at?: string;
  total_duration_seconds?: number;
  session_plan: SessionBlock[];
  completed: boolean;
}

// Practice Log (Extended)
export interface PracticeLogEntry {
  id: number;
  user_id: string;
  exercise_id?: string;
  scale_id?: string;
  scale_shape_id?: string;
  duration: number;
  max_bpm?: number;
  perfect_bpm?: number;
  created_at: string;
  audio?: string;
  exercise_category?: string;
  name?: string;
  module_type?: ModuleType;
  module_config?: ModuleConfig;
  session_id?: string;
}

// Lesson Progress
export interface LessonProgressMetrics {
  best_bpms: Record<string, number>;
  mastery_levels: Record<string, number>;
  recordings: string[];
}

export interface LessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  started_at: string;
  last_practiced?: string;
  completed_at?: string;
  total_time_seconds: number;
  exercises_completed: number;
  metrics: LessonProgressMetrics;
}

// Chord Progressions
export interface ChordDefinition {
  numeral: string;
  name: string;
  voicing_type: 'open' | 'barre' | 'jazz' | 'extended';
  frets: (number | null)[];
  fingers: (number | null)[];
  notes: string[];
}

export interface ChordProgression {
  id: string;
  name: string;
  progression: string;
  key: string;
  genre?: string;
  difficulty?: number;
  chords: ChordDefinition[];
  measures_per_chord: number;
  description?: string;
  is_public: boolean;
  created_by?: string;
  created_at: string;
}

export interface ChordProgressionProgress {
  id: string;
  user_id: string;
  progression_id: string;
  max_clean_bpm: number;
  time_practiced_seconds: number;
  last_practiced?: string;
  mastery_level: number;
}
