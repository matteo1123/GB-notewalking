import { getNote } from "./music";

export const KEY_SIGNATURES: { [key: string]: string[] } = {
    'C': ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
    'G': ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
    'D': ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
    'A': ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'],
    'E': ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'],
    'B': ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#'],
    'F#': ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#'],
    'C#': ['C#', 'D#', 'E#', 'F#', 'G#', 'A#', 'B#'],
    'F': ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'],
    'Bb': ['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A'],
    'Eb': ['Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D'],
    'Ab': ['Ab', 'Bb', 'C', 'Db', 'Eb', 'F', 'G'],
    'Db': ['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C'],
    'Gb': ['Gb', 'Ab', 'Bb', 'Cb', 'Db', 'Eb', 'F'],
    'Cb': ['Cb', 'Db', 'Eb', 'Fb', 'Gb', 'Ab', 'Bb'],
};

export const getNoteWithEnharmonicPreference = (string: number, fret: number, majorKey: string | null): string => {
    const note = getNote(string, fret);
    if (!majorKey || !KEY_SIGNATURES[majorKey]) {
        return note;
    }

    const keySignature = KEY_SIGNATURES[majorKey];
    const noteName = note.slice(0, -1);
    if (keySignature.includes(note)) {
        return note;
    }

    const enharmonicEquivalents: { [key: string]: string } = {
        'A#': 'Bb', 'Bb': 'A#',
        'C#': 'Db', 'Db': 'C#',
        'D#': 'Eb', 'Eb': 'D#',
        'F#': 'Gb', 'Gb': 'F#',
        'G#': 'Ab', 'Ab': 'G#',
    };

    const equivalent = enharmonicEquivalents[note];
    if (equivalent && keySignature.some(n => n.startsWith(equivalent.slice(0, 1)))) {
        return equivalent;
    }

    return note;
}