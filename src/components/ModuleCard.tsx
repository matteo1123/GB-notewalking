import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Play, Plus, Info } from 'lucide-react';
import { MODULE_REGISTRY, getDifficultyStars, type ModuleMetadata } from '@/types/modules';
import type { ModuleType } from '@/types/practice';

interface ModuleCardProps {
    moduleType: ModuleType;
    progress?: {
        current_level: number;
        mastery_percentage: number;
        time_practiced_minutes: number;
    };
    onTryNow: () => void;
    onAddToRoutine: () => void;
    onViewDetails: () => void;
}

/**
 * Module Card Component
 * Displays a practice module in the library/storefront view
 */
export function ModuleCard({
    moduleType,
    progress,
    onTryNow,
    onAddToRoutine,
    onViewDetails,
}: ModuleCardProps) {
    const metadata = MODULE_REGISTRY[moduleType];

    return (
        <Card className="overflow-hidden hover:shadow-lg transition-shadow">
            {/* Header with Icon & Title */}
            <div className="p-6 pb-4">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <span className="text-5xl">{metadata.icon}</span>
                        <div>
                            <h3 className="text-xl font-bold">{metadata.name}</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                {metadata.shortDescription}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Difficulty & Time */}
                <div className="flex items-center gap-4 mt-4">
                    <Badge variant="outline" className="text-xs">
                        {getDifficultyStars(metadata.difficulty.max)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                        {metadata.estimatedTime.min}-{metadata.estimatedTime.max} min recommended
                    </span>
                </div>

                {/* Skills Tags */}
                <div className="flex flex-wrap gap-2 mt-3">
                    {metadata.skills.slice(0, 3).map((skill) => (
                        <Badge key={skill} variant="secondary" className="text-xs">
                            {skill.replace('-', ' ')}
                        </Badge>
                    ))}
                </div>
            </div>

            {/* Progress Section (if user has practiced) */}
            {progress && (
                <div className="px-6 py-3 bg-muted/30 border-t border-b">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Your Progress</span>
                        <span className="text-sm font-semibold">
                            {Math.round(progress.mastery_percentage)}%
                        </span>
                    </div>
                    <Progress value={progress.mastery_percentage} className="h-2 mb-2" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        {progress.current_level && metadata.capabilities.hasLevels && (
                            <span>Level {progress.current_level}/{metadata.difficulty.max}</span>
                        )}
                        <span>{progress.time_practiced_minutes} min practiced</span>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="p-4 flex gap-2">
                <Button
                    onClick={onTryNow}
                    className="flex-1 gap-2"
                    size="lg"
                >
                    <Play className="w-4 h-4" />
                    Try Now
                </Button>
                <Button
                    onClick={onAddToRoutine}
                    variant="outline"
                    className="flex-1 gap-2"
                    size="lg"
                >
                    <Plus className="w-4 h-4" />
                    Add to Routine
                </Button>
                <Button
                    onClick={onViewDetails}
                    variant="ghost"
                    size="icon"
                >
                    <Info className="w-4 h-4" />
                </Button>
            </div>

            {/* Capabilities Badges */}
            <div className="px-4 pb-4 flex flex-wrap gap-2">
                {metadata.capabilities.hasAutoRecord && (
                    <Badge variant="outline" className="text-xs">
                        📹 Auto-Record
                    </Badge>
                )}
                {metadata.capabilities.requiresAudio && (
                    <Badge variant="outline" className="text-xs">
                        🎤 Mic Required
                    </Badge>
                )}
                {metadata.capabilities.hasLevels && (
                    <Badge variant="outline" className="text-xs">
                        📊 Progressive Levels
                    </Badge>
                )}
            </div>
        </Card>
    );
}
