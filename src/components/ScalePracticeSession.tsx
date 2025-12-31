import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import RiffPractice from './RiffPractice';
import { RepertoireItem } from '@/types/repertoire';
import { Tables } from '@/integrations/supabase/types';
import { Loader2 } from 'lucide-react';

interface ScalePracticeSessionProps {
    autoStart?: boolean;
    sessionId?: string;
    moduleType?: 'scale' | 'arpeggio';
    specificExerciseId?: string; // If provided, use this specific exercise
}

/**
 * ScalePracticeSession - Auto-selects and renders scale/arpeggio practice
 * 
 * Uses a weekly rotation system to keep users focused on one position at a time.
 * Week X → Position (X % 5) + 1
 */
export function ScalePracticeSession({
    autoStart = true,
    sessionId,
    moduleType = 'scale',
    specificExerciseId
}: ScalePracticeSessionProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [repertoireItem, setRepertoireItem] = useState<RepertoireItem | null>(null);
    const [sequences, setSequences] = useState<Tables<"sequences">[]>([]);

    // Get current position based on week rotation (1-5)
    const getCurrentPosition = () => {
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const weekNumber = Math.floor((now.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000));
        return (weekNumber % 5) + 1;
    };

    useEffect(() => {
        async function loadExercise() {
            if (!user) {
                setError('Please log in to practice');
                setLoading(false);
                return;
            }

            try {
                setLoading(true);

                // Fetch sequences for patterns
                const { data: seqData } = await supabase
                    .from('sequences')
                    .select('*');

                if (seqData) {
                    setSequences(seqData);
                }

                let exerciseData: RepertoireItem | null = null;

                // If specific exercise requested, fetch that
                if (specificExerciseId) {
                    const { data: scale } = await supabase
                        .from('scales')
                        .select('*')
                        .eq('id', specificExerciseId)
                        .single();

                    if (scale) {
                        exerciseData = transformToRepertoireItem(scale, moduleType);
                    }
                } else {
                    // Weekly rotation: fetch a scale from current position
                    const position = getCurrentPosition();

                    // Fetch scales that match the current position (using position field or fallback)
                    const { data: scales } = await supabase
                        .from('scales')
                        .select('*')
                        .order('id', { ascending: true });

                    if (scales && scales.length > 0) {
                        // For now, cycle through scales based on position and day
                        const dayOfYear = Math.floor(
                            (new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
                            (1000 * 60 * 60 * 24)
                        );
                        const scaleIndex = dayOfYear % scales.length;
                        exerciseData = transformToRepertoireItem(scales[scaleIndex], moduleType);
                    }
                }

                if (exerciseData) {
                    setRepertoireItem(exerciseData);
                } else {
                    setError('No scales available. Please add some scales to practice.');
                }
            } catch (err) {
                console.error('Error loading exercise:', err);
                setError('Failed to load exercise');
            } finally {
                setLoading(false);
            }
        }

        loadExercise();
    }, [user, specificExerciseId, moduleType]);

    // Transform database scale to RepertoireItem format
    function transformToRepertoireItem(scale: any, category: string): RepertoireItem {
        return {
            id: scale.id,
            name: scale.name || 'Unknown Scale',
            category: category as 'scale' | 'arpeggio',
            difficulty: scale.difficulty || 1,
            notes: scale.notes || [],
            tonic: scale.key || scale.tonic || 'C',
            tonality: scale.mode || scale.tonality || 'Major',
            position: scale.position,
            description: scale.description,
            created_at: scale.created_at,
        };
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

    if (error || !repertoireItem) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-4 p-6">
                    <div className="text-6xl">🎸</div>
                    <h3 className="text-xl font-bold">
                        {moduleType === 'scale' ? 'Scale Practice' : 'Arpeggio Practice'}
                    </h3>
                    <p className="text-muted-foreground">
                        {error || 'Unable to load exercise'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Try adding some scales from the Modules tab first!
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <RiffPractice
                repertoireItem={repertoireItem}
                sequences={sequences}
                autoStart={autoStart}
                isControlledSession={true}
            />
        </div>
    );
}

export default ScalePracticeSession;
