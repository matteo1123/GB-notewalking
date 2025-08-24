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
  category: "scale" | "arpeggio" | "riff" | "rhythm" | "ear-training";
  difficulty: number; // 1-10 scale
  notes: Note[];
  description?: string;
  notes_per_beat?: number;
  tonic: string; // e.g., "A", "C#"
  tonality: string; // "Major", "Minor"
  position?: number;
  parent?: string | null; // UUID of parent exercise
  created_at?: string;
  updated_at?: string;
}

export interface PracticeSession {
  id: string;
  name: string;
  repertoireItems: string[]; // Array of repertoire item IDs
  timePerItem?: number; // Time in seconds, undefined means unlimited
}
