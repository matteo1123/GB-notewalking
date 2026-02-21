import { useState, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, GripVertical, Play, Clock, Settings, Ear, X, Check } from 'lucide-react';
import { useModuleConfig, SavedModuleInstance } from '@/hooks/useModuleConfig';
import { MODULE_REGISTRY } from '@/types/modules';
import type { PracticeRoutineSummary, SessionBlock, ModuleType, ModuleConfig, ScaleModuleConfig, ArpeggioModuleConfig, EarTrainingModuleOptions } from '@/types/practice';
import type { RepertoireItem } from '@/types/repertoire';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useRoutines } from '@/hooks/useRoutines';
import { ExercisePracticeModule } from './ExercisePracticeModule';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from 'sonner';

interface SessionBuilderProps {
    onStartSession: (blocks: SessionBlock[], routineName?: string) => void;
    onCancel: () => void;
    initialRoutine?: PracticeRoutineSummary | null;
    initialBlocks?: SessionBlock[];
}

const ICONS = ['🎸', '🎵', '🎶', '🔥', '⚡', '🎯', '💪', '🌟', '🚀', '🎹'];

/**
 * SessionBuilder - UI for composing practice lessons with configured modules
 * 
 * Features:
 * - Add module blocks from saved configs or default
 * - Set duration per block
 * - Reorder blocks (drag or arrows)
 * - Start lesson to practice all blocks in sequence
 */
