export interface Note {
  time: number;
  string: number;
  fret: number;
  duration?: number; // Duration in seconds
  accent?: boolean; // Force highlight this note
  highlight?: boolean; // Force highlight this note (alias for accent)
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