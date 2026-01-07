import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, GripVertical, Play, Clock } from 'lucide-react';
import { useModuleConfig, SavedModuleInstance } from '@/hooks/useModuleConfig';
import { MODULE_REGISTRY } from '@/types/modules';
import type { SessionBlock, ModuleType, ModuleConfig, ScaleModuleConfig, ArpeggioModuleConfig } from '@/types/practice';
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

interface SessionBuilderProps {
    onStartSession: (blocks: SessionBlock[]) => void;
    onCancel: () => void;
}

/**
 * SessionBuilder - UI for composing practice lessons with configured modules
 * 
 * Features:
 * - Add module blocks from saved configs or default
 * - Set duration per block
 * - Reorder blocks (drag or arrows)
 * - Start lesson to practice all blocks in sequence
 */
export function SessionBuilder({ onStartSession, onCancel }: SessionBuilderProps) {
    const [blocks, setBlocks] = useState<SessionBlock[]>([]);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [selectedModuleType, setSelectedModuleType] = useState<ModuleType | null>(null);
    const [selectedDuration, setSelectedDuration] = useState(5);

    const scaleConfigs = useModuleConfig('scale');
    const arpeggioConfigs = useModuleConfig('arpeggio');

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
                    config = { module_type: 'chord_progressions', progression: ['I', 'IV', 'V', 'I'] } as any;
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

    // Get config display name
    const getConfigName = (block: SessionBlock): string => {
        const config = block.config as any;
        if (config._instance_name) return config._instance_name;
        if (config.type_filter) return config.type_filter;
        return 'Default';
    };

    // Get saved configs for selected module type
    const getSavedConfigs = (): SavedModuleInstance[] => {
        if (selectedModuleType === 'scale') return scaleConfigs.savedInstances;
        if (selectedModuleType === 'arpeggio') return arpeggioConfigs.savedInstances;
        return [];
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex-shrink-0 p-4 border-b flex items-center justify-between bg-card">
                <div>
                    <h2 className="text-xl font-bold">Lesson Builder</h2>
                    <p className="text-sm text-muted-foreground">
                        Compose your practice session with configured modules
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        {totalMinutes} min
                    </div>
                    <Button variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button
                        onClick={() => onStartSession(blocks)}
                        disabled={blocks.length === 0}
                        className="gap-2"
                    >
                        <Play className="w-4 h-4" />
                        Start Lesson
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
                            <Card key={index} className="relative">
                                <CardContent className="p-4 flex items-center gap-4">
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
                                    <div className="flex items-center gap-2">
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
                                {[3, 5, 10, 15].map(min => (
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
        </div>
    );
}
