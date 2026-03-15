import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle, PlayCircle, Lock, Loader2, Crown, Info, Target, LineChart, Calendar, MessageCircleQuestion, Send, ChevronLeft } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
    const [awardedXPFor, setAwardedXPFor] = useState<string[]>([]);
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

                let hasPremium = !!(profile?.premium_until && new Date(profile.premium_until) > new Date());

                // Auto-grant 30 days if this user previously signed up for the free PDF
                if (!hasPremium && user.email) {
                    const { data: subscriber } = await supabase
                        .from('email_subscribers')
                        .select('id')
                        .eq('email', user.email)
                        .maybeSingle();

                    if (subscriber) {
                        const premiumUntil = new Date();
                        premiumUntil.setDate(premiumUntil.getDate() + 30);
                        await supabase
                            .from('profiles')
                            .update({ premium_until: premiumUntil.toISOString() })
                            .eq('id', user.id);
                        hasPremium = true;
                    }
                }

                setIsPremium(hasPremium);

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

    // Center map on landing video after loading
    const hasScrolledRef = React.useRef(false);
    
    // Calculate mapping variables needed by nodePositions and scrolling
    const nodeSize = 80;
    const gap = 250; 
    
    const minRow = Math.min(...videos.map(v => v.grid_row ?? 0), -2);
    const maxRow = Math.max(...videos.map(v => v.grid_row ?? 0), 2);
    const minCol = Math.min(...videos.map(v => v.grid_column ?? 0), -2);
    const maxCol = Math.max(...videos.map(v => v.grid_column ?? 0), 2);

    const totalRows = maxRow - minRow + 1;
    const totalCols = maxCol - minCol + 1;

    const getX = React.useCallback((col: number) => (col - minCol) * gap + 40, [minCol, gap]);
    const getY = React.useCallback((row: number) => (row - minRow) * gap + 40, [minRow, gap]);

    const nodePositions = React.useMemo(() => {
        const pos = new Map<string, { x: number; y: number }>();
        
        // Group ALL videos by their grid cell to detect collisions
        const cellGroups = new Map<string, typeof videos>();
        videos.forEach(v => {
            const key = `${v.grid_row},${v.grid_column}`;
            if (!cellGroups.has(key)) cellGroups.set(key, []);
            cellGroups.get(key)!.push(v);
        });
        
        cellGroups.forEach((group, key) => {
            const [row, col] = key.split(',').map(Number);
            const cx = getX(col);
            const cy = getY(row);
            
            if (group.length === 1) {
                pos.set(group[0].id, { x: cx, y: cy });
            } else {
                // Multiple videos at same cell — fan them out in a tight circle
                // Keep nodes well inside the visual hub ring
                const spreadRadius = 60 + group.length * 30;
                group.forEach((v, idx) => {
                    const angle = (idx / group.length) * Math.PI * 2 - Math.PI / 2;
                    pos.set(v.id, {
                        x: cx + Math.cos(angle) * spreadRadius,
                        y: cy + Math.sin(angle) * spreadRadius
                    });
                });
            }
        });
        
        return pos;
    }, [videos, getX, getY]); 

    useEffect(() => {
        if (!loading && mapRef.current && videos.length > 0 && !hasScrolledRef.current && nodePositions.size > 0) {
            const container = mapRef.current.parentElement;
            if (container) {
                // Find Landing Video (cost 0) or fallback to very first node
                const landingVideo = videos.find(v => v.unlock_cost === 0) || videos[0];
                const targetPos = nodePositions.get(landingVideo?.id) || { x: getX(0), y: getY(0) };
                
                const exactX = targetPos.x + 500 + nodeSize / 2;
                const exactY = targetPos.y + 500 + nodeSize / 2;
                
                container.scrollTo({
                    left: exactX - container.clientWidth / 2,
                    top: exactY - container.clientHeight / 2,
                    behavior: 'auto' // Instant scroll to avoid flashy blank screen
                });
                
                hasScrolledRef.current = true;
            }
        }
    }, [loading, videos, nodePositions, getX, getY]);

    // Handle Video Completion -> XP Tracking
    const handleVideoEnd = React.useCallback(() => {
        if (activeVideo && user && !awardedXPFor.includes(activeVideo)) {
            setAwardedXPFor(prev => [...prev, activeVideo]);
            
            // Give them 5 XP
            supabase.rpc('increment_user_points', {
                user_id_param: user.id,
                points_to_add: 5
            }).then(({ error }) => {
                if (!error) {
                    toast({
                        title: "+5 XP Earned! 🎉",
                        description: "You've earned XP for completing a video.",
                    });
                    refreshGamification();
                }
            });
        }
    }, [activeVideo, user, awardedXPFor, toast, refreshGamification]);

    // Format standard YouTube URLs or Bunny Stream URLs to Embed URLs
    // withSound=true when opened via user click (so we can autoplay with audio)
    const getEmbedUrl = (url: string, withSound = false) => {
        if (!url) return '';
        try {
            const shouldAutoplay = withSound || searchParams.get('autoplay') === '1' || !searchParams.has('lesson');
            const shouldMute = !withSound;

            // Handle Bunny Stream URLs
            if (url.includes('player.mediadelivery.net/embed/') || url.includes('iframe.mediadelivery.net/embed/')) {
                const bunnyUrl = new URL(url);
                if (shouldAutoplay) {
                    bunnyUrl.searchParams.set('autoplay', 'true');
                    if (shouldMute) bunnyUrl.searchParams.set('muted', 'true');
                }
                return bunnyUrl.toString();
            }

            // Handle existing YouTube embeds
            if (url.includes('youtube.com/embed/')) {
                const ytUrl = new URL(url);
                if (shouldAutoplay && !ytUrl.searchParams.has('autoplay')) {
                    ytUrl.searchParams.set('autoplay', '1');
                    if (shouldMute) ytUrl.searchParams.set('mute', '1');
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
                const params = new URLSearchParams({
                    rel: '0',
                    modestbranding: '1',
                    showinfo: '0',
                    iv_load_policy: '3',
                    color: 'white',
                });

                if (shouldAutoplay) {
                    params.append('autoplay', '1');
                    if (shouldMute) params.append('mute', '1');
                }

                return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
            }
            return url;
        } catch (e) {
            return url;
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
            setEmailInput('');
            // Trigger PDF delivery via edge function (fire-and-forget)
            supabase.functions.invoke('send-pdf-email', { body: { email: emailInput } }).catch(() => {
                // Edge function may not exist yet; email is saved and can be processed later
            });
            toast({
                title: "PDF is on its way!",
                description: "Check your inbox for the Hitting Chord Tones guide.",
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
        <div className="p-8 flex flex-col items-center justify-center min-h-screen text-muted-foreground bg-[#050505]">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p>Booting orbital map...</p>
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

    const getCategoryTheme = (video: CourseVideo) => {
        const text = ((video.category || "") + " " + (video.title || "")).toLowerCase();
        if (text.includes('rhythm')) return { id: 'rhythm', color: '#3b82f6', bg: 'bg-blue-600', border: 'border-blue-500', glow: 'shadow-[0_0_50px_rgba(59,130,246,0.6)]', text: 'text-blue-400', label: 'Rhythm Realm' };
        if (text.includes('ear')) return { id: 'ear', color: '#a855f7', bg: 'bg-purple-600', border: 'border-purple-500', glow: 'shadow-[0_0_50px_rgba(168,85,247,0.6)]', text: 'text-purple-400', label: 'Ear Training Void' };
        if (text.includes('chord')) return { id: 'chord', color: '#f59e0b', bg: 'bg-amber-600', border: 'border-amber-500', glow: 'shadow-[0_0_50px_rgba(245,158,11,0.6)]', text: 'text-amber-400', label: 'Chord Tone Territory' };
        if (text.includes('technique')) return { id: 'tech', color: '#ef4444', bg: 'bg-red-600', border: 'border-red-500', glow: 'shadow-[0_0_50px_rgba(239,68,68,0.6)]', text: 'text-red-400', label: 'Technique Temple' };
        if (text.includes('fretboard') || text.includes('spire')) return { id: 'fret', color: '#10b981', bg: 'bg-emerald-600', border: 'border-emerald-500', glow: 'shadow-[0_0_50px_rgba(16,185,129,0.6)]', text: 'text-emerald-400', label: 'Fretboard Spire' };
        return { id: 'main', color: '#4f46e5', bg: 'bg-indigo-600', border: 'border-indigo-500', glow: 'shadow-[0_0_50px_rgba(79,70,229,0.6)]', text: 'text-indigo-400', label: 'Core Hub' };
    };



    const renderConnectionLines = () => {
        return (
            <svg 
                className="absolute inset-0 pointer-events-none z-10" 
                width={totalCols * gap + 1000} 
                height={totalRows * gap + 1000}
            >
                <defs>
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                    <linearGradient id="line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#4f46e5" />
                        <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>

                    {/* Thematic Gradients */}
                    <linearGradient id="grad-rhythm" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#60a5fa" /></linearGradient>
                    <linearGradient id="grad-ear" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#a855f7" /><stop offset="100%" stopColor="#c084fc" /></linearGradient>
                    <linearGradient id="grad-chord" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#fbbf24" /></linearGradient>
                    <linearGradient id="grad-tech" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#ef4444" /><stop offset="100%" stopColor="#f87171" /></linearGradient>
                    <linearGradient id="grad-fret" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#34d399" /></linearGradient>
                    <linearGradient id="grad-main" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#4f46e5" /><stop offset="100%" stopColor="#818cf8" /></linearGradient>
                </defs>
                
                {/* Core Hub Background Effect */}
                {(() => {
                    // Count how many videos sit at grid (0,0) to scale the hub circle
                    const hubNodeCount = videos.filter(v => v.grid_row === 0 && v.grid_column === 0).length;
                    // Tight inner ring that grows gently with node count  
                    const innerR = Math.max(160, 100 + hubNodeCount * 40);
                    const glowR = innerR + 100;
                    const outerR = innerR + 150;
                    const midR = innerR + 60;
                    const hubCx = getX(0) + 500 + nodeSize / 2;
                    const hubCy = getY(0) + 500 + nodeSize / 2;
                    
                    return (
                        <g className="select-none pointer-events-none">
                            {/* Distinct Center Zone */}
                            <circle 
                                cx={hubCx} 
                                cy={hubCy} 
                                r={innerR} 
                                fill="#0a0a1a" 
                                stroke="url(#grad-main)"
                                strokeWidth="2"
                                strokeDasharray="4 8"
                                className="opacity-50"
                            />
                            <text 
                                x={hubCx} 
                                y={hubCy - innerR + 30} 
                                textAnchor="middle" 
                                fontSize="24" 
                                fill="#818cf8" 
                                className="font-black uppercase tracking-[0.5em] opacity-50"
                            >
                                Core Hub
                            </text>
                            <circle 
                                cx={hubCx} 
                                cy={hubCy} 
                                r={glowR} 
                                fill="url(#grad-main)" 
                                filter="blur(80px)" 
                                className="opacity-[0.1]"
                            />
                            <circle 
                                cx={hubCx} 
                                cy={hubCy} 
                                r={outerR} 
                                fill="none" 
                                stroke="url(#grad-main)"
                                strokeWidth="2"
                                strokeDasharray="10 20"
                                className="animate-[spin_60s_linear_infinite] opacity-[0.15]"
                            />
                            <circle 
                                cx={hubCx} 
                                cy={hubCy} 
                                r={midR} 
                                fill="none" 
                                stroke="url(#grad-main)"
                                strokeWidth="4"
                                strokeDasharray="5 30"
                                className="animate-[spin_40s_linear_infinite_reverse] opacity-[0.15]"
                            />
                        </g>
                    );
                })()}

                {/* Region Labels Labels (Large Themed Background Text) & Blob Backgrounds */}
                {(() => {
                    const categorizedNodes = new Map<string, { x: number, y: number, theme: ReturnType<typeof getCategoryTheme> }[]>();
                    
                    videos.forEach(video => {
                        const theme = getCategoryTheme(video);
                        if (theme.id === 'main') return;
                        
                        if (!categorizedNodes.has(theme.id)) {
                            categorizedNodes.set(theme.id, []);
                        }
                        const pos = nodePositions.get(video.id);
                        if (pos) {
                            categorizedNodes.get(theme.id)!.push({
                                x: pos.x + 500,
                                y: pos.y + 500,
                                theme
                            });
                        }
                    });

                    return Array.from(categorizedNodes.entries()).map(([id, nodes]) => {
                        if (nodes.length === 0) return null;
                        
                        // Calculate center of mass for the category
                        const avgX = nodes.reduce((sum, n) => sum + n.x, 0) / nodes.length;
                        const avgY = nodes.reduce((sum, n) => sum + n.y, 0) / nodes.length;
                        
                        const theme = nodes[0].theme;
                        
                        // Find the bounding box
                        const minX = Math.min(...nodes.map(n => n.x));
                        const maxX = Math.max(...nodes.map(n => n.x));
                        const minY = Math.min(...nodes.map(n => n.y));
                        const maxY = Math.max(...nodes.map(n => n.y));
                        const width = Math.max(maxX - minX + gap, gap * 2);
                        const height = Math.max(maxY - minY + gap, gap * 2);

                        const hubX = getX(0) + 500 + nodeSize / 2;
                        const hubY = getY(0) + 500 + nodeSize / 2;

                        const dx = avgX - hubX;
                        const dy = avgY - hubY;
                        const dist = Math.sqrt(dx*dx + dy*dy) || 1;

                        // Push the text outward from center to avoid center clump overlap
                        const textPushDist = Math.max(dist, 400);
                        const textX = hubX + (dx / dist) * textPushDist;
                        const textY = hubY + (dy / dist) * textPushDist;

                        // Calculate an angle for text rotation based on the vector from origin (hub) to center of mass
                        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                        // Normalize text so it's readable
                        let readableAngle = angle;
                        if (readableAngle > 90 || readableAngle < -90) readableAngle += 180;

                        return (
                            <g key={id} className="opacity-[0.2] select-none pointer-events-none">
                                {/* Organic Blob behind the region */}
                                <ellipse 
                                    cx={avgX} 
                                    cy={avgY} 
                                    rx={width / 1.5} 
                                    ry={height / 1.5} 
                                    fill={theme.color} 
                                    filter=" blur(80px)" 
                                    className="opacity-40"
                                    transform={`rotate(${angle}, ${avgX}, ${avgY})`}
                                />
                                {/* Dynamic Text Placement */}
                                <text 
                                    x={textX} 
                                    y={textY} 
                                    textAnchor="middle" 
                                    fontSize="40" 
                                    fill={theme.color} 
                                    className="font-black uppercase tracking-[0.4em] drop-shadow-2xl opacity-40"
                                    transform={`rotate(${readableAngle}, ${textX}, ${textY})`}
                                >
                                    {theme.label}
                                </text>
                            </g>
                        );
                    });
                })()}

                {/* Category-based Connection Lines (same skill tree) */}
                {(() => {
                    const categoryGroups = new Map<string, typeof videos>();
                    videos.forEach(v => {
                        // Use only the category field (not title) to avoid false groupings
                        // e.g. "Hit Your First Chord Tone" should NOT group with Chord Tones category
                        const catOnly = (v.category || '').toLowerCase().trim();
                        if (!catOnly || catOnly === 'none') return;
                        const theme = getCategoryTheme({ ...v, title: '' }); // strip title to force category-only match
                        if (theme.id === 'main') return; // uncategorized — skip
                        if (!categoryGroups.has(theme.id)) categoryGroups.set(theme.id, []);
                        categoryGroups.get(theme.id)!.push(v);
                    });
                    
                    const lines: React.ReactNode[] = [];
                    categoryGroups.forEach((group, catId) => {
                        if (group.length < 2 || catId === 'main') return;
                        const theme = getCategoryTheme(group[0]);
                        
                        // Connect each node to its nearest neighbor in the same category
                        for (let i = 0; i < group.length; i++) {
                            let nearestIdx = -1;
                            let nearestDist = Infinity;
                            for (let j = i + 1; j < group.length; j++) {
                                const pi = nodePositions.get(group[i].id);
                                const pj = nodePositions.get(group[j].id);
                                if (!pi || !pj) continue;
                                const d = Math.sqrt((pi.x - pj.x) ** 2 + (pi.y - pj.y) ** 2);
                                if (d < nearestDist) { nearestDist = d; nearestIdx = j; }
                            }
                            if (nearestIdx === -1) continue;
                            const p1 = nodePositions.get(group[i].id)!;
                            const p2 = nodePositions.get(group[nearestIdx].id)!;
                            const sx = p1.x + 500 + nodeSize / 2;
                            const sy = p1.y + 500 + nodeSize / 2;
                            const ex = p2.x + 500 + nodeSize / 2;
                            const ey = p2.y + 500 + nodeSize / 2;
                            const dx = ex - sx;
                            const dy = ey - sy;
                            const curv = 0.15;
                            lines.push(
                                <path
                                    key={`cat-${catId}-${i}-${nearestIdx}`}
                                    d={`M ${sx} ${sy} C ${sx + dx * 0.3 - dy * curv} ${sy + dy * 0.3 + dx * curv}, ${sx + dx * 0.7 - dy * curv} ${sy + dy * 0.7 + dx * curv}, ${ex} ${ey}`}
                                    fill="none"
                                    stroke={theme.color}
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeDasharray="8 12"
                                    className="opacity-30"
                                />
                            );
                        }
                    });
                    return lines;
                })()}

                {/* Prerequisite Connection Paths */}
                {videos.map(video => {
                    if (!video.prerequisite_ids || video.prerequisite_ids.length === 0) return null;
                    
                    return video.prerequisite_ids.map(prereqId => {
                        const prereq = videos.find(v => v.id === prereqId);
                        if (!prereq) return null;

                        const startPos = nodePositions.get(prereq.id);
                        const endPos = nodePositions.get(video.id);
                        if (!startPos || !endPos) return null;

                        const startX = startPos.x + nodeSize / 2;
                        const startY = startPos.y + nodeSize / 2;
                        const endX = endPos.x + nodeSize / 2;
                        const endY = endPos.y + nodeSize / 2;

                        const isMet = progress.includes(prereqId);
                        const theme = getCategoryTheme(video);

                        // Calculate curved path (bezier). To make it organic, we slightly offset the control points perpendicular to the main line.
                        const dx = endX - startX;
                        const dy = endY - startY;
                        const distance = Math.sqrt(dx*dx + dy*dy);
                        // A simple curve pushes the middle point perpendicularly by a fraction of the distance
                        const curvature = 0.2; 
                        const cx1 = startX + dx * 0.3 - dy * curvature;
                        const cy1 = startY + dy * 0.3 + dx * curvature;
                        const cx2 = startX + dx * 0.7 - dy * curvature;
                        const cy2 = startY + dy * 0.7 + dx * curvature;

                        const pathData = `M ${startX} ${startY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${endX} ${endY}`;

                        return (
                            <path
                                key={`${prereqId}-${video.id}`}
                                d={pathData}
                                fill="none"
                                stroke={isMet ? `url(#grad-${theme.id})` : "#1e1b4b"}
                                strokeWidth={isMet ? "10" : "5"}
                                strokeLinecap="round"
                                strokeDasharray={isMet ? "0" : "12,12"}
                                filter={isMet ? "url(#glow)" : "none"}
                                className={`transition-all duration-1000 ease-in-out cursor-pointer ${isMet ? 'opacity-80 hover:opacity-100' : 'opacity-40'}`}
                            />
                        );
                    });
                })}
            </svg>
        );
    };

    return (
        <div className="h-[100dvh] w-full bg-[#050505] text-slate-100 overflow-hidden flex flex-col relative font-sans">
            {/* Cosmic Background Layer */}
            <div className="fixed inset-0 z-0 pointer-events-none bg-black">
                {/* Custom space background if exists, otherwise fallback */}
                <div className="absolute inset-0 bg-[url('/space-bg.jpg')] bg-cover bg-top bg-no-repeat opacity-60 mix-blend-screen" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#1e1b4b_0%,#020617_100%)] opacity-40 mix-blend-multiply" />
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 animate-pulse" />
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[150px] animate-bounce-slow" />
            </div>

            {/* Immersive HUD - Floating fixed above everything */}
            <div className="fixed top-0 left-0 right-0 z-50 p-4 sm:p-8 pointer-events-none flex flex-col sm:flex-row justify-between items-start gap-4 h-32 bg-gradient-to-b from-black/60 to-transparent">
                <div className="pointer-events-auto bg-black/40 backdrop-blur-md border border-white/5 p-4 rounded-2xl shadow-2xl flex flex-col">
                    <h1 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-white to-slate-500 bg-clip-text text-transparent">THE 90-DAY CHALLENGE</h1>
                    <div className="flex items-center gap-4 mt-1">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{completedCount}/{videos.length} Skills Mastered</span>
                        </div>
                        <Progress value={progressPercentage} className="w-16 sm:w-24 h-1 bg-white/5" />
                    </div>
                </div>

                <div className="flex flex-row gap-2 pointer-events-auto items-center">
                    {user && (
                        <div className="bg-indigo-600/20 backdrop-blur-md border border-indigo-500/30 px-3 sm:px-5 py-2 rounded-full flex items-center gap-2 shadow-lg shadow-indigo-500/10 h-[42px]">
                             <Crown className="w-4 h-4 text-indigo-400" />
                             <span className="text-xs font-black text-indigo-300 tracking-wider whitespace-nowrap">{points} XP</span>
                        </div>
                    )}
                    <button 
                        onClick={() => navigate(user ? '/premium' : '/')}
                        className="bg-slate-900/60 hover:bg-slate-800/80 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full flex items-center gap-2 transition-colors h-[42px]"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        <span className="text-xs font-bold whitespace-nowrap hidden sm:inline">Exit Map</span>
                    </button>
                </div>
            </div>

            {/* Immersive Map Container — drag to pan, no scrollbars */}
            <div 
                className="flex-1 overflow-scroll relative select-none bg-grid-white/[0.02] cursor-grab active:cursor-grabbing [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
                ref={(el) => {
                    // Store the scroll container ref for drag-to-pan
                    if (el) (mapRef.current as any).__scrollContainer = el;
                }}
                onMouseDown={(e) => {
                    // Don't intercept clicks on buttons/links
                    if ((e.target as HTMLElement).closest('button, a, [role=button]')) return;
                    e.preventDefault();
                    const container = e.currentTarget;
                    const startX = e.clientX;
                    const startY = e.clientY;
                    const scrollLeft = container.scrollLeft;
                    const scrollTop = container.scrollTop;
                    container.style.cursor = 'grabbing';
                    
                    const onMove = (ev: MouseEvent) => {
                        container.scrollLeft = scrollLeft - (ev.clientX - startX);
                        container.scrollTop = scrollTop - (ev.clientY - startY);
                    };
                    const onUp = () => {
                        container.style.cursor = '';
                        document.removeEventListener('mousemove', onMove);
                        document.removeEventListener('mouseup', onUp);
                    };
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                }}
                onTouchStart={(e) => {
                    const container = e.currentTarget;
                    const touch = e.touches[0];
                    const startX = touch.clientX;
                    const startY = touch.clientY;
                    const scrollLeft = container.scrollLeft;
                    const scrollTop = container.scrollTop;
                    
                    const onMove = (ev: TouchEvent) => {
                        const t = ev.touches[0];
                        container.scrollLeft = scrollLeft - (t.clientX - startX);
                        container.scrollTop = scrollTop - (t.clientY - startY);
                    };
                    const onEnd = () => {
                        container.removeEventListener('touchmove', onMove);
                        container.removeEventListener('touchend', onEnd);
                    };
                    container.addEventListener('touchmove', onMove, { passive: true });
                    container.addEventListener('touchend', onEnd);
                }}
            >
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
                        const pos = nodePositions.get(video.id);
                        if (!pos) return null;

                        const isCompleted = progress.includes(video.id);
                        const isUnlocked = video.unlock_cost === 0 || unlockedCourseVideoIds.includes(video.id);
                        
                        const hasPrereqs = video.prerequisite_ids && video.prerequisite_ids.length > 0;
                        const prereqsMet = !hasPrereqs || video.prerequisite_ids.every(pid => progress.includes(pid));
                        
                        const isAvailable = (enrollmentStatus === 'verified' || !video.locked) && prereqsMet;
                        const isPlaying = activeVideo === video.id;
                        const canAfford = points >= (video.unlock_cost || 0);
                        const requiresPurchase = isAvailable && !isUnlocked && video.unlock_cost > 0;

                        const theme = getCategoryTheme(video);

                        return (
                            <div
                                key={video.id}
                                className="absolute flex flex-col items-center group"
                                style={{
                                    left: pos.x + 500,
                                    top: pos.y + 500,
                                    width: nodeSize
                                }}
                            >
                                {/* Hover Tooltip */}
                                <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/90 border border-white/20 rounded-xl p-3 min-w-[180px] max-w-[240px] text-center shadow-2xl backdrop-blur-sm">
                                    <p className={`text-white font-black text-sm uppercase tracking-wide leading-snug ${theme.text}`}>{video.title}</p>
                                    {video.description && <p className="text-slate-400 text-xs mt-1.5 leading-snug">{video.description}</p>}
                                    <p className="text-slate-500 text-[10px] mt-1.5 uppercase tracking-widest">
                                        {isCompleted ? '✓ Completed' : requiresPurchase ? `${video.unlock_cost} XP to unlock` : isAvailable ? 'Click to watch' : 'Locked'}
                                    </p>
                                </div>
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
                                    className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full flex flex-col items-center justify-center border-2 transition-all duration-700 relative shadow-2xl z-20 hover:scale-110 active:scale-95 group/node
                                        ${isPlaying ? `${theme.bg} border-white ${theme.glow}` : 
                                          isCompleted ? 'bg-emerald-500/20 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.4)]' :
                                          (isAvailable && isUnlocked) ? `bg-slate-800/80 ${theme.border} hover:border-white hover:${theme.glow}` : 
                                          requiresPurchase ? 'bg-amber-950/60 border-amber-500 hover:border-amber-300 shadow-[0_0_40px_rgba(245,158,11,0.3)] animate-pulse' :
                                          'bg-black/60 border-slate-700 opacity-50 cursor-not-allowed'
                                        }
                                    `}
                                >
                                    {isCompleted ? (
                                        <CheckCircle className="w-14 h-14 text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
                                    ) : requiresPurchase ? (
                                        <div className="flex flex-col items-center animate-pulse">
                                            <Lock className={`w-8 h-8 mb-1 ${canAfford ? 'text-amber-400' : 'text-slate-500'}`} />
                                            <span className={`text-[11px] font-black tracking-widest ${canAfford ? 'text-amber-400' : 'text-red-400/80'}`}>{video.unlock_cost} XP</span>
                                        </div>
                                    ) : (isAvailable && isUnlocked) ? (
                                        <>
                                            <PlayCircle className={`w-14 h-14 ${isPlaying ? 'text-white' : 'text-indigo-400 group-hover/node:text-white group-hover/node:drop-shadow-[0_0_15px_rgba(79,70,229,0.9)] transition-all animate-float'}`} />
                                            {/* Special Highlight for New Users (0 points, 0 progress) */}
                                            {points === 0 && progress.length === 0 && video.unlock_cost === 0 && (
                                                <div className="absolute inset-0 rounded-full border-4 border-indigo-400/50 animate-ping pointer-events-none"></div>
                                            )}
                                        </>
                                    ) : (
                                        <Lock className="w-10 h-10 text-slate-700" />
                                    )}

                                    {/* Pulse Effect for Unlocked nodes */}
                                    {isAvailable && isUnlocked && !isCompleted && (
                                        <div className="absolute inset-0 rounded-full border-indigo-500/30 animate-ping opacity-20 pointer-events-none" />
                                    )}
                                </button>
                                
                                <div className="text-center mt-5 w-[160px] z-10 px-2 flex flex-col items-center">
                                    <p className={`text-[12px] font-black uppercase tracking-widest leading-tight drop-shadow-xl transition-colors duration-300 ${isPlaying ? 'text-white' : isCompleted ? 'text-emerald-400' : isAvailable ? theme.text : 'text-slate-600'}`}>
                                        {video.title}
                                    </p>
                                </div>

                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Video Player Modal */}
            <Dialog open={isVideoModalOpen} onOpenChange={setIsVideoModalOpen}>
                <DialogContent className="max-w-6xl p-0 bg-black border-white/10 overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)]">
                    <DialogTitle className="sr-only">{currentVideoTitle}</DialogTitle>
                    <DialogDescription className="sr-only">{currentVideoDesc}</DialogDescription>
                    <div className="flex flex-col h-[90vh]">
                        <div className="aspect-video relative bg-slate-950 group">
                            {currentVideoUrl ? (
                                <iframe
                                    src={getEmbedUrl(currentVideoUrl, true)}
                                    title={currentVideoTitle}
                                    className="w-full h-full border-0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    onLoad={(e) => {
                                        // Attempting to catch video end if YouTube API is used 
                                        // (Note: Raw iframe cannot detect end without postMessage API,
                                        // so we rely on the user confirming mastery or passing ~2 mins minimum for an official mark).
                                        // In standard cases, you need YT Player API or BunnyPlayer API.
                                    }}
                                />
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                                    <PlayCircle className="w-16 h-16 text-indigo-400 mb-4 opacity-50" />
                                    <h2 className="text-2xl font-bold mb-2">Transmission Lost</h2>
                                    <p className="text-slate-500">No video data found for this skill node.</p>
                                </div>
                            )}
                        </div>
                        
                        <div className="overflow-auto p-8 bg-gradient-to-b from-[#0a0a0f] to-black border-t border-white/5">
                            <h2 className="text-3xl font-black tracking-tighter text-white mb-2">{currentVideoTitle}</h2>
                            {currentVideoDesc && <p className="text-slate-400 text-base leading-relaxed mb-6">{currentVideoDesc}</p>}

                            {/* Guest: PDF sign-up offer */}
                            {!user && (
                                <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                                    {!isEmailSubmitted ? (
                                        <>
                                            <h4 className="text-xl font-black text-amber-100 mb-1">Get the Free "Hitting Chord Tones" PDF</h4>
                                            <p className="text-slate-400 text-sm mb-4">Drop your email and we'll send you the full guide — plus a free month of access to the course.</p>
                                            <form onSubmit={handleEmailSubmit} className="flex gap-3">
                                                <input
                                                    type="email"
                                                    value={emailInput}
                                                    onChange={e => setEmailInput(e.target.value)}
                                                    placeholder="your@email.com"
                                                    required
                                                    className="flex-1 bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-amber-500/50"
                                                />
                                                <Button type="submit" disabled={isSubmittingEmail} className="bg-amber-500 hover:bg-amber-400 text-black font-black px-6 rounded-xl whitespace-nowrap">
                                                    {isSubmittingEmail ? 'Sending...' : 'Send Me the PDF'}
                                                </Button>
                                            </form>
                                        </>
                                    ) : (
                                        <div className="text-center py-2">
                                            <p className="text-amber-300 font-black text-lg mb-1">Check your inbox!</p>
                                            <p className="text-slate-400 text-sm">The PDF is on its way. You'll also get a link to access the full course free for 30 days.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Logged-in: Confirm Mastery */}
                            {user && isMainVideoActive && (
                                <Button
                                    variant={progress.includes(activeVideo || '') ? "outline" : "default"}
                                    size="lg"
                                    onClick={() => {
                                        if (activeVideo) {
                                            toggleProgress(activeVideo, progress.includes(activeVideo));
                                            handleVideoEnd();
                                        }
                                    }}
                                    className={`gap-3 text-base py-6 px-8 rounded-2xl transition-all duration-300 ${!progress.includes(activeVideo || '') ? 'bg-emerald-600 hover:bg-emerald-500 hover:scale-105 text-white shadow-xl shadow-emerald-600/20' : 'border-emerald-500/50 text-emerald-400'}`}
                                >
                                    {progress.includes(activeVideo || '') ? (
                                        <><CheckCircle className="w-5 h-5" /> Skill Mastered</>
                                    ) : (
                                        <><Circle className="w-5 h-5" /> Mark as Complete</>
                                    )}
                                </Button>
                            )}

                            {/* Question submission for logged-in users */}
                            {user && isMainVideoActive && (
                                <div className="mt-6 pt-6 border-t border-white/5">
                                    <p className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-3">Have a question about this lesson?</p>
                                    <div className="flex gap-3">
                                        <Textarea
                                            value={questionText}
                                            onChange={e => setQuestionText(e.target.value)}
                                            placeholder="Ask anything about this lesson..."
                                            className="flex-1 bg-white/5 border-white/10 text-sm resize-none h-16 rounded-xl"
                                        />
                                        <Button
                                            onClick={handleSubmitQuestion}
                                            disabled={isSubmittingQuestion || !questionText.trim()}
                                            size="sm"
                                            className="bg-indigo-600 hover:bg-indigo-500 self-end rounded-xl px-4"
                                        >
                                            <Send className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
