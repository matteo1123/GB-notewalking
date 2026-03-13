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
        <div className="min-h-screen bg-[#050505] text-slate-100 overflow-hidden flex flex-col">
            {/* Immersive Header - Floating */}
            <div className="absolute top-0 left-0 right-0 z-50 p-6 pointer-events-none flex justify-between items-start">
                <div className="pointer-events-auto bg-black/40 backdrop-blur-md border border-white/5 p-4 rounded-2xl">
                    <h1 className="text-2xl font-black bg-gradient-to-r from-white to-slate-500 bg-clip-text text-transparent">THE 90-DAY CHALLENGE</h1>
                    <div className="flex items-center gap-4 mt-1">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{completedCount}/{videos.length} Skills</span>
                        </div>
                        <Progress value={progressPercentage} className="w-24 h-1 bg-white/5" />
                    </div>
                </div>

                <div className="flex gap-2 pointer-events-auto">
                    <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setIsHowItWorksOpen(true)}
                        className="bg-black/40 backdrop-blur-md border-white/5 hover:bg-white/10 text-xs font-bold"
                    >
                        <Info className="w-3.5 h-3.5 mr-2" />
                        Guide
                    </Button>
                    {user && (
                        <div className="bg-indigo-600/20 backdrop-blur-md border border-indigo-500/30 px-4 py-1.5 rounded-full flex items-center gap-2">
                             <Crown className="w-3.5 h-3.5 text-indigo-400" />
                             <span className="text-xs font-black text-indigo-300">{points} XP</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Immersive Map Container */}
            <div className="flex-1 overflow-auto relative custom-scrollbar select-none bg-grid-white/[0.02]" style={{ perspective: '1000px' }}>
                <div 
                    ref={mapRef}
                    className="relative transition-all duration-1000 ease-in-out" 
                    style={{
                        width: totalCols * gap + 200,
                        height: totalRows * gap + 200,
                        padding: '100px'
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
                                    left: getX(video.grid_column) + 100,
                                    top: getY(video.grid_row) + 100,
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
                                                title: "Skill Locked",
                                                description: "Complete the previous skills to unlock this path.",
                                                variant: "destructive"
                                            });
                                        }
                                    }}
                                    className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center border-2 transition-all duration-500 relative shadow-2xl z-20 hover:scale-110 active:scale-95
                                        ${isPlaying ? 'bg-indigo-600 border-white shadow-[0_0_30px_rgba(79,70,229,0.5)]' : 
                                          isCompleted ? 'bg-emerald-500/20 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]' :
                                          (isAvailable && isUnlocked) ? 'bg-slate-800/80 border-slate-600 hover:border-indigo-400' : 
                                          requiresPurchase ? 'bg-amber-950/40 border-amber-600 hover:border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.1)]' :
                                          'bg-black/40 border-slate-800 opacity-30 cursor-not-allowed grayscale'
                                        }
                                    `}
                                >
                                    {isCompleted ? (
                                        <CheckCircle className="w-10 h-10 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                                    ) : requiresPurchase ? (
                                        <div className="flex flex-col items-center">
                                            <Lock className={`w-6 h-6 mb-1 ${canAfford ? 'text-amber-400' : 'text-slate-500'}`} />
                                            <span className={`text-[10px] font-black tracking-widest ${canAfford ? 'text-amber-400' : 'text-red-400/80'}`}>{video.unlock_cost} XP</span>
                                        </div>
                                    ) : (isAvailable && isUnlocked) ? (
                                        <PlayCircle className={`w-10 h-10 ${isPlaying ? 'text-white' : 'text-indigo-400 group-hover:text-white'}`} />
                                    ) : (
                                        <Lock className="w-8 h-8 text-slate-600" />
                                    )}

                                    {/* Particle Effect for Completed Nodes */}
                                    {isCompleted && (
                                        <div className="absolute inset-0 rounded-2xl border-emerald-500/50 animate-ping opacity-20" />
                                    )}
                                </button>
                                
                                <div className="text-center mt-3 w-[120px] z-10">
                                    <p className={`text-[11px] font-black uppercase tracking-tighter leading-none drop-shadow-lg line-clamp-2 transition-colors duration-300 ${isPlaying ? 'text-white' : isCompleted ? 'text-emerald-400' : isAvailable ? 'text-slate-200' : 'text-slate-500'}`}>
                                        {video.title}
                                    </p>
                                </div>

                                {video.title.startsWith('Pillars -') && (
                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap">
                                        <span className="text-[12px] font-black text-indigo-400 uppercase tracking-[0.3em] bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 backdrop-blur-sm">
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
                <DialogContent className="max-w-5xl p-0 bg-black border-white/10 overflow-hidden">
                    <div className="flex flex-col h-[90vh]">
                        <div className="aspect-video relative bg-slate-950">
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
                                    <h2 className="text-2xl font-bold mb-2">Video Unavailable</h2>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex-1 overflow-auto p-8 bg-[#0a0a0f] border-t border-white/5">
                            <div className="flex items-start justify-between gap-6">
                                <div className="space-y-4 max-w-2xl">
                                    <h2 className="text-4xl font-black">{currentVideoTitle}</h2>
                                    <p className="text-slate-400 text-lg leading-relaxed">{currentVideoDesc}</p>
                                    
                                    {!user && !activeMainVideoData?.locked && (
                                        <div className="mt-8 p-6 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl">
                                            <h4 className="font-bold text-indigo-300 mb-2 flex items-center gap-2">
                                                <Info className="w-5 h-5" />
                                                Ready for the full experience?
                                            </h4>
                                            <p className="text-sm text-slate-400 mb-4">You're watching a preview! Sign up to unlock the full skill tree and track your progress.</p>
                                            <Button onClick={() => navigate('/auth')} className="bg-indigo-600 hover:bg-indigo-700">Create Free Account</Button>
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
                                                className={`gap-3 text-lg py-6 px-8 rounded-xl transition-all ${!progress.includes(activeVideo || '') ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'border-emerald-500/50 text-emerald-400'}`}
                                            >
                                                {progress.includes(activeVideo || '') ? (
                                                    <><CheckCircle className="w-6 h-6" /> Mastery Confirmed</>
                                                ) : (
                                                    <><Circle className="w-6 h-6" /> Complete Skill</>
                                                )}
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
