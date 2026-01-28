import { useState, useMemo, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Play, Square, Upload, Copy, Check, Info, Star, ChevronRight, Save } from 'lucide-react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { MODULE_REGISTRY } from '@/types/modules';
import type {
    ModuleType,
    ModuleConfig,
    RhythmModuleConfig,
    ScaleModuleConfig,
    ArpeggioModuleConfig,
    NotewalkingModuleConfig,
    ChordProgressionsModuleConfig,
    PieceMasteryModuleConfig,
    MetronomeConfig,
} from '@/types/practice';
import { DEFAULT_METRONOME_CONFIG } from '@/types/practice';
import { ModulePreview } from '@/components/ModulePreview';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { usePracticeSettings } from '@/contexts/PracticeSettingsContext';

const MODULE_TYPES: ModuleType[] = ['rhythm', 'scale', 'arpeggio', 'notewalking', 'chord_progressions', 'piece_mastery'];

// Default config factory - ensures robustness
function getDefaultConfig(moduleType: ModuleType): ModuleConfig {
    const baseConfig = {
        metronome: { ...DEFAULT_METRONOME_CONFIG },
    };

    switch (moduleType) {
        case 'rhythm':
            return {
                ...baseConfig,
                module_type: 'rhythm',
                rhythm_level: 1,
                duration_minutes: 5,
                metronome: { ...baseConfig.metronome, bpm: 60 },
            };
        case 'scale':
            return {
                ...baseConfig,
                module_type: 'scale',
                group_by_shape: true,
                order_by: 'created_at',
            };
        case 'arpeggio':
            return {
                ...baseConfig,
                module_type: 'arpeggio',
                order_by: 'created_at',
                pattern: 'ascending',
            };
        case 'notewalking':
            return {
                ...baseConfig,
                module_type: 'notewalking',
                key: 'C',
                chords: ['I', 'IV', 'V', 'I'],
                measures_per_chord: 4,
            };
        case 'chord_progressions':
            return {
                ...baseConfig,
                module_type: 'chord_progressions',
                progression_id: '',
                key: 'C',
                target_bpm: 80,
            };
        case 'piece_mastery':
            return {
                ...baseConfig,
                module_type: 'piece_mastery',
                piece_id: '',
                segment_seconds: 30,
            };
        default:
            return {
                ...baseConfig,
                module_type: moduleType
            } as ModuleConfig;
    }
}

/**
 * Reusable Metronome Config Editor Component
 */
/**
 * Reusable Collapsible Section Component
 */
function CollapsibleSection({
    title,
    children,
    defaultOpen = false,
    className = ""
}: {
    title: string,
    children: React.ReactNode,
    defaultOpen?: boolean,
    className?: string
}) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className={`space-y-2 ${className}`}
        >
            <div className="flex items-center justify-between space-x-4 px-1">
                <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-start p-0 hover:bg-transparent">
                        <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} />
                        <span className="font-semibold text-sm ml-2">{title}</span>
                    </Button>
                </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="space-y-2 transition-all data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                {children}
            </CollapsibleContent>
        </Collapsible>
    );
}

/**
 * Reusable Metronome Config Editor Component
 */
