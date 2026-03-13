import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle, PlayCircle, Lock, Loader2, Crown, Info, Target, LineChart, Calendar, MessageCircleQuestion, Send } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';
import { useGamification } from '@/hooks/useGamification';

// Updated Stripe Price ID ($29.99/mo)
const STRIPE_PRICE_ID = "price_1T3lcJEOnRZP4MxPepztrhp6";
// Course Purchase Price ID ($199.99)
const STRIPE_COURSE_PRICE_ID = "price_1T5sGBEOnRZP4MxPZp5xxScj";

export interface CourseVideo {
    id: string;
    title: string;
    description: string | null;
    video_url: string;
    duration: string | null;
    order_index: number;
    locked: boolean;
    unlock_cost: number;
    grid_row: number;
    grid_column: number;
    prerequisite_ids: string[];
    category: string | null;
}

export interface RewardVideo {
    id: string;
    title: string;
    description: string | null;
    url: string;
    unlock_cost: number;
    prerequisite_level: number;
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
    const [rewardVideos, setRewardVideos] = useState<RewardVideo[]>([]);
    const [unlockedRewardVideoIds, setUnlockedRewardVideoIds] = useState<string[]>([]);
    const [unlockedCourseVideoIds, setUnlockedCourseVideoIds] = useState<string[]>([]);
    const [activeVideo, setActiveVideo] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
    
    // Categories for the Skill Tree
    const categories = ['Rhythm', 'Chord Tones', 'Fretboard Mastery', 'Ear', 'Technique'];
    const [selectedCategory, setSelectedCategory] = useState('Rhythm');

    // Gamification Hook
    const { points, level, refresh: refreshGamification } = useGamification();
    const [isUnlocking, setIsUnlocking] = useState(false);

    // Question submission state
    const [questionText, setQuestionText] = useState('');
    const [isSubmittingQuestion, setIsSubmittingQuestion] = useState(false);

