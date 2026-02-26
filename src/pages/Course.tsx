import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle, PlayCircle, Lock, Loader2, Crown, Info, Target, LineChart, Calendar } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

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
    const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);

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
            <div className="mb-8 flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-primary mb-2">The 90-Day Guitar Challenge</h1>
                    <p className="text-xl text-muted-foreground max-w-2xl">
                        What would happen if for the next 90 days, you focused on all the most important pillars of musicianship in an organized, progressive way?
                    </p>
                </div>

                <Dialog open={isHowItWorksOpen} onOpenChange={setIsHowItWorksOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="gap-2 shrink-0 border-primary/20 hover:bg-primary/5">
                            <Info className="w-4 h-4 text-primary" />
                            How the Challenge Works
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px] bg-slate-900 border-slate-800 text-slate-100">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black text-center text-white mb-4">
                                The 90-Day Guitar Challenge
                            </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-6 py-4">
                            <p className="text-center text-lg text-slate-300">
                                Commit to daily, focused practice across all pillars of musicianship for 90 days. Track your progress in detail and watch your playing transform.
                            </p>

                            <div className="grid gap-6">
                                <div className="flex gap-4">
                                    <div className="mt-1 bg-indigo-500/20 p-2 rounded-full h-fit">
                                        <Target className="w-6 h-6 text-indigo-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-white">The Guided Curriculum</h3>
                                        <p className="text-slate-400">Lifetime access to the video lessons detailing exactly <em className="text-slate-300">how</em> and <em className="text-slate-300">what</em> to practice.</p>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <div className="mt-1 bg-orange-500/20 p-2 rounded-full h-fit">
                                        <LineChart className="w-6 h-6 text-orange-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-white">The Tools & Tracking</h3>
                                        <p className="text-slate-400">90 Days of Guitar Brain Premium included. We track every note you play, every session you log, and push you with tools like the Speed Trainer.</p>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <div className="mt-1 bg-green-500/20 p-2 rounded-full h-fit">
                                        <Calendar className="w-6 h-6 text-green-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-white">The Execution</h3>
                                        <p className="text-slate-400">Show up. Build your custom routines. Let the AI Coach guide your priorities based on real data.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-800 text-center">
                                <Button
                                    onClick={() => {
                                        setIsHowItWorksOpen(false);
                                        handleBuyCourse();
                                    }}
                                    disabled={isBuyingCourse}
                                    className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-lg py-6 px-8 rounded-xl shadow-lg hover:shadow-indigo-500/25 transition-all"
                                >
                                    {isBuyingCourse ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                                    Join the Challenge ($199.99)
                                </Button>
                                <p className="text-xs text-slate-500 mt-4">One-time payment grants lifetime course access and 90 days of Premium.</p>
                                <div className="mt-6 p-4 bg-indigo-950/30 border border-indigo-500/20 rounded-xl text-left">
                                    <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                                        <CheckCircle className="w-5 h-5 text-indigo-400" />
                                        The 90-Day Guarantee
                                    </h4>
                                    <p className="text-sm text-slate-400">
                                        If you do a 15-minute practice every day for 30 days and don't have:
                                    </p>
                                    <ol className="list-decimal list-inside text-sm text-slate-400 mt-2 space-y-1 ml-2">
                                        <li>A better ear</li>
                                        <li>Faster playing</li>
                                        <li>Better ability to play chord tones over chord changes</li>
                                    </ol>
                                    <p className="text-sm text-slate-400 mt-2">
                                        I will give you your money back and you can still keep the service for the full 90 days free of charge.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
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
                            activeVideoData.locked && enrollmentStatus !== 'verified' ? (
                                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-indigo-950 flex flex-col items-center justify-center text-center p-8">
                                    <Lock className="w-16 h-16 text-indigo-400 mb-4 opacity-50" />
                                    <h2 className="text-2xl font-bold mb-2">Challenge Lesson</h2>
                                    <p className="text-muted-foreground mb-6 max-w-md">Join the 90-Day Challenge to unlock all lessons and instantly get <strong>90 Days of Premium</strong> tools to track your progress.</p>

                                    <div className="flex flex-col sm:flex-row gap-4 items-center">
                                        <Button onClick={handleBuyCourse} disabled={isBuyingCourse} variant="default" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                                            {isBuyingCourse ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
                                            Join Challenge ($199.99)
                                        </Button>
                                        <Button variant="link" className="text-indigo-400 hover:text-indigo-300" onClick={() => setIsHowItWorksOpen(true)}>
                                            How does this work?
                                        </Button>
                                    </div>
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
                        <div>
                            <h2 className="text-2xl font-bold">{activeVideoData?.title}</h2>
                            {activeVideoData?.description && (
                                <p className="text-muted-foreground mt-2">{activeVideoData.description}</p>
                            )}
                        </div>
                        {isPremium && (
                            <Button
                                variant={progress.includes(activeVideo || '') ? "outline" : "default"}
                                onClick={() => {
                                    if (activeVideo) {
                                        toggleProgress(activeVideo, progress.includes(activeVideo))
                                    }
                                }}
                                className="gap-2"
                            >
                                {progress.includes(activeVideo || '') ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4" />}
                                {progress.includes(activeVideo || '') ? 'Completed' : 'Mark Complete'}
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
                                const isAvailable = enrollmentStatus === 'verified' || !video.locked;

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
