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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { useRoutines } from '@/hooks/useRoutines';
import type { SessionBlock, ModuleType, ProgressionMode, PracticeRoutineSummary } from '@/types/practice';

interface CreateRoutineModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated?: () => void;
    routineToEdit?: PracticeRoutineSummary | null;
}

const ICONS = ['🎸', '🎵', '🎶', '🔥', '⚡', '🎯', '💪', '🌟', '🚀', '🎹'];

const MODULE_OPTIONS: { value: ModuleType; label: string }[] = [
    { value: 'scale', label: 'Scale Practice' },
    { value: 'arpeggio', label: 'Arpeggio Practice' },
    { value: 'rhythm', label: 'Rhythm Training' },
    { value: 'chord_progressions', label: 'Chord Progressions' },
    { value: 'notewalking', label: 'Note Walking' },
];

interface ModuleBlock {
    id: string;
    module_type: ModuleType;
    duration_minutes: number;
    progression_mode?: ProgressionMode;
    focus_target_bpm?: number;
    original_config?: any;
}

const PROGRESSION_OPTIONS: { value: ProgressionMode; label: string; description: string }[] = [
    { value: 'cycle', label: 'Cycle', description: 'Loop through all exercises' },
    { value: 'sequential', label: 'Sequential', description: 'Complete in order, stop at end' },
    { value: 'focus', label: 'Focus', description: 'Auto-switch to lowest BPM exercise' },
];