    // Email capture state (for logged out users)
    const [emailInput, setEmailInput] = useState('');
    const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);
    const [isEmailSubmitted, setIsEmailSubmitted] = useState(false);

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
                    .from('course_enrollments')
                    .select('status')
                    .eq('user_id', user.id)
                    .maybeSingle() as { data: { status: string } | null, error: unknown };

                if (enrollment) {
                    setEnrollmentStatus(enrollment.status);
                }

                // Load progress
                const { data: progressData } = await supabase
                    .from('course_progress')
                    .select('video_id')
                    .eq('user_id', user.id) as { data: { video_id: string }[] | null, error: unknown };

                if (progressData) {
                    setProgress(progressData.map(p => p.video_id));
                }

                // Load unlocked reward videos
                const { data: unlockedData } = await (supabase
                    .from('user_videos' as any)
                    .select('video_id')
                    .eq('user_id', user.id) as any);

                if (unlockedData) {
                    setUnlockedRewardVideoIds(unlockedData.map(uv => uv.video_id));
                }

                // Load unlocked course videos
                const { data: courseUnlockData } = await (supabase
                    .from('user_course_unlocks' as any)
                    .select('video_id')
                    .eq('user_id', user.id) as any);
                
                if (courseUnlockData) {
                    setUnlockedCourseVideoIds(courseUnlockData.map(uv => uv.video_id));
                }
            } else {
                // Guest user resets
                setIsPremium(false);
                setEnrollmentStatus(null);
                setProgress([]);
                setUnlockedRewardVideoIds([]);
                setUnlockedCourseVideoIds([]);
            }

            // 2. Fetch course videos (public read access via RLS)
            const { data: videoData } = await supabase
                .from('course_videos')
                .select('*')
                .order('order_index', { ascending: true }) as { data: CourseVideo[] | null, error: unknown };

            if (videoData && videoData.length > 0) {
                setVideos(videoData);
            }

            // 3. Fetch gamification reward videos
            const { data: rewardData } = await (supabase
                .from('videos' as any)
                .select('*')
                .order('created_at', { ascending: true }) as any);

            if (rewardData) {
                setRewardVideos(rewardData);
            }

            // Determine which video to show first
            if (videoData && videoData.length > 0) {
                // Allow direct linking to a lesson via ?lesson=ID
                const requestedLesson = searchParams.get('lesson');
                if (requestedLesson) {
                    // Check if it's a standard lesson or a reward video
                    if (videoData.find(v => v.id === requestedLesson) || rewardData?.find(r => r.id === requestedLesson)) {
                        setActiveVideo(requestedLesson);
                    }
                } else {
                    const firstChordToneVideo = videoData.find(v => v.title.toLowerCase().includes('hit your first chord tone'));
                    const firstVideo = firstChordToneVideo || videoData[0];
                    setActiveVideo(firstVideo.id);
                    
                    // Set category based on initial video
                    if (firstVideo.category) {
                        setSelectedCategory(firstVideo.category);
                    }
                }
            }

            setLoading(false);
        };
        loadCourseData();
    }, [user, navigate, searchParams]);

    // Format standard YouTube URLs or Bunny Stream URLs to Embed URLs
    const getEmbedUrl = (url: string) => {
        if (!url) return '';
        try {
            const shouldAutoplay = searchParams.get('autoplay') === '1' || !searchParams.has('lesson');

            // Handle Bunny Stream URLs
            if (url.includes('player.mediadelivery.net/embed/') || url.includes('iframe.mediadelivery.net/embed/')) {
                const bunnyUrl = new URL(url);
                if (shouldAutoplay) {
                    bunnyUrl.searchParams.set('autoplay', 'true');
                    bunnyUrl.searchParams.set('muted', 'true'); // Required by modern browsers for autoplay
                }
                return bunnyUrl.toString();
            }

            // Handle existing YouTube embeds
            if (url.includes('youtube.com/embed/')) {
                const ytUrl = new URL(url);
                if (shouldAutoplay && !ytUrl.searchParams.has('autoplay')) {
                    ytUrl.searchParams.set('autoplay', '1');
                    ytUrl.searchParams.set('mute', '1'); // Required by modern browsers for autoplay
                }
                return ytUrl.toString();
            }

            let videoId = '';
            if (url.includes('youtube.com/watch?v=')) {
                videoId = new URL(url).searchParams.get('v') || '';
            } else if (url.includes('youtu.be/')) {
                videoId = url.split('youtu.be/')[1].split('?')[0];
            }

            if (videoId) {
                // Check if we should auto-play this specific video from the funnel params
                const params = new URLSearchParams({
                    rel: '0', // Hide related videos from other channels
                    modestbranding: '1', // Hide YouTube logo
                    showinfo: '0', // Hide video title (mostly deprecated, but still partially works on some clients)
                    iv_load_policy: '3', // Hide video annotations
                    color: 'white', // Changes progress bar color
                });

                if (shouldAutoplay) {
                    params.append('autoplay', '1');
                    params.append('mute', '1'); // Required by modern browsers for autoplay
                }

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
                .from('course_progress')
                .delete()
                .match({ user_id: user.id, video_id: videoId });

            if (!error) setProgress(prev => prev.filter(v => v !== videoId));
        } else {
            // Add completion
            const { error } = await supabase
                .from('course_progress')
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
                    priceId: "price_1T5sGBEOnRZP4MxPZp5xxScj", // $199.99 Product
                    subscriptionPriceId: "price_1T3lcJEOnRZP4MxPepztrhp6", // $29.99/mo premium subscription
                    mode: 'subscription',
                    metadata: { type: 'course_purchase' }
                }
            });

            if (error) throw error;
            if (data?.url) {
                window.location.href = data.url;
            } else {
                throw new Error('No checkout URL returned');
            }
        } catch (err) {
            console.error("Checkout error:", err);
            if (typeof err === 'object' && err !== null && 'context' in err) {
                const typedErr = err as { context: { json: () => Promise<{ error?: string }> } };
                if (typeof typedErr.context.json === 'function') {
                    const body = await typedErr.context.json().catch(() => ({} as { error?: string }));
                    console.error("Purchase error body:", body);
                    toast({ title: "Checkout Error", description: body.error || (err as Error).message, variant: "destructive" });
                    return;
                }
            }
            toast({ title: "Checkout Error", description: (err as Error).message, variant: "destructive" });
        } finally {
            setIsBuyingCourse(false);
        }
    };

    const handleSubmitQuestion = async () => {
        if (!user || !questionText.trim() || !currentVideoTitle) return;

        setIsSubmittingQuestion(true);
        try {
            const { error: questionError } = await (supabase
                .from('suggestions' as any)
                .insert([{
                    content: questionText,
                    user_id: user?.id,
                    source: 'course_video_question'
                }]) as any);

            if (questionError) throw questionError;

            toast({
                title: "Question Submitted",
                description: "Thanks for the question! I'll review it and get back to you.",
            });
            setQuestionText('');
        } catch (err) {
            console.error("Error submitting question:", err);
            toast({
                title: "Error submitting question",
                description: "Please try again later or contact support.",
                variant: "destructive",
            });
        } finally {
            setIsSubmittingQuestion(false);
        }
    };

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!emailInput.trim() || !emailInput.includes('@')) return;

        setIsSubmittingEmail(true);
        try {
            const { error } = await supabase.from('email_subscribers').insert([
                { email: emailInput, source: 'course_promo' }
            ]);

            if (error) {
                if (error.code === '23505') { // Unique violation
                    toast({
                        title: "Already Subscribed",
                        description: "You're already on the list! Check your inbox for the PDF.",
                    });
                    setIsEmailSubmitted(true);
                    setEmailInput('');
                    return;
                }
                throw error;
            }

            setIsEmailSubmitted(true);
            toast({
                title: "Success! PDF Sent.",
                description: "Check your inbox for the Hitting Chord Tones PDF in the next few minutes.",
            });
            setEmailInput('');
            toast({
                title: "Wait a second",
                description: "We couldn't process your email right now. Try again?",
                variant: "destructive",
            });
        } finally {
            setIsSubmittingEmail(false);
        }
    };

    const handleUnlockVideo = async (videoId: string, cost: number) => {
        if (!user) return;

        if (points < cost) {
            toast({
                title: "Not enough XP",
                description: `You need ${cost} XP to unlock this video. Keep practicing!`,
                variant: 'destructive'
            });
            return;
        }

        setIsUnlocking(true);
        try {
            // Optimistic update
            setUnlockedRewardVideoIds(prev => [...prev, videoId]);

            // Insert into user_videos
            const { error: insertError } = await supabase
                .from('user_videos')
                .insert({ user_id: user.id, video_id: videoId });

            if (insertError) throw insertError;

            // Deduct points
            const { error: updateError } = await supabase
                .rpc('increment_user_points', {
                    user_id_param: user.id,
                    points_to_add: -cost // Subtract cost
                });

            if (updateError) throw updateError;

            toast({
                title: "Video Unlocked! 🎉",
                description: "You've successfully unlocked this reward video.",
            });

            // Refresh global points
            await refreshGamification();
        } catch (err) {
            console.error("Unlock error:", err);
            // Revert optimistic update on failure
            setUnlockedRewardVideoIds(prev => prev.filter(id => id !== videoId));
            toast({
                title: "Error",
                description: "Failed to unlock video. Please try again.",
                variant: 'destructive'
            });
        } finally {
            setIsUnlocking(false);
        }
    };

    const handleUnlockCourseVideo = async (videoId: string, cost: number) => {
        if (!user) return;

        if (points < cost) {
            toast({
                title: "Not enough XP",
                description: `You need ${cost} XP to unlock this skill. Keep practicing!`,
                variant: 'destructive'
            });
            return;
        }

        setIsUnlocking(true);
        try {
            // Optimistic update
            setUnlockedCourseVideoIds(prev => [...prev, videoId]);

            // Insert into user_course_unlocks
            const { error: insertError } = await supabase
                .from('user_course_unlocks')
                .insert({ user_id: user.id, video_id: videoId });

            if (insertError) throw insertError;

            // Deduct points
            const { error: updateError } = await supabase
                .rpc('increment_user_points', {
                    user_id_param: user.id,
                    points_to_add: -cost // Subtract cost
                });

            if (updateError) throw updateError;

            toast({
                title: "Skill Unlocked! 🎉",
                description: "You've successfully unlocked this new ability.",
            });

            // Refresh global points
            await refreshGamification();
        } catch (err) {
            console.error("Unlock error:", err);
            // Revert optimistic update on failure
            setUnlockedCourseVideoIds(prev => prev.filter(id => id !== videoId));
            toast({
                title: "Error",
                description: "Failed to unlock skill. Please try again.",
                variant: 'destructive'
            });
        } finally {
            setIsUnlocking(false);
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

    const filteredVideos = videos.filter(v => (v.category || 'Rhythm') === selectedCategory);
    const maxRow = Math.max(...filteredVideos.map(v => v.grid_row ?? 0), 0);
    const maxCol = Math.max(...filteredVideos.map(v => v.grid_column ?? 0), 0);

    const activeMainVideoData = videos.find(v => v.id === activeVideo);
    const activeRewardVideoData = rewardVideos.find(v => v.id === activeVideo);
    const isMainVideoActive = !!activeMainVideoData;

    // Abstract the current video to make logic easier below
    const currentVideoTitle = isMainVideoActive ? activeMainVideoData?.title : activeRewardVideoData?.title;
    const currentVideoDesc = isMainVideoActive ? activeMainVideoData?.description : activeRewardVideoData?.description;
    const currentVideoUrl = isMainVideoActive ? activeMainVideoData?.video_url : activeRewardVideoData?.url;
    const isRewardUnlocked = user ? unlockedRewardVideoIds.includes(activeVideo || '') : false;

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
                                {enrollmentStatus !== 'verified' && enrollmentStatus !== 'pending_verification' && (
                                    <>
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
                                    </>
                                )}
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
                        {(isMainVideoActive || activeRewardVideoData) ? (
                            isMainVideoActive && activeMainVideoData?.locked && enrollmentStatus !== 'verified' ? (
                                enrollmentStatus === 'pending_verification' ? (
                                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-indigo-950 flex flex-col items-center justify-center text-center p-8">
                                        <Lock className="w-16 h-16 text-indigo-400 mb-4 opacity-50" />
                                        <h2 className="text-2xl font-bold mb-2">Verifying Purchase</h2>
                                        <p className="text-muted-foreground mb-6 max-w-md">Your course purchase is currently pending verification. This usually takes just a few moments.</p>
                                    </div>
                                ) : (
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
                                )
                            ) : !isMainVideoActive && activeRewardVideoData && !isRewardUnlocked ? (
                                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-amber-950 flex flex-col items-center justify-center text-center p-8">
                                    <Lock className="w-16 h-16 text-amber-500 mb-4 opacity-50" />
                                    <h2 className="text-2xl font-bold mb-2">Bonus Reward Video</h2>
                                    <p className="text-muted-foreground mb-6 max-w-md">Unlock this video using your earned XP! You currently have <strong>{points} XP</strong>.</p>

                                    <Button
                                        onClick={() => handleUnlockVideo(activeRewardVideoData.id, activeRewardVideoData.unlock_cost)}
                                        disabled={isUnlocking || points < activeRewardVideoData.unlock_cost}
                                        variant="default"
                                        className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                                    >
                                        {isUnlocking ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                        Unlock for {activeRewardVideoData.unlock_cost} XP
                                    </Button>

                                    {points < activeRewardVideoData.unlock_cost && (
                                        <p className="text-xs text-amber-500 mt-4 font-medium animate-pulse">
                                            Need {activeRewardVideoData.unlock_cost - points} more XP
                                        </p>
                                    )}
                                </div>
                            ) : currentVideoUrl ? (
                                <iframe
                                    src={getEmbedUrl(currentVideoUrl)}
                                    title={currentVideoTitle}
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

                    {!user && (
                        <div className="mt-8 bg-gradient-to-br from-indigo-900/40 to-slate-900 border border-indigo-500/20 rounded-xl overflow-hidden relative shadow-lg">
                            <div className="p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 relative z-10">
                                <div className="flex-1 text-center md:text-left">
                                    <h3 className="text-2xl font-black text-white mb-2 flex flex-row justify-center md:justify-start items-center gap-2">
                                        <Target className="w-6 h-6 text-indigo-400" />
                                        Free Practice Aid PDF
                                    </h3>
                                    <p className="text-slate-300 text-sm max-w-md mx-auto md:mx-0">
                                        Having trouble getting to the chord tones in time? Get the free <strong>Hitting Chord Tones PDF</strong> guide sent straight to your inbox to study offline.
                                    </p>
                                </div>
                                <div className="w-full md:w-auto min-w-[300px]">
                                    {isEmailSubmitted ? (
                                        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                                            <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                                            <p className="text-green-300 font-bold text-sm">Perfect. PDF is on the way!</p>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
                                            <input
                                                type="email"
                                                placeholder="Enter your email address..."
                                                value={emailInput}
                                                onChange={(e) => setEmailInput(e.target.value)}
                                                required
                                                className="w-full bg-black/40 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-white placeholder-slate-500"
                                            />
                                            <Button type="submit" disabled={isSubmittingEmail || !emailInput} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-6">
                                                {isSubmittingEmail ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
                                                Send me the Free PDF
                                            </Button>
                                        </form>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between mt-6">
                        <div>
                            <h2 className="text-2xl font-bold">{currentVideoTitle}</h2>
                            {currentVideoDesc && (
                                <p className="text-muted-foreground mt-2">{currentVideoDesc}</p>
                            )}
                        </div>
                        {isPremium && isMainVideoActive && (
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

                    {user && (enrollmentStatus === 'verified' || enrollmentStatus === 'pending_verification') && (
                        <div className="mt-8 border-t border-border/50 pt-8">
                            <h3 className="text-lg font-bold flex items-center gap-2 mb-2">
                                <MessageCircleQuestion className="w-5 h-5 text-indigo-400" />
                                Ask a Question
                            </h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Have a question about this lesson? I read every submission and often update lessons or create new ones to answer them!
                            </p>
                            <div className="flex gap-4">
                                <Textarea
                                    placeholder="What confused you about this lesson?"
                                    value={questionText}
                                    onChange={(e) => setQuestionText(e.target.value)}
                                    className="resize-none min-h-[50px] bg-background border-border/50 focus-visible:ring-indigo-500/50"
                                />
                                <Button
                                    onClick={handleSubmitQuestion}
                                    disabled={!questionText.trim() || isSubmittingQuestion}
                                    className="h-auto shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white"
                                >
                                    {isSubmittingQuestion ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar Navigation */}
                <div className="space-y-6">
                    <Card className="bg-[#0f0f13] border-gray-800 overflow-hidden flex flex-col h-[600px]">
                        <CardHeader className="pb-4 shrink-0 px-6 pt-6 bg-gradient-to-b from-indigo-950/20 to-transparent">
                            <CardTitle className="text-xl font-black text-indigo-400">Skill Tree</CardTitle>
                            <CardDescription className="text-sm font-medium">{completedCount} of {videos.length} skills mastered</CardDescription>
                            
                            <div className="flex flex-wrap gap-2 mt-4">
                                {categories.map(cat => (
                                    <Button
                                        key={cat}
                                        variant={selectedCategory === cat ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`text-[10px] sm:text-xs h-7 px-2 sm:px-3 ${selectedCategory === cat ? 'bg-indigo-600 hover:bg-indigo-700' : 'border-indigo-500/20 text-indigo-300/60 hover:bg-indigo-500/10'}`}
                                    >
                                        {cat}
                                    </Button>
                                ))}
                            </div>
                            
                            <Progress value={progressPercentage} className="mt-4 h-2 bg-indigo-950/50" />
                        </CardHeader>
                        <CardContent className="flex-1 overflow-auto p-8 custom-scrollbar bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0a0a0a] to-[#050505] relative">
                            <div 
                                className="relative grid gap-12 place-items-center mx-auto" 
                                style={{
                                    gridTemplateColumns: `repeat(${maxCol + 1}, minmax(130px, 1fr))`,
                                    gridTemplateRows: `repeat(${maxRow + 1}, minmax(130px, auto))`
                                }}
                            >
                                {filteredVideos.length === 0 ? (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <p className="text-sm text-muted-foreground italic text-center py-4">No skills in this category yet.</p>
                                    </div>
                                ) : filteredVideos.map((video) => {
                                    const isCompleted = progress.includes(video.id);
                                    const isUnlocked = video.unlock_cost === 0 || unlockedCourseVideoIds.includes(video.id);
                                    
                                    const hasPrereqs = video.prerequisite_ids && video.prerequisite_ids.length > 0;
                                    // Prereq met if all required prereqs are completed (in progress array)
                                    const prereqsMet = !hasPrereqs || video.prerequisite_ids.every(pid => progress.includes(pid));
                                    
                                    const isAvailable = (enrollmentStatus === 'verified' || !video.locked) && prereqsMet;
                                    const isPlaying = activeVideo === video.id;
                                    const canAfford = points >= (video.unlock_cost || 0);
                                    const requiresPurchase = isAvailable && !isUnlocked && video.unlock_cost > 0;

                                    return (
                                        <div 
                                            key={video.id}
                                            className="relative flex flex-col items-center group transition-all"
                                            style={{
                                                gridRow: (video.grid_row ?? 0) + 1,
                                                gridColumn: (video.grid_column ?? 0) + 1
                                            }}
                                        >
                                            <button
                                                onClick={() => {
                                                    if (requiresPurchase) {
                                                        handleUnlockCourseVideo(video.id, video.unlock_cost);
                                                    } else if (isAvailable && isUnlocked) {
                                                        setActiveVideo(video.id);
                                                    }
                                                }}
                                                disabled={!isAvailable && !isUnlocked && !requiresPurchase}
                                                className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center border-4 transition-all duration-300 relative shadow-xl z-20 outline-none
                                                    ${isPlaying ? 'bg-indigo-900 border-indigo-400 ring-4 ring-indigo-500/30 scale-110 shadow-indigo-900/50' : 
                                                      isCompleted ? 'bg-emerald-950 border-emerald-500 hover:border-emerald-400 hover:bg-emerald-900 shadow-emerald-900/30' :
                                                      (isAvailable && isUnlocked) ? 'bg-slate-800 border-slate-600 hover:border-indigo-400 hover:bg-slate-700 cursor-pointer' : 
                                                      requiresPurchase ? 'bg-amber-950 border-amber-600 hover:bg-amber-900 hover:border-amber-400 cursor-pointer shadow-amber-900/30' :
                                                      'bg-black border-slate-800 opacity-40 cursor-not-allowed'
                                                    }
                                                `}
                                            >
                                                {isCompleted ? (
                                                    <CheckCircle className="w-8 h-8 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                                                ) : requiresPurchase ? (
                                                    <div className="flex flex-col items-center drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]">
                                                        <Lock className={`w-6 h-6 mb-1 ${canAfford ? 'text-amber-400' : 'text-slate-500'}`} />
                                                        <span className={`text-[10px] font-black tracking-wider ${canAfford ? 'text-amber-400' : 'text-red-400/80'}`}>{video.unlock_cost} XP</span>
                                                    </div>
                                                ) : (isAvailable && isUnlocked) ? (
                                                    <PlayCircle className={`w-8 h-8 ${isPlaying ? 'text-white' : 'text-indigo-400'}`} />
                                                ) : (
                                                    <Lock className="w-6 h-6 text-slate-600" />
                                                )}
                                            </button>
                                            
                                            {!isAvailable && hasPrereqs && (
                                                <div className="absolute top-1/2 -translate-y-1/2 left-full ml-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity bg-black border border-red-900/50 text-[10px] px-2 py-1 rounded text-red-500 font-bold z-30 pointer-events-none shadow-lg">
                                                    Requires previous skill
                                                </div>
                                            )}

                                            <div className="text-center mt-3 w-[120px] z-10">
                                                <p className={`text-xs font-bold leading-tight drop-shadow-md ${isPlaying ? 'text-indigo-300' : isCompleted ? 'text-emerald-400' : isAvailable ? 'text-slate-200' : 'text-slate-500'}`}>
                                                    {video.title}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Gamification Rewards Panel */}
                    {(enrollmentStatus === 'verified' || enrollmentStatus === 'pending_verification') && rewardVideos.length > 0 && (
                        <Card className="bg-[#1a1205] border-amber-900/40 shadow-lg shadow-amber-900/10">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-lg text-amber-500 flex items-center justify-between">
                                    <span>Bonus Rewards</span>
                                    <span className="text-sm px-2 py-0.5 bg-amber-500/10 rounded-full">{points} XP</span>
                                </CardTitle>
                                <CardDescription className="text-xs text-amber-500/60">Unlock extra videos with your practice XP</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {rewardVideos.map((video) => {
                                    const isUnlocked = unlockedRewardVideoIds.includes(video.id);
                                    const isPlaying = activeVideo === video.id;
                                    const canAfford = points >= video.unlock_cost;

                                    return (
                                        <button
                                            key={video.id}
                                            onClick={() => setActiveVideo(video.id)}
                                            className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-all duration-200
                                                ${isPlaying ? 'bg-amber-500/20 border border-amber-500/40 shadow-sm' : 'border border-amber-500/10 hover:bg-amber-500/5 bg-black/40'}
                                            `}
                                        >
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="flex-shrink-0">
                                                    {isUnlocked ? (
                                                        <PlayCircle className={`w-5 h-5 ${isPlaying ? 'text-amber-400' : 'text-amber-500/70'}`} />
                                                    ) : (
                                                        <Lock className="w-5 h-5 text-amber-900" />
                                                    )}
                                                </div>
                                                <div className="overflow-hidden">
                                                    <div className={`font-medium truncate text-sm ${isPlaying ? 'text-amber-400' : 'text-slate-200'}`}>
                                                        {video.title}
                                                    </div>
                                                </div>
                                            </div>
                                            {!isUnlocked && (
                                                <div className={`text-xs ml-2 font-bold px-2 py-1 rounded shrink-0 ${canAfford ? 'bg-amber-500/20 text-amber-500' : 'bg-red-500/10 text-red-500'}`}>
                                                    {video.unlock_cost} XP
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
