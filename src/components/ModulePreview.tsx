import { useState } from 'react';
import type { ModuleConfig, ModuleType } from '@/types/practice';
import { RhythmTraining } from './RhythmTraining';
import { ChordProgressionExercise } from './ChordProgressionExercise';
import { ScalePracticeSession } from './ScalePracticeSession';
import { PieceMastery } from './piece-mastery/PieceMastery';
import { PieceList } from './piece-mastery/PieceList';
import type { Piece } from './piece-mastery/types';

interface ModulePreviewProps {
    config: ModuleConfig;
    isPlaying: boolean;
    onConfigChange?: (config: ModuleConfig) => void;
}

/**
 * ModulePreview - Renders any practice module in isolation
 * 
 * This is a standalone sandbox that renders modules exactly as they would
 * appear in a real practice session, but without session tracking or timers.
 */
export function ModulePreview({ config, isPlaying, onConfigChange }: ModulePreviewProps) {
    const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);

    if (!isPlaying) {
        return (
            <div className="h-full flex items-center justify-center bg-muted/20">
                <div className="text-center p-8">
                    <div className="text-6xl mb-4">🎬</div>
                    <h3 className="text-xl font-semibold mb-2">Ready to Preview</h3>
                    <p className="text-muted-foreground">
                        Click the Play button to render the module with the current config
                    </p>
                </div>
            </div>
        );
    }

    const moduleType = config.module_type;

    switch (moduleType) {
        case 'rhythm':
            return (
                <div className="h-full flex flex-col overflow-hidden">
                    <RhythmTraining
                        autoStart={true}
                        moduleConfig={config as any}
                        onConfigChange={onConfigChange as any}
                    />
                </div>
            );

        case 'notewalking':
            return (
                <div className="h-full flex flex-col overflow-hidden">
                    <ChordProgressionExercise
                        autoStart={true}
                        moduleConfig={config as any}
                        onConfigChange={onConfigChange as any}
                    />
                </div>
            );

        case 'scale':
        case 'arpeggio':
            return (
                <div className="h-full flex flex-col overflow-hidden">
                    <ScalePracticeSession
                        autoStart={true}
                        moduleType={moduleType}
                        specificExerciseId={(config as any)?.current_scale_id || (config as any)?.current_arpeggio_id}
                        moduleConfig={config as any}
                        onConfigChange={onConfigChange as any}
                    />
                </div>
            );

        case 'piece_mastery':
            if (!selectedPiece) {
                return (
                    <div className="h-full overflow-auto">
                        <PieceList onSelectPiece={(piece) => setSelectedPiece(piece)} />
                    </div>
                );
            }
            return (
                <div className="h-full flex flex-col overflow-hidden">
                    <PieceMastery
                        piece={selectedPiece}
                        onBack={() => setSelectedPiece(null)}
                    />
                </div>
            );

        case 'chord_progressions':
            return (
                <div className="h-full flex flex-col overflow-hidden">
                    <ChordProgressionExercise
                        autoStart={true}
                        moduleConfig={config as any}
                        onConfigChange={onConfigChange as any}
                    />
                </div>
            );

        default:
            return (
                <div className="h-full flex items-center justify-center overflow-hidden">
                    <div className="text-center">
                        <div className="text-4xl mb-4">🚧</div>
                        <p className="text-muted-foreground">
                            Module type "{moduleType}" not implemented yet
                        </p>
                    </div>
                </div>
            );
    }
}
