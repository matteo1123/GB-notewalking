import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { TrendingDown, TrendingUp, Flame, Target } from 'lucide-react';
import { getUserExercisePerformance, formatSpeed, getSpeedColor, type RankedExercise } from '@/lib/exerciseRanking';

/**
 * Progress Dashboard - Shows ranked exercises
 * Helps users see what needs focus vs what's ready for warmup
 */
export function ProgressDashboard() {
    const { user } = useAuth();
    const [exercises, setExercises] = useState<RankedExercise[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            loadExercises();
        }
    }, [user]);

    const loadExercises = async () => {
        if (!user) return;

        setLoading(true);
        const ranked = await getUserExercisePerformance(user.id);
        setExercises(ranked);
        setLoading(false);
    };

    const focusExercises = exercises.filter(ex => ex.category === 'focus');
    const warmupExercises = exercises.filter(ex => ex.category === 'warmup');

    if (loading) {
        return <div className="p-4">Loading progress...</div>;
    }

    if (exercises.length === 0) {
        return (
            <Card>
                <CardContent className="pt-6 text-center">
                    <Target className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-xl font-bold mb-2">No Practice Data Yet</h3>
                    <p className="text-muted-foreground">
                        Start practicing to see your progress and get personalized recommendations!
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription>Need Focus</CardDescription>
                        <CardTitle className="text-3xl flex items-center gap-2">
                            <TrendingDown className="w-6 h-6 text-red-500" />
                            {focusExercises.length}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            Exercises below target speed
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardDescription>Ready for Warmup</CardDescription>
                        <CardTitle className="text-3xl flex items-center gap-2">
                            <TrendingUp className="w-6 h-6 text-green-500" />
                            {warmupExercises.length}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            Exercises at target speed
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Focus Exercises */}
            {focusExercises.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Target className="w-5 h-5" />
                            Exercises Needing Focus
                        </CardTitle>
                        <CardDescription>
                            Practice these to improve your overall speed
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {focusExercises.slice(0, 10).map((exercise, index) => (
                                <div
                                    key={`${exercise.scale_id}-${exercise.sequence_id}`}
                                    className="flex items-center gap-4 p-3 border rounded-lg"
                                >
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center font-bold text-red-600 dark:text-red-400">
                                        {index + 1}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold truncate">{exercise.scale_name}</div>
                                        <div className="text-sm text-muted-foreground">
                                            {exercise.sequence_name}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <div className="text-sm font-semibold">
                                                {exercise.user_max_bpm} BPM
                                            </div>
                                            <div className={`text-xs ${getSpeedColor(exercise.notes_per_second)}`}>
                                                {formatSpeed(exercise.notes_per_second)}
                                            </div>
                                        </div>

                                        <Badge variant="outline" className="text-xs">
                                            Focus
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Warmup Exercises */}
            {warmupExercises.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Flame className="w-5 h-5 text-orange-500" />
                            Warmup Exercises
                        </CardTitle>
                        <CardDescription>
                            Use these to warm up - you're already fast at these!
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {warmupExercises.slice(0, 5).map((exercise) => (
                                <div
                                    key={`${exercise.scale_id}-${exercise.sequence_id}`}
                                    className="flex items-center gap-4 p-3 border rounded-lg bg-green-50 dark:bg-green-900/10"
                                >
                                    <Flame className="w-5 h-5 text-orange-500 flex-shrink-0" />

                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold truncate">{exercise.scale_name}</div>
                                        <div className="text-sm text-muted-foreground">
                                            {exercise.sequence_name}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                                                {exercise.user_max_bpm} BPM
                                            </div>
                                            <div className={`text-xs ${getSpeedColor(exercise.notes_per_second)}`}>
                                                {formatSpeed(exercise.notes_per_second)}
                                            </div>
                                        </div>

                                        <Badge variant="secondary" className="text-xs bg-green-100 dark:bg-green-900/30">
                                            Warmup
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Speed Distribution */}
            <Card>
                <CardHeader>
                    <CardTitle>Speed Distribution</CardTitle>
                    <CardDescription>
                        Your overall progress across all exercises
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>Slowest</span>
                            <span>Fastest</span>
                        </div>
                        <Progress
                            value={(warmupExercises.length / exercises.length) * 100}
                            className="h-3"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{exercises[0] && formatSpeed(exercises[0].notes_per_second)}</span>
                            <span>{exercises[exercises.length - 1] && formatSpeed(exercises[exercises.length - 1].notes_per_second)}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
