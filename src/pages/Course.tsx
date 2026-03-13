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
    // Unified RPG Skill Tree Map state
    const [progress, setProgress] = useState<string[]>([]);
    const [videos, setVideos] = useState<CourseVideo[]>([]);
    const [rewardVideos, setRewardVideos] = useState<RewardVideo[]>([]);
    const [unlockedRewardVideoIds, setUnlockedRewardVideoIds] = useState<string[]>([]);
    const [unlockedCourseVideoIds, setUnlockedCourseVideoIds] = useState<string[]>([]);
    const [activeVideo, setActiveVideo] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
    const mapRef = React.useRef<HTMLDivElement>(null);

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
                }
            }

            setLoading(false);
        };
        loadCourseData();
    }, [user, navigate, searchParams]);

    // Center map on hub (0,0) after loading
    useEffect(() => {
        if (!loading && mapRef.current) {
            const container = mapRef.current.parentElement;
            if (container) {
                const centerX = (totalCols * gap + 80) / 2 - container.clientWidth / 2;
                const centerY = (totalRows * gap + 80) / 2 - container.clientHeight / 2;
                container.scrollLeft = centerX;
                container.scrollTop = centerY;
            }
        }
    }, [loading, videos]);

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

    const activeMainVideoData = videos.find(v => v.id === activeVideo);
    const activeRewardVideoData = rewardVideos.find(v => v.id === activeVideo);
    const isMainVideoActive = !!activeMainVideoData;

    // Abstract the current video to make logic easier below
    const currentVideoTitle = isMainVideoActive ? activeMainVideoData?.title : activeRewardVideoData?.title;
    const currentVideoDesc = isMainVideoActive ? activeMainVideoData?.description : activeRewardVideoData?.description;
    const currentVideoUrl = isMainVideoActive ? activeMainVideoData?.video_url : activeRewardVideoData?.url;
    const isRewardUnlocked = user ? unlockedRewardVideoIds.includes(activeVideo || '') : false;

    // Map sizing and coordinate logic
    const nodeSize = 80;
    const gap = 120;
    
    const minRow = Math.min(...videos.map(v => v.grid_row ?? 0), 0);
    const maxRow = Math.max(...videos.map(v => v.grid_row ?? 0), 0);
    const minCol = Math.min(...videos.map(v => v.grid_column ?? 0), 0);
    const maxCol = Math.max(...videos.map(v => v.grid_column ?? 0), 0);

    const totalRows = maxRow - minRow + 1;
    const totalCols = maxCol - minCol + 1;

    const getX = (col: number) => (col - minCol) * gap + 40;
    const getY = (row: number) => (row - minRow) * gap + 40;

    const renderConnectionLines = () => {
        return (
            <svg 
                className="absolute inset-0 pointer-events-none opacity-40" 
                width={totalCols * gap + 80} 
                height={totalRows * gap + 80}
            >
                {videos.map(video => {
                    if (!video.prerequisite_ids || video.prerequisite_ids.length === 0) return null;
                    
                    return video.prerequisite_ids.map(prereqId => {
                        const prereq = videos.find(v => v.id === prereqId);
                        if (!prereq) return null;

                        const startX = getX(prereq.grid_column) + nodeSize / 2;
                        const startY = getY(prereq.grid_row) + nodeSize / 2;
                        const endX = getX(video.grid_column) + nodeSize / 2;
                        const endY = getY(video.grid_row) + nodeSize / 2;

                        const isMet = progress.includes(prereqId);

                        return (
                            <line
                                key={`${prereqId}-${video.id}`}
                                x1={startX}
                                y1={startY}
                                x2={endX}
                                y2={endY}
                                stroke={isMet ? "#10b981" : "#4f46e5"}
                                strokeWidth="3"
                                strokeDasharray={isMet ? "0" : "6,4"}
                                className="transition-all duration-1000"
                            />
                        );
                    });
                })}
            </svg>
        );
    return (
        <div className="min-h-screen bg-[#050505] text-slate-100 overflow-hidden flex flex-col relative">
            {/* Immersive Header - Floating */}
            <div className="absolute top-0 left-0 right-0 z-50 p-6 pointer-events-none flex justify-between items-start">
                <div className="pointer-events-auto bg-black/40 backdrop-blur-md border border-white/5 p-4 rounded-2xl shadow-2xl">
                    <h1 className="text-2xl font-black bg-gradient-to-r from-white to-slate-500 bg-clip-text text-transparent">THE 90-DAY CHALLENGE</h1>
                    <div className="flex items-center gap-4 mt-1">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{completedCount}/{videos.length} Skills Mastered</span>
                        </div>
                        <Progress value={progressPercentage} className="w-24 h-1 bg-white/5" />
                    </div>
                </div>

                <div className="flex gap-2 pointer-events-auto">
                    <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setIsHowItWorksOpen(true)}
                        className="bg-black/40 backdrop-blur-md border-white/5 hover:bg-white/10 text-xs font-bold rounded-full px-4"
                    >
                        <Info className="w-4 h-4 mr-2" />
                        Protocol
                    </Button>
                    {user && (
                        <div className="bg-indigo-600/20 backdrop-blur-md border border-indigo-500/30 px-5 py-1.5 rounded-full flex items-center gap-2 shadow-lg shadow-indigo-500/10">
                             <Crown className="w-4 h-4 text-indigo-400" />
                             <span className="text-xs font-black text-indigo-300 tracking-wider">{points} XP</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Immersive Map Container */}
            <div className="flex-1 overflow-auto relative select-none bg-grid-white/[0.02] cursor-grab active:cursor-grabbing">
                <div 
                    ref={mapRef}
                    className="relative p-[500px]" // Massive padding to allow huge scroll area
                    style={{
                        width: totalCols * gap + 1000,
                        height: totalRows * gap + 1000,
                    }}
                >
                    {/* Artistic Background Effects */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-indigo-950/10 via-transparent to-purple-950/10 pointer-events-none" />
                    
                    {renderConnectionLines()}

                    {videos.map((video) => {
                        const isCompleted = progress.includes(video.id);
                        const isUnlocked = video.unlock_cost === 0 || unlockedCourseVideoIds.includes(video.id);
                        
                        const hasPrereqs = video.prerequisite_ids && video.prerequisite_ids.length > 0;
                        const prereqsMet = !hasPrereqs || video.prerequisite_ids.every(pid => progress.includes(pid));
                        
                        const isAvailable = (enrollmentStatus === 'verified' || !video.locked) && prereqsMet;
                        const isPlaying = activeVideo === video.id;
                        const canAfford = points >= (video.unlock_cost || 0);
                        const requiresPurchase = isAvailable && !isUnlocked && video.unlock_cost > 0;

                        return (
                            <div 
                                key={video.id}
                                className="absolute flex flex-col items-center group"
                                style={{
                                    left: getX(video.grid_column) + 500,
                                    top: getY(video.grid_row) + 500,
                                    width: nodeSize
                                }}
                            >
                                <button
                                    onClick={() => {
                                        if (requiresPurchase) {
                                            handleUnlockCourseVideo(video.id, video.unlock_cost);
                                        } else if (isAvailable && isUnlocked) {
                                            setActiveVideo(video.id);
                                            setIsVideoModalOpen(true);
                                        } else if (!isAvailable && !isUnlocked && !requiresPurchase) {
                                            toast({
                                                title: "Protocol Interrupted",
                                                description: "The previous prerequisites must be completed first.",
                                                variant: "destructive"
                                            });
                                        }
                                    }}
                                    className={`w-20 h-20 sm:w-24 sm:h-24 rounded-3xl flex flex-col items-center justify-center border-2 transition-all duration-500 relative shadow-2xl z-20 hover:scale-110 active:scale-95
                                        ${isPlaying ? 'bg-indigo-600 border-white shadow-[0_0_40px_rgba(79,70,229,0.5)]' : 
                                          isCompleted ? 'bg-emerald-500/20 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]' :
                                          (isAvailable && isUnlocked) ? 'bg-slate-800/80 border-slate-600 hover:border-indigo-400' : 
                                          requiresPurchase ? 'bg-amber-950/40 border-amber-600 hover:border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.1)]' :
                                          'bg-black/40 border-slate-800 opacity-30 cursor-not-allowed grayscale'
                                        }
                                    `}
                                >
                                    {isCompleted ? (
                                        <CheckCircle className="w-12 h-12 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                                    ) : requiresPurchase ? (
                                        <div className="flex flex-col items-center">
                                            <Lock className={`w-7 h-7 mb-1 ${canAfford ? 'text-amber-400' : 'text-slate-500'}`} />
                                            <span className={`text-[10px] font-black tracking-widest ${canAfford ? 'text-amber-400' : 'text-red-400/80'}`}>{video.unlock_cost} XP</span>
                                        </div>
                                    ) : (isAvailable && isUnlocked) ? (
                                        <PlayCircle className={`w-12 h-12 ${isPlaying ? 'text-white' : 'text-indigo-400 group-hover:text-white group-hover:drop-shadow-[0_0_10px_rgba(79,70,229,0.8)]'}`} />
                                    ) : (
                                        <Lock className="w-8 h-8 text-slate-700" />
                                    )}

                                    {/* Ripple Effect for Completed Nodes */}
                                    {isCompleted && (
                                        <div className="absolute inset-0 rounded-3xl border-emerald-500/50 animate-ping opacity-20 pointer-events-none" />
                                    )}
                                </button>
                                
                                <div className="text-center mt-4 w-[140px] z-10">
                                    <p className={`text-[11px] font-black uppercase tracking-widest leading-tight drop-shadow-lg transition-colors duration-300 ${isPlaying ? 'text-white' : isCompleted ? 'text-emerald-400' : isAvailable ? 'text-slate-300' : 'text-slate-600'}`}>
                                        {video.title}
                                    </p>
                                </div>

                                {video.title.startsWith('Pillars -') && (
                                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap">
                                        <span className="text-[13px] font-black text-indigo-400 uppercase tracking-[0.4em] bg-indigo-500/10 px-4 py-1.5 rounded-full border border-indigo-500/20 backdrop-blur-md shadow-xl shadow-indigo-900/20">
                                            {video.title.replace('Pillars - ', '')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Video Player Modal */}
            <Dialog open={isVideoModalOpen} onOpenChange={setIsVideoModalOpen}>
                <DialogContent className="max-w-6xl p-0 bg-black border-white/10 overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)]">
                    <div className="flex flex-col h-[90vh]">
                        <div className="aspect-video relative bg-slate-950 group">
                            {currentVideoUrl ? (
                                <iframe
                                    src={getEmbedUrl(currentVideoUrl)}
                                    title={currentVideoTitle}
                                    className="w-full h-full border-0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                />
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                                    <PlayCircle className="w-16 h-16 text-indigo-400 mb-4 opacity-50" />
                                    <h2 className="text-2xl font-bold mb-2">Transmission Lost</h2>
                                    <p className="text-slate-500">No video data found for this skill node.</p>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex-1 overflow-auto p-10 bg-gradient-to-b from-[#0a0a0f] to-black border-t border-white/5">
                            <div className="flex flex-col lg:flex-row items-start justify-between gap-10">
                                <div className="space-y-6 flex-1">
                                    <div className="space-y-2">
                                        <h2 className="text-5xl font-black tracking-tighter text-white">{currentVideoTitle}</h2>
                                        <div className="flex items-center gap-4 text-slate-500 font-bold text-xs uppercase tracking-widest">
                                            <span className="bg-white/5 px-2 py-1 rounded">Rank: Master</span>
                                            <span>Difficulty: Adaptive</span>
                                        </div>
                                    </div>
                                    
                                    <p className="text-slate-400 text-xl leading-relaxed font-medium">{currentVideoDesc}</p>
                                    
                                    {!user && !activeMainVideoData?.locked && (
                                        <div className="mt-8 p-8 bg-indigo-500/10 border border-indigo-500/20 rounded-3xl relative overflow-hidden group">
                                            <div className="absolute -right-10 -top-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
                                            <div className="relative z-10">
                                                <h4 className="text-2xl font-black text-indigo-100 mb-3 flex items-center gap-3">
                                                    <Target className="w-8 h-8 text-indigo-400" />
                                                    Unlock Full Mastery
                                                </h4>
                                                <p className="text-slate-300 text-lg mb-6 max-w-xl">You're exploring a preview node. Sign up to unlock the entire 90-Day Skill Tree, track your XP, and gain access to the AI Coach.</p>
                                                <Button onClick={() => navigate('/auth')} size="lg" className="bg-indigo-600 hover:bg-indigo-500 text-lg px-8 py-7 rounded-2xl shadow-xl shadow-indigo-600/20">
                                                    Initialize Master Account
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {user && isMainVideoActive && (
                                        <div className="pt-8">
                                            <Button
                                                variant={progress.includes(activeVideo || '') ? "outline" : "default"}
                                                size="lg"
                                                onClick={() => {
                                                    if (activeVideo) {
                                                        toggleProgress(activeVideo, progress.includes(activeVideo))
                                                    }
                                                }}
                                                className={`gap-4 text-xl py-8 px-10 rounded-2xl transition-all duration-300 ${!progress.includes(activeVideo || '') ? 'bg-emerald-600 hover:bg-emerald-500 hover:scale-105 text-white shadow-2xl shadow-emerald-600/20' : 'border-emerald-500/50 text-emerald-400'}`}
                                            >
                                                {progress.includes(activeVideo || '') ? (
                                                    <><CheckCircle className="w-8 h-8" /> Skill Mastered</>
                                                ) : (
                                                    <><Circle className="w-8 h-8" /> Confirm Mastery</>
                                                )}
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                <div className="w-full lg:w-80 space-y-8">
                                    <div className="p-6 bg-white/5 rounded-3xl border border-white/5 backdrop-blur-sm">
                                        <h4 className="font-black text-xs uppercase tracking-[0.2em] text-slate-500 mb-6 flex items-center gap-2">
                                            <Crown className="w-3.5 h-3.5 text-amber-500" />
                                            Premium Rewards
                                        </h4>
                                        <div className="space-y-4">
                                            {rewardVideos.slice(0, 3).map(reward => (
                                                <div 
                                                    key={reward.id} 
                                                    className="flex items-center gap-4 group cursor-pointer p-2 rounded-xl hover:bg-white/5 transition-all" 
                                                    onClick={() => { setActiveVideo(reward.id); setIsVideoModalOpen(true); }}
                                                >
                                                    <div className="w-16 h-10 bg-slate-900 rounded-lg border border-white/5 overflow-hidden flex items-center justify-center shrink-0 group-hover:border-indigo-500/30">
                                                        <PlayCircle className="w-6 h-6 text-slate-700 group-hover:text-indigo-500 transition-colors" />
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <p className="text-xs font-black text-slate-300 truncate group-hover:text-white transition-colors uppercase tracking-tight">{reward.title}</p>
                                                        <p className="text-[10px] font-bold text-amber-600 tracking-widest">{reward.unlock_cost} XP</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <div className="p-6 bg-indigo-900/10 rounded-3xl border border-indigo-500/10">
                                        <h4 className="font-black text-[10px] uppercase tracking-widest text-indigo-400 mb-2">System Status</h4>
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[10px] font-bold">
                                                <span className="text-slate-500">Node ID</span>
                                                <span className="text-slate-300 font-mono">{activeVideo?.substring(0, 8)}</span>
                                            </div>
                                            <div className="flex justify-between text-[10px] font-bold">
                                                <span className="text-slate-500">Security</span>
                                                <span className="text-emerald-500">Verified</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Protocol/Guide Modal */}
            <Dialog open={isHowItWorksOpen} onOpenChange={setIsHowItWorksOpen}>
                <DialogContent className="sm:max-w-[650px] bg-slate-950 border-white/10 text-slate-100 p-0 overflow-hidden rounded-[40px]">
                    <div className="p-12 space-y-8">
                        <DialogHeader>
                            <DialogTitle className="text-4xl font-black text-center text-white mb-2 tracking-tighter">
                                CHALLENGE PROTOCOL
                            </DialogTitle>
                            <p className="text-center text-slate-400 font-medium text-lg leading-relaxed">
                                Transform your playing in 90 days through structured immersion in the five pillars of musicianship.
                            </p>
                        </DialogHeader>
                        
                        <div className="grid gap-4">
                            {[
                                { icon: Target, title: 'PHASE 1: IMMERSION', color: 'text-indigo-400', desc: 'Unlock over 30 core training videos branching from the central hub.' },
                                { icon: LineChart, title: 'PHASE 2: TRACKING', color: 'text-orange-400', desc: 'Every note is logged. Your mastery level grows with every practice minute.' },
                                { icon: Calendar, title: 'PHASE 3: MASTERY', color: 'text-green-400', desc: 'Complete branches to unlock legendary rewards and custom AI routines.' }
                            ].map((item, i) => (
                                <div key={i} className="flex gap-6 p-6 bg-white/5 rounded-[30px] border border-white/5 hover:bg-white/[0.07] transition-colors group">
                                    <div className="shrink-0 p-4 bg-black/40 rounded-2xl group-hover:scale-110 transition-transform">
                                        <item.icon className={`w-8 h-8 ${item.color}`} />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-white text-lg tracking-tight mb-1">{item.title}</h4>
                                        <p className="text-sm text-slate-400 font-medium leading-relaxed">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="pt-4 flex flex-col items-center gap-6">
                            {enrollmentStatus !== 'verified' ? (
                                <div className="w-full space-y-4">
                                    <Button onClick={handleBuyCourse} className="w-full bg-indigo-600 hover:bg-indigo-500 py-8 text-xl font-black tracking-widest rounded-2xl shadow-2xl shadow-indigo-600/30">
                                        INITIALIZE CHALLENGE — $199.99
                                    </Button>
                                    <p className="text-[10px] text-center text-slate-600 font-black tracking-[0.2em] uppercase">Lifetime Access Granted Upon Initialization</p>
                                </div>
                            ) : (
                                <Button onClick={() => setIsHowItWorksOpen(false)} variant="outline" className="w-full border-white/10 py-6 font-black tracking-widest uppercase rounded-2xl">
                                    Continue Mission
                                </Button>
                            )}

                            <div className="p-6 bg-indigo-500/5 border border-indigo-500/10 rounded-3xl w-full">
                                <h5 className="font-black text-xs text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <Info className="w-4 h-4" />
                                    The 90-Day Guarantee
                                </h5>
                                <p className="text-[11px] text-slate-500 font-bold leading-relaxed">
                                    Complete 15 minutes of daily practice for 30 days. If your ear, speed, and accuracy haven't transformed, we'll issue a full refund. No questions asked.
                                </p>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
