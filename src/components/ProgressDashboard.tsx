import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { TrendingDown, TrendingUp, Flame, Target, Trophy, Clock, Activity } from 'lucide-react';
import { getUserExercisePerformance, formatSpeed, getSpeedColor, type RankedExercise } from '@/lib/exerciseRanking';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProgressStats } from '@/hooks/useProgressStats';
import { BreadthChart } from './progress/BreadthChart';
import { FrequencyChart } from './progress/FrequencyChart';
import ProgressGraphs from './ProgressGraphs';

/**
 * Progress Dashboard - Shows ranked exercises
 * Helps users see what needs focus vs what's ready for warmup
 */
export function ProgressDashboard() {
    const { user } = useAuth();
    const [exercises, setExercises] = useState<RankedExercise[]>([]);
    const [loadingRankings, setLoadingRankings] = useState(true);
    const { dailyMinutes, categoryDistribution, recentAchievements, totalMinutes30Days, loading: loadingStats } = useProgressStats();

    useEffect(() => {
        if (user) {
            loadExercises();
        }
    }, [user]);

    const loadExercises = async () => {
        if (!user) return;

        setLoadingRankings(true);
        const ranked = await getUserExercisePerformance(user.id);
        setExercises(ranked);
        setLoadingRankings(false);
    };

    const focusExercises = exercises.filter(ex => ex.category === 'focus');
    const warmupExercises = exercises.filter(ex => ex.category === 'warmup');

    if (loadingRankings || loadingStats) {
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
        <div className="space-y-6 pb-20">
            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="priorities">Priorities</TabsTrigger>
                    <TabsTrigger value="speed">Speed Track</TabsTrigger>
                </TabsList>

                {/* OVERVIEW TAB */}
                <TabsContent value="overview" className="space-y-6">
                    {/* Top Stats */}
                    <div className="grid grid-cols-2 gap-4">
                        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-primary/80 font-medium">30 Day Practice</CardDescription>
                                <CardTitle className="text-3xl flex items-center gap-2 text-primary">
                                    <Clock className="w-6 h-6" />
                                    {Math.round(totalMinutes30Days / 60)}h {totalMinutes30Days % 60}m
                                </CardTitle>
                            </CardHeader>
                        </Card>

                        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-orange-600 dark:text-orange-400 font-medium">Recent PBs</CardDescription>
                                <CardTitle className="text-3xl flex items-center gap-2 text-orange-600 dark:text-orange-400">
                                    <Trophy className="w-6 h-6" />
                                    {recentAchievements.length}
                                </CardTitle>
                            </CardHeader>
                        </Card>
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <Activity className="w-5 h-5 text-primary" />
                                    Practice Consistency
                                </CardTitle>
                                <CardDescription>Minutes practiced per day</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <FrequencyChart data={dailyMinutes} />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <Target className="w-5 h-5 text-primary" />
                                    Practice Breadth
                                </CardTitle>
                                <CardDescription>Time distribution across subjects</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <BreadthChart data={categoryDistribution} />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Achievements Feed */}
                    {recentAchievements.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Flame className="w-5 h-5 text-orange-500" />
                                    Recent Highlights
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {recentAchievements.map((achievement, idx) => (
                                        <div key={idx} className="flex justify-between items-center p-3 rounded-lg bg-muted/40 hover:bg-muted transition-colors border shadow-sm">
                                            <div>
                                                <div className="font-semibold">{achievement.title}</div>
                                                <div className="text-xs text-muted-foreground capitalize">{achievement.module_type.replace('_', ' ')}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-lg text-orange-500">{achievement.max_bpm}</div>
                                                <div className="text-[10px] uppercase font-semibold text-muted-foreground">Top BPM</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* PRIORITIES TAB */}
                <TabsContent value="priorities" className="space-y-6">
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
                                    <span>{exercises[exercises.length - 1] && formatSpeed(exercises[exercises.length - 1].notes_per_second)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* SPEED TAB */}
                <TabsContent value="speed" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Speed Trajectory</CardTitle>
                            <CardDescription>Track your speed improvements over time</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ProgressGraphs />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
