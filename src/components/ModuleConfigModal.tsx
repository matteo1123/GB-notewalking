import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { ScaleModuleConfig, ArpeggioModuleConfig } from '@/types/practice';
import { Loader2 } from 'lucide-react';

interface ModuleConfigModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    moduleType: 'scale' | 'arpeggio';
    existingConfig?: ScaleModuleConfig | ArpeggioModuleConfig;
    onSave: (config: ScaleModuleConfig | ArpeggioModuleConfig) => void;
}

interface ExerciseOption {
    id: string;
    name: string;
    Type: string;
}

/**
 * Modal for configuring a practice module instance.
 * Allows selecting type filters and priority exercises.
 */
export function ModuleConfigModal({
    open,
    onOpenChange,
    moduleType,
    existingConfig,
    onSave,
}: ModuleConfigModalProps) {
    const [loading, setLoading] = useState(true);
    const [exercises, setExercises] = useState<ExerciseOption[]>([]);
    const [typeOptions, setTypeOptions] = useState<string[]>([]);

    // Form state
    const [typeFilter, setTypeFilter] = useState<string>(existingConfig?.type_filter || '');
    const [orderBy, setOrderBy] = useState<'created_at' | 'name'>(existingConfig?.order_by || 'created_at');
    const [priorityIds, setPriorityIds] = useState<string[]>(
        existingConfig?.module_type === 'scale'
            ? (existingConfig as ScaleModuleConfig).priority_scale_ids || []
            : existingConfig?.module_type === 'arpeggio'
                ? (existingConfig as ArpeggioModuleConfig).priority_arpeggio_ids || []
                : []
    );

    // Load available exercises and extract unique Types
    useEffect(() => {
        async function loadExercises() {
            setLoading(true);

            let query = supabase.from('scales').select('id, name, Type');

            // Filter by module type
            if (moduleType === 'arpeggio') {
                query = query.ilike('Type', '%arpeggio%');
            } else {
                query = query.not('Type', 'ilike', '%arpeggio%');
            }

            const { data, error } = await query.order('name');

            if (!error && data) {
                setExercises(data);

                // Extract unique Type values
                const types = [...new Set(data.map(e => e.Type).filter(Boolean))];
                setTypeOptions(types);
            }

            setLoading(false);
        }

        if (open) {
            loadExercises();
        }
    }, [open, moduleType]);

    // Filter exercises by selected type
    const filteredExercises = typeFilter
        ? exercises.filter(e => e.Type === typeFilter)
        : exercises;

    // Toggle priority selection
    const togglePriority = (id: string) => {
        setPriorityIds(prev =>
            prev.includes(id)
                ? prev.filter(p => p !== id)
                : [...prev, id]
        );
    };

    // Move priority item up/down
    const movePriority = (id: string, direction: 'up' | 'down') => {
        const idx = priorityIds.indexOf(id);
        if (idx === -1) return;

        const newArr = [...priorityIds];
        if (direction === 'up' && idx > 0) {
            [newArr[idx - 1], newArr[idx]] = [newArr[idx], newArr[idx - 1]];
        } else if (direction === 'down' && idx < newArr.length - 1) {
            [newArr[idx], newArr[idx + 1]] = [newArr[idx + 1], newArr[idx]];
        }
        setPriorityIds(newArr);
    };

    const handleSave = () => {
        const baseConfig = {
            type_filter: typeFilter || undefined,
            order_by: orderBy,
            current_index: 0,
        };

        if (moduleType === 'scale') {
            const config: ScaleModuleConfig = {
                module_type: 'scale',
                ...baseConfig,
                priority_scale_ids: priorityIds.length > 0 ? priorityIds : undefined,
            };
            onSave(config);
        } else {
            const config: ArpeggioModuleConfig = {
                module_type: 'arpeggio',
                ...baseConfig,
                priority_arpeggio_ids: priorityIds.length > 0 ? priorityIds : undefined,
            };
            onSave(config);
        }

        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>
                        Configure {moduleType === 'scale' ? 'Scale' : 'Arpeggio'} Practice
                    </DialogTitle>
                    <DialogDescription>
                        Set filters and priority order for your practice session.
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="flex-1 overflow-hidden flex flex-col gap-4">
                        {/* Type Filter */}
                        <div className="space-y-2">
                            <Label>Filter by Type</Label>
                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All types" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">All types</SelectItem>
                                    {typeOptions.map(type => (
                                        <SelectItem key={type} value={type}>
                                            {type}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Order By */}
                        <div className="space-y-2">
                            <Label>Fallback Order</Label>
                            <Select value={orderBy} onValueChange={(v) => setOrderBy(v as 'created_at' | 'name')}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="created_at">By Created Date (oldest first)</SelectItem>
                                    <SelectItem value="name">By Name (A-Z)</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                After priority exercises are completed, remaining will follow this order.
                            </p>
                        </div>

                        {/* Priority Exercises */}
                        <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
                            <Label>Priority Exercises (practice these first)</Label>
                            <ScrollArea className="flex-1 border rounded-md p-2">
                                <div className="space-y-1">
                                    {filteredExercises.map(exercise => {
                                        const isSelected = priorityIds.includes(exercise.id);
                                        const priorityIndex = priorityIds.indexOf(exercise.id);

                                        return (
                                            <div
                                                key={exercise.id}
                                                className={`flex items-center gap-2 p-2 rounded hover:bg-muted/50 ${isSelected ? 'bg-primary/10' : ''
                                                    }`}
                                            >
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={() => togglePriority(exercise.id)}
                                                />
                                                <span className="flex-1 text-sm truncate">
                                                    {isSelected && (
                                                        <span className="font-bold text-primary mr-2">
                                                            #{priorityIndex + 1}
                                                        </span>
                                                    )}
                                                    {exercise.name}
                                                </span>
                                                {isSelected && (
                                                    <div className="flex gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6"
                                                            onClick={() => movePriority(exercise.id, 'up')}
                                                            disabled={priorityIndex === 0}
                                                        >
                                                            ↑
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6"
                                                            onClick={() => movePriority(exercise.id, 'down')}
                                                            disabled={priorityIndex === priorityIds.length - 1}
                                                        >
                                                            ↓
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                            <p className="text-xs text-muted-foreground">
                                {priorityIds.length} selected • Check exercises to add to priority list
                            </p>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={loading}>
                        Save Configuration
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
