import { usePracticeSession } from '@/hooks/usePracticeSession';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Progress } from './ui/progress';
import { getModuleIcon } from '@/lib/sessionPlanner';
import {
    Play,
    Pause,
    SkipForward,
    X,
    Clock,
    CheckCircle2,
    ListTodo,
} from 'lucide-react';

/**
 * Guided Practice Session Component
 * Displays current activity, timer, and navigation controls
 */
export function GuidedPracticeSession() {
    const session = usePracticeSession();

    if (!session.isActive) {
        return (
            <Card className="p-8 text-center">
                <div className="max-w-md mx-auto space-y-4">
                    <div className="text-6xl mb-4">🎯</div>
                    <h2 className="text-2xl font-bold">Ready to Practice?</h2>
                    <p className="text-muted-foreground">
                        Start a guided practice session tailored to your goals
                    </p>

                    <div className="grid grid-cols-2 gap-3 mt-6">
                        <Button
                            onClick={() => session.startSession(15)}
                            variant="outline"
                            size="lg"
                        >
                            <Clock className="w-4 h-4 mr-2" />
                            15 Minutes
                        </Button>
                        <Button
                            onClick={() => session.startSession(30)}
                            variant="default"
                            size="lg"
                        >
                            <Clock className="w-4 h-4 mr-2" />
                            30 Minutes
                        </Button>
                        <Button
                            onClick={() => session.startSession(45)}
                            variant="outline"
                            size="lg"
                        >
                            <Clock className="w-4 h-4 mr-2" />
                            45 Minutes
                        </Button>
                        <Button
                            onClick={() => session.startSession(60)}
                            variant="outline"
                            size="lg"
                        >
                            <Clock className="w-4 h-4 mr-2" />
                            60 Minutes
                        </Button>
                    </div>

                    <p className="text-xs text-muted-foreground mt-4">
                        The session will automatically guide you through different practice activities
                    </p>
                </div>
            </Card>
        );
    }

    const { activeSession, timer } = session;
    if (!activeSession) return null;

    const currentBlock = activeSession.currentBlock;
    const totalBlocks = activeSession.session.session_plan.length;
    const progressPercent = ((activeSession.currentBlockIndex + 1) / totalBlocks) * 100;
    const blockProgressPercent = ((currentBlock.duration_minutes * 60 - timer.timeRemaining) / (currentBlock.duration_minutes * 60)) * 100;

    return (
        <div className="space-y-4">
            {/* Session Header */}
            <Card className="p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="text-2xl">{getModuleIcon(currentBlock.module_type)}</div>
                        <div>
                            <h3 className="font-semibold">
                                Activity {activeSession.currentBlockIndex + 1} of {totalBlocks}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                {formatModuleType(currentBlock.module_type)}
                            </p>
                        </div>
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => session.endSession(false)}
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                {/* Overall Progress */}
                <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Session Progress</span>
                        <span className="font-medium">{Math.round(progressPercent)}%</span>
                    </div>
                    <Progress value={progressPercent} className="h-2" />
                </div>
            </Card>

            {/* Current Block Timer */}
            <Card className="p-6">
                <div className="text-center space-y-4">
                    {/* Timer Display */}
                    <div>
                        <div className="text-6xl font-bold font-mono tabular-nums">
                            {formatTime(timer.timeRemaining)}
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                            Time remaining in this activity
                        </p>
                    </div>

                    {/* Block Progress */}
                    <div className="max-w-md mx-auto">
                        <Progress value={blockProgressPercent} className="h-3" />
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-center gap-3 pt-4">
                        {session.isPaused ? (
                            <Button
                                onClick={session.resumeSession}
                                size="lg"
                                className="gap-2"
                            >
                                <Play className="w-5 h-5" />
                                Resume
                            </Button>
                        ) : (
                            <Button
                                onClick={session.pauseSession}
                                size="lg"
                                variant="outline"
                                className="gap-2"
                            >
                                <Pause className="w-5 h-5" />
                                Pause
                            </Button>
                        )}

                        <Button
                            onClick={session.skipBlock}
                            size="lg"
                            variant="outline"
                            className="gap-2"
                        >
                            <SkipForward className="w-5 h-5" />
                            Skip
                        </Button>
                    </div>

                    {/* Total Time Remaining */}
                    <div className="text-sm text-muted-foreground pt-4 border-t">
                        <Clock className="w-4 h-4 inline mr-2" />
                        {formatTime(timer.totalTimeRemaining)} total remaining
                    </div>
                </div>
            </Card>

            {/* Upcoming Activities */}
            <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                    <ListTodo className="w-4 h-4" />
                    <h4 className="font-semibold">Upcoming Activities</h4>
                </div>

                <div className="space-y-2">
                    {activeSession.session.session_plan
                        .slice(activeSession.currentBlockIndex + 1)
                        .slice(0, 3)
                        .map((block, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between p-2 rounded bg-muted/30"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">{getModuleIcon(block.module_type)}</span>
                                    <span className="text-sm">{formatModuleType(block.module_type)}</span>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                    {block.duration_minutes} min
                                </span>
                            </div>
                        ))}

                    {activeSession.currentBlockIndex + 1 === totalBlocks && (
                        <div className="flex items-center justify-center gap-2 p-3 rounded bg-green-500/10 text-green-700 dark:text-green-400">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-sm font-medium">Last activity!</span>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}

/**
 * Format module type for display
 */
function formatModuleType(type: string): string {
    const labels: Record<string, string> = {
        scale: 'Scale Practice',
        rhythm: 'Rhythm Training',
        notewalking: 'Notewalking',
        arpeggio: 'Arpeggio Practice',
        riff: 'Riff Practice',
        chord_progressions: 'Chord Changes',
    };
    return labels[type] || type;
}

/**
 * Format seconds to MM:SS
 */
function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')} `;
}
