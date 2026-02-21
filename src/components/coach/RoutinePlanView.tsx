import { Badge } from '@/components/ui/badge';
import { Clock, Layers } from 'lucide-react';
import { getModuleName, getModuleIcon, MODULE_REGISTRY } from '@/types/modules';
import type { ModuleType } from '@/types/practice';
import { cn } from '@/lib/utils';

interface SessionBlockDisplay {
    index: number;
    module_type: string;
    duration_minutes: number;
    config?: any;
}

interface RoutinePlanViewProps {
    routineName: string;
    routineIcon?: string;
    blocks: SessionBlockDisplay[];
    totalDuration?: number;
    /** If provided, highlights blocks that were changed */
    editLog?: string[];
    compact?: boolean;
}

/**
 * Renders a practice routine's session plan inline in chat.
 * Shows each block with module type, icon, duration, and key config details.
 */
export function RoutinePlanView({
    routineName,
    routineIcon = '🎸',
    blocks,
    totalDuration,
    editLog,
    compact = false,
}: RoutinePlanViewProps) {
    const calcTotal = totalDuration || blocks.reduce((acc, b) => acc + (b.duration_minutes || 0), 0);

    const getConfigSummary = (block: SessionBlockDisplay): string | null => {
        const config = block.config;
        if (!config) return null;

        switch (block.module_type) {
            case 'scale':
            case 'arpeggio': {
                const parts: string[] = [];
                if (config.progression_mode && config.progression_mode !== 'cycle') {
                    parts.push(`Mode: ${config.progression_mode}`);
                }
                const shapeCount = config.priority_scale_shape_ids?.length || config.priority_arpeggio_shape_ids?.length || 0;
                if (shapeCount > 0) parts.push(`${shapeCount} shapes`);
                if (config.focus_target_bpm) parts.push(`Target: ${config.focus_target_bpm} BPM`);
                return parts.length > 0 ? parts.join(' · ') : null;
            }
            case 'rhythm':
                return config.rhythm_level ? `Level ${config.rhythm_level}` : null;
            case 'notewalking':
                return config.key ? `Key: ${config.key}` : null;
            case 'chord_progressions':
                return config.key ? `Key: ${config.key}` : null;
            default:
                return null;
        }
    };

    const getBlockIcon = (moduleType: string): string => {
        if (moduleType in MODULE_REGISTRY) {
            return MODULE_REGISTRY[moduleType as ModuleType].emoji;
        }
        return '🎵';
    };

    const getBlockName = (moduleType: string): string => {
        if (moduleType in MODULE_REGISTRY) {
            return MODULE_REGISTRY[moduleType as ModuleType].name;
        }
        return moduleType;
    };

    return (
        <div className="mt-2 rounded-lg border border-border/60 bg-card/50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border/40">
                <span className="text-lg">{routineIcon}</span>
                <span className="font-medium text-sm flex-1 truncate">{routineName}</span>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Layers className="w-3 h-3" />
                    <span>{blocks.length}</span>
                    <span className="mx-1">·</span>
                    <Clock className="w-3 h-3" />
                    <span>{calcTotal} min</span>
                </div>
            </div>

            {/* Blocks */}
            <div className={cn("divide-y divide-border/30", compact ? "max-h-48 overflow-y-auto" : "")}>
                {blocks.map((block, i) => {
                    const configSummary = getConfigSummary(block);
                    return (
                        <div
                            key={i}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/20 transition-colors"
                        >
                            <span className="text-xs text-muted-foreground w-4 text-right flex-shrink-0">
                                {block.index + 1}.
                            </span>
                            <span className="flex-shrink-0">{getBlockIcon(block.module_type)}</span>
                            <span className="flex-1 min-w-0 truncate">
                                {getBlockName(block.module_type)}
                            </span>
                            {configSummary && (
                                <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                                    {configSummary}
                                </span>
                            )}
                            <Badge variant="secondary" className="text-xs px-1.5 py-0 flex-shrink-0">
                                {block.duration_minutes}m
                            </Badge>
                        </div>
                    );
                })}
            </div>

            {/* Edit log (if any) */}
            {editLog && editLog.length > 0 && (
                <div className="px-3 py-2 bg-emerald-500/10 border-t border-emerald-500/20">
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">Changes applied:</p>
                    <ul className="text-xs text-emerald-600/80 dark:text-emerald-400/80 space-y-0.5">
                        {editLog.map((log, i) => (
                            <li key={i}>• {log}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
