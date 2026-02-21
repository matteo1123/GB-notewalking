import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type {
    PracticeRoutine,
    PracticeRoutineSummary,
    CreateRoutineInput,
    UpdateRoutineInput,
    SessionBlock,
} from '@/types/practice';

export interface UseRoutinesReturn {
    routines: PracticeRoutineSummary[];
    loading: boolean;
    error: string | null;

    // CRUD operations
    createRoutine: (input: CreateRoutineInput) => Promise<PracticeRoutine | null>;
    getRoutine: (id: string) => Promise<PracticeRoutine | null>;
    updateRoutine: (id: string, input: UpdateRoutineInput) => Promise<boolean>;
    deleteRoutine: (id: string) => Promise<boolean>;

    // Convenience operations
    toggleFavorite: (id: string) => Promise<boolean>;
    duplicateRoutine: (id: string, newName: string) => Promise<PracticeRoutine | null>;
    recordPractice: (id: string) => Promise<boolean>;

    // Refresh
    refresh: () => Promise<void>;
}

/**
 * Hook to manage practice routines - named, reusable practice configurations.
 *
 * Example usage:
 * ```tsx
 * const { routines, createRoutine, toggleFavorite } = useRoutines();
 *
 * // Create a new routine
 * const routine = await createRoutine({
 *   name: "C# Minor Mastery",
 *   session_plan: [...],
 * });
 *
 * // Toggle favorite
 * await toggleFavorite(routine.id);
 * ```
 */
