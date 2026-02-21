import { useState, useEffect, useMemo, useCallback } from 'react';
import { ModuleCard } from './ModuleCard';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Search, X, Settings, Star, StarOff } from 'lucide-react';
import { RhythmTraining } from './RhythmTraining';
import { ChordProgressionExercise } from './ChordProgressionExercise';
import ExerciseList from './ExerciseList';
import { supabase } from '@/integrations/supabase/client';
import { MODULE_REGISTRY } from '@/types/modules';
import type { ModuleType, ScaleModuleConfig, ArpeggioModuleConfig } from '@/types/practice';
import type { RepertoireItem } from '@/types/repertoire';
import { PieceList } from './piece-mastery/PieceList';
import { PieceMastery } from './piece-mastery/PieceMastery';
import { Piece } from './piece-mastery/types';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import RiffPractice from './RiffPractice';
import { ExercisePracticeModule } from './ExercisePracticeModule';
import { useModuleConfig } from '@/hooks/useModuleConfig';
import { usePracticeSession } from '@/hooks/usePracticeSession';
import { SessionBuilder } from '@/components/SessionBuilder';
import { Save, Layers, Plus } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

/**
 * Module Library - Storefront view for all practice modules
 * 
 * Features:
 * - Browse and select from available exercises
 * - Previous/Next navigation when viewing an exercise
 * - Configurable type filters and priority exercises
 * - Group by scale_shape for unique exercise ordering
 */
