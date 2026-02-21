import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { PracticeSession, SessionBlock, ModuleType } from '@/types/practice';
import { generateSessionPlan } from '@/lib/sessionPlanner';

export interface ActiveSession {
    session: PracticeSession;
    currentBlockIndex: number;
    currentBlock: SessionBlock;
    timeElapsed: number; // seconds
    isPaused: boolean;
}

export interface SessionTimerState {
    timeRemaining: number; // seconds in current block
    totalTimeRemaining: number; // seconds in entire session
}

/**
 * Hook to manage guided practice sessions
 * Handles session planning, timing, and navigation
 */
export function usePracticeSession() {
    const { toast } = useToast();
    const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
    const [timer, setTimer] = useState<SessionTimerState>({
        timeRemaining: 0,
        totalTimeRemaining: 0,
    });
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

    /**
     * Generate and start a new practice session
     */
    const startSession = useCallback(async (
        availableTimeMinutes: number = 30,
        lessonId?: string
    ) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast({
                    title: 'Not authenticated',
                    description: 'Please sign in to start a practice session',
                    variant: 'destructive',
                });
                return;
            }

            // 1. Fetch User Profile (Priorities)
            const { data: profile } = await (supabase as any)
                .from('profiles')
                .select('priorities')
                .eq('id', user.id)
                .single();

            // 2. Fetch Curriculum Concepts
            const { data: concepts, error: conceptsError } = await (supabase as any)
                .from('curriculum_concepts')
                .select('*');

            if (conceptsError) throw conceptsError;

            // 3. Fetch User Progress
            const { data: progressData, error: progressError } = await (supabase as any)
                .from('user_concept_progress')
                .select('*')
                .eq('user_id', user.id);

            if (progressError) throw progressError;

            // Construct UserProfile object for planner
            const progressMap: Record<string, any> = {};
            if (progressData) {
                progressData.forEach(p => {
                    progressMap[p.concept_id] = p;
                });
            }

            const userProfile = {
                id: user.id,
                priorities: (profile?.priorities || { rhythm: 5, improv: 5, technique: 5, repertoire: 5 }) as any,
                progress: progressMap
            };

            // 4. Generate Session Plan
            // If specific lesson requested, we might want to handle differently, 
            // but for now we assume "startSession" means "Give me what I need"
            const blocks = generateSessionPlan(
                userProfile,
                (concepts || []) as any,
                {
                    availableTimeMinutes,
                    blockDurationMinutes: 2,
                    maintenanceSplit: 0.2
                }
            );

            if (blocks.length === 0) {
                // Fallback if no intelligent blocks generated (e.g. valid DB but no matching concepts?)
                // Or empty DB?
                console.warn("Intelligent planner returned 0 blocks. Using robust fallback defaults.");

                // Create a standard warmup session manually
                blocks.push(
                    {
                        module_type: 'rhythm',
                        config: { module_type: 'rhythm', rhythm_level: 1 },
                        duration_minutes: 2,
                        order: 0,
                        conceptId: 'fallback-rhythm'
                    },
                    {
                        module_type: 'scale',
                        config: {
                            module_type: 'scale',
                            // Default to C Major if no specific scale
                            type_filter: 'Major',
                            group_by_shape: true
                        },
                        duration_minutes: 2,
                        order: 1,
                        conceptId: 'fallback-scale'
                    },
                    {
                        module_type: 'chord_progressions',
                        config: {
                            module_type: 'chord_progressions',
                            key: 'C',
                            progression_id: '' // Component will default to first available
                        },
                        duration_minutes: 2,
                        order: 2,
                        conceptId: 'fallback-chords'
                    }
                );
            }

            // Double check validation to prevent "No goals established" error
            if (blocks.length === 0) {
                // This should be impossible now, but just in case
                blocks.push({
                    module_type: 'rhythm',
                    config: { module_type: 'rhythm', rhythm_level: 0 },
                    duration_minutes: 2,
                    order: 0,
                    conceptId: 'emergency-fallback'
                });
            }

            // Create session in database
            const { data: session, error } = await (supabase as any)
                .from('practice_sessions')
                .insert({
                    user_id: user.id,
                    lesson_id: lessonId, // Optional, might be null
                    started_at: new Date().toISOString(),
                    total_duration_seconds: availableTimeMinutes * 60,
                    session_plan: blocks as any, // Cast to any for JSON compatibility
                    completed: false,
                })
                .select()
                .single();

            if (error) throw error;

            // Set active session
            const firstBlock = blocks[0];
            setActiveSession({
                session: session as PracticeSession,
                currentBlockIndex: 0,
                currentBlock: firstBlock,
                timeElapsed: 0,
                isPaused: false,
            });

            setTimer({
                timeRemaining: firstBlock.duration_minutes * 60,
                totalTimeRemaining: availableTimeMinutes * 60,
            });

            // Start timer
            startTimer();

            toast({
                title: 'Session started!',
                description: `${blocks.length} activities planned based on your priorities.`,
            });

        } catch (error) {
            console.error('Failed to start session:', error);
            toast({
                title: 'Failed to start session',
                description: 'Please try again',
                variant: 'destructive',
            });
        }
    }, [toast]);

    /**
     * Start/resume timer
     */
    const startTimer = useCallback(() => {
        if (timerIntervalRef.current) return; // Already running

        timerIntervalRef.current = setInterval(() => {
            setActiveSession(prev => {
                if (!prev || prev.isPaused) return prev;
                return { ...prev, timeElapsed: prev.timeElapsed + 1 };
            });

            setTimer(prev => {
                const newTimeRemaining = Math.max(0, prev.timeRemaining - 1);
                const newTotalRemaining = Math.max(0, prev.totalTimeRemaining - 1);

                return {
                    timeRemaining: newTimeRemaining,
                    totalTimeRemaining: newTotalRemaining,
                };
            });
        }, 1000);
    }, []);

    /**
     * Pause timer
     */
    const pauseSession = useCallback(() => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
        setActiveSession(prev => (prev ? { ...prev, isPaused: true } : null));
    }, []);

    /**
     * Resume timer
     */
    const resumeSession = useCallback(() => {
        setActiveSession(prev => (prev ? { ...prev, isPaused: false } : null));
        startTimer();
    }, [startTimer]);

    /**
     * Move to next block
     */
    const nextBlock = useCallback(async () => {
        if (!activeSession) return;

        const nextIndex = activeSession.currentBlockIndex + 1;
        const blocks = activeSession.session.session_plan;

        if (nextIndex >= blocks.length) {
            // Session complete!
            await endSession(true);
            return;
        }

        const nextBlock = blocks[nextIndex];
        setActiveSession(prev => {
            if (!prev) return null;
            return {
                ...prev,
                currentBlockIndex: nextIndex,
                currentBlock: nextBlock,
            };
        });

        setTimer(prev => ({
            ...prev,
            timeRemaining: nextBlock.duration_minutes * 60,
        }));

        toast({
            title: 'Next activity',
            description: `Starting block ${nextIndex + 1} of ${blocks.length}`,
        });
    }, [activeSession, toast]);

    /**
     * Skip current block
     */
    const skipBlock = useCallback(() => {
        nextBlock();
    }, [nextBlock]);

    /**
     * Move to previous block
     */
    const previousBlock = useCallback(() => {
        if (!activeSession) return;

        const prevIndex = activeSession.currentBlockIndex - 1;
        if (prevIndex < 0) return; // Already at first block

        const blocks = activeSession.session.session_plan;
        const prevBlock = blocks[prevIndex];

        setActiveSession(prev => {
            if (!prev) return null;
            return {
                ...prev,
                currentBlockIndex: prevIndex,
                currentBlock: prevBlock,
            };
        });

        setTimer(prev => ({
            ...prev,
            timeRemaining: prevBlock.duration_minutes * 60,
        }));

        toast({
            title: 'Previous activity',
            description: `Returning to block ${prevIndex + 1} of ${blocks.length}`,
        });
    }, [activeSession, toast]);

    /**
     * End session
     */
    const endSession = useCallback(async (completed: boolean = false) => {
        if (!activeSession) return;

        try {
            // Update session in database
            await (supabase as any)
                .from('practice_sessions')
                .update({
                    ended_at: new Date().toISOString(),
                    completed,
                })
                .eq('id', activeSession.session.id);

            // Stop timer
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }

            setActiveSession(null);
            setTimer({ timeRemaining: 0, totalTimeRemaining: 0 });

            toast({
                title: completed ? 'Session complete! 🎉' : 'Session ended',
                description: completed
                    ? 'Great work today!'
                    : 'Your progress has been saved',
            });

        } catch (error) {
            console.error('Failed to end session:', error);
        }
    }, [activeSession, toast]);

    /**
     * Auto-advance when block timer reaches zero
     */
    useEffect(() => {
        if (timer.timeRemaining === 0 && activeSession && !activeSession.isPaused) {
            nextBlock();
        }
    }, [timer.timeRemaining, activeSession, nextBlock]);

    /**
     * Cleanup on unmount
     */
    useEffect(() => {
        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        };
    }, []);

    return {
        activeSession,
        timer,
        startSession,
        pauseSession,
        resumeSession,
        nextBlock,
        previousBlock,
        skipBlock,
        endSession,
        isActive: activeSession !== null,
        isPaused: activeSession?.isPaused || false,
    };
}
