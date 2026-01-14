import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import RiffPractice from "@/components/RiffPractice";
import { RepertoireItem } from "@/types/repertoire";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import Paywall from "@/components/Premium/Paywall";
import { ModuleLibrary } from "@/components/ModuleLibrary";
import { PriorityManager } from "@/components/PriorityManager";
import { PressStart } from "@/components/PressStart";
import { ProgressDashboard } from "@/components/ProgressDashboard";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { SessionProvider, useSession } from "@/contexts/SessionContext";
import { SessionExecutor } from "@/components/SessionExecutor";
import { SessionWrapUp } from "@/components/SessionWrapUp";

// Updated Stripe Price ID
const STRIPE_PRICE_ID = "price_1SknWkEOnRZP4MxPtX889sCh";

/**
 * Inner component that consumes the SessionContext
 */
const PremiumContent = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Lift session state check to here
  const { activeSession, completeSession } = useSession();

  const [selectedRiff, setSelectedRiff] = useState<RepertoireItem | null>(null);
  const [exercises, setExercises] = useState<RepertoireItem[]>([]);
  const [sequences, setSequences] = useState<Tables<"sequences">[]>([]);
  // Note: Lessons system removed - now using SessionBuilder for custom routines
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const exerciseId = searchParams.get("exerciseId");
  const [isPremium, setIsPremium] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [checkingPremium, setCheckingPremium] = useState(true);
  const [activeTab, setActiveTab] = useState("priorities");

  // Handle Session Completion
  const handleSessionComplete = async () => {
    // This function can handle any post-session wrap up logic if needed
    // But mostly it's handled by SessionWrapUp component which calls completeSession(false) eventually?
    // Actually SessionExecutor calls nextBlock/complete. 
    // If activeSession is done, we might want to show wrap up.
    // The SessionContext handles 'activeSession' state. 
    // If session is complete, it might be null or marked complete.
    // Let's rely on the context to clear activeSession when done.
    completeSession();
  };

  useEffect(() => {
    if (searchParams.get("success")) {
      toast.success("Subscription successful! Welcome to Guitar Brain Premium.");
    }
    if (searchParams.get("canceled")) {
      toast.error("Subscription canceled.");
    }
  }, [searchParams]);

  useEffect(() => {
    if (exerciseId) {
      const exercise = exercises.find((e) => e.id === exerciseId);
      if (exercise) {
        setSelectedRiff(exercise);
        document.body.classList.add("overflow-hidden");
      }
    } else {
      setSelectedRiff(null);
      document.body.classList.remove("overflow-hidden");
    }

    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [exerciseId, exercises]);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      setCheckingPremium(true);

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('premium_until')
          .eq('id', user.id)
          .single();

        if ((profile as any)?.premium_until) {
          const expiryDate = new Date((profile as any).premium_until);
          if (expiryDate > new Date()) {
            setIsPremium(true);
          }
        }

        const { data: sessionsData } = await supabase
          .from('practice_sessions' as any)
          .select('id')
          .eq('user_id', user.id)
          .not('started_at', 'is', null)
          .limit(1);

        if (sessionsData && sessionsData.length > 0) {
          setActiveTab("start");
        } else {
          setActiveTab("priorities");
        }
      }
      setCheckingPremium(false);

      const { data: scalesData, error: scalesError } = await supabase
        .from("scales")
        .select("*");

      if (!isMounted) return;

      if (scalesError) {
        setError(scalesError.message);
        setExercises([]);
        setLoading(false);
        return;
      }

      const mapped: RepertoireItem[] = (scalesData ?? []).map((row: Tables<'scales'> & { Type: string }) => ({
        id: row.id,
        name: row.name,
        category: row.Type === 'arpeggio' ? 'arpeggio' : 'scale',
        difficulty: row.difficulty,
        description: undefined,
        notes: (row.notes_json as unknown as RepertoireItem['notes']) ?? [],
        notes_per_beat: 4,
        tonic: row.root_note,
        tonality: row.tonality,
        position: row.Position,
        parent: undefined,
        major_key: row.major_key,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Type: (row as any).Type,
      }));

      setExercises(mapped);

      const { data: sequencesData, error: sequencesError } = await supabase
        .from("sequences")
        .select("*");

      if (sequencesError) {
        setError(sequencesError.message);
        setSequences([]);
      } else {
        setSequences(sequencesData as Tables<"sequences">[]);
      }

      // Lessons fetch removed - using SessionBuilder for custom routines now

      setError(null);
      setLoading(false);
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const handleSubscribe = async () => {
    try {
      setIsSubscribing(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in to subscribe");
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          priceId: STRIPE_PRICE_ID,
        }
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }

    } catch (err: any) {
      console.error("Subscription error:", err);
      toast.error("Failed to start subscription: " + err.message);
    } finally {
      setIsSubscribing(false);
    }
  }

  const handleExerciseSelect = async (item: RepertoireItem) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('practice_log')
      .insert({
        user_id: user.id,
        scale_id: item.category === 'scale' || item.category === 'arpeggio' ? item.id : null,
        duration: 0,
      });

    if (error) {
      console.error("Error creating practice log:", error);
    }

    setSearchParams({ exerciseId: item.id });
  };

  // Lesson handlers removed - using SessionBuilder for custom routines

  if (loading || checkingPremium) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!user || (!isPremium && user)) {
    return <Paywall onSubscribe={user ? handleSubscribe : undefined} isLoading={isSubscribing} />;
  }

  // 1. Check for Active Session
  if (activeSession) {
    // If session is complete (but still in state?) - SessionWrapUp might be better handled by Executor return value or state
    // But let's assume activeSession remains true until explicit close.
    // If we need a WrapUp screen, the Executor probably handles it or we have a flag.
    // For now, if active, show executor.
    return <SessionExecutor />;
  }

  // 2. Check active Riff
  if (selectedRiff) {
    return (
      <div className="bg-background p-4 bpm-control-area">
        <div className="space-y-6">
          <RiffPractice
            repertoireItem={selectedRiff}
            sequences={sequences}
            onComplete={() => setSearchParams({})}
            onExerciseSelect={(exercise) => setSearchParams({ exerciseId: exercise.id })}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden">
      <div className="flex-shrink-0 border-b bg-card px-2 sm:px-4 py-1 sm:py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.href = '/'}
            className="gap-1 sm:gap-2 px-2 sm:px-3"
          >
            <span className="hidden sm:inline">←</span> Back
          </Button>
          <h2 className="font-semibold text-sm sm:text-base truncate">Guitar Brain</h2>
          {isPremium && <span className="text-xs bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold px-1.5 sm:px-2 py-0.5 rounded-full hidden sm:inline">PREMIUM</span>}
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {!isPremium && (
            <Button
              size="sm"
              variant="default"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0 text-xs sm:text-sm px-2 sm:px-3"
              onClick={handleSubscribe}
              disabled={isSubscribing}
            >
              {isSubscribing && <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />}
              <span className="hidden sm:inline">Upgrade ($9.99/mo)</span>
              <span className="sm:hidden">Upgrade</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.href = '/profile'}
            className="px-2 sm:px-3"
          >
            <span className="hidden sm:inline">Profile</span>
            <span className="sm:hidden">👤</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-2 sm:p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="overflow-x-auto flex-shrink-0 mb-2 sm:mb-4 -mx-2 px-2">
            <TabsList className="inline-flex w-auto min-w-full sm:grid sm:grid-cols-4 gap-1">
              <TabsTrigger value="start" className="text-xs sm:text-sm px-2 sm:px-4 whitespace-nowrap">🚀 Start</TabsTrigger>
              <TabsTrigger value="priorities" className="text-xs sm:text-sm px-2 sm:px-4 whitespace-nowrap">⚙️ Priorities</TabsTrigger>
              <TabsTrigger value="progress" className="text-xs sm:text-sm px-2 sm:px-4 whitespace-nowrap">📊 Progress</TabsTrigger>
              <TabsTrigger value="modules" className="text-xs sm:text-sm px-2 sm:px-4 whitespace-nowrap">🎯 Modules</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="start" className="flex-1 min-h-0 overflow-y-auto data-[state=active]:block p-6">
            <PressStart />
          </TabsContent>

          <TabsContent value="priorities" className="flex-1 min-h-0 overflow-y-auto data-[state=active]:block p-6">
            <PriorityManager onStart={() => setActiveTab("start")} />
          </TabsContent>

          <TabsContent value="progress" className="flex-1 min-h-0 overflow-y-auto data-[state=active]:block p-6">
            <ProgressDashboard />
          </TabsContent>

          <TabsContent value="modules" className="flex-1 min-h-0 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
            <ModuleLibrary />
          </TabsContent>

          {/* Lessons tab removed - using SessionBuilder in Modules tab for custom routines */}
        </Tabs>
      </div>
    </div>
  );
};

// Main Export
const Premium = () => {
  return (
    <SessionProvider>
      <PremiumContent />
    </SessionProvider>
  );
}

export default Premium;
