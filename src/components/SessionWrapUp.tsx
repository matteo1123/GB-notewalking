import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Play, Pause, CheckCircle, Music, Clock, RotateCcw, ChevronRight, TrendingUp } from 'lucide-react';
import type { SessionBlock } from '@/types/practice';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface RecordedAudio {
    id: number;
    audio: string;
    module_type: string;
    duration: number;
    created_at: string;
}

interface SessionWrapUpProps {
    sessionBlocks: SessionBlock[];
    recordings: RecordedAudio[];
    totalDurationMinutes: number;
    startedAt?: string;
    onRestart: () => void;
    onNewSession?: () => void;
}

/**
 * Session Wrap-Up Component
 * 
 * Displays a summary of the completed practice session including:
 * - List of completed blocks
 * - Any audio recordings made during the session
 * - Auto-play functionality for recordings
 */
export function SessionWrapUp({
    sessionBlocks,
    recordings,
    totalDurationMinutes,
    startedAt,
    onRestart,
    onNewSession
}: SessionWrapUpProps) {
    const { user } = useAuth();
    const [currentlyPlaying, setCurrentlyPlaying] = useState<number | null>(null);
    const [autoPlayQueue, setAutoPlayQueue] = useState<number[]>([]);
    const [achievements, setAchievements] = useState<any[]>([]);
    const [loadingStats, setLoadingStats] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Fetch practice logs from this session window
    useEffect(() => {
        const fetchSessionStats = async () => {
            if (!user || !startedAt) return;
            setLoadingStats(true);

            // Fetch practice logs created since the session started
            const { data, error } = await supabase
                .from('practice_log')
                .select('*, scales(name), scale_shapes(name)')
                .eq('user_id', user.id)
                .gte('created_at', startedAt)
                .order('created_at', { ascending: false });

            if (!error && data) {
                // Filter for "achievements" (e.g. max_bpm > 0 or long duration)
                const notable = data.filter(log => (log.max_bpm && log.max_bpm > 0) || (log.duration && log.duration > 60));

                // Deduplicate by module_type / scale_id so we just show the best for each
                const uniqueAchievements = [];
                const seen = new Set();
                for (const log of notable) {
                    const key = `${log.module_type}-${log.scale_id}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        uniqueAchievements.push(log);
                    }
                }
                setAchievements(uniqueAchievements);
            }
            setLoadingStats(false);
        };

        fetchSessionStats();
    }, [user, startedAt]);

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
            default: return '🎯';
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6 space-y-6">
            {/* Hidden audio element for playback */}
            <audio ref={audioRef} />

            {/* Header */}
            <div className="text-center space-y-2">
                <div className="text-6xl">🎉</div>
                <h1 className="text-3xl font-bold">Great Practice!</h1>
                <p className="text-muted-foreground">
                    You completed a {totalDurationMinutes}-minute session
                </p>
            </div>

            {/* Completed Blocks */}
            <Card className="border-2 border-primary/20 bg-card">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        What You Practiced
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {sessionBlocks.map((block, index) => (
                        <div
                            key={block.conceptId || index}
                            className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg hover:bg-muted/60 transition-colors"
                        >
                            <span className="text-2xl">{getModuleEmoji(block.module_type)}</span>
                            <div className="flex-1">
                                <div className="font-semibold capitalize flex items-center gap-2">
                                    {block.module_type.replace('_', ' ')}
                                </div>
                                <div className="text-sm text-muted-foreground line-clamp-1">
                                    {(block.config as any)?.notes || "Focused practice block"}
                                </div>
                            </div>
                            <Badge variant="outline" className="bg-background/50">
                                {block.duration_minutes} min
                            </Badge>
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* Achievements Section */}
            {!loadingStats && achievements.length > 0 && (
                <Card className="border-2 border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-red-500/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-orange-500" />
                            Session Achievements
                        </CardTitle>
                        <CardDescription>
                            Highlights from today's practice
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {achievements.map((log) => (
                            <div
                                key={log.id}
                                className="flex justify-between items-center p-3 rounded-lg bg-background/50 border shadow-sm"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 font-bold">
                                        ⚡
                                    </div>
                                    <div>
                                        <div className="font-semibold">
                                            {log.scales?.name || log.scale_shapes?.name || (log.module_type ? log.module_type.replace('_', ' ') : 'Practice')}
                                        </div>
                                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                                            <Clock className="w-3 h-3" />
                                            {formatDuration(log.duration || 0)} spent
                                        </div>
                                    </div>
                                </div>
                                {log.max_bpm && log.max_bpm > 0 ? (
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-orange-500">{log.max_bpm}</div>
                                        <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Top BPM</div>
                                    </div>
                                ) : null}
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
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button
                    variant="outline"
                    className="flex-1 h-14 text-lg bg-background hover:bg-muted"
                    onClick={onRestart}
                >
                    <RotateCcw className="w-5 h-5 mr-2" />
                    Back to Routines
                </Button>
                {onNewSession && (
                    <Button
                        className="flex-1 h-14 text-lg bg-gradient-to-r from-primary to-primary/80"
                        onClick={onNewSession}
                    >
                        <Play className="w-5 h-5 mr-2" />
                        Start Another Session
                    </Button>
                )}
            </div>
        </div>
    );
}
