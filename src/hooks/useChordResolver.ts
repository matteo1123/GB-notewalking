import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { notes as allNotes } from '@/lib/musicTheory';

export interface ResolvedChord {
    id: string;
    name: string;
    chord_name: string;
    chord_quality: string;
    root_note: string;
    notes: string[];
    notes_json: any[];
    is_movable: boolean;
    // Metadata for the UI
    numeral: string;
    degree: number;
}

const ROMAN_TO_INTERVAL: Record<string, number> = {
    'i': 0, 'I': 0,
    'ii': 2, 'II': 2,
    'iii': 4, 'III': 4,
    'iv': 5, 'IV': 5,
    'v': 7, 'V': 7,
    'vi': 9, 'VI': 9,
    'vii': 11, 'VII': 11,
};

// Simple parser for standard progression numerals
// Handling accidentals (bVII, #iv) would require more regex logic
const parseNumeral = (numeral: string) => {
    const normalized = numeral.trim();
    let interval = 0;
    let quality = 'major'; // Default
    let baseNumeral = normalized;

    // Check for accidentals
    let semitoneShift = 0;
    if (normalized.startsWith('b') || normalized.startsWith('♭')) {
        semitoneShift = -1;
        baseNumeral = normalized.substring(1);
    } else if (normalized.startsWith('#') || normalized.startsWith('♯')) {
        semitoneShift = 1;
        baseNumeral = normalized.substring(1);
    }

    // Determine Quality
    if (baseNumeral === baseNumeral.toLowerCase()) {
        quality = 'minor'; // ii, vi
        // standard convention: lower = minor
        // but could be diminished if vii°
    }

    if (baseNumeral.includes('°') || baseNumeral.includes('dim')) {
        quality = 'diminished';
        baseNumeral = baseNumeral.replace(/°|dim/g, ''); // strip suffix for lookup
    } else if (baseNumeral.includes('aug') || baseNumeral.includes('+')) {
        quality = 'augmented';
        baseNumeral = baseNumeral.replace(/aug|\+/g, '');
    } else if (baseNumeral.includes('7')) {
        // V7 -> dominant7? Or just 7?
        // For now simple mapping
        if (quality === 'major') quality = 'dominant7';
        if (quality === 'minor') quality = 'minor7'; // vi7
        baseNumeral = baseNumeral.replace('7', '');
    }

    // Determine Interval
    // Use UPPER case for lookup
    const lookup = baseNumeral.toUpperCase();
    if (ROMAN_TO_INTERVAL.hasOwnProperty(lookup)) {
        interval = ROMAN_TO_INTERVAL[lookup] + semitoneShift;
    }

    return { interval: (interval + 12) % 12, quality };
};

export function useChordResolver() {
    const [resolvedChords, setResolvedChords] = useState<ResolvedChord[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const resolve = useCallback(async (progressionNumerals: string[], keyRoot: string) => {
        setIsLoading(true);
        setError(null);
        setResolvedChords([]);

        try {
            const rootIndex = allNotes.indexOf(keyRoot);
            if (rootIndex === -1) throw new Error(`Invalid key root: ${keyRoot}`);

            const requests = progressionNumerals.map(numeral => {
                const { interval, quality } = parseNumeral(numeral);
                const targetIndex = (rootIndex + interval) % 12;
                const targetRoot = allNotes[targetIndex];
                return { numeral, targetRoot, quality };
            });

            // 1. Fetch ALL relevant chords in one query (or as many as possible)
            // Since we need specific Root+Quality pairs, we can try to fetch them all
            // Or just fetch specific combos.

            // Let's optimize: fetch all chords matching ANY of the target roots?
            // Or just fetch ALL chords if the table is small (it is small now).
            // But filtering is safer.

            // Construct an OR query? 'or=(root_note.eq.C,root_note.eq.G...)'
            // But we need Root AND Quality. 'or=(and(root_note.eq.C,chord_quality.eq.major),...)'
            // Supabase complex ORs are tricky.

            // Simpler approach: Fetch all chords where root_note IN [list of roots].
            // Then filter in memory.
            const uniqueRoots = [...new Set(requests.map(r => r.targetRoot))];

            const { data: chords, error: queryError } = await supabase
                .from('chords' as any)
                .select('*')
                .in('root_note', uniqueRoots);

            if (queryError) throw queryError;
            if (!chords) throw new Error("No chords found in database");

            // 2. Map requests to best matching chord
            const result: ResolvedChord[] = requests.map(req => {
                // Find matches
                let matches = (chords as any[]).filter(c =>
                    c.root_note === req.targetRoot &&
                    c.chord_quality === req.quality
                );

                // Fallback quality?
                if (matches.length === 0) {
                    // If asked for "dominant7" and none found, maybe fallback to "major"?
                    // For now, strict.
                    // Try strict match first.
                }

                if (matches.length === 0) {
                    // Return placeholder or error?
                    // Let's return a dummy "Missing" chord?
                    return {
                        id: `missing-${req.numeral}`,
                        name: `Missing: ${req.targetRoot} ${req.quality}`,
                        chord_name: req.targetRoot,
                        chord_quality: req.quality,
                        root_note: req.targetRoot,
                        notes: [],
                        notes_json: [],
                        is_movable: false,
                        numeral: req.numeral,
                        degree: 0
                    };
                }

                // Sort preference: Open (is_movable=false) first?
                matches.sort((a, b) => {
                    if (a.is_movable === b.is_movable) return 0;
                    return a.is_movable ? 1 : -1; // False (Open) comes first
                });

                const bestMatch = matches[0];
                return {
                    id: bestMatch.id,
                    name: bestMatch.name,
                    chord_name: bestMatch.chord_name || bestMatch.root_note,
                    chord_quality: bestMatch.chord_quality,
                    root_note: bestMatch.root_note,
                    notes: bestMatch.notes,
                    notes_json: bestMatch.shape_json || bestMatch.notes_json,
                    is_movable: bestMatch.is_movable,
                    numeral: req.numeral,
                    degree: 0
                };
            });

            setResolvedChords(result);
        } catch (err: any) {
            setError(err.message);
            console.error("Chord resolution error:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    return { resolve, resolvedChords, isLoading, error };
}
