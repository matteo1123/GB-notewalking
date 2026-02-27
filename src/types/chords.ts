export type ChordNumeral = "I" | "ii" | "iii" | "IV" | "V" | "vi" | "vii°";

export interface ChordInfo {
    numeral: ChordNumeral;
    rootNote: string;
    degree: number; // 1-7
}

export type RhythmPattern = "quarter" | "eighth" | "sixteenth";

export interface RhythmPatternInfo {
    id: RhythmPattern;
    name: string;
    description: string;
    subdivision: number; // How many hits per beat
    hitPattern: number[]; // Which subdivisions to hit (0-based)
}

export interface ChordProgressionSettings {
    key: string;
    selectedChords: ChordNumeral[];
    measuresPerChord: number;
    droneEnabled: boolean;
    droneVolume: number;
    promptFretboardPainter: boolean;
    droneMode: "pedal" | "chord-major" | "chord-minor";
}

export interface ChordProgressionState {
    settings: ChordProgressionSettings;
    currentChordIndex: number;
    isPlaying: boolean;
    currentBpm: number;
}
