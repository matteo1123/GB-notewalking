import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Play, Pause, SkipForward, CheckCircle, Clock } from 'lucide-react';
import type { SessionBlock, ModuleType } from '@/types/practice';
// Import module components
import { RhythmTraining } from './RhythmTraining';
import { ChordProgressionExercise } from './ChordProgressionExercise';
import { ScalePracticeSession } from './ScalePracticeSession';
import { PieceMastery } from './piece-mastery/PieceMastery';
import { PieceList } from './piece-mastery/PieceList';
import type { Piece } from './piece-mastery/types';
import { useSession } from '@/contexts/SessionContext';
import { EarTrainingPractice } from './EarTrainingPractice';
import { ChordProgressionPractice } from './ChordProgressionPractice';
import { DailyFocusWidget } from './DailyFocusWidget';

// Helper to get display info from module type
function getModuleDisplayInfo(moduleType: ModuleType): { icon: string; title: string; description: string } {
    switch (moduleType) {
        case 'scale':
            return { icon: '🎵', title: 'Scale Practice', description: 'Practice scales with metronome' };
        case 'arpeggio':
            return { icon: '🎹', title: 'Arpeggio Practice', description: 'Practice arpeggios with metronome' };
        case 'rhythm':
            return { icon: '🥁', title: 'Rhythm Training', description: 'Develop your timing skills' };
        case 'notewalking':
            return { icon: '🎤', title: 'Note Walking', description: 'Chord progressions and ear training' };
        case 'chord_progressions':
            return { icon: '🎼', title: 'Chord Progressions', description: 'Practice chord transitions' };
        case 'piece_mastery':
            return { icon: '🎸', title: 'Piece Mastery', description: 'Master your repertoire' };
        case 'riff':
            return { icon: '🔥', title: 'Riff Practice', description: 'Learn and practice riffs' };
        case 'ear_training':
            return { icon: '🎧', title: 'Ear Training', description: 'Identify scale degrees over a drone' };
        default:
            return { icon: '🎯', title: 'Practice', description: 'Focus on your skills' };
    }
}

/**
 * Session Executor - Actions governed by SessionContext
 */
export function SessionExecutor() {
    const {
        activeSession,
        timer,
        pauseSession,
        resumeSession,
        nextBlock,
        skipBlock,
        endSession
    } = useSession();

    const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);

    // If no active session, we shouldn't be here, but handle gracefully
    if (!activeSession) {
        return <div className="p-4">No active session</div>;
    }

    const { currentBlock, currentBlockIndex, session } = activeSession;
    const blocks = session.session_plan;
    const totalBlocks = blocks.length;

    // Calculate progress based on current index
    const progressPercent = ((currentBlockIndex) / totalBlocks) * 100;

    const handleTogglePause = () => {
        if (activeSession.isPaused) {
            resumeSession();
        } else {
            pauseSession();
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Compact Progress Header */}
            <div className="flex-shrink-0 border-b bg-card p-3">
                <div className="flex w-full items-center justify-center mb-2">
                    <DailyFocusWidget />
                </div>
                <div className="flex items-center justify-between gap-4 mb-2">
                    {/* Left: Title & Block Info */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="text-xl">{getModuleDisplayInfo(currentBlock.module_type).icon}</span>
                        <div className="min-w-0 flex-1">
                            <h3 className="font-semibold truncate text-sm">{getModuleDisplayInfo(currentBlock.module_type).title}</h3>
                            <p className="text-xs text-muted-foreground truncate">{getModuleDisplayInfo(currentBlock.module_type).description}</p>
                        </div>
                    </div>

                    {/* Center: Timer (from Context) */}
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <Clock className="w-4 h-4" />
                        {formatTime(timer.timeRemaining)} / {currentBlock.duration_minutes}:00
                    </div>

                    {/* Right: Controls */}
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={handleTogglePause}
                            variant={activeSession.isPaused ? 'default' : 'outline'}
                            size="sm"
                        >
                            {activeSession.isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                        </Button>
                        <Button onClick={() => skipBlock()} variant="outline" size="sm">
                            <SkipForward className="w-4 h-4" />
                        </Button>
                        <Button onClick={() => endSession(false)} variant="ghost" size="sm">
                            Exit
                        </Button>
                    </div>
                </div>

                {/* Progress Bar */}
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

            {/* Module Content */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {renderModuleContent(currentBlock, session.id, selectedPiece, setSelectedPiece)}
            </div>
        </div>
    );
}

// ... renderModuleContent remains mostly the same, just exported or kept local
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

        case 'chord_progressions':
            return (
                <div className="h-full flex flex-col overflow-hidden">
                    <ChordProgressionPractice config={block.config as any} sessionId={sessionId} />
                </div>
            );

        case 'ear_training':
            return (
                <div className="h-full flex flex-col overflow-hidden items-stretch">
                    <EarTrainingPractice autoStart={true} sessionId={sessionId} config={block.config as any} />
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
