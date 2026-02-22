import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle, PlayCircle, Lock, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';

export interface CourseVideo {
    id: string;
    title: string;
    description: string | null;
    video_url: string;
    duration: string | null;
    order_index: number;
    locked: boolean;
}

export default function Course() {
    const { user } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();

    const [isPremium, setIsPremium] = useState(false);
    const [enrollmentStatus, setEnrollmentStatus] = useState<string | null>(null);
    const [progress, setProgress] = useState<string[]>([]);
    const [videos, setVideos] = useState<CourseVideo[]>([]);
    const [activeVideo, setActiveVideo] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadCourseData = async () => {
            if (!user) {
                navigate('/auth');
                return;
            }

            // Check premium status
            const { data: profile } = await supabase
                .from('profiles')
                .select('premium_until')
                .eq('id', user.id)
                .single();

            const hasPremium = profile?.premium_until && new Date(profile.premium_until) > new Date();
            setIsPremium(!!hasPremium);

            // Check enrollment
            const { data: enrollment } = await supabase
                .from('course_enrollments' as any)
                .select('status')
                .eq('user_id', user.id)
                .maybeSingle();

            if (enrollment) {
                setEnrollmentStatus(enrollment.status);
            }

            // Load progress
            const { data: progressData } = await supabase
                .from('course_progress' as any)
                .select('video_id')
                .eq('user_id', user.id);

            if (progressData) {
                setProgress(progressData.map(p => p.video_id));
            }

            // Fetch course videos
            const { data: videoData } = await supabase
                .from('course_videos' as any)
                .select('*')
                .order('order_index', { ascending: true });

            if (videoData && videoData.length > 0) {
                setVideos(videoData);
                setActiveVideo(videoData[0].id);
            }

            setLoading(false);
        };
        loadCourseData();
    }, [user, navigate]);

    const toggleProgress = async (videoId: string, isCompleted: boolean) => {
        if (!user) return;

        if (isCompleted) {
            // Remove completion
            const { error } = await supabase
                .from('course_progress' as any)
                .delete()
                .eq('user_id', user.id)
                .eq('video_id', videoId);

            if (!error) setProgress(prev => prev.filter(v => v !== videoId));
        } else {
            // Add completion
            const { error } = await supabase
                .from('course_progress' as any)
                .insert({ user_id: user.id, video_id: videoId });

            if (!error) setProgress(prev => [...prev, videoId]);
        }
    };

    if (loading) return (
        <div className="p-8 flex flex-col items-center justify-center min-h-[50vh] text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p>Loading course data...</p>
        </div>
    );

    const completedCount = progress.length;
    const progressPercentage = videos.length > 0 ? Math.round((completedCount / videos.length) * 100) : 0;

    const activeVideoData = videos.find(v => v.id === activeVideo);

    return (
        <div className="container max-w-6xl mx-auto py-8 px-4">
            <div className="mb-8">
                <h1 className="text-4xl font-black text-primary mb-2">Guitar Brain Mastery Course</h1>
                <p className="text-xl text-muted-foreground">Learn how to maximize your progress with Tempo Trekker tools.</p>
            </div>

            {/* Course Enrollment Banner */}
            {enrollmentStatus === 'pending_verification' && (
                <div className="bg-orange-500/10 border border-orange-500/50 p-4 rounded-xl mb-8 flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-orange-500">Trial Grace Period Active</h3>
                        <p className="text-sm">We're verifying your Udemy purchase. Enjoy your 14-day free pass in the meantime!</p>
                    </div>
                </div>
            )}

            {!isPremium && !enrollmentStatus && (
                <div className="bg-destructive/10 border border-destructive bg-secondary p-6 rounded-xl mb-8 text-center">
                    <Lock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="font-bold text-xl mb-2">Premium Content</h3>
                    <p className="mb-4 text-muted-foreground">This course requires premium access or a verified Udemy purchase.</p>
                    <Button onClick={() => navigate('/premium')} variant="default">Upgrade to Premium</Button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Main Video Area */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="aspect-video bg-black rounded-xl border-border border-2 overflow-hidden relative">
                        {activeVideoData?.video_url ? (
                            <iframe
                                src={activeVideoData.video_url}
                                title={activeVideoData.title}
                                className="w-full h-full border-0 absolute inset-0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-indigo-950 flex flex-col items-center justify-center text-center p-8">
                                <PlayCircle className="w-20 h-20 text-indigo-400 mb-4 opacity-50" />
                                <h2 className="text-2xl font-bold mb-2">No Video Selected</h2>
                                <p className="text-muted-foreground">Please select a lesson from the curriculum.</p>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold">{activeVideoData?.title}</h2>
                        {isPremium && (
                            <Button
                                variant={progress.includes(activeVideo) ? "outline" : "default"}
                                onClick={() => toggleProgress(activeVideo, progress.includes(activeVideo))}
                                className="gap-2"
                            >
                                {progress.includes(activeVideo) ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4" />}
                                {progress.includes(activeVideo) ? 'Completed' : 'Mark Complete'}
                            </Button>
                        )}
                    </div>
                </div>

                {/* Sidebar Navigation */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Course Progress</CardTitle>
                            <CardDescription>{completedCount} of {videos.length} lessons completed</CardDescription>
                            <Progress value={progressPercentage} className="mt-2" />
                        </CardHeader>
                        <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
                            {videos.length === 0 ? (
                                <p className="text-sm text-muted-foreground italic text-center py-4">No lessons available yet.</p>
                            ) : videos.map((video, idx) => {
                                const isCompleted = progress.includes(video.id);
                                const isPlaying = activeVideo === video.id;
                                const isAvailable = isPremium || !video.locked;

                                return (
                                    <button
                                        key={video.id}
                                        disabled={!isAvailable}
                                        onClick={() => setActiveVideo(video.id)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors
                                            ${isPlaying ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted'}
                                            ${!isAvailable ? 'opacity-50 cursor-not-allowed' : ''}
                                        `}
                                    >
                                        <div className="flex-shrink-0">
                                            {isCompleted ? (
                                                <CheckCircle className="w-5 h-5 text-green-500" />
                                            ) : isAvailable ? (
                                                <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center">
                                                    <span className="text-[10px] text-muted-foreground font-bold">{idx + 1}</span>
                                                </div>
                                            ) : (
                                                <Lock className="w-5 h-5 text-muted-foreground" />
                                            )}
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <div className={`font-medium truncate ${isPlaying ? 'text-primary' : ''}`}>
                                                {video.title}
                                            </div>
                                            {video.duration && (
                                                <div className="text-xs text-muted-foreground">{video.duration}</div>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
