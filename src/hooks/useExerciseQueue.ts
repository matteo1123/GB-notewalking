import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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

    // Prevent duplicate fetches using a ref
    const fetchingRef = useRef(false);
    const lastFetchKeyRef = useRef<string>('');

    // Stable key for dependency tracking (prevents infinite loop from array reference)
    const priorityIdsKey = JSON.stringify(priorityIds);

    // Fetch and sort exercises
    useEffect(() => {
        const fetchKey = `${moduleType}-${priorityIdsKey}-${typeFilter}-${orderBy}`;

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
                // Using select('*') to get all columns since column names vary
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

                // Transform to RepertoireItem format
                // Using correct column names from database: root_note, notes_json, Position
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
                    major_key: scale.major_key,
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
                fetchingRef.current = false;
                setLoading(false);
            }
        }

        loadExercises();
    }, [moduleType, priorityIdsKey, typeFilter, orderBy, initialIndex, queue.length]);

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
