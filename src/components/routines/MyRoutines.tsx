import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Inbox, Star, Copy, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useRoutines } from '@/hooks/useRoutines';
import { RoutineCard } from './RoutineCard';
import { RoutineRow } from './RoutineRow';
import { SessionBuilder } from '../SessionBuilder';
import type { PracticeRoutineSummary, SessionBlock } from '@/types/practice';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface MyRoutinesProps {
    onStartRoutine: (routineId: string) => void;
    onStartSession: (blocks: SessionBlock[], name?: string) => void;
}

export function MyRoutines({ onStartRoutine, onStartSession }: MyRoutinesProps) {
    const {
        routines,
        loading,
        error,
        toggleFavorite,
        duplicateRoutine,
        deleteRoutine,
        refresh,
    } = useRoutines();

    const [creating, setCreating] = useState(false);
    const [editingRoutine, setEditingRoutine] = useState<PracticeRoutineSummary | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<PracticeRoutineSummary | null>(null);

    const favorites = routines.filter(r => r.is_favorite);
    const others = routines.filter(r => !r.is_favorite);

    const handleOpenCreateEditModal = (open: boolean) => {
        if (!open) {
            setCreating(false);
            setEditingRoutine(null);
        }
    };

    const handleDuplicate = async (routine: PracticeRoutineSummary) => {
        await duplicateRoutine(routine.id, `${routine.name} (copy)`);
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        await deleteRoutine(deleteTarget.id);
        setDeleteTarget(null);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12">
                <p className="text-destructive mb-4">{error}</p>
                <Button variant="outline" onClick={refresh}>
                    Try Again
                </Button>
            </div>
        );
    }

    if (creating || editingRoutine) {
        return (
            <div className="h-[80vh]">
                <SessionBuilder
                    initialRoutine={editingRoutine}
                    onStartSession={onStartSession}
                    onCancel={() => handleOpenCreateEditModal(false)}
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold">My Routines</h2>
                    <p className="text-sm text-muted-foreground">
                        Saved practice configurations you can start anytime
                    </p>
                </div>
                <Button onClick={() => setCreating(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    New Routine
                </Button>
            </div>

            {routines.length === 0 ? (
                /* Empty State */
                <div className="text-center py-12 border rounded-lg bg-muted/30">
                    <Inbox className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No routines yet</h3>
                    <p className="text-muted-foreground mb-4 max-w-sm mx-auto">
                        Create your first practice routine or ask the AI Coach to help you build one.
                    </p>
                    <Button onClick={() => setCreating(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Your First Routine
                    </Button>
                </div>
            ) : (
                <>
                    {/* Favorites Section */}
                    {favorites.length > 0 && (
                        <section>
                            <h3 className="text-sm font-medium text-muted-foreground mb-3">
                                Favorites
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {favorites.map(routine => (
                                    <RoutineCard
                                        key={routine.id}
                                        routine={routine}
                                        onStart={() => onStartRoutine(routine.id)}
                                        onToggleFavorite={() => toggleFavorite(routine.id)}
                                        onDuplicate={() => handleDuplicate(routine)}
                                        onDelete={() => setDeleteTarget(routine)}
                                        onEdit={() => setEditingRoutine(routine)}
                                    />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* All Routines Section */}
                    {others.length > 0 && (
                        <section>
                            <h3 className="text-sm font-medium text-muted-foreground mb-3">
                                {favorites.length > 0 ? 'All Routines' : 'Your Routines'}
                            </h3>
                            <div className="space-y-2">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px]"></TableHead>
                                            <TableHead>Routine</TableHead>
                                            <TableHead className="text-right">Duration</TableHead>
                                            <TableHead className="text-right">Practiced</TableHead>
                                            <TableHead className="text-right"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {others.map((routine) => (
                                            <TableRow key={routine.id} className="group">
                                                <TableCell>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => toggleFavorite(routine.id)}
                                                        className={routine.is_favorite ? "text-yellow-500 hover:text-yellow-600" : "text-muted-foreground hover:text-foreground"}
                                                    >
                                                        <Star className={`w-4 h-4 ${routine.is_favorite ? 'fill-current' : ''}`} />
                                                    </Button>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-xl">
                                                            {routine.icon}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="font-medium">{routine.name}</div>
                                                                {routine.created_by_ai && (
                                                                    <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-[10px] font-medium border border-purple-500/20">
                                                                        AI Coach
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-sm text-muted-foreground">
                                                                {routine.module_count} Modules
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {routine.total_duration_minutes}m
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="text-sm">
                                                        <div>{routine.times_practiced}x</div>
                                                        {routine.last_practiced_at && (
                                                            <div className="text-xs text-muted-foreground">
                                                                Last: {formatDistanceToNow(new Date(routine.last_practiced_at), { addSuffix: true })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 uppercase text-xs font-bold"
                                                            onClick={() => setEditingRoutine(routine)}
                                                        >
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => handleDuplicate(routine)}
                                                        >
                                                            <Copy className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => setDeleteTarget(routine)}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </section>
                    )}
                </>
            )}

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Routine?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{deleteTarget?.name}"?
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
