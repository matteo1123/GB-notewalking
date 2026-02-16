import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, Play, Clock, MoreVertical, Sparkles } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { PracticeRoutineSummary } from '@/types/practice';

interface RoutineCardProps {
    routine: PracticeRoutineSummary;
    onStart: () => void;
    onEdit?: () => void;
    onDuplicate?: () => void;
    onDelete?: () => void;
    onToggleFavorite?: () => void;
}

export function RoutineCard({
    routine,
    onStart,
    onEdit,
    onDuplicate,
    onDelete,
    onToggleFavorite,
}: RoutineCardProps) {
    const formatLastPracticed = (date?: string) => {
        if (!date) return 'Never';
        const d = new Date(date);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        return d.toLocaleDateString();
    };

    return (
        <Card className="group hover:shadow-md transition-shadow">
            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="text-2xl flex-shrink-0">{routine.icon}</div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h3 className="font-semibold truncate">{routine.name}</h3>
                                {routine.created_by_ai && (
                                    <Sparkles className="w-3 h-3 text-purple-500 flex-shrink-0" />
                                )}
                            </div>
                            {routine.description && (
                                <p className="text-sm text-muted-foreground truncate">
                                    {routine.description}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                        {onToggleFavorite && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleFavorite();
                                }}
                            >
                                <Heart
                                    className={`w-4 h-4 ${routine.is_favorite ? 'fill-red-500 text-red-500' : ''}`}
                                />
                            </Button>
                        )}

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="w-4 h-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {onEdit && (
                                    <DropdownMenuItem onClick={onEdit}>
                                        Edit
                                    </DropdownMenuItem>
                                )}
                                {onDuplicate && (
                                    <DropdownMenuItem onClick={onDuplicate}>
                                        Duplicate
                                    </DropdownMenuItem>
                                )}
                                {onDelete && (
                                    <DropdownMenuItem
                                        onClick={onDelete}
                                        className="text-destructive"
                                    >
                                        Delete
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {routine.total_duration_minutes || '?'} min
                    </div>
                    <Badge variant="secondary" className="text-xs">
                        {routine.module_count} module{routine.module_count !== 1 ? 's' : ''}
                    </Badge>
                    <span className="text-xs">
                        {formatLastPracticed(routine.last_practiced_at)}
                    </span>
                </div>

                <Button
                    className="w-full mt-4"
                    onClick={onStart}
                >
                    <Play className="w-4 h-4 mr-2" />
                    Start Practice
                </Button>
            </CardContent>
        </Card>
    );
}
