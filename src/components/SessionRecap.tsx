import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Play, Pause, CheckCircle, Music, Clock, RotateCcw, ChevronRight, Calendar } from 'lucide-react';
import type { SessionBlock } from '@/lib/sessionGenerator';

interface RecordedAudio {
    id: number;
    audio: string;
    module_type: string;
    duration: number;
    created_at: string;
}

interface SessionRecapProps {
    onStartNewSession?: () => void;
}

/**
 * Session Recap Component
 * 
 * Displays a summary of the most recent completed practice session including:
 * - List of completed blocks
 * - Any audio recordings made during the session
 * - Auto-play functionality for recordings
 * 
 * This persists between sessions - users can always see their last practice recap
 */
export function SessionRecap({ onStartNewSession }: SessionRecapProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [sessionBlocks, setSessionBlocks] = useState<SessionBlock[]>([]);
    const [recordings, setRecordings] = useState<RecordedAudio[]>([]);
    const [totalDurationMinutes, setTotalDurationMinutes] = useState(0);
    const [sessionDate, setSessionDate] = useState<Date | null>(null);
    const [sessionName, setSessionName] = useState<string | null>(null);
    const [hasSession, setHasSession] = useState(false);

    const [currentlyPlaying, setCurrentlyPlaying] = useState<number | null>(null);
    const [autoPlayQueue, setAutoPlayQueue] = useState<number[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Load most recent completed session on mount
    useEffect(() => {
        if (user) {
            loadLastSession();
        }
    }, [user]);

    // Handle audio end - play next in queue
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
            // Get the most recent completed or ended session
            const { data: session, error } = await supabase
                .from('practice_sessions' as any)
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

            // Parse session data
            const planData = session.session_plan;
            const blocks: SessionBlock[] = Array.isArray(planData)
                ? planData
                : planData?.blocks || [];

            setSessionBlocks(blocks);
            setTotalDurationMinutes(Math.round((session.total_duration_seconds || 0) / 60));
            setSessionDate(new Date(session.ended_at));
            setSessionName(planData?.name || null);
            setHasSession(true);

            // Fetch recordings from this session
            const { data: recordingsData } = await supabase
                .from('practice_logs' as any)
                .select('id, audio, module_type, duration, created_at')
                .eq('session_id', session.id)
                .not('audio', 'is', null);

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
            // Pause current
            audioRef.current?.pause();
            setCurrentlyPlaying(null);
            setAutoPlayQueue([]);
            return;
        }

        // Play this recording and queue the rest
        setCurrentlyPlaying(index);

        // Build queue of subsequent recordings
        const subsequentRecordings = recordings
            .slice(index + 1)
            .map((_, i) => index + 1 + i);
        setAutoPlayQueue(subsequentRecordings);

        // Create and play audio
        if (audioRef.current) {
            audioRef.current.src = recordings[index].audio;
            audioRef.current.play().catch(console.error);
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
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
            {/* Hidden audio element for playback */}
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
                    {totalDurationMinutes > 0 && (
                        <>
                            <span className="mx-1">•</span>
                            <Clock className="w-4 h-4" />
                            {totalDurationMinutes} minutes
                        </>
                    )}
                </p>
            </div>

            {/* Completed Blocks */}
            {sessionBlocks.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-500" />
                            What You Practiced
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {sessionBlocks.map((block, index) => (
                            <div
                                key={block.id || index}
                                className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                            >
                                <span className="text-2xl">{getModuleEmoji(block.module_type)}</span>
                                <div className="flex-1">
                                    <div className="font-medium capitalize">
                                        {block.title || block.module_type.replace('_', ' ')}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {block.duration_minutes} minutes
                                    </div>
                                </div>
                                <Badge variant="secondary">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Done
                                </Badge>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Recordings */}
            {recordings.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Music className="w-5 h-5 text-primary" />
                            Your Recordings
                        </CardTitle>
                        <CardDescription>
                            Click play to hear your practice • Auto-plays remaining recordings
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {recordings.map((recording, index) => (
                            <div
                                key={recording.id}
                                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${currentlyPlaying === index
                                    ? 'border-primary bg-primary/5'
                                    : 'hover:bg-muted/50'
                                    }`}
                            >
                                <Button
                                    variant={currentlyPlaying === index ? "default" : "outline"}
                                    size="icon"
                                    className="flex-shrink-0"
                                    onClick={() => playRecording(index)}
                                >
                                    {currentlyPlaying === index
                                        ? <Pause className="w-4 h-4" />
                                        : <Play className="w-4 h-4" />
                                    }
                                </Button>
                                <div className="flex-1">
                                    <div className="font-medium capitalize flex items-center gap-2">
                                        {getModuleEmoji(recording.module_type)}
                                        {recording.module_type.replace('_', ' ')}
                                        {currentlyPlaying === index && (
                                            <Badge variant="secondary" className="animate-pulse">
                                                Playing...
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                                        <Clock className="w-3 h-3" />
                                        {formatDuration(recording.duration)}
                                        {autoPlayQueue.includes(index) && (
                                            <span className="text-primary">• Up next</span>
                                        )}
                                    </div>
                                </div>
                                {index < recordings.length - 1 && autoPlayQueue.length === 0 && currentlyPlaying !== index && (
                                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                )}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* No recordings message */}
            {recordings.length === 0 && (
                <Card className="border-dashed">
                    <CardContent className="py-8 text-center text-muted-foreground">
                        <Music className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p>No recordings from this session</p>
                        <p className="text-sm">
                            Enable auto-record to capture your practice!
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Actions */}
            {onStartNewSession && (
                <div className="flex gap-3">
                    <Button
                        className="flex-1"
                        onClick={onStartNewSession}
                    >
                        <Play className="w-4 h-4 mr-2" />
                        New Session
                    </Button>
                </div>
            )}
        </div>
    );
}
