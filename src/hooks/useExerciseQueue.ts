import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RepertoireItem } from '@/types/repertoire';
import { useAuth } from '@/contexts/AuthContext';
import type { ProgressionMode, ExerciseProgressState } from '@/types/practice';
import {
    getNextExercise,
    updateProgressionState,
    loadExerciseProgress,
    getProgressSummary,
    type ProgressionContext,
} from '@/lib/progressionEngine';

export interface UseExerciseQueueOptions {
    moduleType: 'scale' | 'arpeggio';
    // LEGACY: priorityIds are exercise IDs (scale IDs) - kept for backward compatibility
    priorityIds?: string[];       // Practice these first (in this order) - these are scale IDs
    // NEW: priorityShapeIds are shape IDs - for shape-by-shape learning progression
    priorityShapeIds?: string[];  // Practice these shapes first (in this order) - these are scale_shape IDs
    typeFilter?: string;          // Filter by Type field
    orderBy?: 'created_at' | 'name'; // Fallback ordering
    initialIndex?: number;        // Starting position in queue
    groupByShape?: boolean;       // If true, show only one exercise per scale_shape (default: true for scale/arpeggio)
    // NEW: Progression mode options
    progressionMode?: ProgressionMode;  // 'cycle' | 'sequential' | 'focus'
    focusTargetBpm?: number;            // Target BPM for focus mode (default 90)
}

export interface UseExerciseQueueReturn {
    currentExercise: RepertoireItem | null;
    currentIndex: number;
    totalCount: number;
    queue: RepertoireItem[];
    next: () => void;
    previous: () => void;
    goTo: (index: number) => void;
    loading: boolean;
    error: string | null;
    // NEW: Progression mode features
    progressionMode: ProgressionMode;
    exerciseProgress: Record<string, ExerciseProgressState>;
    progressSummary: ReturnType<typeof getProgressSummary> | null;
    recordExerciseComplete: (exerciseId: string, achievedBpm: number) => void;
    isCompleted: boolean; // True if sequential mode and all done
}

/**
 * Hook to manage an ordered queue of exercises for a module instance.
 * 
 * Ordering logic (when groupByShape is true - default for scale/arpeggio):
 * 1. Priority scale_shapes (from priorityIds) come first, in specified order
 * 2. For each scale_shape, pick one representative scale (first by position or alphabetically)
 * 3. Remaining scale_shapes ordered by scale_shapes.created_at (or name)
 * 
 * This ensures users progress shape-by-shape rather than key-by-key within the same shape.
 */
