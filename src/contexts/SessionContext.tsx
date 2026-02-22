import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { PracticeSession, SessionBlock, ModuleType, ModuleConfig } from '@/types/practice';

// Local type for session generation
interface SampleGoal {
    id: string;
    lesson_id: string;
    module_type: ModuleType;
    module_config: ModuleConfig;
}

export interface ActiveSession {
    session: PracticeSession;
    currentBlockIndex: number;
    currentBlock: SessionBlock;
    timeElapsed: number; // seconds
    isPaused: boolean;
    routineId?: string;
}

export interface SessionTimerState {
    timeRemaining: number; // seconds in current block
    totalTimeRemaining: number; // seconds in entire session
}

interface SessionContextType {
    activeSession: ActiveSession | null;
    completedSession: ActiveSession | null;
    timer: SessionTimerState;
    startSession: (availableTimeMinutes?: number, lessonId?: string) => Promise<void>;
    startSessionWithPlan: (name: string, blocks: SessionBlock[], routineId?: string) => Promise<void>;
    pauseSession: () => void;
    resumeSession: () => void;
    nextBlock: () => Promise<void>;
    skipBlock: () => void;
    endSession: (completed?: boolean) => Promise<void>;
    clearCompletedSession: () => void;
    isActive: boolean;
    isPaused: boolean;
    autoAdvanceEnabled: boolean;
    setAutoAdvanceEnabled: (enabled: boolean) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
    const { toast } = useToast();
    const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
    const [completedSession, setCompletedSession] = useState<ActiveSession | null>(null);
    const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(true);
    const [timer, setTimer] = useState<SessionTimerState>({
        timeRemaining: 0,
        totalTimeRemaining: 0,
    });
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Save timer ref to clear it on unmount
    useEffect(() => {
        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        };
    }, []);

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

            if (completed) {
                setCompletedSession(activeSession);
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

    const clearCompletedSession = useCallback(() => {
        setCompletedSession(null);
    }, []);

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
    }, [activeSession, endSession, toast]);

    /**
     * Skip current block
     */
    const skipBlock = useCallback(() => {
        nextBlock();
    }, [nextBlock]);


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

            // Default sample session for new users - includes ALL modules
            // for a better first impression with variety
            const sampleGoals: SampleGoal[] = [
                {
                    id: '1',
                    lesson_id: lessonId || 'default',
                    module_type: 'rhythm',
                    module_config: { module_type: 'rhythm', rhythm_level: 1 },
                },
                {
                    id: '2',
                    lesson_id: lessonId || 'default',
                    module_type: 'notewalking',
                    module_config: { module_type: 'notewalking', key: 'C', chords: ['I', 'IV', 'V'], measures_per_chord: 4 },
                },
                {
                    id: '3',
                    lesson_id: lessonId || 'default',
                    module_type: 'scale',
                    module_config: { module_type: 'scale' },
                },
                {
                    id: '4',
                    lesson_id: lessonId || 'default',
                    module_type: 'arpeggio',
                    module_config: { module_type: 'arpeggio' },
                },
                {
                    id: '5',
                    lesson_id: lessonId || 'default',
                    module_type: 'chord_progressions',
                    module_config: { module_type: 'chord_progressions', key: 'C', progression_id: '' },
                },
            ];

            // Generate session plan directly from sample goals
            // This bypasses the intelligent curriculum system that's still being integrated
            const blocks: SessionBlock[] = sampleGoals.map((goal, index) => ({
                module_type: goal.module_type,
                config: goal.module_config,
                duration_minutes: Math.floor(availableTimeMinutes / sampleGoals.length),
                order: index,
                conceptId: `sample-${goal.id}`
            }));

            if (blocks.length === 0) {
                toast({
                    title: 'Session setup failed',
                    description: 'Could not generate practice blocks. Please try again.',
                    variant: 'destructive',
                });
                return;
            }

            // Create session in database
            const { data: session, error } = await (supabase as any)
                .from('practice_sessions')
                .insert({
                    user_id: user.id,
                    lesson_id: lessonId,
                    started_at: new Date().toISOString(),
                    total_duration_seconds: availableTimeMinutes * 60,
                    session_plan: blocks,
                    completed: false,
                })
                .select()
                .single();

            if (error) throw error;

            // Set active session
            const firstBlock = blocks[0];
            setActiveSession({
                session,
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
                description: `${blocks.length} activities planned for ${availableTimeMinutes} minutes`,
            });

        } catch (error) {
            console.error('Failed to start session:', error);
            toast({
                title: 'Failed to start session',
                description: 'Please try again',
                variant: 'destructive',
            });
        }
    }, [startTimer, toast]);

    /**
     * Start a session with a pre-built plan (e.g., from AI coach or saved routine)
     */
    const startSessionWithPlan = useCallback(async (
        name: string,
        blocks: SessionBlock[],
        routineId?: string
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

            if (blocks.length === 0) {
                toast({
                    title: 'Empty session',
                    description: 'No practice blocks configured',
                    variant: 'destructive',
                });
                return;
            }

            // Calculate total duration
            const totalDurationSeconds = blocks.reduce(
                (sum, block) => sum + (block.duration_minutes || 10) * 60,
                0
            );

            // Create session in database
            const { data: session, error } = await (supabase as any)
                .from('practice_sessions')
                .insert({
                    user_id: user.id,
                    started_at: new Date().toISOString(),
                    total_duration_seconds: totalDurationSeconds,
                    session_plan: blocks,
                    completed: false,
                })
                .select()
                .single();

            if (error) throw error;

            // Set active session
            const firstBlock = blocks[0];
            setActiveSession({
                session,
                currentBlockIndex: 0,
                currentBlock: firstBlock,
                timeElapsed: 0,
                isPaused: false,
                routineId,
            });

            setTimer({
                timeRemaining: (firstBlock.duration_minutes || 10) * 60,
                totalTimeRemaining: totalDurationSeconds,
            });

            // Start timer
            startTimer();

            toast({
                title: `Started: ${name}`,
                description: `${blocks.length} activity${blocks.length > 1 ? 'ies' : ''} planned`,
            });

        } catch (error) {
            console.error('Failed to start session:', error);
            toast({
                title: 'Failed to start session',
                description: 'Please try again',
                variant: 'destructive',
            });
        }
    }, [startTimer, toast]);

    /**
     * Auto-advance when block timer reaches zero
     */
    useEffect(() => {
        if (timer.timeRemaining === 0 && activeSession && !activeSession.isPaused && autoAdvanceEnabled) {
            nextBlock();
        }
    }, [timer.timeRemaining, activeSession, nextBlock, autoAdvanceEnabled]);

    return (
        <SessionContext.Provider value={{
            activeSession,
            completedSession,
            timer,
            startSession,
            startSessionWithPlan,
            pauseSession,
            resumeSession,
            nextBlock,
            skipBlock,
            endSession,
            clearCompletedSession,
            isActive: activeSession !== null,
            isPaused: activeSession?.isPaused || false,
            autoAdvanceEnabled,
            setAutoAdvanceEnabled,
        }}>
            {children}
        </SessionContext.Provider>
    );
}

export function useSession() {
    const context = useContext(SessionContext);
    if (context === undefined) {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
}
