import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle, PlayCircle, Lock, Loader2, Crown } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useNavigate, useSearchParams } from 'react-router-dom';

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
    const [searchParams] = useSearchParams();

    const [isPremium, setIsPremium] = useState(false);
    const [isBuyingCourse, setIsBuyingCourse] = useState(false);
    const [enrollmentStatus, setEnrollmentStatus] = useState<string | null>(null);
    const [progress, setProgress] = useState<string[]>([]);
    const [videos, setVideos] = useState<CourseVideo[]>([]);
    const [activeVideo, setActiveVideo] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadCourseData = async () => {
            // 1. If user is logged in, pull their premium status, enrollments, and progress
            if (user) {
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
            } else {
                // Guest user resets
                setIsPremium(false);
                setEnrollmentStatus(null);
                setProgress([]);
            }

            // 2. Fetch course videos (public read access via RLS)
            const { data: videoData } = await supabase
                .from('course_videos' as any)
                .select('*')
                .order('order_index', { ascending: true });

            if (videoData && videoData.length > 0) {
                setVideos(videoData);

                // Allow direct linking to a lesson via ?lesson=ID
                const requestedLesson = searchParams.get('lesson');
                if (requestedLesson && videoData.find(v => v.id === requestedLesson)) {
                    setActiveVideo(requestedLesson);
                } else {
                    setActiveVideo(videoData[0].id);
                }
            }

            setLoading(false);
        };
        loadCourseData();
    }, [user, navigate, searchParams]);

    // Format standard YouTube URLs to Embed URLs
    const getEmbedUrl = (url: string) => {
        if (!url) return '';
        try {
            // If already an embed url, return it
            if (url.includes('youtube.com/embed/')) return url;

            let videoId = '';
            if (url.includes('youtube.com/watch?v=')) {
                videoId = new URL(url).searchParams.get('v') || '';
            } else if (url.includes('youtu.be/')) {
                videoId = url.split('youtu.be/')[1].split('?')[0];
            }

            if (videoId) {
                // Check if we should auto-play this specific video from the funnel params
                const shouldAutoplay = searchParams.get('autoplay') === '1' && searchParams.get('lesson') === activeVideo;
                const params = new URLSearchParams({
                    rel: '0', // Hide related videos from other channels
                    modestbranding: '1', // Hide YouTube logo
                    showinfo: '0', // Hide video title (mostly deprecated, but still partially works on some clients)
                    iv_load_policy: '3', // Hide video annotations
                    color: 'white', // Changes progress bar color
                });

                if (shouldAutoplay) params.append('autoplay', '1');

                return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
            }
            return url;
        } catch (e) {
            return url; // fallback to original if parsing fails
        }
    };

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

    const handleBuyCourse = async () => {
        if (!user) {
            toast({
                title: "Account Required",
                description: "Please create a free account to securely link your course purchase.",
            });
            navigate('/auth');
            return;
        }

        try {
            setIsBuyingCourse(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                toast({ title: "Error", description: "Please log in to purchase the course", variant: "destructive" });
                return;
            }

            const { data, error } = await supabase.functions.invoke('create-checkout-session', {
                body: {
                    priceId: "price_1T4bIGEOnRZP4MxPYTo7dKJt", // $1 Test Product
                    mode: 'payment',
                    metadata: { type: 'course_purchase' }
                }
            });

            if (error) throw error;
            if (data?.url) {
                window.location.href = data.url;
            } else {
                throw new Error('No checkout URL returned');
            }
        } catch (err: any) {
            console.error("Purchase error:", err);
            toast({ title: "Checkout Error", description: err.message, variant: "destructive" });
        } finally {
            setIsBuyingCourse(false);
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

            {enrollmentStatus === 'pending_verification' && (
                <div className="bg-orange-500/10 border border-orange-500/50 p-4 rounded-xl mb-8 flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-orange-500">Trial Grace Period Active</h3>
                        <p className="text-sm">We're verifying your course purchase. Enjoy your 14-day free pass in the meantime!</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">

                {/* Main Video Area */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="aspect-video bg-[#0a0a0a] rounded-xl border-border border overflow-hidden relative shadow-2xl">
                        {activeVideoData ? (
                            activeVideoData.locked && !isPremium ? (
                                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-indigo-950 flex flex-col items-center justify-center text-center p-8">
                                    <Lock className="w-16 h-16 text-indigo-400 mb-4 opacity-50" />
                                    <h2 className="text-2xl font-bold mb-2">Premium Lesson</h2>
                                    <p className="text-muted-foreground mb-6 max-w-md">Purchasing the GuitarBrain Mastery course grants lifetime access to all lessons and instantly adds <strong>90 Days of Premium</strong> to your account.</p>
                                    <Button onClick={handleBuyCourse} disabled={isBuyingCourse} variant="default" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                                        {isBuyingCourse ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
                                        Buy Course ($1.00 Test)
                                    </Button>
                                </div>
                            ) : activeVideoData.video_url ? (
                                <iframe
                                    src={getEmbedUrl(activeVideoData.video_url)}
                                    title={activeVideoData.title}
                                    className="w-full h-full border-0 absolute inset-0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                />
                            ) : (
                                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-indigo-950 flex flex-col items-center justify-center text-center p-8">
                                    <PlayCircle className="w-16 h-16 text-indigo-400 mb-4 opacity-50" />
                                    <h2 className="text-2xl font-bold mb-2">Video Unavailable</h2>
                                    <p className="text-muted-foreground text-sm">No video URL has been linked to this lesson yet.</p>
                                </div>
                            )
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                                <PlayCircle className="w-16 h-16 text-muted-foreground mb-4 opacity-20" />
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
                    <Card className="bg-[#0f0f13] border-gray-800">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg">Curriculum</CardTitle>
                            <CardDescription className="text-xs">{completedCount} of {videos.length} lessons completed</CardDescription>
                            <Progress value={progressPercentage} className="mt-3 h-2" />
                        </CardHeader>
                        <CardContent className="space-y-1.5 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                            {videos.length === 0 ? (
                                <p className="text-sm text-muted-foreground italic text-center py-4">No lessons available yet.</p>
                            ) : videos.map((video, idx) => {
                                const isCompleted = progress.includes(video.id);
                                const isPlaying = activeVideo === video.id;
                                const isAvailable = isPremium || !video.locked;

                                return (
                                    <button
                                        key={video.id}
                                        onClick={() => setActiveVideo(video.id)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200
                                            ${isPlaying ? 'bg-primary/10 border border-primary/20 shadow-sm' : 'border border-transparent hover:bg-muted'}
                                            ${!isAvailable && !isPlaying ? 'opacity-70' : ''}
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
