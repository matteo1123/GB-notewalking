import { useState, useEffect } from 'react';
import { ModuleCard } from './ModuleCard';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Search, X } from 'lucide-react';
import { RhythmTraining } from './RhythmTraining';
import { ChordProgressionExercise } from './ChordProgressionExercise';
import ExerciseList from './ExerciseList';
import { supabase } from '@/integrations/supabase/client';
import { MODULE_REGISTRY } from '@/types/modules';
import type { ModuleType } from '@/types/practice';
import type { RepertoireItem } from '@/types/repertoire';

/**
 * Module Library - Storefront view for all practice modules
 */
export function ModuleLibrary() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
    const [activeModule, setActiveModule] = useState<ModuleType | null>(null);
    const [exercises, setExercises] = useState<RepertoireItem[]>([]);

    // Load exercises for scales and arpeggios
    useEffect(() => {
        async function loadExercises() {
            const { data: scalesData } = await supabase
                .from('scales')
                .select('*')
                .order('Position');

            if (scalesData) {
                const mapped = scalesData.map((row: any) => ({
                    id: row.id,
                    name: row.name,
                    category: row.Type === 'arpeggio' ? 'arpeggio' : 'scale',
                    difficulty: row.difficulty,
                    notes: row.notes_json ?? [],
                    tonic: row.root_note,
                    tonality: row.tonality,
                    position: row.Position,
                    major_key: row.major_key,
                    Type: row.Type,
                }));
                setExercises(mapped as any);
            }
        }
        loadExercises();
    }, []);

    // Available modules with mock progress data
    const modules: Array<{
        type: ModuleType;
        progress?: { current_level: number; mastery_percentage: number; time_practiced_minutes: number };
    }> = [
            {
                type: 'rhythm',
                progress: { current_level: 8, mastery_percentage: 78, time_practiced_minutes: 120 },
            },
            {
                type: 'notewalking',
                progress: { current_level: 3, mastery_percentage: 23, time_practiced_minutes: 45 },
            },
            {
                type: 'scale',
                progress: { current_level: 6, mastery_percentage: 45, time_practiced_minutes: 200 },
            },
            {
                type: 'chord_progressions',
                progress: { current_level: 4, mastery_percentage: 35, time_practiced_minutes: 60 },
            },
            {
                type: 'arpeggio',
            },
            {
                type: 'riff',
                progress: { current_level: 2, mastery_percentage: 15, time_practiced_minutes: 30 },
            },
        ];

    const handleTryNow = (moduleType: ModuleType) => {
        setActiveModule(moduleType);
    };

    const handleAddToRoutine = (moduleType: ModuleType) => {
        console.log('Add to routine:', moduleType);
        // TODO: Open routine builder with this module
    };

    const handleViewDetails = (moduleType: ModuleType) => {
        console.log('View details:', moduleType);
        // TODO: Open module details modal
    };

    const handleCloseModule = () => {
        setActiveModule(null);
    };

    // Render active module in freeplay mode
    if (activeModule) {
        return (
            <div className="fixed inset-0 bg-background z-50 flex flex-col">
                {/* Header */}
                <div className="flex-shrink-0 p-4 border-b flex items-center justify-between bg-card">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{MODULE_REGISTRY[activeModule].icon}</span>
                        <div>
                            <h2 className="text-xl font-bold">{MODULE_REGISTRY[activeModule].name}</h2>
                            <p className="text-sm text-muted-foreground">Freeplay Mode</p>
                        </div>
                    </div>
                    <Button onClick={handleCloseModule} variant="ghost" size="sm" className="gap-2">
                        <X className="w-4 h-4" />
                        Exit
                    </Button>
                </div>

                {/* Module Content */}
                <div className="flex-1 min-h-0">
                    {activeModule === 'rhythm' && <RhythmTraining />}
                    {activeModule === 'notewalking' && <ChordProgressionExercise />}
                    {activeModule === 'scale' && (
                        <div className="h-full overflow-y-auto p-4">
                            <ExerciseList
                                items={exercises.filter((e) => e.category === "scale")}
                                defaultSort={{ key: "position", dir: "asc" }}
                                onSelect={(exercise) => console.log('Selected scale:', exercise)}
                            />
                        </div>
                    )}
                    {activeModule === 'arpeggio' && (
                        <div className="h-full overflow-y-auto p-4">
                            <ExerciseList
                                items={exercises.filter((e) => e.category === "arpeggio")}
                                defaultSort={{ key: "difficulty", dir: "asc" }}
                                onSelect={(exercise) => console.log('Selected arpeggio:', exercise)}
                            />
                        </div>
                    )}
                    {activeModule === 'chord_progressions' && (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center p-8">
                                <span className="text-6xl mb-4 block">🎼</span>
                                <h3 className="text-2xl font-bold mb-2">Chord Changes</h3>
                                <p className="text-muted-foreground">Coming soon!</p>
                            </div>
                        </div>
                    )}
                    {activeModule === 'riff' && (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center p-8">
                                <span className="text-6xl mb-4 block">🎸</span>
                                <h3 className="text-2xl font-bold mb-2">Riff Practice</h3>
                                <p className="text-muted-foreground">Coming soon!</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex-shrink-0 border-b bg-background">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-3xl font-bold">Practice Modules</h1>
                            <p className="text-muted-foreground mt-1">
                                Build your skills with focused practice modules
                            </p>
                        </div>
                        <Button size="lg" className="gap-2">
                            <Search className="w-4 h-4" />
                            Create Custom Routine
                        </Button>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search modules..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>
            </div>

            {/* Module Grid */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {modules.map(({ type, progress }) => (
                        <ModuleCard
                            key={type}
                            moduleType={type}
                            progress={progress}
                            onTryNow={() => handleTryNow(type)}
                            onAddToRoutine={() => handleAddToRoutine(type)}
                            onViewDetails={() => handleViewDetails(type)}
                        />
                    ))}
                </div>

                {/* Empty State */}
                {modules.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center p-12">
                        <div className="text-6xl mb-4">🎵</div>
                        <h3 className="text-xl font-semibold mb-2">No modules found</h3>
                        <p className="text-muted-foreground">
                            Try adjusting your search or filters
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
