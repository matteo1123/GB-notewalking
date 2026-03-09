export type KeyQuality = 'major' | 'minor';

export interface Progression {
    id: string;
    numeralString: string;
    quality: KeyQuality;
}

export const MAJOR_KEYS = ['C', 'G', 'D', 'A', 'E', 'F'] as const;
export const MINOR_KEYS = ['Am', 'Bm', 'Dm', 'Em', 'F#m'] as const;

export type MajorKey = typeof MAJOR_KEYS[number];
export type MinorKey = typeof MINOR_KEYS[number];

export const MAJOR_PROGRESSIONS: Progression[] = [
    { id: 'maj_1', numeralString: 'I - IV', quality: 'major' },
    { id: 'maj_2', numeralString: 'I - V', quality: 'major' },
    { id: 'maj_3', numeralString: 'I - IV - V', quality: 'major' },
    { id: 'maj_4', numeralString: 'I - vi - IV - V', quality: 'major' },
    { id: 'maj_5', numeralString: 'I - V - vi - IV', quality: 'major' },
    { id: 'maj_6', numeralString: 'ii - V - I', quality: 'major' },
    { id: 'maj_7', numeralString: 'I - vi - ii - V', quality: 'major' },
    { id: 'maj_8', numeralString: 'I - IV - I - V', quality: 'major' },
    { id: 'maj_9', numeralString: 'I - bVII - IV', quality: 'major' },
    { id: 'maj_10', numeralString: 'I - iii - IV - V', quality: 'major' },
    { id: 'maj_11', numeralString: 'IV - I - V - vi', quality: 'major' }
];

export const MINOR_PROGRESSIONS: Progression[] = [
    { id: 'min_1', numeralString: 'i - VI - VII', quality: 'minor' },
    { id: 'min_2', numeralString: 'i - iv - v', quality: 'minor' },
    { id: 'min_3', numeralString: 'i - iv - VII', quality: 'minor' },
    { id: 'min_4', numeralString: 'i - VI - III - VII', quality: 'minor' },
    { id: 'min_5', numeralString: 'i - VII - VI - V', quality: 'minor' },
    { id: 'min_6', numeralString: 'ii° - V - i', quality: 'minor' },
    { id: 'min_7', numeralString: 'i - iv - i', quality: 'minor' },
    { id: 'min_8', numeralString: 'VI - VII - i', quality: 'minor' },
    { id: 'min_9', numeralString: 'i - v - VI - III', quality: 'minor' }
];

export const ALL_PROGRESSIONS = [...MAJOR_PROGRESSIONS, ...MINOR_PROGRESSIONS];

export function getChordsForProgression(numeralString: string, key: string, quality: KeyQuality): string[] {
    const majorKeyMap: Record<string, string[]> = {
        'C': ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim'],
        'G': ['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F#dim'],
        'D': ['D', 'Em', 'F#m', 'G', 'A', 'Bm', 'C#dim'],
        'A': ['A', 'Bm', 'C#m', 'D', 'E', 'F#m', 'G#dim'],
        'E': ['E', 'F#m', 'G#m', 'A', 'B', 'C#m', 'D#dim'],
        'F': ['F', 'Gm', 'Am', 'Bb', 'C', 'Dm', 'Edim'],
    };

    const minorKeyMap: Record<string, string[]> = {
        'Am': ['Am', 'Bm7b5', 'C', 'Dm', 'Em', 'F', 'G'],
        'Bm': ['Bm', 'C#m7b5', 'D', 'Em', 'F#m', 'G', 'A'],
        'Dm': ['Dm', 'Em7b5', 'F', 'Gm', 'Am', 'Bb', 'C'],
        'Em': ['Em', 'F#m7b5', 'G', 'Am', 'Bm', 'C', 'D'],
        'F#m': ['F#m', 'G#m7b5', 'A', 'Bm', 'C#m', 'D', 'E'],
    };

    // bVII is a borrowed chord (flat 7th) - a major chord one whole step below the root
    const flatSevenMap: Record<string, string> = {
        'C': 'Bb',
        'G': 'F',
        'D': 'C',
        'A': 'G',
        'E': 'D',
        'F': 'Eb',
        'Am': 'G',
        'Bm': 'A',
        'Dm': 'C',
        'Em': 'D',
        'F#m': 'E',
    };

    const numerals = numeralString.split('-').map(n => n.trim());
    const chords: string[] = [];

    const majorNumeralsMap: Record<string, number> = {
        'I': 0, 'ii': 1, 'iii': 2, 'IV': 3, 'V': 4, 'vi': 5, 'vii°': 6,
    };

    // Note: The Minor image uses II instead of ii° in its header sometimes, but we standardized to ii°
    const minorNumeralsMap: Record<string, number> = {
        'i': 0, 'ii°': 1, 'III': 2, 'iv': 3, 'v': 4, 'VI': 5, 'VII': 6
    };

    const mapToUse = quality === 'major' ? majorNumeralsMap : minorNumeralsMap;
    const keyChords = quality === 'major' ? majorKeyMap[key] : minorKeyMap[key];

    if (!keyChords) return numerals; // fallback if key not found

    for (const numeral of numerals) {
        // Handle bVII (flat 7th) - a borrowed chord that's a whole step below the root
        if (numeral === 'bVII') {
            const flatSevenChord = flatSevenMap[key];
            if (flatSevenChord) {
                chords.push(flatSevenChord);
            } else {
                chords.push(numeral); // fallback
            }
        } else {
            const index = mapToUse[numeral];
            if (index !== undefined && keyChords[index]) {
                chords.push(keyChords[index]);
            } else {
                chords.push(numeral); // fallback to just returning the numeral if not found
            }
        }
    }

    return chords;
}
