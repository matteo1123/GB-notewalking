import { useState, useMemo, useCallback } from 'react';
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
import { Play, Square, Upload, Copy, Check } from 'lucide-react';
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

const MODULE_TYPES: ModuleType[] = ['rhythm', 'scale', 'arpeggio', 'notewalking', 'chord_progressions', 'piece_mastery'];

// Default configs for each module type
function getDefaultConfig(moduleType: ModuleType): ModuleConfig {
    switch (moduleType) {
        case 'rhythm':
            return {
                module_type: 'rhythm',
                rhythm_level: 1,
                duration_minutes: 5,
                metronome: { ...DEFAULT_METRONOME_CONFIG, bpm: 60 },
            };
        case 'scale':
            return {
                module_type: 'scale',
                group_by_shape: true,
                order_by: 'created_at',
            };
        case 'arpeggio':
            return {
                module_type: 'arpeggio',
                order_by: 'created_at',
                pattern: 'ascending',
            };
        case 'notewalking':
            return {
                module_type: 'notewalking',
                key: 'C',
                chords: ['I', 'IV', 'V', 'I'],
                measures_per_chord: 4,
            };
        case 'chord_progressions':
            return {
                module_type: 'chord_progressions',
                progression_id: '',
                key: 'C',
                target_bpm: 80,
            };
        case 'piece_mastery':
            return {
                module_type: 'piece_mastery',
                piece_id: '',
                segment_seconds: 30,
            };
        default:
            return { module_type: moduleType } as ModuleConfig;
    }
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

    // JSON representation of current config
    const configJson = useMemo(() => {
        return JSON.stringify(config, null, 2);
    }, [config]);

    // Handle module type change
    const handleTypeChange = useCallback((newType: ModuleType) => {
        setSelectedType(newType);
        setConfig(getDefaultConfig(newType));
        setIsPlaying(false);
    }, []);

    // Update a specific config field
    const updateConfig = useCallback((updates: Partial<ModuleConfig>) => {
        setConfig(prev => ({ ...prev, ...updates } as ModuleConfig));
    }, []);

    // Update metronome config
    const updateMetronome = useCallback((updates: Partial<MetronomeConfig>) => {
        setConfig(prev => ({
            ...prev,
            metronome: { ...(prev as any).metronome || DEFAULT_METRONOME_CONFIG, ...updates },
        } as ModuleConfig));
    }, []);

    // Import JSON from textarea
    const handleImportJson = useCallback(() => {
        try {
            const parsed = JSON.parse(jsonInput);
            if (!parsed.module_type) {
                throw new Error('Missing module_type field');
            }
            if (!MODULE_TYPES.includes(parsed.module_type)) {
                throw new Error(`Invalid module_type: ${parsed.module_type}`);
            }
            setSelectedType(parsed.module_type);
            setConfig(parsed);
            setJsonImportMode(false);
            setJsonInput('');
            toast({
                title: 'JSON Imported',
                description: `Loaded ${parsed.module_type} configuration`,
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
                <div className="w-[400px] flex-shrink-0 border-r overflow-y-auto p-4 space-y-4">
                    {/* Module Type Selector */}
                    <div className="space-y-2">
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

                    {/* Config Form - Dynamic based on module type */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg">Configuration</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {renderConfigForm(selectedType, config, updateConfig, updateMetronome)}
                        </CardContent>
                    </Card>

                    {/* JSON View / Import */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center justify-between">
                                JSON
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleCopyJson}
                                    >
                                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    </Button>
                                    <Button
                                        variant={jsonImportMode ? 'secondary' : 'ghost'}
                                        size="sm"
                                        onClick={() => setJsonImportMode(!jsonImportMode)}
                                    >
                                        <Upload className="w-4 h-4" />
                                    </Button>
                                </div>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {jsonImportMode ? (
                                <div className="space-y-3">
                                    <Textarea
                                        value={jsonInput}
                                        onChange={(e) => setJsonInput(e.target.value)}
                                        placeholder="Paste JSON configuration here..."
                                        className="font-mono text-xs h-48"
                                    />
                                    <Button onClick={handleImportJson} className="w-full">
                                        Load JSON
                                    </Button>
                                </div>
                            ) : (
                                <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto max-h-64 overflow-y-auto font-mono">
                                    {configJson}
                                </pre>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Panel - Module Preview */}
                <div className="flex-1 min-w-0 overflow-hidden bg-background">
                    <ModulePreview config={config} isPlaying={isPlaying} />
                </div>
            </div>
        </div>
    );
}

/**
 * Render config form fields based on module type
 */
function renderConfigForm(
    moduleType: ModuleType,
    config: ModuleConfig,
    updateConfig: (updates: Partial<ModuleConfig>) => void,
    updateMetronome: (updates: Partial<MetronomeConfig>) => void
) {
    switch (moduleType) {
        case 'rhythm':
            const rhythmConfig = config as RhythmModuleConfig;
            return (
                <>
                    <div className="space-y-2">
                        <Label>Rhythm Level (1-10)</Label>
                        <Input
                            type="number"
                            min={1}
                            max={10}
                            value={rhythmConfig.rhythm_level || 1}
                            onChange={(e) => updateConfig({ rhythm_level: parseInt(e.target.value) || 1 })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Duration (minutes)</Label>
                        <Input
                            type="number"
                            min={1}
                            max={60}
                            value={rhythmConfig.duration_minutes || 5}
                            onChange={(e) => updateConfig({ duration_minutes: parseInt(e.target.value) || 5 })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>BPM</Label>
                        <Input
                            type="number"
                            min={40}
                            max={240}
                            value={rhythmConfig.metronome?.bpm || 60}
                            onChange={(e) => updateMetronome({ bpm: parseInt(e.target.value) || 60 })}
                        />
                    </div>
                </>
            );

        case 'scale':
            const scaleConfig = config as ScaleModuleConfig;
            return (
                <>
                    <div className="space-y-2">
                        <Label>Scale ID (optional)</Label>
                        <Input
                            value={scaleConfig.current_scale_id || ''}
                            onChange={(e) => updateConfig({ current_scale_id: e.target.value || undefined })}
                            placeholder="UUID of specific scale"
                        />
                    </div>
                    <div className="space-y-2">
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
                    <div className="space-y-2">
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
                    <div className="flex items-center justify-between">
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
                        <div className="space-y-2">
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
                </>
            );

        case 'arpeggio':
            const arpeggioConfig = config as ArpeggioModuleConfig;
            return (
                <>
                    <div className="space-y-2">
                        <Label>Arpeggio ID (optional)</Label>
                        <Input
                            value={arpeggioConfig.current_arpeggio_id || ''}
                            onChange={(e) => updateConfig({ current_arpeggio_id: e.target.value || undefined })}
                            placeholder="UUID of specific arpeggio"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Type Filter</Label>
                        <Input
                            value={arpeggioConfig.type_filter || ''}
                            onChange={(e) => updateConfig({ type_filter: e.target.value || undefined })}
                            placeholder="Filter by type"
                        />
                    </div>
                    <div className="space-y-2">
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
                    <div className="flex items-center justify-between">
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
                </>
            );

        case 'notewalking':
            const notewalkingConfig = config as NotewalkingModuleConfig;
            return (
                <>
                    <div className="space-y-2">
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
                    <div className="space-y-2">
                        <Label>Chords (comma-separated)</Label>
                        <Input
                            value={notewalkingConfig.chords?.join(', ') || ''}
                            onChange={(e) => updateConfig({
                                chords: e.target.value.split(',').map(c => c.trim()).filter(Boolean)
                            })}
                            placeholder="I, IV, V, I"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Measures per Chord</Label>
                        <Input
                            type="number"
                            min={1}
                            max={16}
                            value={notewalkingConfig.measures_per_chord || 4}
                            onChange={(e) => updateConfig({ measures_per_chord: parseInt(e.target.value) || 4 })}
                        />
                    </div>
                </>
            );

        case 'chord_progressions':
            const chordConfig = config as ChordProgressionsModuleConfig;
            return (
                <>
                    <div className="space-y-2">
                        <Label>Progression ID</Label>
                        <Input
                            value={chordConfig.progression_id || ''}
                            onChange={(e) => updateConfig({ progression_id: e.target.value })}
                            placeholder="UUID of progression"
                        />
                    </div>
                    <div className="space-y-2">
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
                    <div className="space-y-2">
                        <Label>Target BPM</Label>
                        <Input
                            type="number"
                            min={40}
                            max={240}
                            value={chordConfig.target_bpm || 80}
                            onChange={(e) => updateConfig({ target_bpm: parseInt(e.target.value) || 80 })}
                        />
                    </div>
                </>
            );

        case 'piece_mastery':
            const pieceConfig = config as PieceMasteryModuleConfig;
            return (
                <>
                    <div className="space-y-2">
                        <Label>Piece ID</Label>
                        <Input
                            value={pieceConfig.piece_id || ''}
                            onChange={(e) => updateConfig({ piece_id: e.target.value })}
                            placeholder="UUID of piece"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Segment Duration (seconds)</Label>
                        <Input
                            type="number"
                            min={5}
                            max={120}
                            value={pieceConfig.segment_seconds || 30}
                            onChange={(e) => updateConfig({ segment_seconds: parseInt(e.target.value) || 30 })}
                        />
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
