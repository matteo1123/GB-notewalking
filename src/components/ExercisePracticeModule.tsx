import { useMemo, useCallback } from 'react';
import { Button } from './ui/button';
import { Settings, Star, StarOff, Save, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { ScaleModuleConfig, ArpeggioModuleConfig } from '@/types/practice';
import type { RepertoireItem } from '@/types/repertoire';
import RiffPractice from './RiffPractice';
import ExerciseList from './ExerciseList';
import { ForceLandscapeWrapper } from './ForceLandscapeWrapper';
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

export interface ExercisePracticeModuleProps {
    moduleType: 'scale' | 'arpeggio';
    exercises: RepertoireItem[];
    sequences: any[];
    selectedExercise: RepertoireItem | null;
    onSelectExercise: (exercise: RepertoireItem | null) => void;
    config: ScaleModuleConfig | ArpeggioModuleConfig;
    onConfigChange: (config: ScaleModuleConfig | ArpeggioModuleConfig) => void;
    availableTypes: string[];
    onSaveConfig?: () => void;
    savedInstances?: { id: string; name: string }[];
    onLoadInstance?: (id: string) => void;
    // Exit callback for standalone/freeplay mode
    onExit?: () => void;
    // Config mode: hides metronome, no playback - for session builder configuration
    isConfigMode?: boolean;
}

/**
 * ExercisePracticeModule - Shared component for scale and arpeggio practice
 * 
 * Unifies the previously duplicated scale/arpeggio rendering logic from ModuleLibrary.
 * Supports:
 * - Navigation (Previous/Next through exercises)
 * - Settings menu with type filter and priority management
 * - Priority toggle for current exercise
 * - Exercise selection list view
 */
export function ExercisePracticeModule({
    moduleType,
    exercises,
    sequences,
    selectedExercise,
    onSelectExercise,
    config,
    onConfigChange,
    availableTypes,
    onSaveConfig,
    savedInstances = [],
    onLoadInstance,
    onExit,
    isConfigMode = false,
}: ExercisePracticeModuleProps) {
    // Process exercises with config (filter, dedupe, order)
    const processedExercises = useMemo(() => {
        let result = exercises.filter(e => e.category === moduleType);

        // Apply type filter
        const typeFilter = config.type_filter;
        if (typeFilter) {
            result = result.filter(e => e.Type === typeFilter);
        }

        // Deduplicate by scale_shape if enabled (only for scale type with group_by_shape)
        if (moduleType === 'scale' && (config as ScaleModuleConfig).group_by_shape) {
            const seenShapes = new Map<string, RepertoireItem>();
            result.forEach(exercise => {
                const shapeId = exercise.scale_shape;
                if (shapeId && !seenShapes.has(shapeId)) {
                    seenShapes.set(shapeId, exercise);
                } else if (!shapeId) {
                    seenShapes.set(exercise.id, exercise);
                }
            });
            result = Array.from(seenShapes.values());
        }

        // Get priority IDs based on module type
        const priorityIds = new Set(
            moduleType === 'scale'
                ? (config as ScaleModuleConfig).priority_scale_ids || []
                : (config as ArpeggioModuleConfig).priority_arpeggio_ids || []
        );

        const priorityIdsList = moduleType === 'scale'
            ? (config as ScaleModuleConfig).priority_scale_ids || []
            : (config as ArpeggioModuleConfig).priority_arpeggio_ids || [];

        // Separate priority and non-priority exercises
        const priorityExercises = priorityIdsList
            .map(id => result.find(e => e.id === id))
            .filter((e): e is RepertoireItem => e !== undefined);

        const remainingExercises = result
            .filter(e => !priorityIds.has(e.id))
            .sort((a, b) => {
                if (config.order_by === 'name') {
                    return (a.name || '').localeCompare(b.name || '');
                }
                const posA = a.position ?? 9999;
                const posB = b.position ?? 9999;
                if (posA !== posB) return posA - posB;
                const dateA = new Date(a.created_at || 0).getTime();
                const dateB = new Date(b.created_at || 0).getTime();
                return dateA - dateB;
            });

        return [...priorityExercises, ...remainingExercises];
    }, [exercises, config, moduleType]);

    const currentIndex = selectedExercise
        ? processedExercises.findIndex(e => e.id === selectedExercise.id)
        : -1;
    const hasPrevious = currentIndex > 0;
    const hasNext = currentIndex < processedExercises.length - 1 && currentIndex !== -1;

    const priorityIds = moduleType === 'scale'
        ? (config as ScaleModuleConfig).priority_scale_ids || []
        : (config as ArpeggioModuleConfig).priority_arpeggio_ids || [];
    const isPriority = selectedExercise && priorityIds.includes(selectedExercise.id);

    const goToPrevious = useCallback(() => {
        if (hasPrevious) {
            onSelectExercise(processedExercises[currentIndex - 1]);
        }
    }, [hasPrevious, currentIndex, processedExercises, onSelectExercise]);

    const goToNext = useCallback(() => {
        if (hasNext) {
            onSelectExercise(processedExercises[currentIndex + 1]);
        }
    }, [hasNext, currentIndex, processedExercises, onSelectExercise]);

    const togglePriority = useCallback(() => {
        if (!selectedExercise) return;

        if (moduleType === 'scale') {
            const scaleConfig = config as ScaleModuleConfig;
            const ids = scaleConfig.priority_scale_ids || [];
            if (ids.includes(selectedExercise.id)) {
                onConfigChange({
                    ...scaleConfig,
                    priority_scale_ids: ids.filter(id => id !== selectedExercise.id),
                });
            } else {
                onConfigChange({
                    ...scaleConfig,
                    priority_scale_ids: [...ids, selectedExercise.id],
                });
            }
        } else {
            const arpeggioConfig = config as ArpeggioModuleConfig;
            const ids = arpeggioConfig.priority_arpeggio_ids || [];
            if (ids.includes(selectedExercise.id)) {
                onConfigChange({
                    ...arpeggioConfig,
                    priority_arpeggio_ids: ids.filter(id => id !== selectedExercise.id),
                });
            } else {
                onConfigChange({
                    ...arpeggioConfig,
                    priority_arpeggio_ids: [...ids, selectedExercise.id],
                });
            }
        }
    }, [selectedExercise, moduleType, config, onConfigChange]);

    const moduleLabel = moduleType === 'scale' ? 'Scale' : 'Arpeggio';

    // Exercise view (when an exercise is selected)
    if (selectedExercise) {
        return (
            /* @LANDSCAPE-LOCK: Do not remove ForceLandscapeWrapper — it forces landscape on mobile phones */
            <ForceLandscapeWrapper>
                <div className="h-full flex flex-col bg-background">
                    {/* Navigation bar - mobile optimized */}
                    <div className="flex-shrink-0 flex items-center justify-between px-2 sm:px-4 py-1 sm:py-2 border-b bg-card gap-1 sm:gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={goToPrevious}
                            disabled={!hasPrevious}
                            className="px-2 sm:px-3"
                        >
                            <ChevronLeft className="w-4 h-4 sm:mr-1" />
                            <span className="hidden sm:inline">Previous</span>
                        </Button>

                        <div className="flex items-center gap-1 sm:gap-2 flex-1 justify-center min-w-0">
                            {/* Settings dropdown */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="gap-1 px-2">
                                        <Settings className="w-4 h-4" />
                                        {config.type_filter && (
                                            <span className="text-xs bg-primary/20 px-1 rounded hidden sm:inline">
                                                {config.type_filter.split(' ')[0]}
                                            </span>
                                        )}
                                        {priorityIds.length > 0 && (
                                            <span className="text-xs bg-yellow-500/20 px-1 rounded">
                                                {priorityIds.length}★
                                            </span>
                                        )}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="center" className="w-56">
                                    <DropdownMenuLabel>{moduleLabel} Settings</DropdownMenuLabel>
                                    <DropdownMenuSeparator />

                                    {/* Type Filter */}
                                    <div className="px-2 py-1.5">
                                        <label className="text-xs text-muted-foreground mb-1 block">Type Filter</label>
                                        <Select
                                            value={config.type_filter || "all"}
                                            onValueChange={(value) => onConfigChange({
                                                ...config,
                                                type_filter: value === "all" ? undefined : value
                                            })}
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

                                    {/* Group by shape toggle (scale only) */}
                                    {moduleType === 'scale' && (
                                        <>
                                            <DropdownMenuItem onClick={() => {
                                                const scaleConfig = config as ScaleModuleConfig;
                                                onConfigChange({
                                                    ...scaleConfig,
                                                    group_by_shape: !scaleConfig.group_by_shape
                                                });
                                            }}>
                                                {(config as ScaleModuleConfig).group_by_shape ? '✓ ' : '  '}
                                                One per scale shape
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                        </>
                                    )}

                                    {/* Priority info */}
                                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                        {priorityIds.length > 0
                                            ? `${priorityIds.length} priority exercise(s)`
                                            : 'No priority exercises'
                                        }
                                    </div>
                                    {priorityIds.length > 0 && (
                                        <DropdownMenuItem onClick={() => {
                                            if (moduleType === 'scale') {
                                                onConfigChange({
                                                    ...config as ScaleModuleConfig,
                                                    priority_scale_ids: []
                                                });
                                            } else {
                                                onConfigChange({
                                                    ...config as ArpeggioModuleConfig,
                                                    priority_arpeggio_ids: []
                                                });
                                            }
                                        }}>
                                            Clear all priorities
                                        </DropdownMenuItem>
                                    )}

                                    <DropdownMenuSeparator />

                                    {/* Save Config Button */}
                                    {onSaveConfig && (
                                        <DropdownMenuItem onClick={onSaveConfig} className="gap-2">
                                            <Save className="w-4 h-4" />
                                            Save as Module Instance
                                        </DropdownMenuItem>
                                    )}

                                    {/* Show saved instances if any */}
                                    {savedInstances.length > 0 && onLoadInstance && (
                                        <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuLabel className="text-xs">Saved Configurations</DropdownMenuLabel>
                                            {savedInstances.map((instance) => (
                                                <DropdownMenuItem
                                                    key={instance.id}
                                                    onClick={() => onLoadInstance(instance.id)}
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
                                className="px-2"
                            >
                                {isPriority ? <Star className="w-4 h-4 fill-current" /> : <StarOff className="w-4 h-4" />}
                            </Button>

                            <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                                {currentIndex + 1}/{processedExercises.length}
                            </span>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onSelectExercise(null)}
                                className="px-2 sm:px-3"
                            >
                                <span className="hidden sm:inline">Select Another</span>
                                <span className="sm:hidden">List</span>
                            </Button>
                        </div>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={goToNext}
                            disabled={!hasNext}
                            className="px-2 sm:px-3"
                        >
                            <span className="hidden sm:inline">Next</span>
                            <ChevronRight className="w-4 h-4 sm:ml-1" />
                        </Button>

                        {/* Exit button */}
                        {onExit && (
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1 ml-1" onClick={onExit}>
                                <X className="w-3 h-3" /> Exit
                            </Button>
                        )}
                    </div>

                    {/* Exercise content */}
                    <div className="flex-1 min-h-0">
                        <RiffPractice
                            repertoireItem={selectedExercise}
                            sequences={sequences}
                            onExerciseSelect={() => { }}
                            isConfigMode={isConfigMode}
                        />
                    </div>
                </div>
            </ForceLandscapeWrapper>
        );
    }

    // List view (when no exercise is selected)
    return (
        <div className="h-full overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                <h3 className="text-lg font-semibold">Select a {moduleLabel}</h3>
                <div className="flex items-center gap-2">
                    {/* Type filter in list view */}
                    <Select
                        value={config.type_filter || "all"}
                        onValueChange={(value) => onConfigChange({
                            ...config,
                            type_filter: value === "all" ? undefined : value
                        })}
                    >
                        <SelectTrigger className="h-8 w-32 sm:w-48">
                            <SelectValue placeholder="All Types" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            {availableTypes.map(type => (
                                <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {processedExercises.length} exercises
                    </span>
                    {onExit && (
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" onClick={onExit}>
                            <X className="w-3 h-3" /> Exit
                        </Button>
                    )}
                </div>
            </div>
            <ExerciseList
                items={processedExercises}
                defaultSort={{ key: "position", dir: "asc" }}
                onSelect={onSelectExercise}
            />
        </div>
    );
}

export default ExercisePracticeModule;