export function ModuleLibrary() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
    const [activeModule, setActiveModule] = useState<ModuleType | null>(null);
    const [selectedExercise, setSelectedExercise] = useState<RepertoireItem | null>(null);
    const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);
    const [exercises, setExercises] = useState<RepertoireItem[]>([]);
    const [sequences, setSequences] = useState<any[]>([]);

    // Scale module configuration
    const [scaleConfig, setScaleConfig] = useState<ScaleModuleConfig>({
        module_type: 'scale',
        type_filter: undefined,
        priority_scale_ids: [],
        group_by_shape: true,
        order_by: 'created_at',
        current_index: 0,
    });

    // Arpeggio module configuration (new - matches scale config pattern)
    const [arpeggioConfig, setArpeggioConfig] = useState<ArpeggioModuleConfig>({
        module_type: 'arpeggio',
        type_filter: undefined,
        priority_arpeggio_ids: [],
        order_by: 'created_at',
        current_index: 0,
    });

    // Save config dialog state
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [instanceName, setInstanceName] = useState('');

    // Module config persistence hook
    const moduleConfig = useModuleConfig('scale');

    // Session management
    const [showSessionBuilder, setShowSessionBuilder] = useState(false);
    const practiceSession = usePracticeSession();

    const handleSaveConfig = async () => {
        if (!instanceName.trim()) return;
        const id = await moduleConfig.saveConfig(instanceName.trim(), scaleConfig);
        if (id) {
            setSaveDialogOpen(false);
            setInstanceName('');
        }
    };

    // Start a lesson from SessionBuilder
    const handleStartLesson = useCallback(async (blocks: any[]) => {
        if (blocks.length === 0) return;

        // Calculate total time from blocks
        const totalMinutes = blocks.reduce((sum: number, b: any) => sum + b.duration_minutes, 0);

        // For now, we'll use the basic startSession
        // In a full implementation, we'd pass the blocks directly
        await practiceSession.startSession(totalMinutes);
        setShowSessionBuilder(false);
    }, [practiceSession]);

    // Load exercises for scales and arpeggios
    useEffect(() => {
        async function loadData() {
            const { data: scalesData } = await supabase
                .from('scales')
                .select('*')
                .order('Position');

            if (scalesData) {
                const mapped = scalesData.map((row: any) => ({
                    id: row.id,
                    name: row.name,
                    category: row.Type?.toLowerCase().includes('arpeggio') ? 'arpeggio' : 'scale',
                    difficulty: row.difficulty,
                    notes: row.notes_json ?? [],
                    tonic: row.root_note,
                    tonality: row.tonality,
                    position: row.Position,
                    major_key: row.major_key,
                    Type: row.Type,
                    scale_shape: row.scale_shape,
                    created_at: row.created_at,
                }));
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setExercises(mapped as any);
            }

            const { data: sequencesData } = await supabase
                .from('sequences')
                .select('*');

            if (sequencesData) {
                setSequences(sequencesData);
            }
        }
        loadData();
    }, []);

    // Get unique Type values for filter dropdown (for both scale and arpeggio)
    const availableTypes = useMemo(() => {
        const types = new Set<string>();
        exercises.forEach(e => {
            if (e.Type && (e.category === 'scale' || e.category === 'arpeggio')) {
                types.add(e.Type);
            }
        });
        return Array.from(types).sort();
    }, [exercises]);

    // Process scale exercises with config (filter, dedupe, order)
    const processedScaleExercises = useMemo(() => {
        let result = exercises.filter(e => e.category === 'scale');

        // Apply type filter
        if (scaleConfig.type_filter) {
            result = result.filter(e => e.Type === scaleConfig.type_filter);
        }

        // Deduplicate by scale_shape if enabled
        if (scaleConfig.group_by_shape) {
            const seenShapes = new Map<string, RepertoireItem>();
            result.forEach(exercise => {
                const shapeId = exercise.scale_shape;
                if (shapeId && !seenShapes.has(shapeId)) {
                    seenShapes.set(shapeId, exercise);
                } else if (!shapeId) {
                    // Keep exercises without scale_shape
                    seenShapes.set(exercise.id, exercise);
                }
            });
            result = Array.from(seenShapes.values());
        }

        // Separate priority and non-priority exercises
        const priorityIds = new Set(scaleConfig.priority_scale_ids || []);
        const priorityExercises = (scaleConfig.priority_scale_ids || [])
            .map(id => result.find(e => e.id === id))
            .filter((e): e is RepertoireItem => e !== undefined);

        const remainingExercises = result
            .filter(e => !priorityIds.has(e.id))
            .sort((a, b) => {
                if (scaleConfig.order_by === 'name') {
                    return (a.name || '').localeCompare(b.name || '');
                }
                // Default: sort by created_at (or position as fallback)
                const posA = a.position ?? 9999;
                const posB = b.position ?? 9999;
                if (posA !== posB) return posA - posB;
                const dateA = new Date(a.created_at || 0).getTime();
                const dateB = new Date(b.created_at || 0).getTime();
                return dateA - dateB;
            });

        return [...priorityExercises, ...remainingExercises];
    }, [exercises, scaleConfig]);

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
                type: 'piece_mastery',
                progress: { current_level: 1, mastery_percentage: 0, time_practiced_minutes: 0 },
            },
            {
                type: 'ear_training',
                progress: { current_level: 1, mastery_percentage: 0, time_practiced_minutes: 0 },
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
        if (selectedPiece) {
            setSelectedPiece(null);
            return;
        }
        if (selectedExercise) {
            setSelectedExercise(null);
            return;
        }
        setActiveModule(null);
    };

    // Render Session Builder if active
    if (showSessionBuilder) {
        return (
            <div className="fixed inset-0 bg-background z-50 flex flex-col">
                <SessionBuilder
                    onStartSession={handleStartLesson}
                    onCancel={() => setShowSessionBuilder(false)}
                />
            </div>
        );
    }

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
                    {activeModule === 'rhythm' && <RhythmTraining onExit={handleCloseModule} />}
                    {activeModule === 'notewalking' && <ChordProgressionExercise onExit={handleCloseModule} />}
                    {(activeModule === 'scale' || activeModule === 'arpeggio') && (
                        <ExercisePracticeModule
                            moduleType={activeModule}
                            exercises={exercises}
                            sequences={sequences}
                            selectedExercise={selectedExercise}
                            onSelectExercise={setSelectedExercise}
                            config={activeModule === 'scale' ? scaleConfig : arpeggioConfig}
                            onConfigChange={(newConfig) => {
                                if (activeModule === 'scale') {
                                    setScaleConfig(newConfig as ScaleModuleConfig);
                                } else {
                                    setArpeggioConfig(newConfig as ArpeggioModuleConfig);
                                }
                            }}
                            availableTypes={availableTypes}
                            onSaveConfig={() => setSaveDialogOpen(true)}
                            savedInstances={moduleConfig.savedInstances}
                            onLoadInstance={async (id) => {
                                const config = await moduleConfig.loadConfig(id);
                                if (config) {
                                    if (config.module_type === 'scale') {
                                        setScaleConfig(config as ScaleModuleConfig);
                                    } else if (config.module_type === 'arpeggio') {
                                        setArpeggioConfig(config as ArpeggioModuleConfig);
                                    }
                                }
                            }}
                            onExit={handleCloseModule}
                        />
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
                    {activeModule === 'piece_mastery' && (
                        selectedPiece ? (
                            <div className="h-full bg-background">
                                <PieceMastery piece={selectedPiece} onBack={() => setSelectedPiece(null)} onExit={handleCloseModule} />
                            </div>
                        ) : (
                            <div className="h-full overflow-y-auto">
                                <PieceList onSelectPiece={setSelectedPiece} onExit={handleCloseModule} />
                            </div>
                        )
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
                        <Button size="lg" className="gap-2" onClick={() => setShowSessionBuilder(true)}>
                            <Plus className="w-4 h-4" />
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

                    {/* Lesson Builder Button */}
                    <Button
                        variant="default"
                        className="gap-2"
                        onClick={() => setShowSessionBuilder(true)}
                    >
                        <Layers className="w-4 h-4" />
                        Lesson Builder
                    </Button>
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

            {/* Save Configuration Dialog */}
            <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Save Configuration</DialogTitle>
                        <DialogDescription>
                            Save your current scale settings as a reusable module instance.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Instance Name</label>
                            <Input
                                placeholder="e.g., 3NPS Scales Priority"
                                value={instanceName}
                                onChange={(e) => setInstanceName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveConfig();
                                }}
                            />
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                            <p>Current settings:</p>
                            <ul className="list-disc pl-4">
                                {scaleConfig.type_filter && (
                                    <li>Type: {scaleConfig.type_filter}</li>
                                )}
                                <li>Group by shape: {scaleConfig.group_by_shape ? 'Yes' : 'No'}</li>
                                {(scaleConfig.priority_scale_ids?.length || 0) > 0 && (
                                    <li>{scaleConfig.priority_scale_ids?.length} priority exercise(s)</li>
                                )}
                            </ul>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveConfig} disabled={!instanceName.trim()}>
                            <Save className="w-4 h-4 mr-2" />
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
