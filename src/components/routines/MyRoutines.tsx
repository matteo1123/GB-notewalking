import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Inbox } from 'lucide-react';
import { useRoutines } from '@/hooks/useRoutines';
import { RoutineCard } from './RoutineCard';
import { RoutineRow } from './RoutineRow';
import { CreateRoutineModal } from './CreateRoutineModal';
import type { PracticeRoutine, PracticeRoutineSummary } from '@/types/practice';
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
}

export function MyRoutines({ onStartRoutine }: MyRoutinesProps) {
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
    const [deleteTarget, setDeleteTarget] = useState<PracticeRoutineSummary | null>(null);

    const favorites = routines.filter(r => r.is_favorite);
    const others = routines.filter(r => !r.is_favorite);

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
                                {others.map(routine => (
                                    <RoutineRow
                                        key={routine.id}
                                        routine={routine}
                                        onStart={() => onStartRoutine(routine.id)}
                                        onToggleFavorite={() => toggleFavorite(routine.id)}
                                        onDuplicate={() => handleDuplicate(routine)}
                                        onDelete={() => setDeleteTarget(routine)}
                                    />
                                ))}
                            </div>
                        </section>
                    )}
                </>
            )}

            {/* Create Modal */}
            <CreateRoutineModal
                open={creating}
                onOpenChange={setCreating}
                onCreated={refresh}
            />

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