export function SessionBuilder({ onStartSession, onCancel, initialRoutine, initialBlocks }: SessionBuilderProps) {
    const { createRoutine, updateRoutine } = useRoutines();
    const [blocks, setBlocks] = useState<SessionBlock[]>(initialBlocks || []);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [selectedModuleType, setSelectedModuleType] = useState<ModuleType | null>(null);
    const [selectedDuration, setSelectedDuration] = useState(2);

    // Routine Meta State
    const [name, setName] = useState(initialRoutine?.name || '');
    const [description, setDescription] = useState(initialRoutine?.description || '');
    const [icon, setIcon] = useState(initialRoutine?.icon || '🎸');
    const [isSaving, setIsSaving] = useState(false);

    // Edit block state
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingBlockIndex, setEditingBlockIndex] = useState<number | null>(null);

    // Fullscreen config mode state
    const [configMode, setConfigMode] = useState(false);
    const [configExercise, setConfigExercise] = useState<RepertoireItem | null>(null);

    // Data for ExercisePracticeModule
    const [exercises, setExercises] = useState<RepertoireItem[]>([]);
    const [sequences, setSequences] = useState<any[]>([]);

    const scaleConfigs = useModuleConfig('scale');
    const arpeggioConfigs = useModuleConfig('arpeggio');

    // Load exercises and sequences for config mode
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
                setExercises(mapped as any);
            }

            const { data: sequencesData } = await (supabase as any)
                .from('sequences')
                .select('*');

            if (sequencesData) {
                setSequences(sequencesData);
            }
        }
        loadData();
    }, []);

    // Load full routine data if initialRoutine is provided and we don't have initialBlocks
    useEffect(() => {
        if (initialRoutine && !initialBlocks?.length) {
            if (initialRoutine.id === 'default-daily-practice') {
                setBlocks([
                    { module_type: 'scale', duration_minutes: 3, order: 0, config: { module_type: 'scale' } },
                    { module_type: 'arpeggio', duration_minutes: 2, order: 1, config: { module_type: 'arpeggio' } },
                    { module_type: 'rhythm', duration_minutes: 3, order: 2, config: { module_type: 'rhythm', rhythm_level: 1 } },
                    { module_type: 'ear_training', duration_minutes: 2, order: 3, config: { module_type: 'ear_training', root_note: 'C' } }
                ] as SessionBlock[]);
                return;
            }

            const fetchFullRoutine = async () => {
                const table = initialRoutine.is_history ? 'practice_sessions' : 'practice_routines';
                const { data, error } = await (supabase as any)
                    .from(table)
                    .select('session_plan')
                    .eq('id', initialRoutine.id)
                    .single();

                if (!error && data?.session_plan) {
                    setBlocks(data.session_plan as SessionBlock[]);
                }
            };
            fetchFullRoutine();
        }
    }, [initialRoutine, initialBlocks]);

    // Get unique Type values for filter dropdown
    const availableTypes = useMemo(() => {
        const types = new Set<string>();
        exercises.forEach(e => {
            if (e.Type && (e.category === 'scale' || e.category === 'arpeggio')) {
                types.add(e.Type);
            }
        });
        return Array.from(types).sort();
    }, [exercises]);

    // Get total duration
    const totalMinutes = blocks.reduce((sum, b) => sum + b.duration_minutes, 0);

    // Add a new block with default or saved config
    const addBlock = useCallback((moduleType: ModuleType, savedConfig?: SavedModuleInstance) => {
        const order = blocks.length;

        // Create default config based on module type
        let config: ModuleConfig;
        if (savedConfig) {
            config = savedConfig.module_config;
        } else {
            switch (moduleType) {
                case 'scale':
                    config = {
                        module_type: 'scale',
                        group_by_shape: true,
                        order_by: 'created_at',
                    } as ScaleModuleConfig;
                    break;
                case 'arpeggio':
                    config = {
                        module_type: 'arpeggio',
                        order_by: 'created_at',
                    } as ArpeggioModuleConfig;
                    break;
                case 'rhythm':
                    config = { module_type: 'rhythm', rhythm_level: 1 } as any;
                    break;
                case 'notewalking':
                    config = { module_type: 'notewalking', key: 'C', chords: ['I', 'IV', 'V'] } as any;
                    break;
                case 'piece_mastery':
                    config = { module_type: 'piece_mastery', piece_id: '', segment_seconds: 30 } as any;
                    break;
                case 'chord_progressions':
                    config = { module_type: 'chord_progressions', progression_id: 'maj_1', key: 'C' } as any;
                    break;
                case 'ear_training':
                    config = { module_type: 'ear_training', root_note: 'C' } as any;
                    break;
                default:
                    config = { module_type: moduleType } as any;
            }
        }

        const newBlock: SessionBlock = {
            module_type: moduleType,
            config,
            duration_minutes: selectedDuration,
            order,
        };

        setBlocks(prev => [...prev, newBlock]);
        setAddDialogOpen(false);
        setSelectedModuleType(null);
    }, [blocks.length, selectedDuration]);

    // Remove block
    const removeBlock = useCallback((index: number) => {
        setBlocks(prev => {
            const updated = prev.filter((_, i) => i !== index);
            // Re-order
            return updated.map((b, i) => ({ ...b, order: i }));
        });
    }, []);

    // Update block duration
    const updateDuration = useCallback((index: number, minutes: number) => {
        setBlocks(prev => prev.map((b, i) =>
            i === index ? { ...b, duration_minutes: minutes } : b
        ));
    }, []);

    // Update block config (for edit dialog)
    const updateBlockConfig = useCallback((index: number, newConfig: Partial<ModuleConfig>) => {
        setBlocks(prev => prev.map((b, i) =>
            i === index ? { ...b, config: { ...b.config, ...newConfig } as ModuleConfig } : b
        ));
    }, []);

    // Open edit dialog for a block - fullscreen for scale/arpeggio, simple dialog for others
    const openEditDialog = useCallback((index: number) => {
        const block = blocks[index];
        setEditingBlockIndex(index);

        // For scale/arpeggio modules, use fullscreen config mode
        if (block.module_type === 'scale' || block.module_type === 'arpeggio') {
            // Find the currently selected exercise from config
            const config = block.config as ScaleModuleConfig | ArpeggioModuleConfig;
            const exerciseId = config.module_type === 'scale'
                ? (config as ScaleModuleConfig).current_scale_id
                : (config as ArpeggioModuleConfig).current_arpeggio_id;

            if (exerciseId) {
                const found = exercises.find(e => e.id === exerciseId);
                setConfigExercise(found || null);
            } else {
                setConfigExercise(null);
            }
            setConfigMode(true);
        } else {
            // For other module types, use simple dialog
            setEditDialogOpen(true);
        }
    }, [blocks, exercises]);

    // Move block up/down
    const moveBlock = useCallback((index: number, direction: 'up' | 'down') => {
        setBlocks(prev => {
            const newIndex = direction === 'up' ? index - 1 : index + 1;
            if (newIndex < 0 || newIndex >= prev.length) return prev;

            const updated = [...prev];
            [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
            return updated.map((b, i) => ({ ...b, order: i }));
        });
    }, []);

    // Get config display name - shows what's actually configured
    const getConfigName = (block: SessionBlock): string => {
        const config = block.config as any;
        const parts: string[] = [];

        // Check for saved instance name
        if (config._instance_name) {
            return config._instance_name;
        }

        // Check for selected exercise ID and look up name
        const exerciseId = config.current_scale_id || config.current_arpeggio_id;
        if (exerciseId) {
            const exercise = exercises.find(e => e.id === exerciseId);
            if (exercise) {
                parts.push(exercise.name);
            }
        }

        // Add type filter if present
        if (config.type_filter) {
            parts.push(config.type_filter);
        }

        // Add ear training indicator if enabled
        if (config.ear_training?.enabled) {
            parts.push(`🎧 ${config.ear_training.mode}`);
        }

        return parts.length > 0 ? parts.join(' • ') : 'Default';
    };

    // Get saved configs for selected module type
    const getSavedConfigs = (): SavedModuleInstance[] => {
        if (selectedModuleType === 'scale') return scaleConfigs.savedInstances;
        if (selectedModuleType === 'arpeggio') return arpeggioConfigs.savedInstances;
        return [];
    };

    // Handle saving config in fullscreen mode
    const handleSaveConfig = useCallback(() => {
        if (editingBlockIndex === null) return;

        const block = blocks[editingBlockIndex];
        const moduleType = block.module_type as 'scale' | 'arpeggio';
        const config = block.config as ScaleModuleConfig | ArpeggioModuleConfig;

        // Update the config with the selected exercise ID
        if (configExercise) {
            if (moduleType === 'scale') {
                updateBlockConfig(editingBlockIndex, {
                    current_scale_id: configExercise.id,
                });
            } else {
                updateBlockConfig(editingBlockIndex, {
                    current_arpeggio_id: configExercise.id,
                });
            }
        }

        setConfigMode(false);
        setConfigExercise(null);
        setEditingBlockIndex(null);
    }, [editingBlockIndex, blocks, configExercise, updateBlockConfig]);

    // Render fullscreen config mode for scale/arpeggio modules
    if (configMode && editingBlockIndex !== null && blocks[editingBlockIndex]) {
        const block = blocks[editingBlockIndex];
        const moduleType = block.module_type as 'scale' | 'arpeggio';
        const config = block.config as ScaleModuleConfig | ArpeggioModuleConfig;

        return (
            <div className="fixed inset-0 bg-background z-50 flex flex-col">
                {/* Header */}
                <div className="flex-shrink-0 p-4 border-b flex items-center justify-between bg-card">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{MODULE_REGISTRY[moduleType]?.icon || '📦'}</span>
                        <div>
                            <h2 className="text-xl font-bold">Configure {MODULE_REGISTRY[moduleType]?.name}</h2>
                            <p className="text-sm text-muted-foreground">
                                {configExercise ? configExercise.name : 'Select an exercise'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => {
                            setConfigMode(false);
                            setConfigExercise(null);
                            setEditingBlockIndex(null);
                        }}>
                            <X className="w-4 h-4 mr-2" />
                            Cancel
                        </Button>
                        <Button onClick={handleSaveConfig}>
                            <Check className="w-4 h-4 mr-2" />
                            Save Configuration
                        </Button>
                    </div>
                </div>

                {/* Exercise Practice Module in config mode */}
                <div className="flex-1 min-h-0">
                    <ExercisePracticeModule
                        moduleType={moduleType}
                        exercises={exercises}
                        sequences={sequences}
                        selectedExercise={configExercise}
                        onSelectExercise={setConfigExercise}
                        config={config}
                        onConfigChange={(newConfig) => updateBlockConfig(editingBlockIndex, newConfig)}
                        availableTypes={availableTypes}
                        isConfigMode={true}
                    />
                </div>
            </div>
        );
    }

    // Save routine
    const handleSaveRoutine = async () => {
        if (!name.trim()) {
            toast.error("Please provide a name for your routine before saving.");
            return;
        }
        if (blocks.length === 0) {
            toast.error("Add at least one module to save the routine.");
            return;
        }

        setIsSaving(true);
        try {
            if (initialRoutine && !initialRoutine.is_history) {
                await updateRoutine(initialRoutine.id, {
                    name: name.trim(),
                    description: description.trim() || undefined,
                    icon,
                    session_plan: blocks,
                });
                toast.success("Routine updated successfully!");
            } else {
                await createRoutine({
                    name: name.trim(),
                    description: description.trim() || undefined,
                    icon,
                    session_plan: blocks,
                });
                toast.success("New routine created!");
            }
            onCancel(); // exit builder
        } catch (err) {
            console.error(err);
            toast.error("Failed to save routine");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-background">
            <div className="flex-shrink-0 border-b p-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex-1 max-w-2xl">
                        <div className="flex gap-3 mb-4">
                            <div className="flex-shrink-0">
                                <Label className="text-xs text-muted-foreground">Icon</Label>
                                <Select value={icon} onValueChange={setIcon}>
                                    <SelectTrigger className="w-16 h-10 text-xl border-none shadow-sm dark:bg-card">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ICONS.map(i => (
                                            <SelectItem key={i} value={i} className="text-xl">
                                                {i}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex-1">
                                <Label htmlFor="routine-name" className="text-xs text-muted-foreground">Routine Name</Label>
                                <Input
                                    id="routine-name"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="e.g., C# Minor Mastery (Optional if just starting a session)"
                                    className="text-lg font-semibold bg-transparent border-0 border-b rounded-none px-0 focus-visible:ring-0"
                                />
                            </div>
                        </div>
                        <div>
                            <Input
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Add a description..."
                                className="text-sm text-muted-foreground bg-transparent border-0 border-b rounded-none px-0 focus-visible:ring-0 h-8"
                            />
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold">Session Builder</h2>
                        <p className="text-muted-foreground">Compose your ideal practice session</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onCancel} className="gap-2">
                        <X className="w-4 h-4" />
                        Cancel
                    </Button>
                </div>
            </div>
            {/* Blocks List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {blocks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-12">
                        <div className="text-6xl mb-4">📝</div>
                        <h3 className="text-xl font-semibold mb-2">No blocks yet</h3>
                        <p className="text-muted-foreground mb-4">
                            Add modules to build your practice lesson
                        </p>
                        <Button onClick={() => setAddDialogOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Add Module
                        </Button>
                    </div>
                ) : (
                    <>
                        {blocks.map((block, index) => (
                            <Card key={index} className="relative cursor-pointer hover:border-primary/50 transition-colors">
                                <CardContent className="p-4 flex items-center gap-4" onClick={() => openEditDialog(index)}>
                                    {/* Drag handle / order controls */}
                                    <div className="flex flex-col gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => moveBlock(index, 'up')}
                                            disabled={index === 0}
                                        >
                                            ↑
                                        </Button>
                                        <GripVertical className="w-4 h-4 text-muted-foreground" />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => moveBlock(index, 'down')}
                                            disabled={index === blocks.length - 1}
                                        >
                                            ↓
                                        </Button>
                                    </div>

                                    {/* Module info */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl">{MODULE_REGISTRY[block.module_type]?.icon || '📦'}</span>
                                            <div>
                                                <h4 className="font-semibold">
                                                    {MODULE_REGISTRY[block.module_type]?.name || block.module_type}
                                                </h4>
                                                <p className="text-xs text-muted-foreground">
                                                    Config: {getConfigName(block)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Duration */}
                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                        <Input
                                            type="number"
                                            value={block.duration_minutes}
                                            onChange={(e) => updateDuration(index, parseInt(e.target.value) || 1)}
                                            className="w-16 text-center"
                                            min={1}
                                            max={60}
                                        />
                                        <span className="text-sm text-muted-foreground">min</span>
                                    </div>

                                    {/* Remove */}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeBlock(index)}
                                        className="text-destructive hover:text-destructive"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}

                        {/* Add more button */}
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => setAddDialogOpen(true)}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Module
                        </Button>

                        {/* Action Buttons */}
                        <div className="flex gap-2 mt-4">
                            <Button
                                onClick={() => onStartSession(blocks, name)}
                                disabled={blocks.length === 0}
                                className="flex-1 gap-2"
                                size="lg"
                            >
                                <Play className="w-4 h-4" />
                                Start Session ({totalMinutes} min)
                            </Button>
                            <Button
                                className="flex-1 gap-2"
                                size="lg"
                                variant="outline"
                                onClick={handleSaveRoutine}
                                disabled={isSaving || blocks.length === 0}
                            >
                                <Check className="w-4 h-4" />
                                {isSaving ? "Saving..." : (initialRoutine && !initialRoutine.is_history ? "Save Changes" : "Save as New Routine")}
                            </Button>
                        </div>
                    </>
                )}
            </div>

            {/* Add Module Dialog */}
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add Module</DialogTitle>
                        <DialogDescription>
                            Choose a module type and configuration
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Module Type Selector */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Module Type</label>
                            <Select
                                value={selectedModuleType || ""}
                                onValueChange={(value) => setSelectedModuleType(value as ModuleType)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select module type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(MODULE_REGISTRY).map(([type, info]) => (
                                        <SelectItem key={type} value={type}>
                                            {info.icon} {info.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Duration */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Duration (minutes)</label>
                            <div className="flex gap-2">
                                {[2, 5, 10, 15].map(min => (
                                    <Button
                                        key={min}
                                        variant={selectedDuration === min ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setSelectedDuration(min)}
                                    >
                                        {min}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Saved Configs (for scale/arpeggio) */}
                        {selectedModuleType && getSavedConfigs().length > 0 && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Use Saved Configuration</label>
                                <div className="space-y-2">
                                    {getSavedConfigs().map((config) => (
                                        <Button
                                            key={config.id}
                                            variant="outline"
                                            className="w-full justify-start"
                                            onClick={() => addBlock(selectedModuleType, config)}
                                        >
                                            ⭐ {config.name}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Add with default config */}
                        {selectedModuleType && (
                            <Button
                                className="w-full"
                                onClick={() => addBlock(selectedModuleType)}
                            >
                                Add with Default Config
                            </Button>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Block Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Settings className="w-5 h-5" />
                            Edit {editingBlockIndex !== null ? MODULE_REGISTRY[blocks[editingBlockIndex]?.module_type]?.name : 'Block'}
                        </DialogTitle>
                        <DialogDescription>
                            Configure this module for your practice session
                        </DialogDescription>
                    </DialogHeader>

                    {editingBlockIndex !== null && blocks[editingBlockIndex] && (
                        <div className="space-y-4 py-4">
                            {/* Module Info */}
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span className="text-2xl">{MODULE_REGISTRY[blocks[editingBlockIndex].module_type]?.icon || '📦'}</span>
                                <span>{getConfigName(blocks[editingBlockIndex])}</span>
                            </div>

                            {/* Ear Training Toggle (for scale and arpeggio) */}
                            {['scale', 'arpeggio'].includes(blocks[editingBlockIndex].module_type) && (
                                <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Ear className="w-4 h-4" />
                                            <Label htmlFor="ear-training-toggle">Ear Training Mode</Label>
                                        </div>
                                        <Switch
                                            id="ear-training-toggle"
                                            checked={(blocks[editingBlockIndex].config as ScaleModuleConfig | ArpeggioModuleConfig).ear_training?.enabled ?? false}
                                            onCheckedChange={(checked) => {
                                                const currentConfig = blocks[editingBlockIndex].config as ScaleModuleConfig | ArpeggioModuleConfig;
                                                updateBlockConfig(editingBlockIndex, {
                                                    ear_training: {
                                                        enabled: checked,
                                                        mode: currentConfig.ear_training?.mode ?? 'identify',
                                                        level: currentConfig.ear_training?.level ?? 12,
                                                    } as EarTrainingModuleOptions,
                                                });
                                            }}
                                        />
                                    </div>

                                    {/* Mode selection when enabled */}
                                    {(blocks[editingBlockIndex].config as ScaleModuleConfig | ArpeggioModuleConfig).ear_training?.enabled && (
                                        <div className="flex gap-2">
                                            <Button
                                                variant={(blocks[editingBlockIndex].config as ScaleModuleConfig | ArpeggioModuleConfig).ear_training?.mode === 'identify' ? "default" : "outline"}
                                                size="sm"
                                                className="flex-1"
                                                onClick={() => {
                                                    const currentConfig = blocks[editingBlockIndex].config as ScaleModuleConfig | ArpeggioModuleConfig;
                                                    updateBlockConfig(editingBlockIndex, {
                                                        ear_training: {
                                                            ...currentConfig.ear_training,
                                                            enabled: true,
                                                            mode: 'identify',
                                                        } as EarTrainingModuleOptions,
                                                    });
                                                }}
                                            >
                                                🎯 Identify
                                            </Button>
                                            <Button
                                                variant={(blocks[editingBlockIndex].config as ScaleModuleConfig | ArpeggioModuleConfig).ear_training?.mode === 'sing-back' ? "default" : "outline"}
                                                size="sm"
                                                className="flex-1"
                                                onClick={() => {
                                                    const currentConfig = blocks[editingBlockIndex].config as ScaleModuleConfig | ArpeggioModuleConfig;
                                                    updateBlockConfig(editingBlockIndex, {
                                                        ear_training: {
                                                            ...currentConfig.ear_training,
                                                            enabled: true,
                                                            mode: 'sing-back',
                                                        } as EarTrainingModuleOptions,
                                                    });
                                                }}
                                            >
                                                🎤 Sing-back
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}

                            <Button
                                className="w-full"
                                onClick={() => setEditDialogOpen(false)}
                            >
                                Done
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
