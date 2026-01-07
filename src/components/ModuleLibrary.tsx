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
import type { ModuleType, ScaleModuleConfig } from '@/types/practice';
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
import { useModuleConfig } from '@/hooks/useModuleConfig';
import { usePracticeSession } from '@/hooks/usePracticeSession';
import { SessionBuilder } from '@/components/SessionBuilder';
import { Save, Layers } from 'lucide-react';
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

    // Get unique Type values for filter dropdown
    const availableTypes = useMemo(() => {
        const types = new Set<string>();
        exercises.forEach(e => {
            if (e.Type && e.category === 'scale') {
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
                    {activeModule === 'rhythm' && <RhythmTraining />}
                    {activeModule === 'notewalking' && <ChordProgressionExercise />}
                    {activeModule === 'scale' && (() => {
                        const scaleExercises = processedScaleExercises;
                        const currentIndex = selectedExercise ? scaleExercises.findIndex(e => e.id === selectedExercise.id) : -1;
                        const hasPrevious = currentIndex > 0;
                        const hasNext = currentIndex < scaleExercises.length - 1 && currentIndex !== -1;
                        const isPriority = selectedExercise && (scaleConfig.priority_scale_ids || []).includes(selectedExercise.id);

                        const goToPrevious = () => {
                            if (hasPrevious) {
                                setSelectedExercise(scaleExercises[currentIndex - 1]);
                            }
                        };

                        const goToNext = () => {
                            if (hasNext) {
                                setSelectedExercise(scaleExercises[currentIndex + 1]);
                            }
                        };

                        const togglePriority = () => {
                            if (!selectedExercise) return;
                            setScaleConfig(prev => {
                                const ids = prev.priority_scale_ids || [];
                                if (ids.includes(selectedExercise.id)) {
                                    return { ...prev, priority_scale_ids: ids.filter(id => id !== selectedExercise.id) };
                                } else {
                                    return { ...prev, priority_scale_ids: [...ids, selectedExercise.id] };
                                }
                            });
                        };

                        return selectedExercise ? (
                            <div className="h-full flex flex-col bg-background">
                                {/* Navigation bar */}
                                <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b bg-card gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={goToPrevious}
                                        disabled={!hasPrevious}
                                    >
                                        ← Previous
                                    </Button>
                                    <div className="flex items-center gap-2">
                                        {/* Settings dropdown */}
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" size="sm" className="gap-1">
                                                    <Settings className="w-4 h-4" />
                                                    {scaleConfig.type_filter && (
                                                        <span className="text-xs bg-primary/20 px-1 rounded">
                                                            {scaleConfig.type_filter.split(' ')[0]}
                                                        </span>
                                                    )}
                                                    {(scaleConfig.priority_scale_ids?.length || 0) > 0 && (
                                                        <span className="text-xs bg-yellow-500/20 px-1 rounded">
                                                            {scaleConfig.priority_scale_ids?.length}★
                                                        </span>
                                                    )}
                                                    {!scaleConfig.group_by_shape && (
                                                        <span className="text-xs bg-blue-500/20 px-1 rounded">
                                                            All
                                                        </span>
                                                    )}
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="center" className="w-56">
                                                <DropdownMenuLabel>Scale Settings</DropdownMenuLabel>
                                                <DropdownMenuSeparator />

                                                {/* Type Filter */}
                                                <div className="px-2 py-1.5">
                                                    <label className="text-xs text-muted-foreground mb-1 block">Type Filter</label>
                                                    <Select
                                                        value={scaleConfig.type_filter || "all"}
                                                        onValueChange={(value) => setScaleConfig(prev => ({
                                                            ...prev,
                                                            type_filter: value === "all" ? undefined : value
                                                        }))}
                                                    >
                                                        <SelectTrigger className="h-8">
                                                            <SelectValue placeholder="All Types" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="all">All Types</SelectItem>
                                                            {availableTypes.map(type => (
                                                                <SelectItem key={type} value={type}>{type}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <DropdownMenuSeparator />

                                                {/* Group by shape toggle */}
                                                <DropdownMenuItem onClick={() => setScaleConfig(prev => ({
                                                    ...prev,
                                                    group_by_shape: !prev.group_by_shape
                                                }))}>
                                                    {scaleConfig.group_by_shape ? '✓ ' : '  '}
                                                    One per scale shape
                                                </DropdownMenuItem>

                                                <DropdownMenuSeparator />

                                                {/* Priority info */}
                                                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                                    {(scaleConfig.priority_scale_ids?.length || 0) > 0
                                                        ? `${scaleConfig.priority_scale_ids?.length} priority exercise(s)`
                                                        : 'No priority exercises'
                                                    }
                                                </div>
                                                {(scaleConfig.priority_scale_ids?.length || 0) > 0 && (
                                                    <DropdownMenuItem onClick={() => setScaleConfig(prev => ({
                                                        ...prev,
                                                        priority_scale_ids: []
                                                    }))}>
                                                        Clear all priorities
                                                    </DropdownMenuItem>
                                                )}

                                                <DropdownMenuSeparator />

                                                {/* Save Config Button */}
                                                <DropdownMenuItem onClick={() => setSaveDialogOpen(true)} className="gap-2">
                                                    <Save className="w-4 h-4" />
                                                    Save as Module Instance
                                                </DropdownMenuItem>

                                                {/* Reset to Default - only show if config has any customizations */}
                                                {(scaleConfig.type_filter ||
                                                    (scaleConfig.priority_scale_ids?.length || 0) > 0 ||
                                                    !scaleConfig.group_by_shape) && (
                                                        <DropdownMenuItem
                                                            onClick={() => setScaleConfig({
                                                                module_type: 'scale',
                                                                type_filter: undefined,
                                                                priority_scale_ids: [],
                                                                group_by_shape: true,
                                                                order_by: 'created_at',
                                                                current_index: 0,
                                                            })}
                                                            className="text-muted-foreground"
                                                        >
                                                            Reset to Default
                                                        </DropdownMenuItem>
                                                    )}

                                                {/* Show saved instances if any */}
                                                {moduleConfig.savedInstances.length > 0 && (
                                                    <>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuLabel className="text-xs">Saved Configurations</DropdownMenuLabel>
                                                        {moduleConfig.savedInstances.map((instance) => (
                                                            <DropdownMenuItem
                                                                key={instance.id}
                                                                onClick={async () => {
                                                                    const config = await moduleConfig.loadConfig(instance.id);
                                                                    if (config && config.module_type === 'scale') {
                                                                        setScaleConfig(config as ScaleModuleConfig);
                                                                    }
                                                                }}
                                                            >
                                                                {instance.name}
                                                            </DropdownMenuItem>
                                                        ))}
                                                    </>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        {/* Priority toggle for current exercise */}
                                        <Button
                                            variant={isPriority ? "default" : "outline"}
                                            size="sm"
                                            onClick={togglePriority}
                                            title={isPriority ? "Remove from priority" : "Add to priority"}
                                        >
                                            {isPriority ? <Star className="w-4 h-4 fill-current" /> : <StarOff className="w-4 h-4" />}
                                        </Button>

                                        <span className="text-sm text-muted-foreground">
                                            {currentIndex + 1} / {scaleExercises.length}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setSelectedExercise(null)}
                                        >
                                            Select Another
                                        </Button>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={goToNext}
                                        disabled={!hasNext}
                                    >
                                        Next →
                                    </Button>
                                </div>
                                {/* Exercise content */}
                                <div className="flex-1 min-h-0">
                                    <RiffPractice
                                        repertoireItem={selectedExercise}
                                        sequences={sequences}
                                        onExerciseSelect={() => { }}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="h-full overflow-y-auto p-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold">Select a Scale</h3>
                                    <div className="flex items-center gap-2">
                                        {/* Type filter in list view too */}
                                        <Select
                                            value={scaleConfig.type_filter || "all"}
                                            onValueChange={(value) => setScaleConfig(prev => ({
                                                ...prev,
                                                type_filter: value === "all" ? undefined : value
                                            }))}
                                        >
                                            <SelectTrigger className="h-8 w-48">
                                                <SelectValue placeholder="All Types" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Types</SelectItem>
                                                {availableTypes.map(type => (
                                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <span className="text-sm text-muted-foreground">
                                            {scaleExercises.length} exercises
                                        </span>
                                    </div>
                                </div>
                                <ExerciseList
                                    items={scaleExercises}
                                    defaultSort={{ key: "position", dir: "asc" }}
                                    onSelect={setSelectedExercise}
                                />
                            </div>
                        );
                    })()}
                    {activeModule === 'arpeggio' && (() => {
                        const arpeggioExercises = exercises.filter((e) => e.category === "arpeggio");
                        const currentIndex = selectedExercise ? arpeggioExercises.findIndex(e => e.id === selectedExercise.id) : -1;
                        const hasPrevious = currentIndex > 0;
                        const hasNext = currentIndex < arpeggioExercises.length - 1 && currentIndex !== -1;

                        const goToPrevious = () => {
                            if (hasPrevious) {
                                setSelectedExercise(arpeggioExercises[currentIndex - 1]);
                            }
                        };

                        const goToNext = () => {
                            if (hasNext) {
                                setSelectedExercise(arpeggioExercises[currentIndex + 1]);
                            }
                        };

                        return selectedExercise ? (
                            <div className="h-full flex flex-col bg-background">
                                {/* Navigation bar */}
                                <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b bg-card">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={goToPrevious}
                                        disabled={!hasPrevious}
                                    >
                                        ← Previous
                                    </Button>
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm text-muted-foreground">
                                            {currentIndex + 1} / {arpeggioExercises.length}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setSelectedExercise(null)}
                                        >
                                            Select Another
                                        </Button>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={goToNext}
                                        disabled={!hasNext}
                                    >
                                        Next →
                                    </Button>
                                </div>
                                {/* Exercise content */}
                                <div className="flex-1 min-h-0">
                                    <RiffPractice
                                        repertoireItem={selectedExercise}
                                        sequences={sequences}
                                        onExerciseSelect={() => { }}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="h-full overflow-y-auto p-4">
                                <h3 className="text-lg font-semibold mb-4">Select an Arpeggio</h3>
                                <ExerciseList
                                    items={arpeggioExercises}
                                    defaultSort={{ key: "position", dir: "asc" }}
                                    onSelect={setSelectedExercise}
                                />
                            </div>
                        );
                    })()}
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
                                <PieceMastery piece={selectedPiece} onBack={() => setSelectedPiece(null)} />
                            </div>
                        ) : (
                            <div className="h-full overflow-y-auto">
                                <PieceList onSelectPiece={setSelectedPiece} />
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
