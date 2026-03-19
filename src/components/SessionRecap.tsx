import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Play, Pause, Music, RotateCcw, ChevronDown, ChevronUp, Calendar, Sparkles } from 'lucide-react';
import type { SessionBlock } from '@/lib/sessionGenerator';

interface RecordedAudio {
    id: number;
    audio: string;
    module_type: string;
    duration: number;
    created_at: string;
    exercise_category?: string | null;
    practice_evaluations?: { ai_feedback: string }[];
}

interface SessionRecapProps {
    onStartNewSession?: () => void;
}

export function SessionRecap({ onStartNewSession }: SessionRecapProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [recordings, setRecordings] = useState<RecordedAudio[]>([]);
    const [sessionDate, setSessionDate] = useState<Date | null>(null);
    const [sessionName, setSessionName] = useState<string | null>(null);
    const [hasSession, setHasSession] = useState(false);
    const [expandedFeedback, setExpandedFeedback] = useState<Set<number>>(new Set());

    const [currentlyPlaying, setCurrentlyPlaying] = useState<number | null>(null);
    const [autoPlayQueue, setAutoPlayQueue] = useState<number[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        if (user) {
            loadLastSession();
        }
    }, [user]);

    useEffect(() => {
        if (audioRef.current) {
            const handleEnded = () => {
                if (autoPlayQueue.length > 0) {
                    const [next, ...rest] = autoPlayQueue;
                    setAutoPlayQueue(rest);
                    playRecording(next);
                } else {
                    setCurrentlyPlaying(null);
                }
            };

            audioRef.current.addEventListener('ended', handleEnded);
            return () => {
                audioRef.current?.removeEventListener('ended', handleEnded);
            };
        }
    }, [autoPlayQueue]);

    const loadLastSession = async () => {
        if (!user) return;

        setLoading(true);

        try {
            const { data: session, error } = await supabase
                .from('practice_sessions')
                .select('*')
                .eq('user_id', user.id)
                .not('ended_at', 'is', null)
                .order('ended_at', { ascending: false })
                .limit(1)
                .single();

            if (error || !session) {
                setHasSession(false);
                setLoading(false);
                return;
            }

            const planData = session.session_plan as any;
            setSessionDate(new Date(session.ended_at));
            setSessionName(planData?.name || null);
            setHasSession(true);

            const { data: recordingsData } = await supabase
                .from('practice_log')
                .select(`
                    id, audio, module_type, duration, created_at, exercise_category,
                    practice_evaluations (
                        ai_feedback
                    )
                `)
                .eq('session_id', session.id)
                .not('audio', 'is', null)
                .order('created_at', { ascending: true });

            if (recordingsData) {
                setRecordings(recordingsData as RecordedAudio[]);
            }

        } catch (err) {
            console.error('Error loading last session:', err);
            setHasSession(false);
        }

        setLoading(false);
    };

    const playRecording = (index: number) => {
        if (currentlyPlaying === index) {
            audioRef.current?.pause();
            setCurrentlyPlaying(null);
            setAutoPlayQueue([]);
            return;
        }

        setCurrentlyPlaying(index);
        const subsequentRecordings = recordings
            .slice(index + 1)
            .map((_, i) => index + 1 + i);
        setAutoPlayQueue(subsequentRecordings);

        if (audioRef.current) {
            audioRef.current.src = recordings[index].audio;
            audioRef.current.play().catch(console.error);
        }
    };

    const toggleFeedback = (id: number) => {
        setExpandedFeedback(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const getModuleEmoji = (moduleType: string) => {
        switch (moduleType) {
            case 'rhythm': return '🥁';
            case 'notewalking': return '🎹';
            case 'scale': return '🎸';
            case 'arpeggio': return '🎵';
            case 'chord_progressions': return '🎶';
            case 'piece_mastery': return '🎼';
            default: return '🎯';
        }
    };

    const getModuleLabel = (moduleType: string) => {
        switch (moduleType) {
            case 'rhythm': return 'Rhythm';
            case 'notewalking': return 'Notewalking';
            case 'scale': return 'Scale';
            case 'arpeggio': return 'Arpeggio';
            case 'chord_progressions': return 'Chord Progressions';
            case 'piece_mastery': return 'Piece Mastery';
            default: return moduleType.replace('_', ' ');
        }
    };

    const formatDate = (date: Date) => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return `Today at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
        } else if (date.toDateString() === yesterday.toDateString()) {
            return `Yesterday at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
        } else {
            return date.toLocaleDateString([], {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            });
        }
    };

    if (loading) {
        return <div className="p-4 text-center text-muted-foreground">Loading recap...</div>;
    }

    if (!hasSession) {
        return (
            <Card>
                <CardContent className="pt-12 pb-8 text-center">
                    <Music className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-xl font-bold mb-2">No Practice Sessions Yet</h3>
                    <p className="text-muted-foreground mb-6">
                        Complete your first practice session to see your recap here!
                    </p>
                    {onStartNewSession && (
                        <Button onClick={onStartNewSession} size="lg">
                            Start Your First Session
                        </Button>
                    )}
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <audio ref={audioRef} />

            {/* Header */}
            <div className="text-center space-y-2">
                <div className="text-6xl">🎉</div>
                <h1 className="text-3xl font-bold">
                    {sessionName || 'Great Practice!'}
                </h1>
                <p className="text-muted-foreground flex items-center justify-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {sessionDate && formatDate(sessionDate)}
                </p>
            </div>

            {/* Practice Recap Table */}
            {recordings.length > 0 ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-primary" />
                            Practice Recap
                        </CardTitle>
                        <CardDescription>
                            Your recordings and AI coach feedback from this session
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y">
                            {recordings.map((recording, index) => {
                                const hasFeedback = !!recording.practice_evaluations?.[0]?.ai_feedback;
                                const isExpanded = expandedFeedback.has(recording.id);
                                const isPlaying = currentlyPlaying === index;

                                return (
                                    <div key={recording.id} className="p-4 space-y-3">
                                        {/* Row: play button + module + exercise */}
                                        <div className="flex items-start gap-3">
                                            <Button
                                                variant={isPlaying ? "default" : "outline"}
                                                size="icon"
                                                className="flex-shrink-0 mt-0.5"
                                                onClick={() => playRecording(index)}
                                            >
                                                {isPlaying
                                                    ? <Pause className="w-4 h-4" />
                                                    : <Play className="w-4 h-4" />
                                                }
                                            </Button>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 font-medium">
                                                    <span>{getModuleEmoji(recording.module_type)}</span>
                                                    <span>{getModuleLabel(recording.module_type)}</span>
                                                    {isPlaying && (
                                                        <Badge variant="secondary" className="animate-pulse text-xs">
                                                            Playing
                                                        </Badge>
                                                    )}
                                                    {autoPlayQueue.includes(index) && (
                                                        <span className="text-xs text-primary">Up next</span>
                                                    )}
                                                </div>
                                                {recording.exercise_category && (
                                                    <div className="text-sm text-muted-foreground mt-0.5">
                                                        {recording.exercise_category}
                                                    </div>
                                                )}
                                            </div>
                                            {hasFeedback && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="flex-shrink-0 text-primary gap-1"
                                                    onClick={() => toggleFeedback(recording.id)}
                                                >
                                                    <Sparkles className="w-3 h-3" />
                                                    AI Coach
                                                    {isExpanded
                                                        ? <ChevronUp className="w-3 h-3" />
                                                        : <ChevronDown className="w-3 h-3" />
                                                    }
                                                </Button>
                                            )}
                                        </div>

                                        {/* AI Feedback (expanded) */}
                                        {hasFeedback && isExpanded && (
                                            <div className="ml-11 p-3 bg-primary/5 rounded-lg border border-primary/20 text-sm">
                                                <p className="whitespace-pre-wrap">
                                                    {recording.practice_evaluations![0].ai_feedback}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card className="border-dashed">
                    <CardContent className="py-8 text-center text-muted-foreground">
                        <Music className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p>No recordings from this session</p>
                        <p className="text-sm">Enable auto-record to capture your practice!</p>
                    </CardContent>
                </Card>
            )}

            {/* Actions */}
            {onStartNewSession && (
                <div className="flex gap-3">
                    <Button className="flex-1" onClick={onStartNewSession}>
                        <Play className="w-4 h-4 mr-2" />
                        New Session
                    </Button>
                </div>
            )}
        </div>
    );
}
