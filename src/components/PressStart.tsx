import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Play, Clock, Target, Zap, History, Pencil } from 'lucide-react';
import { useToast } from './ui/use-toast';
import { generatePracticeSession, type SessionBlock } from '@/lib/sessionGenerator';
import type { UserPriority } from '@/types/priorities';
import { useSession } from '@/contexts/SessionContext';

// Interface for recordings fetched after session
interface SessionRecording {
    id: number;
    audio: string;
    module_type: string;
    duration: number;
    created_at: string;
}

// Session plan structure with optional name
interface SessionPlanData {
    name?: string;
    blocks: SessionBlock[];
}

interface SavedSession {
    id: string;
    name: string;
    duration: number;
    planData: SessionPlanData; // Full plan data including name
    last_used: string;
}

/**
 * Press Start - Daily Practice Launcher
 * The zero-friction entry point to practice
 */
export function PressStart() {
    const { user } = useAuth();
    const { toast } = useToast();
    const { startSession } = useSession(); // Use context

    const [priorities, setPriorities] = useState<UserPriority[]>([]);
    const [selectedDuration, setSelectedDuration] = useState(30);
    const [sessionPlan, setSessionPlan] = useState<SessionPlanData | null>(null);
    const [sessionName, setSessionName] = useState('');
    const [recentSessions, setRecentSessions] = useState<SavedSession[]>([]);

    // We strictly use context for execution state now. 
    // If context.isActive is true, Premium.tsx handles the view switch.
    // So PressStart only needs to worry about generating and calling startSession.

    const [loading, setLoading] = useState(true);

    const [warmupCandidates, setWarmupCandidates] = useState<{ id: string; name: string; type: 'scale' | 'arpeggio' }[]>([]);

    const durationOptions = [15, 20, 30, 45, 60];

    useEffect(() => {
        if (user) {
            loadPriorities();
            loadRecentSessions();
            loadWarmupSuggestions();
        }
    }, [user]);

    const loadWarmupSuggestions = async () => {
        if (!user) return;

        // Strategy 1: Last 2 practiced scales
        const { data: recentLogs } = await supabase
            .from('practice_log' as any)
            .select(`
                scale_id,
                created_at,
                scales!inner (
                    id,
                    name,
                    Type
                )
            `)
            .eq('user_id', user.id)
            .not('scale_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(20); // Fetch more to deduplicate

        const uniqueScales = new Map();
        if (recentLogs) {
            recentLogs.forEach((log: any) => {
                const scale = log.scales;
                if (scale && !uniqueScales.has(scale.id)) {
                    uniqueScales.set(scale.id, {
                        id: scale.id,
                        name: scale.name,
                        type: scale.Type === 'arpeggio' ? 'arpeggio' : 'scale'
                    });
                }
            });
        }

        let candidates = Array.from(uniqueScales.values()).slice(0, 2);

        // Strategy 2: If < 2 found, get oldest by scale_shape
        if (candidates.length < 2) {
            const { data: oldestScales } = await supabase
                .from('scales')
                .select(`
                    id,
                    name,
                    Type,
                    scale_shapes!inner (
                        created_at
                    )
                `)
                .order('created_at', { foreignTable: 'scale_shapes', ascending: true })
                .limit(20); // Fetch a batch to find ones we don't have

            if (oldestScales) {
                for (const scale of oldestScales) {
                    if (candidates.length >= 2) break;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    if (!candidates.find(c => c.id === scale.id)) {
                        candidates.push({
                            id: scale.id,
                            name: scale.name,
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            type: (scale as any).Type === 'arpeggio' ? 'arpeggio' : 'scale'
                        });
                    }
                }
            }
        }

        setWarmupCandidates(candidates as any);
    };

    const loadPriorities = async () => {
        if (!user) return;

        setLoading(true);
        const { data, error } = await supabase
            .from('user_priorities' as any)
            .select('*')
            .eq('user_id', user.id)
            .order('weight', { ascending: false });

        if (error) {
            toast({
                title: 'Error loading priorities',
                description: error.message,
                variant: 'destructive',
            });
        } else {
            setPriorities(data as any as UserPriority[]);
        }
        setLoading(false);
    };

    const loadRecentSessions = async () => {
        if (!user) return;

        const { data, error } = await supabase
            .from('practice_sessions' as any)
            .select('*')
            .eq('user_id', user.id)
            .not('started_at', 'is', null)
            .order('started_at', { ascending: false })
            .limit(3);

        if (!error && data) {
            const sessions: SavedSession[] = data.map((s: any) => {
                // Handle both old format (array) and new format (object with name)
                const planData: SessionPlanData = Array.isArray(s.session_plan)
                    ? { blocks: s.session_plan }
                    : s.session_plan;

                return {
                    id: s.id,
                    name: planData.name || `${s.total_duration_seconds / 60} min practice`,
                    duration: s.total_duration_seconds / 60,
                    planData,
                    last_used: s.started_at
                };
            });
            setRecentSessions(sessions);
        }
    };

    const handleGenerateSession = () => {
        if (!user || priorities.length === 0) {
            toast({
                title: 'No priorities set',
                description: 'Add at least one priority to generate a practice session.',
                variant: 'destructive',
            });
            return;
        }

        try {
            const blocks = generatePracticeSession({
                userId: user.id,
                priorities,
                durationMinutes: selectedDuration,
                warmupExercises: warmupCandidates,
            });

            // Create session plan with name
            setSessionPlan({
                name: sessionName.trim() || undefined,
                blocks,
            });

            toast({
                title: 'Session generated!',
                description: `Your ${selectedDuration}-minute practice plan is ready.`,
            });
        } catch (error) {
            toast({
                title: 'Error generating session',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'destructive',
            });
        }
    };

    const handleStartSession = async (planData?: SessionPlanData) => {
        const planToUse = planData || sessionPlan;
        if (!planToUse || !user) return;

        // Use global context to start session
        // Pass the calculated duration and the generated blocks
        await startSession(selectedDuration, undefined, planToUse.blocks);

        // Context update will trigger Premium.tsx to change view
    };

    const handleUseRecentSession = (session: SavedSession) => {
        // Inherit the full plan data (including name) from the old session
        setSessionPlan(session.planData);
        setSessionName(session.planData.name || '');
        // Start immediately
        handleStartSession(session.planData);
    };

    const handleRenameSession = async (sessionId: string, newName: string) => {
        // Find the session in our local state
        const session = recentSessions.find(s => s.id === sessionId);
        if (!session) return;

        // Update the session_plan JSON with the new name
        const updatedPlanData: SessionPlanData = {
            ...session.planData,
            name: newName || undefined,
        };

        const { error } = await supabase
            .from('practice_sessions' as any)
            .update({ session_plan: updatedPlanData })
            .eq('id', sessionId);

        if (error) {
            toast({
                title: 'Error renaming session',
                description: error.message,
                variant: 'destructive',
            });
        } else {
            // Update local state
            setRecentSessions(prev =>
                prev.map(s =>
                    s.id === sessionId
                        ? { ...s, name: newName || `${s.duration} min practice`, planData: updatedPlanData }
                        : s
                )
            );
            toast({
                title: 'Session renamed',
                description: `Session renamed to "${newName || 'Unnamed'}"`,
            });
        }
    };

    if (loading) {
        return <div className="p-4">Loading...</div>;
    }

    if (priorities.length === 0) {
        return (
            <Card>
                <CardContent className="pt-6 text-center">
                    <Target className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-xl font-bold mb-2">No Priorities Set</h3>
                    <p className="text-muted-foreground mb-4">
                        Set your practice priorities first to generate personalized sessions.
                    </p>
                    <Button onClick={() => window.location.href = '/premium?tab=priorities'}>
                        Set Priorities
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <h1 className="text-2xl sm:text-4xl font-bold mb-1 sm:mb-2">Ready to Practice?</h1>
                <p className="text-muted-foreground text-sm sm:text-lg">
                    Your personalized session is one click away
                </p>
            </div>

            {/* Recent Sessions */}
            {recentSessions.length > 0 && !sessionPlan && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <History className="w-5 h-5" />
                            Recent Practices
                        </CardTitle>
                        <CardDescription>
                            Quick start with a session you've used before
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {recentSessions.map((session) => (
                            <div
                                key={session.id}
                                className="flex items-center gap-2 w-full border rounded-lg p-3 hover:bg-accent/50 transition-colors"
                            >
                                {/* Edit button */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="flex-shrink-0 h-8 w-8"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const newName = prompt('Enter session name:', session.name);
                                        if (newName !== null && newName.trim() !== session.name) {
                                            handleRenameSession(session.id, newName.trim());
                                        }
                                    }}
                                >
                                    <Pencil className="w-4 h-4" />
                                </Button>

                                {/* Session info + play button */}
                                <Button
                                    variant="ghost"
                                    className="flex-1 justify-between text-left h-auto py-1 px-2"
                                    onClick={() => handleUseRecentSession(session)}
                                >
                                    <div>
                                        <div className="font-semibold">{session.name}</div>
                                        <div className="text-sm text-muted-foreground">
                                            {session.planData.blocks.length} exercises •{' '}
                                            Last used {new Date(session.last_used).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <Play className="w-5 h-5 flex-shrink-0" />
                                </Button>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Time Selection */}
            {!sessionPlan && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="w-5 h-5" />
                            How much time do you have?
                        </CardTitle>
                        <CardDescription>
                            We'll create a perfect practice plan for your available time
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Duration Buttons - wrap on mobile */}
                        <div className="flex flex-wrap gap-2 sm:gap-3 justify-center">
                            {durationOptions.map((minutes) => (
                                <Button
                                    key={minutes}
                                    variant={selectedDuration === minutes ? 'default' : 'outline'}
                                    onClick={() => setSelectedDuration(minutes)}
                                    className="h-14 sm:h-20 min-w-[60px] sm:min-w-[80px] flex flex-col"
                                >
                                    <span className="text-lg sm:text-2xl font-bold">{minutes}</span>
                                    <span className="text-xs">min</span>
                                </Button>
                            ))}
                        </div>

                        {/* Custom Duration */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Or custom:</span>
                            <input
                                type="number"
                                min={10}
                                max={120}
                                value={selectedDuration}
                                onChange={(e) => setSelectedDuration(parseInt(e.target.value) || 30)}
                                className="w-20 px-3 py-2 border rounded"
                            />
                            <span className="text-sm">minutes</span>
                        </div>

                        {/* Priority Preview */}
                        <div className="space-y-2">
                            <h4 className="text-sm font-semibold">Your Priorities:</h4>
                            <div className="flex flex-wrap gap-2">
                                {priorities.map((p) => {
                                    const totalWeight = priorities.reduce((sum, pr) => sum + pr.weight, 0);
                                    const percentage = Math.round((p.weight / totalWeight) * 100);
                                    return (
                                        <Badge key={p.id} variant="secondary">
                                            {p.module_type} • {percentage}%
                                        </Badge>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Session Name Input */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Pencil className="w-4 h-4 text-muted-foreground" />
                                <label htmlFor="session-name" className="text-sm font-medium">
                                    Session Name (optional)
                                </label>
                            </div>
                            <Input
                                id="session-name"
                                placeholder="e.g., Morning Singing Practice, Guitar Warmup..."
                                value={sessionName}
                                onChange={(e) => setSessionName(e.target.value)}
                                className="w-full"
                            />
                            <p className="text-xs text-muted-foreground">
                                Give your session a name to easily find it later
                            </p>
                        </div>

                        {/* Generate Button */}
                        <Button
                            onClick={handleGenerateSession}
                            size="lg"
                            className="w-full text-lg h-14"
                        >
                            <Zap className="w-5 h-5 mr-2" />
                            Generate My Practice Plan
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Session Plan Preview */}
            {sessionPlan && (
                <Card className="border-2 border-primary">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-2xl">
                            <Target className="w-6 h-6" />
                            {sessionPlan.name || `Your ${selectedDuration}-Minute Practice Plan`}
                        </CardTitle>
                        <CardDescription>
                            {sessionPlan.name
                                ? `${selectedDuration} minute session • Optimized for your priorities`
                                : 'Optimized for your priorities and goals'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Session Blocks */}
                        <div className="space-y-3">
                            {sessionPlan.blocks.map((block, index) => (
                                <div
                                    key={block.id}
                                    className="flex items-center gap-4 p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                                >
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                                        {index + 1}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-semibold">{block.title}</div>
                                        <div className="text-sm text-muted-foreground">
                                            {block.description}
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="text-lg font-semibold">
                                        {block.duration_minutes} min
                                    </Badge>
                                </div>
                            ))}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-4">
                            <Button
                                onClick={() => handleStartSession()}
                                size="lg"
                                className="flex-1 text-lg h-14 bg-gradient-to-r from-primary to-primary/80"
                            >
                                <Play className="w-5 h-5 mr-2" />
                                Start Practice Session
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setSessionPlan(null)}
                                className="px-6"
                            >
                                Regenerate
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
