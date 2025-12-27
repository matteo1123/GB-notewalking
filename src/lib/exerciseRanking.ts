/**
 * Exercise Ranking System
 * 
 * Ranks exercises by actual speed (notes per second) to identify
 * which exercises need focus vs which are ready for warmup.
 */

import { supabase } from '@/integrations/supabase/client';

export interface RankedExercise {
    scale_id: string;
    sequence_id: string;
    scale_name: string;
    sequence_name: string;
    user_max_bpm: number;
    notes_per_click: number;
    notes_per_second: number;
    category: 'focus' | 'warmup';
    last_practiced?: string;
}

/**
 * Calculate notes per second for an exercise
 */
export function calculateNotesPerSecond(
    bpm: number,
    notesPerClick: number
): number {
    // BPM = beats per minute
    // Convert to beats per second: BPM / 60
    // In 4/4 time with 16th note grid: 4 clicks per beat
    // But we track notes_per_click relative to the metronome

    const beatsPerSecond = bpm / 60;
    const clicksPerBeat = 4; // 16th note grid
    const clicksPerSecond = beatsPerSecond * clicksPerBeat;

    return clicksPerSecond * notesPerClick;
}

/**
 * Fetch user's exercise performance data
 */
export async function getUserExercisePerformance(
    userId: string
): Promise<RankedExercise[]> {
    // Get all practice log entries for this user with scale/sequence info
    const { data: practiceLogs, error } = await supabase
        .from('practice_log')
        .select(`
      scale_id,
      max_bpm,
      created_at,
      scales!inner (
        id,
        name
      )
    `)
        .eq('user_id', userId)
        .not('scale_id', 'is', null)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching practice logs:', error);
        return [];
    }

    // Group by scale_id to get max BPM per scale
    const scalePerformance = new Map<string, { max_bpm: number; scale_name: string; last_practiced: string }>();

    for (const log of practiceLogs || []) {
        if (!log.scale_id) continue;

        const existing = scalePerformance.get(log.scale_id);
        if (!existing || log.max_bpm > existing.max_bpm) {
            scalePerformance.set(log.scale_id, {
                max_bpm: log.max_bpm,
                scale_name: (log.scales as any)?.name || 'Unknown',
                last_practiced: log.created_at
            });
        }
    }

    // Get all sequences
    const { data: sequences, error: seqError } = await supabase
        .from('sequences')
        .select('id, name, notes_per_click');

    if (seqError) {
        console.error('Error fetching sequences:', seqError);
        return [];
    }

    // Create ranked exercises for each scale/sequence combination
    const ranked: RankedExercise[] = [];

    for (const [scaleId, performance] of scalePerformance.entries()) {
        // For each scale, create entry with default sequence
        // TODO: Track which sequences user has actually practiced
        const defaultSequence = sequences?.[0];
        if (!defaultSequence) continue;

        const notesPerSecond = calculateNotesPerSecond(
            performance.max_bpm,
            defaultSequence.notes_per_click || 2.0
        );

        ranked.push({
            scale_id: scaleId,
            sequence_id: defaultSequence.id,
            scale_name: performance.scale_name,
            sequence_name: defaultSequence.name,
            user_max_bpm: performance.max_bpm,
            notes_per_click: defaultSequence.notes_per_click || 2.0,
            notes_per_second: notesPerSecond,
            category: 'focus', // Will be categorized below
            last_practiced: performance.last_practiced
        });
    }

    // Sort by notes per second (slowest first)
    ranked.sort((a, b) => a.notes_per_second - b.notes_per_second);

    // Categorize: bottom 70% = focus, top 30% = warmup
    const focusThreshold = Math.floor(ranked.length * 0.7);

    ranked.forEach((exercise, index) => {
        exercise.category = index < focusThreshold ? 'focus' : 'warmup';
    });

    return ranked;
}

/**
 * Get exercises that need focus (slowest 70%)
 */
export async function getFocusExercises(
    userId: string
): Promise<RankedExercise[]> {
    const ranked = await getUserExercisePerformance(userId);
    return ranked.filter(ex => ex.category === 'focus');
}

/**
 * Get exercises for warmup (fastest 30%)
 */
export async function getWarmupExercises(
    userId: string
): Promise<RankedExercise[]> {
    const ranked = await getUserExercisePerformance(userId);
    return ranked.filter(ex => ex.category === 'warmup');
}

/**
 * Get next exercise to practice for a given module type
 * Picks the slowest exercise in that category
 */
export async function getNextExercise(
    userId: string,
    moduleType: 'scale' | 'arpeggio'
): Promise<RankedExercise | null> {
    const focusExercises = await getFocusExercises(userId);

    // TODO: Filter by module type when we have that data
    // For now, return the slowest overall
    return focusExercises[0] || null;
}

/**
 * Check if exercise should graduate to warmup
 */
export function shouldGraduate(
    exercise: RankedExercise,
    targetBPM: number = 120,
    threshold: number = 10
): boolean {
    return exercise.user_max_bpm >= targetBPM + threshold;
}

/**
 * Format notes per second for display
 */
export function formatSpeed(notesPerSecond: number): string {
    return `${notesPerSecond.toFixed(1)} notes/sec`;
}

/**
 * Get color for speed (for UI)
 */
export function getSpeedColor(notesPerSecond: number): string {
    if (notesPerSecond < 4) return 'text-red-500'; // Slow - needs work
    if (notesPerSecond < 8) return 'text-yellow-500'; // Medium
    return 'text-green-500'; // Fast - ready for warmup
}
