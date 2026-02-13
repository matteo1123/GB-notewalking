import { usePracticeSession } from '@/hooks/usePracticeSession';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RhythmTraining } from './RhythmTraining';
import RiffPractice from './RiffPractice';
import { ChordProgressionExercise } from './ChordProgressionExercise';
import { ChordProgressionTrainer } from './ChordProgressionTrainer';
import { LessonNavWrapper } from './LessonNavWrapper';

/**
 * Guided Practice Session Component
 * Uses LessonNavWrapper to provide consistent navigation across all modules.
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

    const hasPrevious = activeSession.currentBlockIndex > 0;
    const hasNext = activeSession.currentBlockIndex < totalBlocks - 1;
    const nextPlan = activeSession.session.session_plan[activeSession.currentBlockIndex + 1];
    const nextLabel = nextPlan ? formatModuleType(nextPlan.module_type) : 'Finish';

    return (
        <LessonNavWrapper
            currentIndex={activeSession.currentBlockIndex}
            totalBlocks={totalBlocks}
            blockLabel={formatModuleType(currentBlock.module_type)}
            blockModuleType={currentBlock.module_type}
            timeRemaining={timer.timeRemaining}
            isPaused={session.isPaused}
            hasPrevious={hasPrevious}
            hasNext={hasNext}
            onPrevious={session.previousBlock}
            onNext={session.nextBlock}
            onPause={session.pauseSession}
            onResume={session.resumeSession}
            onSkip={session.skipBlock}
            onExit={() => session.endSession(false)}
            nextBlockLabel={nextLabel}
        >
            <RenderModule
                currentBlock={currentBlock}
                sessionId={activeSession.session.id}
            />
        </LessonNavWrapper>
    );
}

// ── Module Renderer ──────────────────────────────────────────
// Separated so it can be wrapped cleanly by LessonNavWrapper.

function RenderModule({ currentBlock, sessionId }: { currentBlock: any; sessionId?: string }) {
    const config = currentBlock.config || {};
    const [scaleData, setScaleData] = useState<{ item: any; sequences: any[] } | null>(null);

    // Fetch scale data if current block is scale
    useEffect(() => {
        const fetchScale = async () => {
            if (currentBlock.module_type === 'scale' || currentBlock.module_type === 'arpeggio') {
                const scaleId = currentBlock.config?.scale_id;
                if (!scaleId) return;

                const { data: scale } = await supabase.from('scales').select('*').eq('id', scaleId).single();
                const { data: sequences } = await supabase.from('sequences').select('*');

                if (scale) {
                    setScaleData({ item: scale, sequences: sequences || [] });
                }
            } else {
                setScaleData(null);
            }
        };
        fetchScale();
    }, [currentBlock.module_type, currentBlock.config]);

    switch (currentBlock.module_type) {
        case 'rhythm':
            return (
                <div className="h-full">
                    <RhythmTraining
                        autoStart
                        sessionId={sessionId}
                        moduleConfig={config}
                    />
                </div>
            );
        case 'notewalking':
            return (
                <div className="h-full">
                    <ChordProgressionExercise
                        autoStart
                        sessionId={sessionId}
                        moduleConfig={config}
                    />
                </div>
            );
        case 'chord_progressions':
            return (
                <div className="h-full">
                    <ChordProgressionTrainer
                        moduleConfig={config}
                    />
                </div>
            );
        case 'scale':
        case 'arpeggio':
            if (!scaleData) return <div className="flex items-center justify-center h-48">Loading scale...</div>;
            return (
                <div className="h-full">
                    <RiffPractice
                        repertoireItem={scaleData.item}
                        sequences={scaleData.sequences}
                        autoStart
                        sessionId={sessionId}
                        moduleConfig={config}
                        isControlledSession={true}
                    />
                </div>
            );
        default:
            return <div className="p-4">Unknown module type: {currentBlock.module_type}</div>;
    }
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
