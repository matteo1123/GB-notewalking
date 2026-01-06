import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RepertoireItem } from '@/types/repertoire';

export interface UseExerciseQueueOptions {
    moduleType: 'scale' | 'arpeggio';
    priorityIds?: string[];       // Practice these first (in this order)
    typeFilter?: string;          // Filter by Type field
    orderBy?: 'created_at' | 'name'; // Fallback ordering
    initialIndex?: number;        // Starting position in queue
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
}

/**
 * Hook to manage an ordered queue of exercises for a module instance.
 * 
 * Ordering logic:
 * 1. Priority exercises (from priorityIds) come first, in specified order
 * 2. Remaining exercises ordered by scale_shapes.created_at (or name)
 */
export function useExerciseQueue({
    moduleType,
    priorityIds = [],
    typeFilter,
    orderBy = 'created_at',
    initialIndex = 0,
}: UseExerciseQueueOptions): UseExerciseQueueReturn {
    const [queue, setQueue] = useState<RepertoireItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch and sort exercises
    useEffect(() => {
        async function loadExercises() {
            setLoading(true);
            setError(null);

            try {
                // Build query for scales/arpeggios
                let query = supabase
                    .from('scales')
                    .select(`
            id,
            name,
            notes,
            Type,
            key,
            mode,
            difficulty,
            description,
            created_at,
            scale_shape,
            position
          `);

                // Apply type filter if provided
                if (typeFilter) {
                    query = query.eq('Type', typeFilter);
                }

                // Apply module type filter (scale vs arpeggio)
                // The 'Type' field contains values like '3 Notes Per String Scale', 'arpeggio', etc.
                if (moduleType === 'arpeggio') {
                    query = query.ilike('Type', '%arpeggio%');
                } else {
                    // For scales, exclude arpeggios unless typeFilter is specifically set
                    if (!typeFilter) {
                        query = query.not('Type', 'ilike', '%arpeggio%');
                    }
                }

                const { data: scales, error: fetchError } = await query;

                if (fetchError) {
                    throw fetchError;
                }

                if (!scales || scales.length === 0) {
                    setQueue([]);
                    setLoading(false);
                    return;
                }

                // Transform to RepertoireItem format
                const exercises: RepertoireItem[] = scales.map((scale: any) => ({
                    id: scale.id,
                    name: scale.name || 'Unknown',
                    category: moduleType,
                    difficulty: scale.difficulty || 1,
                    notes: scale.notes || [],
                    tonic: scale.key || 'C',
                    tonality: scale.mode || 'Major',
                    Type: scale.Type,
                    description: scale.description,
                    created_at: scale.created_at,
                    position: scale.position,
                    scale_shape: scale.scale_shape,
                }));

                // Sort: priority exercises first, then by created_at or name
                const sortedQueue: RepertoireItem[] = [];
                const remainingExercises = [...exercises];

                // Add priority exercises first (in order specified)
                for (const priorityId of priorityIds) {
                    const idx = remainingExercises.findIndex(e => e.id === priorityId);
                    if (idx !== -1) {
                        sortedQueue.push(remainingExercises[idx]);
                        remainingExercises.splice(idx, 1);
                    }
                }

                // Sort remaining by fallback order
                remainingExercises.sort((a, b) => {
                    if (orderBy === 'name') {
                        return (a.name || '').localeCompare(b.name || '');
                    }
                    // Default: order by position first, then by created_at
                    const posA = a.position ?? 9999;
                    const posB = b.position ?? 9999;
                    if (posA !== posB) {
                        return posA - posB;
                    }
                    const dateA = new Date(a.created_at || 0).getTime();
                    const dateB = new Date(b.created_at || 0).getTime();
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
                setLoading(false);
            }
        }

        loadExercises();
    }, [moduleType, priorityIds, typeFilter, orderBy, initialIndex]);

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
    };
}
