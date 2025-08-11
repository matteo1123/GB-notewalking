export interface Note {
  time: number;
  duration: number;
  string: number;
  fret: number;
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