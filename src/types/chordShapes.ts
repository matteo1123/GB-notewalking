// Type definitions for chord shapes and chords
// Mirrors the database schema for chord_shapes and chords tables

export type ChordQuality =
    | 'major'
    | 'minor'
    | 'diminished'
    | 'augmented'
    | 'dominant7'
    | 'minor7'
    | 'major7'
    | 'minor7b5'  // Half-diminished
    | 'dim7';      // Fully diminished 7

export interface ChordShapeNote {
    string: number;       // 1-6
    fret_offset: number;  // Relative to root
}

export interface ChordShape {
    id: string;
    name: string;
    chord_quality: ChordQuality;
    root_fret: number;
    shape_json: ChordShapeNote[];
    intervals: number[];
    notes: string[];
    created_at: string;
    updated_at: string;
}

export interface ChordNote {
    string: number;
    fret: number;
    time: number;
    duration: number;
}

export interface Chord {
    id: string;
    name: string;           // e.g., "C Major"
    chord_name: string;     // e.g., "C"
    chord_quality: ChordQuality;
    root_note: string;
    intervals: number[];
    notes: string[];
    notes_json: ChordNote[];
    chord_shape_id: string | null;
    is_public: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}