export function useExerciseQueue({
    moduleType,
    priorityIds = [],        // LEGACY: exercise IDs (scale IDs)
    priorityShapeIds = [],   // NEW: shape IDs (scale_shape IDs)
    typeFilter,
    orderBy = 'created_at',
    initialIndex = 0,
    groupByShape = true, // Default to true for shape-by-shape learning
    progressionMode = 'cycle',
    focusTargetBpm = 90,
}: UseExerciseQueueOptions): UseExerciseQueueReturn {
    const { user } = useAuth();
    const [queue, setQueue] = useState<RepertoireItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [exerciseProgress, setExerciseProgress] = useState<Record<string, ExerciseProgressState>>({});
    const [isCompleted, setIsCompleted] = useState(false);

    // Prevent duplicate fetches using a ref
    const fetchingRef = useRef(false);
    const lastFetchKeyRef = useRef<string>('');

    // Stable key for dependency tracking (prevents infinite loop from array reference)
    const priorityIdsKey = JSON.stringify(priorityIds);
    const priorityShapeIdsKey = JSON.stringify(priorityShapeIds);

    // Fetch and sort exercises
    useEffect(() => {
        const fetchKey = `${moduleType}-${priorityIdsKey}-${priorityShapeIdsKey}-${typeFilter}-${orderBy}-${groupByShape}`;

        // Skip if already fetching or same request
        if (fetchingRef.current) return;
        if (fetchKey === lastFetchKeyRef.current && queue.length > 0) return;

        async function loadExercises() {
            fetchingRef.current = true;
            lastFetchKeyRef.current = fetchKey;
            setLoading(true);
            setError(null);

            try {
                // Build query for scales/arpeggios
                let query = supabase
                    .from('scales')
                    .select('*');

                // Apply type filter if provided (exact match for enum)
                if (typeFilter) {
                    query = query.eq('Type', typeFilter);
                }

                // NOTE: We don't filter by arpeggio vs scale in the query because
                // Type is an enum and ilike doesn't work on enums.
                // We'll filter client-side instead.

                const { data: scales, error: fetchError } = await query;

                if (fetchError) {
                    throw fetchError;
                }

                if (!scales || scales.length === 0) {
                    setQueue([]);
                    setLoading(false);
                    return;
                }

                // Filter by module type client-side (scale vs arpeggio)
                // The 'Type' field contains values like '3 Notes Per String Scale', 'arpeggio', etc.
                let filteredScales = scales;
                if (!typeFilter) {
                    if (moduleType === 'arpeggio') {
                        filteredScales = scales.filter((s: any) =>
                            s.Type?.toLowerCase().includes('arpeggio')
                        );
                    } else {
                        // For scales, exclude arpeggios
                        filteredScales = scales.filter((s: any) =>
                            !s.Type?.toLowerCase().includes('arpeggio')
                        );
                    }
                }

                if (filteredScales.length === 0) {
                    setQueue([]);
                    setLoading(false);
                    return;
                }

                // Fetch scale_shapes data for ordering
                // Get unique scale_shape IDs from filtered scales
                const shapeIds = [...new Set(filteredScales
                    .map((s: any) => s.scale_shape)
                    .filter(Boolean))];
                
                let shapeDataMap = new Map<string, { created_at: string }>();
                if (shapeIds.length > 0) {
                    const { data: shapes } = await supabase
                        .from('scale_shapes')
                        .select('id, created_at')
                        .in('id', shapeIds);
                    
                    if (shapes) {
                        shapes.forEach((shape: any) => {
                            shapeDataMap.set(shape.id, { created_at: shape.created_at });
                        });
                    }
                }

                // Transform to RepertoireItem format
                // Include scale_shape data for grouping and ordering
                const exercises: RepertoireItem[] = filteredScales.map((scale: any) => ({
                    id: scale.id,
                    name: scale.name || 'Unknown',
                    category: moduleType,
                    difficulty: scale.difficulty || 1,
                    notes: scale.notes_json ?? [],
                    tonic: scale.root_note || 'C',
                    tonality: scale.tonality || 'Major',
                    Type: scale.Type,
                    description: scale.description,
                    created_at: scale.created_at,
                    position: scale.Position,
                    scale_shape: scale.scale_shape,
                    scale_shape_created_at: scale.scale_shape 
                        ? shapeDataMap.get(scale.scale_shape)?.created_at 
                        : undefined,
                    major_key: scale.major_key,
                }));

                // Group by scale_shape if enabled (default for scale/arpeggio modules)
                // This ensures we show one exercise per shape, not all 12 keys of the same shape
                let processedExercises = exercises;
                if (groupByShape) {
                    const shapeMap = new Map<string, RepertoireItem>();
                    exercises.forEach(exercise => {
                        const shapeId = exercise.scale_shape;
                        if (shapeId) {
                            // Keep the first (lowest position/most natural key) for each shape
                            if (!shapeMap.has(shapeId)) {
                                shapeMap.set(shapeId, exercise);
                            } else {
                                const existing = shapeMap.get(shapeId)!;
                                // Prefer lower position, or if same position, earlier in alphabet
                                const posDiff = (exercise.position ?? 9999) - (existing.position ?? 9999);
                                if (posDiff < 0 || (posDiff === 0 && exercise.name < existing.name)) {
                                    shapeMap.set(shapeId, exercise);
                                }
                            }
                        } else {
                            // For exercises without a scale_shape, use the exercise ID as key
                            shapeMap.set(exercise.id, exercise);
                        }
                    });
                    processedExercises = Array.from(shapeMap.values());
                }

                // Sort: priority exercises/shapes first, then by scale_shapes.created_at or name
                const sortedQueue: RepertoireItem[] = [];
                const remainingExercises = [...processedExercises];

                // Priority 1: priorityShapeIds (NEW - scale_shape IDs for shape-by-shape learning)
                // These take precedence as they're the new shape-based priority system
                for (const priorityShapeId of priorityShapeIds) {
                    const idx = remainingExercises.findIndex(e => e.scale_shape === priorityShapeId);
                    if (idx !== -1) {
                        sortedQueue.push(remainingExercises[idx]);
                        remainingExercises.splice(idx, 1);
                    }
                }

                // Priority 2: priorityIds (LEGACY - exercise IDs for backward compatibility)
                // These are exercise IDs (scale IDs), not shape IDs
                // When groupByShape is true, we find the exercise that matches the ID,
                // or if that exercise was deduplicated, we find the representative for its shape
                for (const priorityId of priorityIds) {
                    // First try to find the exact exercise by ID
                    let idx = remainingExercises.findIndex(e => e.id === priorityId);
                    if (idx === -1) {
                        // If not found (maybe it was deduplicated), find by shape
                        const priorityExercise = exercises.find(e => e.id === priorityId);
                        if (priorityExercise?.scale_shape) {
                            idx = remainingExercises.findIndex(e => e.scale_shape === priorityExercise.scale_shape);
                        }
                    }
                    if (idx !== -1) {
                        sortedQueue.push(remainingExercises[idx]);
                        remainingExercises.splice(idx, 1);
                    }
                }

                // Sort remaining by scale_shape creation date (not scale creation date)
                remainingExercises.sort((a, b) => {
                    if (orderBy === 'name') {
                        return (a.name || '').localeCompare(b.name || '');
                    }
                    // Default: order by scale_shape created_at (natural learning progression)
                    // This ensures we go shape-by-shape, not through all 12 keys of one shape
                    const dateA = new Date(a.scale_shape_created_at || a.created_at || 0).getTime();
                    const dateB = new Date(b.scale_shape_created_at || b.created_at || 0).getTime();
                    return dateA - dateB;
                });

                // Combine priority + remaining
                sortedQueue.push(...remainingExercises);

                setQueue(sortedQueue);

                // Clamp initial index to valid range
                if (initialIndex >= sortedQueue.length) {
                    setCurrentIndex(0);
                }
            } catch (err: any) {
                console.error('Error loading exercises:', err);
                setError(err.message || 'Failed to load exercises');
            } finally {
                fetchingRef.current = false;
                setLoading(false);
            }
        }

        loadExercises();
    }, [moduleType, priorityIdsKey, priorityShapeIdsKey, typeFilter, orderBy, initialIndex, queue.length, groupByShape]);

    // Navigation functions
    const next = useCallback(() => {
        setCurrentIndex(prev => {
            if (prev >= queue.length - 1) {
                return 0; // Loop back to start
            }
            return prev + 1;
        });
    }, [queue.length]);

    const previous = useCallback(() => {
        setCurrentIndex(prev => {
            if (prev <= 0) {
                return Math.max(0, queue.length - 1); // Loop to end
            }
            return prev - 1;
        });
    }, [queue.length]);

    const goTo = useCallback((index: number) => {
        if (index >= 0 && index < queue.length) {
            setCurrentIndex(index);
        }
    }, [queue.length]);

    // Current exercise
    const currentExercise = useMemo(() => {
        if (queue.length === 0 || currentIndex >= queue.length) {
            return null;
        }
        return queue[currentIndex];
    }, [queue, currentIndex]);

    // Load exercise progress from database when user and queue are ready
    useEffect(() => {
        if (!user?.id || queue.length === 0) return;

        const exerciseIds = queue.map(e => e.id);
        loadExerciseProgress(user.id, exerciseIds).then(progress => {
            setExerciseProgress(progress);
        });
    }, [user?.id, queue]);

    // Compute progress summary for display
    const progressSummary = useMemo(() => {
        if (queue.length === 0) return null;

        const context: ProgressionContext = {
            mode: progressionMode,
            exerciseIds: queue.map(e => e.id),
            currentIndex,
            targetBpm: focusTargetBpm,
            exerciseProgress,
        };

        return getProgressSummary(context);
    }, [queue, currentIndex, progressionMode, focusTargetBpm, exerciseProgress]);

    // Record exercise completion and advance based on progression mode
    const recordExerciseComplete = useCallback((exerciseId: string, achievedBpm: number) => {
        const context: ProgressionContext = {
            mode: progressionMode,
            exerciseIds: queue.map(e => e.id),
            currentIndex,
            targetBpm: focusTargetBpm,
            exerciseProgress,
        };

        const updatedState = updateProgressionState(context, exerciseId, achievedBpm);
        setExerciseProgress(updatedState.exerciseProgress || {});

        // Handle navigation based on mode
        if (progressionMode === 'sequential') {
            const nextResult = getNextExercise(updatedState);
            if (nextResult === null) {
                setIsCompleted(true);
                // Stay on current (last) exercise
            } else {
                setCurrentIndex(nextResult.index);
            }
        } else if (progressionMode === 'focus') {
            const nextResult = getNextExercise({ ...updatedState, exerciseProgress: updatedState.exerciseProgress });
            if (nextResult) {
                setCurrentIndex(nextResult.index);
            }
        } else {
            // cycle mode - just advance normally
            next();
        }
    }, [queue, currentIndex, progressionMode, focusTargetBpm, exerciseProgress, next]);

    return {
        currentExercise,
        currentIndex,
        totalCount: queue.length,
        queue,
        next,
        previous,
        goTo,
        loading,
        error,
        // Progression mode features
        progressionMode,
        exerciseProgress,
        progressSummary,
        recordExerciseComplete,
        isCompleted,
    };
}
