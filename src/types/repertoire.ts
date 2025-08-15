export interface Note {
  beat: number;
  subdivision: number;
  string: number;
  fret: number;
  duration?: number; // Optional duration in seconds
  accent?: boolean; // Force highlight this note
  highlight?: boolean; // Force highlight this note (alias for accent)
  highlightEvery?: number; // Global pattern: highlight every Nth note
  highlightOffset?: number; // Global pattern: offset for highlighting
}

export interface RepertoireItem {
  id: string;
  name: string;
  category: 'scale' | 'arpeggio' | 'riff' | 'rhythm' | 'ear-training';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  notes: Note[];
  tempo: number;
  description?: string;
}

export interface PracticeSession {
  id: string;
  name: string;
  repertoireItems: string[]; // Array of repertoire item IDs
  timePerItem?: number; // Time in seconds, undefined means unlimited
}