export function CreateRoutineModal({
    open,
    onOpenChange,
    onCreated,
    routineToEdit,
}: CreateRoutineModalProps) {
    const { createRoutine, updateRoutine, getRoutine } = useRoutines();

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [icon, setIcon] = useState('🎸');
    const [modules, setModules] = useState<ModuleBlock[]>([
        { id: crypto.randomUUID(), module_type: 'scale', duration_minutes: 5 },
    ]);
    const [saving, setSaving] = useState(false);

    // Load routine data if editing
    useEffect(() => {
        if (open) {
            if (routineToEdit) {
                getRoutine(routineToEdit.id).then(fullRoutine => {
                    if (fullRoutine) {
                        setName(fullRoutine.name);
                        setDescription(fullRoutine.description || '');
                        setIcon(fullRoutine.icon || '🎸');

                        if (fullRoutine.session_plan) {
                            setModules(fullRoutine.session_plan.map(block => ({
                                id: crypto.randomUUID(),
                                module_type: block.module_type,
                                duration_minutes: block.duration_minutes || 5,
                                progression_mode: (block.config as any)?.progression_mode as ProgressionMode,
                                focus_target_bpm: (block.config as any)?.focus_target_bpm,
                                original_config: block.config
                            })));
                        }
                    }
                });
            } else {
                setName('');
                setDescription('');
                setIcon('🎸');
                setModules([{ id: crypto.randomUUID(), module_type: 'scale', duration_minutes: 5 }]);
            }
        }
    }, [open, routineToEdit, getRoutine]);

    const addModule = () => {
        setModules(prev => [
            ...prev,
            { id: crypto.randomUUID(), module_type: 'scale', duration_minutes: 5 },
        ]);
    };

    const removeModule = (id: string) => {
        setModules(prev => prev.filter(m => m.id !== id));
    };

    const updateModule = (id: string, updates: Partial<ModuleBlock>) => {
        setModules(prev => prev.map(m =>
            m.id === id ? { ...m, ...updates } : m
        ));
    };

    const totalDuration = modules.reduce((acc, m) => acc + m.duration_minutes, 0);

    const handleSave = async () => {
        if (!name.trim() || modules.length === 0) return;

        setSaving(true);
        try {
            const session_plan: SessionBlock[] = modules.map((m, i) => ({
                module_type: m.module_type,
                config: {
                    ...m.original_config,
                    module_type: m.module_type,
                    ...(m.progression_mode && { progression_mode: m.progression_mode }),
                    ...(m.progression_mode === 'focus' && m.focus_target_bpm && { focus_target_bpm: m.focus_target_bpm }),
                },
                duration_minutes: m.duration_minutes,
                order: i,
            }));

            if (routineToEdit) {
                await updateRoutine(routineToEdit.id, {
                    name: name.trim(),
                    description: description.trim() || undefined,
                    icon,
                    session_plan,
                });
            } else {
                await createRoutine({
                    name: name.trim(),
                    description: description.trim() || undefined,
                    icon,
                    session_plan,
                });
            }

            onOpenChange(false);
            onCreated?.();
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{routineToEdit ? 'Edit Practice Routine' : 'Create Practice Routine'}</DialogTitle>
                    <DialogDescription>
                        {routineToEdit ? 'Modify your practice routine configuration.' : 'Build a reusable practice routine with multiple modules.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-4 py-2">
                    {/* Name & Icon */}
                    <div className="flex gap-3">
                        <div className="flex-shrink-0">
                            <Label className="text-xs text-muted-foreground">Icon</Label>
                            <Select value={icon} onValueChange={setIcon}>
                                <SelectTrigger className="w-16 h-10 text-xl">
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
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g., C# Minor Mastery"
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <Label htmlFor="description">Description (optional)</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="What is this routine for?"
                            rows={2}
                        />
                    </div>

                    {/* Modules */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <Label>Modules ({totalDuration} min total)</Label>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={addModule}
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                Add Module
                            </Button>
                        </div>

                        <div className="space-y-2">
                            {modules.map((module, index) => (
                                <div
                                    key={module.id}
                                    className="p-2 rounded-lg border bg-muted/30 space-y-2"
                                >
                                    <div className="flex items-center gap-2">
                                        <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />

                                        <span className="text-sm text-muted-foreground w-6">
                                            {index + 1}.
                                        </span>

                                        <Select
                                            value={module.module_type}
                                            onValueChange={(v) => updateModule(module.id, { module_type: v as ModuleType })}
                                        >
                                            <SelectTrigger className="flex-1">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {MODULE_OPTIONS.map(opt => (
                                                    <SelectItem key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        <div className="flex items-center gap-1">
                                            <Input
                                                type="number"
                                                min={1}
                                                max={60}
                                                value={module.duration_minutes}
                                                onChange={e => updateModule(module.id, {
                                                    duration_minutes: parseInt(e.target.value) || 5
                                                })}
                                                className="w-16 text-center"
                                            />
                                            <span className="text-sm text-muted-foreground">min</span>
                                        </div>

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 flex-shrink-0"
                                            onClick={() => removeModule(module.id)}
                                            disabled={modules.length === 1}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>

                                    {/* Progression mode for scale/arpeggio modules */}
                                    {(module.module_type === 'scale' || module.module_type === 'arpeggio') && (
                                        <div className="flex items-center gap-2 pl-8">
                                            <span className="text-xs text-muted-foreground">Progression:</span>
                                            <Select
                                                value={module.progression_mode || 'cycle'}
                                                onValueChange={(v) => updateModule(module.id, { progression_mode: v as ProgressionMode })}
                                            >
                                                <SelectTrigger className="w-32 h-7 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {PROGRESSION_OPTIONS.map(opt => (
                                                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                                            {opt.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {module.progression_mode === 'focus' && (
                                                <div className="flex items-center gap-1">
                                                    <span className="text-xs text-muted-foreground">Target:</span>
                                                    <Input
                                                        type="number"
                                                        min={40}
                                                        max={200}
                                                        value={module.focus_target_bpm || 90}
                                                        onChange={e => updateModule(module.id, {
                                                            focus_target_bpm: parseInt(e.target.value) || 90
                                                        })}
                                                        className="w-16 h-7 text-xs text-center"
                                                    />
                                                    <span className="text-xs text-muted-foreground">BPM</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={!name.trim() || modules.length === 0 || saving}
                    >
                        {saving ? 'Saving...' : (routineToEdit ? 'Save Changes' : 'Create Routine')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
