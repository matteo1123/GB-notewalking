import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import RiffPractice from './RiffPractice';
import { Tables } from '@/integrations/supabase/types';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useExerciseQueue, UseExerciseQueueOptions } from '@/hooks/useExerciseQueue';
import { ScaleModuleConfig, ArpeggioModuleConfig } from '@/types/practice';

interface ScalePracticeSessionProps {
    autoStart?: boolean;
    sessionId?: string;
    moduleType?: 'scale' | 'arpeggio';
    specificExerciseId?: string; // If provided, use this specific exercise (overrides queue)
    moduleConfig?: ScaleModuleConfig | ArpeggioModuleConfig; // Optional configuration for exercise ordering
    onConfigChange?: (config: ScaleModuleConfig | ArpeggioModuleConfig) => void; // Callback when navigation changes
}

/**
 * ScalePracticeSession - Renders scale/arpeggio practice with configurable exercise ordering
 * 
 * Now supports:
 * - Priority exercise ordering (specific UUIDs first)
 * - Type filtering (e.g., "3 Notes Per String")
 * - Step-through navigation (Previous/Next)
 * - Fallback ordering by scale_shapes.created_at
 */
export function ScalePracticeSession({
    autoStart = true,
    sessionId,
    moduleType = 'scale',
    specificExerciseId,
    moduleConfig,
    onConfigChange,
}: ScalePracticeSessionProps) {
    const { user } = useAuth();
    const [sequences, setSequences] = useState<Tables<"sequences">[]>([]);
    const [sequencesLoading, setSequencesLoading] = useState(true);

    // Derive queue options from moduleConfig
    const queueOptions: UseExerciseQueueOptions = {
        moduleType,
        priorityIds: moduleConfig?.module_type === 'scale'
            ? (moduleConfig as ScaleModuleConfig).priority_scale_ids
            : moduleConfig?.module_type === 'arpeggio'
                ? (moduleConfig as ArpeggioModuleConfig).priority_arpeggio_ids
                : undefined,
        typeFilter: moduleConfig?.type_filter,
        orderBy: moduleConfig?.order_by || 'created_at',
        initialIndex: moduleConfig?.current_index || 0,
    };

    // Use the exercise queue hook
    const {
        currentExercise,
        currentIndex,
        totalCount,
        next,
        previous,
        loading: queueLoading,
        error: queueError,
    } = useExerciseQueue(queueOptions);

    // Load sequences for patterns (independent of queue)
    useEffect(() => {
        async function loadSequences() {
            const { data: seqData } = await supabase
                .from('sequences')
                .select('*');

            if (seqData) {
                setSequences(seqData);
            }
            setSequencesLoading(false);
        }
        loadSequences();
    }, []);

    // Notify parent when navigation changes (to persist state)
    const handleNext = useCallback(() => {
        next();
        if (onConfigChange && moduleConfig) {
            onConfigChange({
                ...moduleConfig,
                current_index: currentIndex + 1,
            } as ScaleModuleConfig | ArpeggioModuleConfig);
        }
    }, [next, onConfigChange, moduleConfig, currentIndex]);

    const handlePrevious = useCallback(() => {
        previous();
        if (onConfigChange && moduleConfig) {
            onConfigChange({
                ...moduleConfig,
                current_index: Math.max(0, currentIndex - 1),
            } as ScaleModuleConfig | ArpeggioModuleConfig);
        }
    }, [previous, onConfigChange, moduleConfig, currentIndex]);

    const loading = queueLoading || sequencesLoading;

    if (!user) {
        return (
            <div className="h-full flex items-center justify-center">
                <p className="text-muted-foreground">Please log in to practice</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-4">
                    <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
                    <p className="text-muted-foreground">Loading your practice exercise...</p>
                </div>
            </div>
        );
    }

    if (queueError || !currentExercise) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-4 p-6">
                    <div className="text-6xl">🎸</div>
                    <h3 className="text-xl font-bold">
                        {moduleType === 'scale' ? 'Scale Practice' : 'Arpeggio Practice'}
                    </h3>
                    <p className="text-muted-foreground">
                        {queueError || 'No exercises available'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Try adding some {moduleType}s from the Modules tab first!
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Navigation Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePrevious}
                    disabled={totalCount <= 1}
                    className="flex items-center gap-1"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                </Button>

                <div className="text-center">
                    <span className="text-sm font-medium">
                        {currentExercise.name}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                        ({currentIndex + 1} / {totalCount})
                    </span>
                </div>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleNext}
                    disabled={totalCount <= 1}
                    className="flex items-center gap-1"
                >
                    Next
                    <ChevronRight className="w-4 h-4" />
                </Button>
            </div>

            {/* RiffPractice Component */}
            <div className="flex-1 overflow-hidden">
                <RiffPractice
                    repertoireItem={currentExercise}
                    sequences={sequences}
                    autoStart={autoStart}
                    isControlledSession={true}
                />
            </div>
        </div>
    );
}

export default ScalePracticeSession;
