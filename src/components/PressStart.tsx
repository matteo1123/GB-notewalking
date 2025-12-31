import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Play, Clock, Target, Zap, History, Pencil } from 'lucide-react';
import { useToast } from './ui/use-toast';
import { generatePracticeSession, formatSessionSummary, type SessionBlock } from '@/lib/sessionGenerator';
import type { UserPriority } from '@/types/priorities';
import { SessionExecutor, SessionComplete } from './SessionExecutor';

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
    const [priorities, setPriorities] = useState<UserPriority[]>([]);
    const [selectedDuration, setSelectedDuration] = useState(30);
    const [sessionPlan, setSessionPlan] = useState<SessionPlanData | null>(null);
    const [sessionName, setSessionName] = useState('');
    const [recentSessions, setRecentSessions] = useState<SavedSession[]>([]);
    const [isExecuting, setIsExecuting] = useState(false);
    const [sessionComplete, setSessionComplete] = useState(false);
    const [loading, setLoading] = useState(true);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

    const durationOptions = [15, 20, 30, 45, 60];

    useEffect(() => {
        if (user) {
            loadPriorities();
            loadRecentSessions();
        }
    }, [user]);

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

        // Save session to database (store the full planData object including name)
        const { data, error } = await supabase
            .from('practice_sessions' as any)
            .insert([
                {
                    user_id: user.id,
                    session_plan: planToUse,
                    total_duration_seconds: selectedDuration * 60,
                    started_at: new Date().toISOString(),
                },
            ])
            .select()
            .single();

        if (error) {
            toast({
                title: 'Error starting session',
                description: error.message,
                variant: 'destructive',
            });
        } else {
            // Store the session ID for linking practice logs
            setCurrentSessionId((data as any)?.id || null);
            setIsExecuting(true);
            if (!planData) {
                // Reload recent sessions
                loadRecentSessions();
            }
        }
    };

    const handleSessionComplete = async () => {
        setIsExecuting(false);
        setSessionComplete(true);

        toast({
            title: 'Session complete!',
            description: 'Great work! Your progress has been saved.',
        });

        // Reload recent sessions
        await loadRecentSessions();
    };

    const handleRestart = () => {
        setSessionPlan(null);
        setSessionName('');
        setIsExecuting(false);
        setSessionComplete(false);
        setCurrentSessionId(null); // Clear session ID on restart
    };

    const handleUseRecentSession = (session: SavedSession) => {
        // Inherit the full plan data (including name) from the old session
        setSessionPlan(session.planData);
        setSessionName(session.planData.name || '');
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

    // Show session executor
    if (isExecuting && sessionPlan) {
        return (
            <SessionExecutor
                sessionPlan={sessionPlan.blocks}
                sessionId={currentSessionId || undefined}
                onComplete={handleSessionComplete}
                onExit={() => setIsExecuting(false)}
            />
        );
    }

    // Show completion screen
    if (sessionComplete) {
        return <SessionComplete onRestart={handleRestart} />;
    }

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
                <h1 className="text-4xl font-bold mb-2">Ready to Practice?</h1>
                <p className="text-muted-foreground text-lg">
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
                        {/* Duration Buttons */}
                        <div className="grid grid-cols-5 gap-3">
                            {durationOptions.map((minutes) => (
                                <Button
                                    key={minutes}
                                    variant={selectedDuration === minutes ? 'default' : 'outline'}
                                    onClick={() => setSelectedDuration(minutes)}
                                    className="h-20 flex flex-col"
                                >
                                    <span className="text-2xl font-bold">{minutes}</span>
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
