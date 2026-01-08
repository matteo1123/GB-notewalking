import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Play, Pause, SkipForward, CheckCircle, Clock } from 'lucide-react';
import type { SessionBlock } from '@/lib/sessionGenerator';

// Import module components
import { RhythmTraining } from './RhythmTraining';
import { ChordProgressionExercise } from './ChordProgressionExercise';
import { ScalePracticeSession } from './ScalePracticeSession';
import { PieceMastery } from './piece-mastery/PieceMastery';
import { PieceList } from './piece-mastery/PieceList';
import type { Piece } from './piece-mastery/types';

/**
 * Session Executor - Takes user through a practice session
 * Shows progress bar and advances through blocks
 */

interface SessionExecutorProps {
    sessionPlan: SessionBlock[];
    sessionId?: string; // Practice session ID for linking practice logs
    onComplete: () => void;
    onExit: () => void;
}

export function SessionExecutor({ sessionPlan, sessionId, onComplete, onExit }: SessionExecutorProps) {
    const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
    const [elapsedTime, setElapsedTime] = useState(0); // seconds
    const [isPaused, setIsPaused] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);

    const currentBlock = sessionPlan[currentBlockIndex];
    const totalBlocks = sessionPlan.length;
    const totalDuration = sessionPlan.reduce((sum, b) => sum + b.duration_minutes, 0);
    const progressPercent = ((currentBlockIndex + 1) / totalBlocks) * 100;

    // Timer
    useEffect(() => {
        if (!isRunning || isPaused) return;

        const interval = setInterval(() => {
            setElapsedTime(prev => prev + 1);

            // Auto-advance when block time is up
            const blockDurationSeconds = currentBlock.duration_minutes * 60;
            if (elapsedTime >= blockDurationSeconds) {
                handleNext();
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isRunning, isPaused, elapsedTime, currentBlock]);

    const handleStart = () => {
        setIsRunning(true);
    };

    const handlePause = () => {
        setIsPaused(!isPaused);
    };

    const handleNext = () => {
        if (currentBlockIndex < totalBlocks - 1) {
            setCurrentBlockIndex(prev => prev + 1);
            setElapsedTime(0);
        } else {
            // Session complete!
            setIsRunning(false);
            onComplete();
        }
    };

    const handleSkip = () => {
        handleNext();
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Compact Progress Header - Single Line */}
            <div className="flex-shrink-0 border-b bg-card p-3">
                <div className="flex items-center justify-between gap-4 mb-2">
                    {/* Left: Title & Block Info */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        {currentBlock.type === 'warmup' && (
                            <span className="text-xl">🔥</span>
                        )}
                        {currentBlock.type === 'priority' && (
                            <span className="text-xl">🎯</span>
                        )}
                        <div className="min-w-0 flex-1">
                            <h3 className="font-semibold truncate text-sm">{currentBlock.title}</h3>
                            <p className="text-xs text-muted-foreground truncate">{currentBlock.description}</p>
                        </div>
                    </div>

                    {/* Center: Timer */}
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <Clock className="w-4 h-4" />
                        {formatTime(elapsedTime)} / {currentBlock.duration_minutes}:00
                    </div>

                    {/* Right: Controls */}
                    <div className="flex items-center gap-2">
                        {!isRunning ? (
                            <Button onClick={handleStart} size="sm">
                                <Play className="w-4 h-4 mr-1" />
                                Start
                            </Button>
                        ) : (
                            <>
                                <Button
                                    onClick={handlePause}
                                    variant={isPaused ? 'default' : 'outline'}
                                    size="sm"
                                >
                                    <Pause className="w-4 h-4" />
                                </Button>
                                <Button onClick={handleSkip} variant="outline" size="sm">
                                    <SkipForward className="w-4 h-4" />
                                </Button>
                            </>
                        )}
                        <Button onClick={onExit} variant="ghost" size="sm">
                            Exit
                        </Button>
                    </div>
                </div>

                {/* Progress Bar - Thin */}
                <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {currentBlockIndex + 1}/{totalBlocks}
                    </span>
                    <Progress value={progressPercent} className="h-2 flex-1" />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {Math.round(progressPercent)}%
                    </span>
                </div>
            </div>

            {/* Module Content - Takes remaining space, no overflow */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {renderModuleContent(currentBlock, sessionId, selectedPiece, setSelectedPiece)}
            </div>
        </div>
    );
}

/**
 * Render the appropriate module based on block type
 * Pure flexbox layout - NO OVERFLOW EVER
 */
function renderModuleContent(
    block: SessionBlock,
    sessionId?: string,
    selectedPiece?: Piece | null,
    setSelectedPiece?: (piece: Piece | null) => void
) {
    switch (block.module_type) {
        case 'rhythm':
            return (
                <div className="h-full flex flex-col overflow-hidden">
                    <RhythmTraining autoStart={true} sessionId={sessionId} />
                </div>
            );

        case 'notewalking':
            return (
                <div className="h-full flex flex-col overflow-hidden">
                    <ChordProgressionExercise autoStart={true} sessionId={sessionId} />
                </div>
            );

        case 'scale':
        case 'arpeggio':
            return (
                <div className="h-full flex flex-col overflow-hidden">
                    <ScalePracticeSession
                        autoStart={true}
                        sessionId={sessionId}
                        moduleType={block.module_type as 'scale' | 'arpeggio'}
                        specificExerciseId={(block.config as any)?.exercise_id}
                        moduleConfig={block.config as any}
                    />
                </div>
            );

        case 'piece_mastery':
            // Show PieceList for selection, or PieceMastery once a piece is chosen
            if (!selectedPiece) {
                return (
                    <div className="h-full overflow-auto">
                        <PieceList onSelectPiece={(piece) => setSelectedPiece?.(piece)} />
                    </div>
                );
            }
            return (
                <div className="h-full flex flex-col overflow-hidden">
                    <PieceMastery
                        piece={selectedPiece}
                        onBack={() => setSelectedPiece?.(null)}
                    />
                </div>
            );

        default:
            return (
                <div className="h-full flex items-center justify-center overflow-hidden">
                    <div className="text-center">
                        <p className="text-muted-foreground">
                            Module type "{block.module_type}" not implemented yet
                        </p>
                    </div>
                </div>
            );
    }
}

/**
 * Completion Screen
 */
export function SessionComplete({ onRestart }: { onRestart: () => void }) {
    return (
        <Card className="max-w-2xl mx-auto mt-12">
            <CardContent className="pt-12 pb-8 text-center">
                <CheckCircle className="w-24 h-24 mx-auto mb-6 text-green-500" />
                <h2 className="text-3xl font-bold mb-4">Great Work!</h2>
                <p className="text-muted-foreground mb-8 text-lg">
                    You've completed your practice session.
                </p>
                <div className="space-y-3">
                    <Button onClick={onRestart} size="lg" className="w-full">
                        Start Another Session
                    </Button>
                    <Button variant="outline" size="lg" className="w-full" onClick={() => window.location.href = '/profile'}>
                        View Progress
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