function MetronomeConfigEditor({
    config,
    onChange
}: {
    config: MetronomeConfig,
    onChange: (updates: Partial<MetronomeConfig>) => void
}) {
    return (
        <div className="space-y-4 border rounded-lg p-3 bg-muted/30">
            {/* Header removed as it is now handled by CollapsibleSection */}

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs">Mode</Label>
                    <Select
                        value={config.mode}
                        onValueChange={(v: any) => onChange({ mode: v })}
                    >
                        <SelectTrigger className="h-8">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="regular">Regular</SelectItem>
                            <SelectItem value="speed-trainer">Speed Trainer</SelectItem>
                            <SelectItem value="progressive">Progressive</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1.5">
                    <Label className="text-xs">Start BPM</Label>
                    <Input
                        type="number"
                        min={40}
                        max={300}
                        className="h-8"
                        value={config.bpm}
                        onChange={(e) => onChange({ bpm: parseInt(e.target.value) || 60 })}
                    />
                </div>

                {config.mode !== 'regular' && (
                    <div className="space-y-1.5">
                        <Label className="text-xs">End BPM</Label>
                        <Input
                            type="number"
                            min={40}
                            max={300}
                            className="h-8"
                            value={config.end_bpm || (config.bpm + 40)}
                            onChange={(e) => onChange({ end_bpm: parseInt(e.target.value) || (config.bpm + 40) })}
                        />
                    </div>
                )}
            </div>

            {config.mode !== 'regular' && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                    <div className="space-y-1.5">
                        <Label className="text-xs">Increments</Label>
                        <Input
                            type="number"
                            min={2}
                            max={100}
                            className="h-8"
                            value={config.increments || 8}
                            onChange={(e) => onChange({ increments: parseInt(e.target.value) || 8 })}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs">Meas. / Inc</Label>
                        <Input
                            type="number"
                            min={1}
                            max={20}
                            className="h-8"
                            value={config.measures_per_increment || 4}
                            onChange={(e) => onChange({ measures_per_increment: parseInt(e.target.value) || 4 })}
                        />
                    </div>

                    {config.mode === 'progressive' && (
                        <div className="space-y-1.5">
                            <Label className="text-xs">Step BPM</Label>
                            <Input
                                type="number"
                                min={1}
                                max={50}
                                className="h-8"
                                value={config.step_bpm || 5}
                                onChange={(e) => onChange({ step_bpm: parseInt(e.target.value) || 5 })}
                            />
                        </div>
                    )}
                </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div className="flex items-center space-x-2">
                    <Switch
                        id="metronome-loop"
                        checked={config.loop ?? false}
                        onCheckedChange={(checked) => onChange({ loop: checked })}
                    />
                    <Label htmlFor="metronome-loop" className="text-xs cursor-pointer">Loop</Label>
                </div>

                <div className="flex items-center space-x-2">
                    <Switch
                        id="metronome-drum"
                        checked={config.drum_beat ?? false}
                        onCheckedChange={(checked) => onChange({ drum_beat: checked })}
                    />
                    <Label htmlFor="metronome-drum" className="text-xs cursor-pointer">Drum Beat</Label>
                </div>
            </div>
        </div>
    );
}

/**
 * JSON Troubleshooter - Admin page for inspecting and testing module configurations
 */
export default function JsonTroubleshooter() {
    const { toast } = useToast();
    const [selectedType, setSelectedType] = useState<ModuleType>('rhythm');
    const [config, setConfig] = useState<ModuleConfig>(getDefaultConfig('rhythm'));
    const [isPlaying, setIsPlaying] = useState(false);
    const [jsonImportMode, setJsonImportMode] = useState(false);
    const [jsonInput, setJsonInput] = useState('');
    const [copied, setCopied] = useState(false);

    // NEW: Local state for available scales (for Scale module selector)
    const [availableScales, setAvailableScales] = useState<{ id: string; name: string; type: string }[]>([]);

    // NEW: Local state for JSON text editing
    const [jsonText, setJsonText] = useState('');
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Simulation State
    const { settings } = usePracticeSettings();
    const [simEndBpm, setSimEndBpm] = useState(60);
    const [simExercisesCompleted, setSimExercisesCompleted] = useState(1);
    const [simIncrement, setSimIncrement] = useState(settings.bpmIncrement);

    // Update simulation default when config changes
    useEffect(() => {
        if (config.metronome?.bpm) {
            setSimEndBpm(config.metronome.bpm);
        }
    }, [config.metronome?.bpm]);

    // Update simIncrement when settings load/change
    useEffect(() => {
        setSimIncrement(settings.bpmIncrement);
    }, [settings.bpmIncrement]);

    // Handle Simulation
    const handleSimulateSession = useCallback(() => {
        const currentMetronome = config.metronome || DEFAULT_METRONOME_CONFIG;
        const currentBpm = simEndBpm || currentMetronome.bpm;

        // 1. Calculate Next Start BPM
        const nextStartBpm = currentBpm + simIncrement;

        // 2. Calculate Next Queue Index
        // Note: For Scale/Arpeggio modules, current_index determines position in queue
        const currentIndex = (config as ScaleModuleConfig).current_index || 0;
        const nextIndex = currentIndex + simExercisesCompleted;

        // Update Config
        setConfig(prev => ({
            ...prev,
            current_index: nextIndex,
            metronome: {
                ...((prev as any).metronome || DEFAULT_METRONOME_CONFIG),
                bpm: nextStartBpm
            }
        }));

        toast({
            title: "Session Simulated",
            description: `Advanced to BPM ${nextStartBpm} and Index ${nextIndex}`,
        });
    }, [config, simEndBpm, simExercisesCompleted, simIncrement, toast]);

    // Fetch scales on mount
    useEffect(() => {
        async function fetchScales() {
            const { data } = await supabase
                .from('scales')
                .select('id, name, Type')
                .order('name');

            if (data) {
                setAvailableScales(data.map(s => ({
                    id: s.id,
                    name: s.name,
                    type: s.Type
                })));
            }
        }
        fetchScales();
    }, []);

    // Sync config to JSON text when config changes (unless user is manually editing)
    useEffect(() => {
        // If the user has unsaved changes, we don't want to overwrite unless the config changed externally?
        // Actually, if the user interacts with the UI form controls, they expect the JSON to update.
        // But if they are typing in JSON, we don't want form controls to overwrite them?
        // Wait, form controls update `config`, which triggers this.
        // If user is typing in JSON, they haven't updated config yet (since we removed auto-update).
        // So this will only fire if:
        // 1. Initial load
        // 2. User interacts with visual form controls
        // 3. User clicks "Apply" -> updates config -> updates this (but new serialization should match)

        if (!hasUnsavedChanges) {
            setJsonText(JSON.stringify(config, null, 2));
            setJsonError(null);
        }
    }, [config, hasUnsavedChanges]);

    // Handle manual JSON edits
    const handleJsonTextChange = (text: string) => {
        setJsonText(text);
        setHasUnsavedChanges(true);
        // Only validate syntax for error display, don't update config
        try {
            JSON.parse(text);
            setJsonError(null);
        } catch (e: any) {
            setJsonError(e.message);
        }
    };

    // Apply JSON changes
    const applyJsonChanges = useCallback(() => {
        try {
            const parsed = JSON.parse(jsonText);
            // safe merge with default of current type to ensure robustness
            const currentType = parsed.module_type || selectedType;
            // Only update config if valid
            if (MODULE_TYPES.includes(currentType)) {
                // We need to signal that this update comes from JSON apply, so we shouldn't mark it as unsaved
                // But actually, once we setConfig, the useEffect will fire.
                // We want the useEffect to update jsonText (reformat) and clear unsaved flag?
                // Or we clear unsaved flag here.

                setConfig(parsed as ModuleConfig);
                if (currentType !== selectedType) {
                    setSelectedType(currentType);
                }
                setJsonError(null);
                setHasUnsavedChanges(false);

                toast({
                    title: "Changes Applied",
                    description: "Configuration updated successfully.",
                });
            } else {
                setJsonError(`Invalid module_type: ${currentType}`);
            }
        } catch (e: any) {
            setJsonError(e.message);
            toast({
                title: "Invalid JSON",
                description: e.message,
                variant: "destructive"
            });
        }
    }, [jsonText, selectedType, toast]);

    // JSON representation of current config
    const configJson = useMemo(() => {
        return JSON.stringify(config, null, 2);
    }, [config]);

    // Handle module type change
    const handleTypeChange = useCallback((newType: ModuleType) => {
        setSelectedType(newType);
        // Reset to default config for this type
        setConfig(getDefaultConfig(newType));
        setIsPlaying(false);
        setHasUnsavedChanges(false);
    }, []);

    // Update a specific config field
    const updateConfig = useCallback((updates: Partial<ModuleConfig>) => {
        setConfig(prev => ({ ...prev, ...updates } as ModuleConfig));
    }, []);

    // Update metronome config
    const updateMetronome = useCallback((updates: Partial<MetronomeConfig>) => {
        setConfig(prev => {
            // Ensure metronome object exists with defaults
            const currentMetronome = (prev as any).metronome || DEFAULT_METRONOME_CONFIG;
            return {
                ...prev,
                metronome: {
                    ...currentMetronome,
                    ...updates
                }
            } as ModuleConfig;
        });
    }, []);

    // Import JSON from textarea using Robust Pattern
    const handleImportJson = useCallback(() => {
        try {
            const parsed = JSON.parse(jsonInput);

            // Basic validation
            if (!parsed.module_type) {
                throw new Error('Missing module_type field');
            }
            if (!MODULE_TYPES.includes(parsed.module_type)) {
                throw new Error(`Invalid module_type: ${parsed.module_type}`);
            }

            // ROBUST HANDLING:
            // 1. Get default config for the target type
            const defaultConfig = getDefaultConfig(parsed.module_type);

            // 2. Merge imported config ON TOP of defaults
            // This ensures missing fields get default values, while extra fields are preserved 
            // (though potentially ignored by UI, they won't crash anything)
            const safeConfig = {
                ...defaultConfig,
                ...parsed,
                // Ensure metronome is also safely merged
                metronome: {
                    ...defaultConfig.metronome,
                    ...(parsed.metronome || {})
                }
            };

            setSelectedType(parsed.module_type);
            setConfig(safeConfig);
            setJsonImportMode(false);
            setJsonInput('');

            toast({
                title: 'JSON Imported Successfully',
                description: `Loaded ${parsed.module_type} configuration with robust validation.`,
            });
        } catch (error: any) {
            toast({
                title: 'Invalid JSON',
                description: error.message,
                variant: 'destructive',
            });
        }
    }, [jsonInput, toast]);

    // Copy JSON to clipboard
    const handleCopyJson = useCallback(async () => {
        await navigator.clipboard.writeText(configJson);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [configJson]);

    // Play/Stop toggle
    const togglePlay = useCallback(() => {
        setIsPlaying(prev => !prev);
    }, []);

    return (
        <div className="h-screen flex flex-col">
            {/* Header */}
            <div className="flex-shrink-0 p-4 border-b bg-card flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">JSON Troubleshooter</h1>
                    <p className="text-sm text-muted-foreground">
                        Inspect, edit, and preview module configurations
                    </p>
                </div>
                <Button
                    size="lg"
                    onClick={togglePlay}
                    variant={isPlaying ? 'destructive' : 'default'}
                    className="gap-2"
                >
                    {isPlaying ? (
                        <>
                            <Square className="w-5 h-5" />
                            Stop
                        </>
                    ) : (
                        <>
                            <Play className="w-5 h-5" />
                            Play Module
                        </>
                    )}
                </Button>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel - Config */}
                <div className="w-[400px] flex-shrink-0 border-r flex flex-col h-full bg-background overflow-hidden">
                    {/* Scrollable Settings Area */}
                    <div className="flex-shrink-0 overflow-y-auto max-h-[70%] p-4 space-y-4">
                        {/* Module Type Selector */}
                        <div className="space-y-2">
                            {/* Keep Header separate or inside? Inside is fine */}
                            <Label>Module Type</Label>
                            <Select value={selectedType} onValueChange={(v) => handleTypeChange(v as ModuleType)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {MODULE_TYPES.map(type => (
                                        <SelectItem key={type} value={type}>
                                            {MODULE_REGISTRY[type]?.icon} {MODULE_REGISTRY[type]?.name || type}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Collapsible Module Configurations */}
                        <CollapsibleSection title="Module Settings" defaultOpen={true}>
                            <Card>
                                <CardContent className="space-y-6 pt-6">
                                    <div className="space-y-4">
                                        {renderConfigForm(selectedType, config, updateConfig, availableScales)}
                                    </div>
                                </CardContent>
                            </Card>
                        </CollapsibleSection>

                        <CollapsibleSection title="Metronome Settings" defaultOpen={false}>
                            <MetronomeConfigEditor
                                config={(config as any).metronome || DEFAULT_METRONOME_CONFIG}
                                onChange={updateMetronome}
                            />
                        </CollapsibleSection>

                        {/* Progression Simulation */}
                        <CollapsibleSection title="Progression Simulation" defaultOpen={false}>
                            <div className="space-y-4 border rounded-lg p-3 bg-muted/30">
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Simulated End BPM</Label>
                                    <Input
                                        type="number"
                                        value={simEndBpm}
                                        onChange={(e) => setSimEndBpm(parseInt(e.target.value) || 0)}
                                    />
                                    <p className="text-[10px] text-muted-foreground">
                                        The BPM reached at the end of the session.
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Exercises Completed</Label>
                                        <Input
                                            type="number"
                                            value={simExercisesCompleted}
                                            onChange={(e) => setSimExercisesCompleted(parseInt(e.target.value) || 1)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Increment (+)</Label>
                                        <Input
                                            type="number"
                                            value={simIncrement}
                                            onChange={(e) => setSimIncrement(parseInt(e.target.value) || 2)}
                                        />
                                    </div>
                                </div>
                                <Button
                                    className="w-full"
                                    variant="secondary"
                                    onClick={handleSimulateSession}
                                >
                                    <ChevronRight className="w-4 h-4 mr-2" />
                                    Simulate Next Session
                                </Button>
                            </div>
                        </CollapsibleSection>
                    </div>

                    {/* Resizable JSON Editor Area */}
                    <div className="flex-grow flex flex-col min-h-0 border-t">
                        <div className="p-3 bg-muted/20 border-b flex items-center justify-between flex-shrink-0">
                            <span className="text-sm font-medium">JSON Configuration</span>
                            <div className="flex gap-1">
                                <Button
                                    variant={hasUnsavedChanges && !jsonError ? "default" : "ghost"}
                                    size="sm"
                                    className="h-6 gap-1 px-2"
                                    onClick={applyJsonChanges}
                                    disabled={!hasUnsavedChanges || !!jsonError}
                                    title="Apply Changes (Ctrl+Enter)"
                                >
                                    <Save className="w-3 h-3" />
                                    {hasUnsavedChanges ? "Apply" : "Synced"}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => {
                                        navigator.clipboard.writeText(jsonText);
                                        setCopied(true);
                                        setTimeout(() => setCopied(false), 2000);
                                    }}
                                    title="Copy JSON"
                                >
                                    {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                </Button>
                            </div>
                        </div>
                        <div className="flex-1 relative min-h-0">
                            <Textarea
                                value={jsonText}
                                onChange={(e) => handleJsonTextChange(e.target.value)}
                                onKeyDown={(e) => {
                                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                        e.preventDefault(); // Prevent newline if that's default behavior (though usually not for Ctrl+Enter)
                                        applyJsonChanges();
                                    }
                                }}
                                placeholder="JSON configuration..."
                                className={`font-mono text-xs h-full w-full resize-none border-0 focus-visible:ring-0 p-4 rounded-none ${jsonError ? 'bg-destructive/5' : ''}`}
                                spellCheck={false}
                            />
                        </div>
                        {jsonError && (
                            <div className="flex-shrink-0 p-2 bg-destructive/10 text-destructive text-xs border-t border-destructive/20">
                                Error: {jsonError}
                            </div>
                        )}
                        <div className="flex-shrink-0 p-2 bg-muted/30 text-[10px] text-muted-foreground border-t flex items-center gap-1.5 justify-end">
                            <Info className="w-3 h-3" />
                            <span>{hasUnsavedChanges ? "Press Ctrl+Enter to apply changes" : "Edits apply immediately defined by standard controls"}</span>
                        </div>
                    </div>
                </div>

                {/* Right Panel - Module Preview */}
                <div className="flex-1 min-w-0 overflow-hidden bg-background">
                    <ModulePreview config={config} isPlaying={isPlaying} onConfigChange={setConfig} />
                </div>
            </div>
        </div>
    );
}

/**
 * Render config form fields based on module type
 * Note: Metronome config is handled separately as it's universal
 */
function renderConfigForm(
    moduleType: ModuleType,
    config: ModuleConfig,
    updateConfig: (updates: Partial<ModuleConfig>) => void,
    availableScales: { id: string; name: string; type: string }[] = []
) {
    switch (moduleType) {
        case 'rhythm':
            const rhythmConfig = config as RhythmModuleConfig;
            return (
                <>
                    <h3 className="font-medium text-sm text-muted-foreground mb-2">Rhythm Settings</h3>
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label>Rhythm Level (1-10)</Label>
                            <Input
                                type="number"
                                min={1}
                                max={10}
                                value={rhythmConfig.rhythm_level || 1}
                                onChange={(e) => updateConfig({ rhythm_level: parseInt(e.target.value) || 1 })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Duration (minutes)</Label>
                            <Input
                                type="number"
                                min={1}
                                max={60}
                                value={rhythmConfig.duration_minutes || 5}
                                onChange={(e) => updateConfig({ duration_minutes: parseInt(e.target.value) || 5 })}
                            />
                        </div>
                    </div>
                </>
            );

        case 'scale':
            const scaleConfig = config as ScaleModuleConfig;
            return (
                <>
                    <h3 className="font-medium text-sm text-muted-foreground mb-2">Scale Settings</h3>
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label>Select Scale</Label>
                            <div className="flex gap-2">
                                <Select
                                    value={scaleConfig.current_scale_id || "none"}
                                    onValueChange={(v) => {
                                        const newVal = v === "none" ? undefined : v;
                                        // Also update priority to star this one if desired? No, separate control.
                                        updateConfig({ current_scale_id: newVal });
                                    }}
                                >
                                    <SelectTrigger className="flex-1">
                                        <SelectValue placeholder="Select a scale..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">-- Default (Random/Queue) --</SelectItem>
                                        {availableScales
                                            .filter(s => !s.type?.toLowerCase().includes('arpeggio')) // Filter out arpeggios
                                            .map(scale => (
                                                <SelectItem key={scale.id} value={scale.id}>
                                                    {scale.name}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>

                                {/* Star/Priority Toggle */}
                                <Button
                                    variant={scaleConfig.priority_scale_ids?.includes(scaleConfig.current_scale_id || '') ? "secondary" : "outline"}
                                    size="icon"
                                    disabled={!scaleConfig.current_scale_id}
                                    title={scaleConfig.priority_scale_ids?.includes(scaleConfig.current_scale_id || '') ? "Remove from Priority" : "Add to Priority"}
                                    onClick={() => {
                                        const currentId = scaleConfig.current_scale_id;
                                        if (!currentId) return;

                                        const currentPriorities = scaleConfig.priority_scale_ids || [];
                                        let newPriorities;

                                        if (currentPriorities.includes(currentId)) {
                                            newPriorities = currentPriorities.filter(id => id !== currentId);
                                        } else {
                                            newPriorities = [...currentPriorities, currentId];
                                        }

                                        updateConfig({ priority_scale_ids: newPriorities });
                                    }}
                                >
                                    <Star
                                        className={`w-4 h-4 ${scaleConfig.priority_scale_ids?.includes(scaleConfig.current_scale_id || '') ? "fill-yellow-400 text-yellow-500" : "text-muted-foreground"}`}
                                    />
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Type Filter</Label>
                            <Input
                                value={scaleConfig.type_filter || ''}
                                onChange={(e) => updateConfig({ type_filter: e.target.value || undefined })}
                                placeholder="e.g., 3 Notes Per String"
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label>Group by Shape</Label>
                            <Switch
                                checked={scaleConfig.group_by_shape ?? true}
                                onCheckedChange={(checked) => updateConfig({ group_by_shape: checked })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Order By</Label>
                            <Select
                                value={scaleConfig.order_by || 'created_at'}
                                onValueChange={(v) => updateConfig({ order_by: v as 'created_at' | 'name' })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="created_at">Created At</SelectItem>
                                    <SelectItem value="name">Name</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center justify-between border-t pt-2 mt-2">
                            <Label>Ear Training</Label>
                            <Switch
                                checked={scaleConfig.ear_training?.enabled ?? false}
                                onCheckedChange={(checked) => updateConfig({
                                    ear_training: {
                                        enabled: checked,
                                        mode: scaleConfig.ear_training?.mode || 'identify',
                                    }
                                })}
                            />
                        </div>
                        {scaleConfig.ear_training?.enabled && (
                            <div className="space-y-1.5 pl-2 border-l-2">
                                <Label>Ear Training Mode</Label>
                                <Select
                                    value={scaleConfig.ear_training?.mode || 'identify'}
                                    onValueChange={(v) => updateConfig({
                                        ear_training: {
                                            ...scaleConfig.ear_training,
                                            enabled: true,
                                            mode: v as 'identify' | 'sing-back',
                                        }
                                    })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="identify">Identify</SelectItem>
                                        <SelectItem value="sing-back">Sing-back</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                </>
            );

        case 'arpeggio':
            const arpeggioConfig = config as ArpeggioModuleConfig;
            return (
                <>
                    <h3 className="font-medium text-sm text-muted-foreground mb-2">Arpeggio Settings</h3>
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label>Arpeggio ID (optional)</Label>
                            <Input
                                value={arpeggioConfig.current_arpeggio_id || ''}
                                onChange={(e) => updateConfig({ current_arpeggio_id: e.target.value || undefined })}
                                placeholder="UUID of specific arpeggio"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Type Filter</Label>
                            <Input
                                value={arpeggioConfig.type_filter || ''}
                                onChange={(e) => updateConfig({ type_filter: e.target.value || undefined })}
                                placeholder="Filter by type"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Pattern</Label>
                            <Select
                                value={arpeggioConfig.pattern || 'ascending'}
                                onValueChange={(v) => updateConfig({ pattern: v as 'ascending' | 'descending' | 'alternating' })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ascending">Ascending</SelectItem>
                                    <SelectItem value="descending">Descending</SelectItem>
                                    <SelectItem value="alternating">Alternating</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center justify-between border-t pt-2 mt-2">
                            <Label>Ear Training</Label>
                            <Switch
                                checked={arpeggioConfig.ear_training?.enabled ?? false}
                                onCheckedChange={(checked) => updateConfig({
                                    ear_training: {
                                        enabled: checked,
                                        mode: arpeggioConfig.ear_training?.mode || 'identify',
                                    }
                                })}
                            />
                        </div>
                    </div>
                </>
            );

        case 'notewalking':
            const notewalkingConfig = config as NotewalkingModuleConfig;
            return (
                <>
                    <h3 className="font-medium text-sm text-muted-foreground mb-2">Notewalking Settings</h3>
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label>Key</Label>
                            <Select
                                value={notewalkingConfig.key || 'C'}
                                onValueChange={(v) => updateConfig({ key: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {['C', 'G', 'D', 'A', 'E', 'B', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'].map(k => (
                                        <SelectItem key={k} value={k}>{k}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Chords (comma-separated)</Label>
                            <Input
                                value={notewalkingConfig.chords?.join(', ') || ''}
                                onChange={(e) => updateConfig({
                                    chords: e.target.value.split(',').map(c => c.trim()).filter(Boolean)
                                })}
                                placeholder="I, IV, V, I"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Measures per Chord</Label>
                            <Input
                                type="number"
                                min={1}
                                max={16}
                                value={notewalkingConfig.measures_per_chord || 4}
                                onChange={(e) => updateConfig({ measures_per_chord: parseInt(e.target.value) || 4 })}
                            />
                        </div>
                    </div>
                </>
            );

        case 'chord_progressions':
            const chordConfig = config as ChordProgressionsModuleConfig;
            return (
                <>
                    <h3 className="font-medium text-sm text-muted-foreground mb-2">Chord Progression Settings</h3>
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label>Progression ID</Label>
                            <Input
                                value={chordConfig.progression_id || ''}
                                onChange={(e) => updateConfig({ progression_id: e.target.value })}
                                placeholder="UUID of progression"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Key</Label>
                            <Select
                                value={chordConfig.key || 'C'}
                                onValueChange={(v) => updateConfig({ key: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {['C', 'G', 'D', 'A', 'E', 'B', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'].map(k => (
                                        <SelectItem key={k} value={k}>{k}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Target BPM</Label>
                            <Input
                                type="number"
                                min={40}
                                max={240}
                                value={chordConfig.target_bpm || 80}
                                onChange={(e) => updateConfig({ target_bpm: parseInt(e.target.value) || 80 })}
                            />
                        </div>
                    </div>
                </>
            );

        case 'piece_mastery':
            const pieceConfig = config as PieceMasteryModuleConfig;
            return (
                <>
                    <h3 className="font-medium text-sm text-muted-foreground mb-2">Piece Mastery Settings</h3>
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label>Piece ID</Label>
                            <Input
                                value={pieceConfig.piece_id || ''}
                                onChange={(e) => updateConfig({ piece_id: e.target.value })}
                                placeholder="UUID of piece"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Segment Duration (seconds)</Label>
                            <Input
                                type="number"
                                min={5}
                                max={120}
                                value={pieceConfig.segment_seconds || 30}
                                onChange={(e) => updateConfig({ segment_seconds: parseInt(e.target.value) || 30 })}
                            />
                        </div>
                    </div>
                </>
            );

        default:
            return (
                <p className="text-sm text-muted-foreground">
                    No configuration options for this module type
                </p>
            );
    }
}
