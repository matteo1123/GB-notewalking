import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, Play, Clock, MoreVertical, Sparkles, Trash2, Copy, Edit } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { PracticeRoutineSummary } from '@/types/practice';

interface RoutineRowProps {
    routine: PracticeRoutineSummary;
    onStart: () => void;
    onEdit?: () => void;
    onDuplicate?: () => void;
    onDelete?: () => void;
    onToggleFavorite?: () => void;
}

export function RoutineRow({
    routine,
    onStart,
    onEdit,
    onDuplicate,
    onDelete,
    onToggleFavorite,
}: RoutineRowProps) {
    const formatLastPracticed = (date?: string) => {
        if (!date) return 'Never practiced';
        const d = new Date(date);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
        return d.toLocaleDateString();
    };

    return (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
            {/* Icon */}
            <div className="text-2xl flex-shrink-0">{routine.icon}</div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{routine.name}</span>
                    {routine.created_by_ai && (
                        <Sparkles className="w-3 h-3 text-purple-500 flex-shrink-0" />
                    )}
                    {routine.is_favorite && (
                        <Heart className="w-3 h-3 fill-red-500 text-red-500 flex-shrink-0" />
                    )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {routine.total_duration_minutes || '?'}m
                    </span>
                    <span>{routine.module_count} modules</span>
                    <span>{formatLastPracticed(routine.last_practiced_at)}</span>
                    {routine.times_practiced > 0 && (
                        <Badge variant="outline" className="text-xs py-0">
                            {routine.times_practiced}x
                        </Badge>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
                <Button size="sm" onClick={onStart}>
                    <Play className="w-4 h-4 mr-1" />
                    Start
                </Button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {onToggleFavorite && (
                            <DropdownMenuItem onClick={onToggleFavorite}>
                                <Heart className={`w-4 h-4 mr-2 ${routine.is_favorite ? 'fill-red-500 text-red-500' : ''}`} />
                                {routine.is_favorite ? 'Unfavorite' : 'Favorite'}
                            </DropdownMenuItem>
                        )}
                        {onEdit && (
                            <DropdownMenuItem onClick={onEdit}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                            </DropdownMenuItem>
                        )}
                        {onDuplicate && (
                            <DropdownMenuItem onClick={onDuplicate}>
                                <Copy className="w-4 h-4 mr-2" />
                                Duplicate
                            </DropdownMenuItem>
                        )}
                        {onDelete && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={onDelete}
                                    className="text-destructive"
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
