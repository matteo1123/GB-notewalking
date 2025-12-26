import { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Clock, Target, TrendingUp, X, CheckCircle2 } from 'lucide-react';
import type { PracticeModuleProps, ModuleResults } from '@/types/modules';
import { getModuleMetadata, formatDuration, calculateProgress } from '@/types/modules';

/**
 * Practice Module Wrapper
 * Wraps any practice module to provide:
 * - Timer overlay (for routine/goal mode)
 * - Progress tracking
 * - Target metrics display
 * - Completion handling
 * - Consistent UI chrome
 */
export function PracticeModuleWrapper({
    mode,
    config,
    timeLimit,
    targetMetrics,
    onComplete,
    onProgress,
    onTimeUp,
    sessionId,
    routineId,
    children,
}: PracticeModuleProps & { children: React.ReactNode }) {
    const metadata = getModuleMetadata(config.module_type as any);

    const [timeElapsed, setTimeElapsed] = useState(0);
    const [results, setResults] = useState<Partial<ModuleResults>>({
        completed: false,
        duration_seconds: 0,
        performance_metrics: {},
    });
    const [showCompletion, setShowCompletion] = useState(false);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number>(Date.now());

    // Timer
    useEffect(() => {
        if (mode === 'freeplay') return; // No timer in freeplay

        timerRef.current = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
            setTimeElapsed(elapsed);

            // Check time limit
            if (timeLimit && elapsed >= timeLimit) {
                handleTimeUp();
            }
        }, 1000);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [mode, timeLimit]);

    // Handle time up
    const handleTimeUp = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        const finalResults: ModuleResults = {
            completed: false, // Time ran out
            duration_seconds: timeElapsed,
            performance_metrics: results.performance_metrics || {},
        };

        onTimeUp?.();
        onComplete?.(finalResults);
    }, [timeElapsed, results, onComplete, onTimeUp]);

    // Handle manual completion
    const handleComplete = useCallback((moduleResults: Partial<ModuleResults>) => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        const finalResults: ModuleResults = {
            completed: true,
            duration_seconds: timeElapsed,
            performance_metrics: moduleResults.performance_metrics || {},
            achievements: moduleResults.achievements,
            recordings: moduleResults.recordings,
        };

        setResults(finalResults);

        // Calculate progress for goal mode
        if (mode === 'goal' && targetMetrics) {
            const progress = calculateProgress(finalResults, targetMetrics);
            onProgress?.(progress);
        } else {
            onProgress?.(1.0);
        }

        // Show completion screen briefly before callback
        setShowCompletion(true);
        setTimeout(() => {
            onComplete?.(finalResults);
        }, mode === 'routine' ? 2000 : 0); // 2s delay in routine, instant in goal/freeplay

    }, [mode, timeElapsed, targetMetrics, onComplete, onProgress]);

    // Calculate remaining time
    const timeRemaining = timeLimit ? Math.max(0, timeLimit - timeElapsed) : 0;
    const progressPercent = timeLimit ? (timeElapsed / timeLimit) * 100 : 0;

    // Completion screen
    if (showCompletion && mode === 'routine') {
        return (
            <Card className="p-8 flex flex-col items-center justify-center h-full">
                <div className="text-center space-y-4">
                    <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
                    <h2 className="text-2xl font-bold">Module Complete!</h2>
                    <p className="text-muted-foreground">Great work on {metadata.name}</p>
                    <p className="text-sm">Moving to next activity...</p>
                </div>
            </Card>
        );
    }

    return (
        <div className="relative h-full flex flex-col">
            {/* Module Header (routine/goal mode only) */}
            {mode !== 'freeplay' && (
                <div className="flex-shrink-0 p-3 bg-card border-b">
                    <div className="flex items-center justify-between">
                        {/* Module Info */}
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{metadata.icon}</span>
                            <div>
                                <h3 className="font-semibold">{metadata.name}</h3>
                                <p className="text-xs text-muted-foreground">
                                    {mode === 'routine' ? 'Practice session' : 'Goal practice'}
                                </p>
                            </div>
                        </div>

                        {/* Timer & Targets */}
                        <div className="flex items-center gap-4">
                            {/* Target Metrics (goal mode) */}
                            {mode === 'goal' && targetMetrics && (
                                <div className="flex items-center gap-3 text-sm">
                                    {targetMetrics.target_bpm && (
                                        <Badge variant="outline" className="gap-1">
                                            <Target className="w-3 h-3" />
                                            {targetMetrics.target_bpm} BPM
                                        </Badge>
                                    )}
                                    {targetMetrics.target_level && (
                                        <Badge variant="outline" className="gap-1">
                                            <TrendingUp className="w-3 h-3" />
                                            Level {targetMetrics.target_level}
                                        </Badge>
                                    )}
                                </div>
                            )}

                            {/* Timer */}
                            {timeLimit && (
                                <div className="flex items-center gap-2 min-w-[120px]">
                                    <Clock className="w-4 h-4 text-muted-foreground" />
                                    <div>
                                        <div className="text-sm font-mono font-semibold tabular-nums">
                                            {formatDuration(timeRemaining)}
                                        </div>
                                        <Progress value={progressPercent} className="h-1 w-20" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Module Content */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {children}
            </div>

            {/* Complete Button (goal mode only) */}
            {mode === 'goal' && !showCompletion && (
                <div className="flex-shrink-0 p-3 bg-card border-t">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            Practice until you meet the target, then mark complete
                        </p>
                        <Button
                            onClick={() => handleComplete(results)}
                            size="lg"
                            className="gap-2"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            Mark Complete
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Hook to manage module results within a practice module
 * Provides standardized way to track and report results
 */
export function useModuleResults() {
    const [results, setResults] = useState<Partial<ModuleResults>>({
        performance_metrics: {},
    });

    const updateMetric = useCallback((key: keyof ModuleResults['performance_metrics'], value: number) => {
        setResults(prev => ({
            ...prev,
            performance_metrics: {
                ...prev.performance_metrics,
                [key]: value,
            },
        }));
    }, []);

    const addAchievement = useCallback((achievement: string) => {
        setResults(prev => ({
            ...prev,
            achievements: [...(prev.achievements || []), achievement],
        }));
    }, []);

    const addRecording = useCallback((recordingUrl: string) => {
        setResults(prev => ({
            ...prev,
            recordings: [...(prev.recordings || []), recordingUrl],
        }));
    }, []);

    const markComplete = useCallback(() => {
        setResults(prev => ({ ...prev, completed: true }));
    }, []);

    return {
        results,
        updateMetric,
        addAchievement,
        addRecording,
        markComplete,
    };
}
