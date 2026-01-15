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

// Metronome Configuration - The universal backbone for all modules
export interface MetronomeConfig {
  mode: 'regular' | 'speed-trainer' | 'progressive';
  bpm: number;               // Starting BPM (always present)
  drum_beat: boolean;
  auto_record: boolean;
  // Speed trainer / progressive fields (conditional on mode)
  end_bpm?: number;
  increments?: number;       // # of BPM steps
  measures_per_increment?: number;
  step_bpm?: number;         // Progressive mode only
  loop?: boolean;
}

// Default metronome configuration
export const DEFAULT_METRONOME_CONFIG: MetronomeConfig = {
  mode: 'regular',
  bpm: 60,
  drum_beat: false,
  auto_record: false,
};

export type ModuleType =
  | 'scale'
  | 'rhythm'
  | 'notewalking'
  | 'arpeggio'
  | 'piece_mastery'
  | 'chord_progressions'
  | 'riff';

// Ear Training Options for module configs
export interface EarTrainingModuleOptions {
  enabled: boolean;
  mode: 'sing-back' | 'identify';
  level?: number;           // 1-12: difficulty level
  notes_per_phrase?: number; // For sing-back mode
}

// Module Configurations
// Each module config includes an optional metronome config for encoding full practice state
export interface ScaleModuleConfig {
  module_type: 'scale';
  metronome?: MetronomeConfig;
  ear_training?: EarTrainingModuleOptions;  // Opens module directly in ear training mode
  current_scale_id?: string;        // Currently active scale (for navigation state)
  priority_scale_ids?: string[];    // User-defined order (UUIDs to practice first)
  type_filter?: string;             // Filter by Type field (e.g., "3 Notes Per String")
  group_by_shape?: boolean;         // If true, show only one exercise per scale_shape
  order_by?: 'created_at' | 'name'; // Fallback ordering after priority list is exhausted
  current_index?: number;           // Current position in the queue
}

export interface RhythmModuleConfig {
  module_type: 'rhythm';
  metronome?: MetronomeConfig;
  rhythm_level: number;
  duration_minutes?: number;
}

export interface NotewalkingModuleConfig {
  module_type: 'notewalking';
  metronome?: MetronomeConfig;
  key: string;
  chords: string[];
  measures_per_chord: number;
}

export interface ChordProgressionsModuleConfig {
  module_type: 'chord_progressions';
  metronome?: MetronomeConfig;
  progression_id: string;
  key: string;
  target_bpm?: number;
}

export interface ArpeggioModuleConfig {
  module_type: 'arpeggio';
  metronome?: MetronomeConfig;
  ear_training?: EarTrainingModuleOptions;  // Opens module directly in ear training mode
  current_arpeggio_id?: string;      // Currently active arpeggio (for navigation state)
  priority_arpeggio_ids?: string[];  // User-defined order (UUIDs to practice first)
  type_filter?: string;              // Filter by Type field
  order_by?: 'created_at' | 'name';  // Fallback ordering
  current_index?: number;            // Current position in the queue
  pattern?: 'ascending' | 'descending' | 'alternating';
}

export interface PieceMasteryModuleConfig {
  module_type: 'piece_mastery';
  metronome?: MetronomeConfig;
  piece_id: string;
  segment_seconds: number;
}

export interface RiffModuleConfig {
  module_type: 'riff';
  metronome?: MetronomeConfig;
  riff_id?: string;
  riff_name?: string;
}

export type ModuleConfig =
  | ScaleModuleConfig
  | RhythmModuleConfig
  | NotewalkingModuleConfig
  | ChordProgressionsModuleConfig
  | ArpeggioModuleConfig
  | PieceMasteryModuleConfig
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
