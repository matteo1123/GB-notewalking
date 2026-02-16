/**
 * Progression Engine
 *
 * Handles the logic for different progression modes in scale/arpeggio modules:
 * - cycle: Rotate through all exercises, loop back to start
 * - sequential: Complete exercises in order, stop at end
 * - focus: Auto-switch to lowest BPM exercise until it reaches target
 */

import type { ProgressionMode, ExerciseProgressState } from '@/types/practice';
import { supabase } from '@/integrations/supabase/client';

export interface ProgressionContext {
    mode: ProgressionMode;
    exerciseIds: string[];
    currentIndex: number;
    targetBpm?: number;
    exerciseProgress?: Record<string, ExerciseProgressState>;
}

export interface NextExerciseResult {
    exerciseId: string;
    index: number;
    reason: string;
}

/**
 * Get the next exercise based on progression mode
 */
export function getNextExercise(
    context: ProgressionContext,
    completedExerciseId?: string
): NextExerciseResult | null {
    const { mode, exerciseIds, currentIndex } = context;

    if (exerciseIds.length === 0) return null;

    switch (mode) {
        case 'cycle':
            return getNextForCycleMode(context, completedExerciseId);

        case 'sequential':
            return getNextForSequentialMode(context, completedExerciseId);

        case 'focus':
            return getNextForFocusMode(context, completedExerciseId);

        default:
            return getNextForCycleMode(context, completedExerciseId);
    }
}

/**
 * Cycle Mode: Rotate through all exercises, loop back to start
 */
function getNextForCycleMode(
    context: ProgressionContext,
    _completedExerciseId?: string
): NextExerciseResult {
    const { exerciseIds, currentIndex } = context;
    const nextIndex = (currentIndex + 1) % exerciseIds.length;

    return {
        exerciseId: exerciseIds[nextIndex],
        index: nextIndex,
        reason: nextIndex === 0
            ? 'Completed all exercises, starting over'
            : `Moving to exercise ${nextIndex + 1} of ${exerciseIds.length}`,
    };
}

/**
 * Sequential Mode: Complete exercises in order, stop at end
 */
function getNextForSequentialMode(
    context: ProgressionContext,
    _completedExerciseId?: string
): NextExerciseResult | null {
    const { exerciseIds, currentIndex } = context;
    const nextIndex = currentIndex + 1;

    if (nextIndex >= exerciseIds.length) {
        return null; // Completed all exercises
    }

    return {
        exerciseId: exerciseIds[nextIndex],
        index: nextIndex,
        reason: `Moving to exercise ${nextIndex + 1} of ${exerciseIds.length}`,
    };
}

/**
 * Focus Mode: Auto-switch to lowest BPM exercise until it reaches target
 */
function getNextForFocusMode(
    context: ProgressionContext,
    _completedExerciseId?: string
): NextExerciseResult {
    const { exerciseIds, exerciseProgress, targetBpm = 90 } = context;

    if (!exerciseProgress || Object.keys(exerciseProgress).length === 0) {
        // No progress data yet, start with first exercise
        return {
            exerciseId: exerciseIds[0],
            index: 0,
            reason: 'Starting with first exercise (no progress data yet)',
        };
    }

    // Find exercises below target BPM
    const belowTarget = exerciseIds
        .map((id, index) => ({
            id,
            index,
            maxBpm: exerciseProgress[id]?.max_bpm || 0,
        }))
        .filter(ex => ex.maxBpm < targetBpm)
        .sort((a, b) => a.maxBpm - b.maxBpm);

    if (belowTarget.length === 0) {
        // All exercises at target! Cycle through for maintenance
        const nextIndex = (context.currentIndex + 1) % exerciseIds.length;
        return {
            exerciseId: exerciseIds[nextIndex],
            index: nextIndex,
            reason: `All exercises at target (${targetBpm} BPM)! Maintenance mode.`,
        };
    }

    // Focus on the lowest BPM exercise
    const lowestExercise = belowTarget[0];
    return {
        exerciseId: lowestExercise.id,
        index: lowestExercise.index,
        reason: `Focusing on exercise at ${lowestExercise.maxBpm} BPM until it reaches ${targetBpm} BPM`,
    };
}

/**
 * Update progression state after completing an exercise
 */
export function updateProgressionState(
    currentState: ProgressionContext,
    completedExerciseId: string,
    achievedBpm: number
): ProgressionContext {
    const { mode, exerciseProgress = {} } = currentState;

    // Update exercise progress
    const updatedProgress: Record<string, ExerciseProgressState> = {
        ...exerciseProgress,
        [completedExerciseId]: {
            exercise_id: completedExerciseId,
            max_bpm: Math.max(exerciseProgress[completedExerciseId]?.max_bpm || 0, achievedBpm),
            target_bpm: currentState.targetBpm || 90,
            last_practiced: new Date().toISOString(),
            times_practiced: (exerciseProgress[completedExerciseId]?.times_practiced || 0) + 1,
        },
    };

    // Get next exercise
    const next = getNextExercise({ ...currentState, exerciseProgress: updatedProgress }, completedExerciseId);

    return {
        ...currentState,
        currentIndex: next?.index ?? currentState.currentIndex,
        exerciseProgress: updatedProgress,
    };
}

/**
 * Load exercise progress from practice_log for a set of exercises
 */
export async function loadExerciseProgress(
    userId: string,
    exerciseIds: string[]
): Promise<Record<string, ExerciseProgressState>> {
    if (exerciseIds.length === 0) return {};

    const { data, error } = await supabase
        .from('practice_log')
        .select('scale_id, max_bpm, created_at')
        .eq('user_id', userId)
        .in('scale_id', exerciseIds)
        .order('created_at', { ascending: false });

    if (error || !data) return {};

    // Group by exercise and get max BPM
    const progress: Record<string, ExerciseProgressState> = {};

    data.forEach(log => {
        const id = log.scale_id;
        if (!id) return;

        if (!progress[id]) {
            progress[id] = {
                exercise_id: id,
                max_bpm: log.max_bpm || 0,
                target_bpm: 90,
                last_practiced: log.created_at,
                times_practiced: 1,
            };
        } else {
            progress[id].max_bpm = Math.max(progress[id].max_bpm, log.max_bpm || 0);
            progress[id].times_practiced += 1;
        }
    });

    return progress;
}

/**
 * Get a summary of progress for display
 */
export function getProgressSummary(
    context: ProgressionContext
): {
    completed: number;
    remaining: number;
    averageBpm: number;
    lowestBpm: number;
    highestBpm: number;
    allAtTarget: boolean;
} {
    const { exerciseIds, exerciseProgress = {}, targetBpm = 90 } = context;

    const bpms = exerciseIds
        .map(id => exerciseProgress[id]?.max_bpm || 0)
        .filter(bpm => bpm > 0);

    const completed = bpms.filter(bpm => bpm >= targetBpm).length;

    return {
        completed,
        remaining: exerciseIds.length - completed,
        averageBpm: bpms.length > 0 ? Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length) : 0,
        lowestBpm: Math.min(...bpms, 0),
        highestBpm: Math.max(...bpms, 0),
        allAtTarget: completed === exerciseIds.length,
    };
}