export function useRoutines(): UseRoutinesReturn {
    const { toast } = useToast();
    const { user } = useAuth();
    const [routines, setRoutines] = useState<PracticeRoutineSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /**
     * Load all routines for the current user
     */
    const refresh = useCallback(async () => {
        if (!user) {
            setRoutines([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const [
                { data: routinesData, error: routinesError },
                { data: sessionsData, error: sessionsError }
            ] = await Promise.all([
                (supabase as any)
                    .from('practice_routines')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('is_active', true)
                    .order('last_practiced_at', { ascending: false, nullsFirst: false }),
                (supabase as any)
                    .from('practice_sessions')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('started_at', { ascending: false })
                    .limit(10)
            ]);

            if (routinesError) throw routinesError;
            if (sessionsError) console.error("Could not fetch sessions", sessionsError);

            // Transform routines to summary format
            const routineSummaries: PracticeRoutineSummary[] = (routinesData || []).map((row: any) => ({
                id: row.id,
                name: row.name,
                description: row.description,
                icon: row.icon || '🎸',
                color: row.color || 'blue',
                is_favorite: row.is_favorite || false,
                last_practiced_at: row.last_practiced_at,
                times_practiced: row.times_practiced || 0,
                module_count: Array.isArray(row.session_plan) ? row.session_plan.length : 0,
                total_duration_minutes: row.total_duration_minutes,
                created_by_ai: row.created_by_ai || false,
                is_history: false
            }));

            // Transform recent sessions to summary format
            const sessionSummaries: PracticeRoutineSummary[] = (sessionsData || [])
                .filter((s: any) => Array.isArray(s.session_plan) && s.session_plan.length > 0)
                .map((row: any) => {
                    const moduleTypes = Array.from(new Set(row.session_plan.map((b: any) => b.module_type)));
                    const generatedName = `${moduleTypes.map(t => typeof t === 'string' ? t.replace('_', ' ') : 'Module').join(', ')} Practice`;

                    return {
                        id: row.id,
                        name: `Recent: ${generatedName} (${new Date(row.started_at).toLocaleDateString()})`,
                        description: `Practice session from ${new Date(row.started_at).toLocaleString()}`,
                        icon: '🕒',
                        color: 'gray',
                        is_favorite: false,
                        last_practiced_at: row.started_at,
                        times_practiced: 1,
                        module_count: row.session_plan.length,
                        total_duration_minutes: Math.ceil((row.total_duration_seconds || 0) / 60) || row.session_plan.reduce((acc: number, b: any) => acc + (b.duration_minutes || 0), 0),
                        created_by_ai: false,
                        is_history: true
                    };
                });

            // Make sure we have a default routine if none exist
            if (routineSummaries.length === 0) {
                routineSummaries.push({
                    id: 'default-daily-practice',
                    name: "Default Daily Practice",
                    description: "A balanced 10-minute daily guitar workout.",
                    icon: '🎸',
                    color: 'blue',
                    is_favorite: true,
                    times_practiced: 0,
                    module_count: 4,
                    total_duration_minutes: 10,
                    created_by_ai: false,
                    is_history: false
                });
            }

            // Merge and sort
            const unified = [...routineSummaries, ...sessionSummaries].sort((a, b) => {
                const dateA = a.last_practiced_at ? new Date(a.last_practiced_at).getTime() : 0;
                const dateB = b.last_practiced_at ? new Date(b.last_practiced_at).getTime() : 0;
                return dateB - dateA; // Descending
            });

            setRoutines(unified);
        } catch (err: any) {
            console.error('Failed to load routines:', err);
            setError(err.message || 'Failed to load routines');
        } finally {
            setLoading(false);
        }
    }, [user]);

    // Load on mount and when user changes
    useEffect(() => {
        refresh();
    }, [refresh]);

    /**
     * Create a new routine
     */
    const createRoutine = useCallback(async (input: CreateRoutineInput): Promise<PracticeRoutine | null> => {
        if (!user) {
            toast({
                title: 'Not authenticated',
                description: 'Please sign in to create routines',
                variant: 'destructive',
            });
            return null;
        }

        try {
            // Calculate total duration from session plan
            const totalDuration = input.session_plan.reduce(
                (acc, block) => acc + (block.duration_minutes || 0),
                0
            );

            const { data, error: insertError } = await (supabase as any)
                .from('practice_routines')
                .insert({
                    user_id: user.id,
                    name: input.name,
                    description: input.description,
                    icon: input.icon || '🎸',
                    color: input.color || 'blue',
                    session_plan: input.session_plan,
                    total_duration_minutes: totalDuration,
                    is_favorite: input.is_favorite || false,
                    created_by_ai: input.created_by_ai || false,
                    ai_prompt: input.ai_prompt,
                })
                .select()
                .single();

            if (insertError) throw insertError;

            toast({
                title: 'Routine created!',
                description: `"${input.name}" is ready to use`,
            });

            await refresh();
            return data as PracticeRoutine;

        } catch (err: any) {
            console.error('Failed to create routine:', err);
            toast({
                title: 'Failed to create routine',
                description: err.message || 'Please try again',
                variant: 'destructive',
            });
            return null;
        }
    }, [user, toast, refresh]);

    /**
     * Get a full routine by ID
     */
    const getRoutine = useCallback(async (id: string): Promise<PracticeRoutine | null> => {
        try {
            const { data, error: fetchError } = await (supabase as any)
                .from('practice_routines')
                .select('*')
                .eq('id', id)
                .single();

            if (fetchError) throw fetchError;

            return data as PracticeRoutine;

        } catch (err: any) {
            console.error('Failed to get routine:', err);
            return null;
        }
    }, []);

    /**
     * Update an existing routine
     */
    const updateRoutine = useCallback(async (id: string, input: UpdateRoutineInput): Promise<boolean> => {
        try {
            const updateData: any = { ...input };

            // Recalculate total duration if session_plan changed
            if (input.session_plan) {
                updateData.total_duration_minutes = input.session_plan.reduce(
                    (acc, block) => acc + (block.duration_minutes || 0),
                    0
                );
            }

            const { error: updateError } = await (supabase as any)
                .from('practice_routines')
                .update(updateData)
                .eq('id', id);

            if (updateError) throw updateError;

            toast({
                title: 'Routine updated',
            });

            await refresh();
            return true;

        } catch (err: any) {
            console.error('Failed to update routine:', err);
            toast({
                title: 'Failed to update routine',
                description: err.message || 'Please try again',
                variant: 'destructive',
            });
            return false;
        }
    }, [toast, refresh]);

    /**
     * Delete a routine (soft delete - sets is_active to false)
     */
    const deleteRoutine = useCallback(async (id: string): Promise<boolean> => {
        try {
            const { error: deleteError } = await (supabase as any)
                .from('practice_routines')
                .update({ is_active: false })
                .eq('id', id);

            if (deleteError) throw deleteError;

            toast({
                title: 'Routine deleted',
            });

            await refresh();
            return true;

        } catch (err: any) {
            console.error('Failed to delete routine:', err);
            toast({
                title: 'Failed to delete routine',
                variant: 'destructive',
            });
            return false;
        }
    }, [toast, refresh]);

    /**
     * Toggle favorite status
     */
    const toggleFavorite = useCallback(async (id: string): Promise<boolean> => {
        try {
            // Find current state
            const routine = routines.find(r => r.id === id);
            if (!routine) return false;

            const { error: updateError } = await (supabase as any)
                .from('practice_routines')
                .update({ is_favorite: !routine.is_favorite })
                .eq('id', id);

            if (updateError) throw updateError;

            // Optimistic update
            setRoutines(prev => prev.map(r =>
                r.id === id ? { ...r, is_favorite: !r.is_favorite } : r
            ));

            return true;

        } catch (err: any) {
            console.error('Failed to toggle favorite:', err);
            return false;
        }
    }, [routines]);

    /**
     * Duplicate a routine with a new name
     */
    const duplicateRoutine = useCallback(async (id: string, newName: string): Promise<PracticeRoutine | null> => {
        try {
            const original = await getRoutine(id);
            if (!original) return null;

            return await createRoutine({
                name: newName,
                description: original.description,
                icon: original.icon,
                color: original.color,
                session_plan: original.session_plan,
                is_favorite: false,
                created_by_ai: false,
            });

        } catch (err: any) {
            console.error('Failed to duplicate routine:', err);
            return null;
        }
    }, [getRoutine, createRoutine]);

    /**
     * Record that a routine was practiced (updates last_practiced_at and times_practiced)
     */
    const recordPractice = useCallback(async (id: string): Promise<boolean> => {
        try {
            const routine = routines.find(r => r.id === id);

            const { error: updateError } = await (supabase as any)
                .from('practice_routines')
                .update({
                    last_practiced_at: new Date().toISOString(),
                    times_practiced: (routine?.times_practiced || 0) + 1,
                })
                .eq('id', id);

            if (updateError) throw updateError;

            // Optimistic update
            setRoutines(prev => prev.map(r =>
                r.id === id
                    ? {
                        ...r,
                        last_practiced_at: new Date().toISOString(),
                        times_practiced: r.times_practiced + 1,
                    }
                    : r
            ));

            return true;

        } catch (err: any) {
            console.error('Failed to record practice:', err);
            return false;
        }
    }, [routines]);

    return {
        routines,
        loading,
        error,
        createRoutine,
        getRoutine,
        updateRoutine,
        deleteRoutine,
        toggleFavorite,
        duplicateRoutine,
        recordPractice,
        refresh,
    };
}
