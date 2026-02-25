import { useEffect, useState, useRef } from "react";
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
import { SessionRecap } from "@/components/SessionRecap";
import { toast } from "sonner";
import { Loader2, Settings, Star } from "lucide-react";
import { SessionProvider, useSession } from "@/contexts/SessionContext";
import { SessionExecutor } from "@/components/SessionExecutor";
import { SessionWrapUp } from "@/components/SessionWrapUp";
import { MyRoutines } from "@/components/routines";
import { CoachChat } from "@/components/coach";
import { ProgressDashboard } from "@/components/ProgressDashboard";
import { useRoutines } from "@/hooks/useRoutines";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

// Updated Stripe Price ID ($29.99/mo)
const STRIPE_PRICE_ID = "price_1T3lcJEOnRZP4MxPepztrhp6";
// Course Purchase Price ID ($1.00 Test)
const STRIPE_COURSE_PRICE_ID = "price_1T4bIGEOnRZP4MxPYTo7dKJt";

/**
 * Inner component that consumes the SessionContext
 */
const PremiumContent = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Lift session state check to here
  const { activeSession, completedSession, clearCompletedSession, startSessionWithPlan } = useSession();
  const { getRoutine, recordPractice } = useRoutines();

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
  const [isBuyingCourse, setIsBuyingCourse] = useState(false);
  const [checkingPremium, setCheckingPremium] = useState(true);
  const [activeTab, setActiveTab] = useState("practice");
  const [prioritiesOpen, setPrioritiesOpen] = useState(false);

  // Track previous session state to detect completion
  const prevActiveSessionRef = useRef(activeSession);

  // Redirect to progress tab when wrapping up (handled by SessionWrapUp now)
  useEffect(() => {
    prevActiveSessionRef.current = activeSession;
  }, [activeSession]);

  // Handle starting a routine
  const handleStartRoutine = async (routineId: string) => {
    const routine = await getRoutine(routineId);
    if (routine && routine.session_plan && routine.session_plan.length > 0) {
      await recordPractice(routineId);
      // Start session with the routine's saved session plan
      await startSessionWithPlan(routine.name, routine.session_plan, routine.id);
      // The component will re-render to show SessionExecutor when activeSession is set
    }
  };

  // Handle starting a custom session directly from blocks
  const handleStartSession = async (blocks: any[], name?: string) => {
    if (blocks && blocks.length > 0) {
      await startSessionWithPlan(name || "Custom Practice", blocks);
    }
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
          setActiveTab("practice");
        } else {
          setActiveTab("practice");
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

  const handleBuyCourse = async () => {
    try {
      setIsBuyingCourse(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in to purchase the course");
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          priceId: STRIPE_COURSE_PRICE_ID,
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
      toast.error("Failed to start checkout: " + err.message);
    } finally {
      setIsBuyingCourse(false);
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
    // If active, show executor.
    return <SessionExecutor />;
  }

  // 1.5. Check for Completed Session
  if (completedSession) {
    return (
      <div className="bg-background min-h-screen p-4 flex flex-col pt-12">
        <SessionWrapUp
          sessionBlocks={completedSession.session.session_plan}
          recordings={[]}
          totalDurationMinutes={Math.round(completedSession.timeElapsed / 60)}
          onRestart={() => clearCompletedSession()}
          onNewSession={() => {
            clearCompletedSession();
            setActiveTab("practice");
          }}
        />
      </div>
    );
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
          {isPremium && <span className="text-xs bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold px-1.5 sm:px-2 py-0.5 rounded-full hidden lg:inline">PREMIUM</span>}
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {!isPremium && (
            <Button
              size="sm"
              variant="default"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0 text-xs sm:text-sm px-2 sm:px-3"
              onClick={handleSubscribe}
              disabled={isSubscribing || isBuyingCourse}
            >
              {isSubscribing && <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />}
              <span className="hidden sm:inline">Upgrade ($29.99/mo)</span>
              <span className="sm:hidden">Upgrade</span>
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="hidden lg:flex border-indigo-600 text-indigo-400 hover:bg-indigo-600/10 text-xs sm:text-sm px-2 sm:px-3"
            onClick={handleBuyCourse}
            disabled={isSubscribing || isBuyingCourse}
          >
            {isBuyingCourse && <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />}
            <Star className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Buy Course ($1.00 Test)</span>
            <span className="sm:hidden">Course</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPrioritiesOpen(true)}
            className="h-8 w-8"
            title="Learning Priorities"
          >
            <Settings className="h-4 w-4" />
          </Button>
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
              <TabsTrigger value="practice" className="text-xs sm:text-sm px-2 sm:px-4 whitespace-nowrap">🎸 Practice</TabsTrigger>
              <TabsTrigger value="library" className="text-xs sm:text-sm px-2 sm:px-4 whitespace-nowrap">🎯 Library</TabsTrigger>
              <TabsTrigger value="coach" className="text-xs sm:text-sm px-2 sm:px-4 whitespace-nowrap">🤖 Coach</TabsTrigger>
              <TabsTrigger value="progress" className="text-xs sm:text-sm px-2 sm:px-4 whitespace-nowrap">📊 Progress</TabsTrigger>
            </TabsList>
          </div>

          {/* Practice - Quick start or pick a routine */}
          <TabsContent value="practice" className="flex-1 min-h-0 overflow-y-auto data-[state=active]:block p-6 space-y-8">
            <div className="py-6 min-h-[50vh]">
              <MyRoutines
                onStartRoutine={handleStartRoutine}
                onStartSession={handleStartSession}
              />
            </div></TabsContent>

          {/* Library - Browse all exercises and modules */}
          <TabsContent value="library" className="flex-1 min-h-0 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
            <ModuleLibrary />
          </TabsContent>

          {/* Coach - AI chat interface */}
          <TabsContent value="coach" className="flex-1 min-h-0 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
            <CoachChat />
          </TabsContent>

          {/* Progress - Analytics, history, recaps */}
          <TabsContent value="progress" className="flex-1 min-h-0 overflow-y-auto data-[state=active]:block p-6">
            <ProgressDashboard />
          </TabsContent>
        </Tabs>
      </div>

      {/* Priorities Settings Sheet */}
      <Sheet open={prioritiesOpen} onOpenChange={setPrioritiesOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Learning Priorities</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <PriorityManager onStart={() => {
              setPrioritiesOpen(false);
              setActiveTab("practice");
            }} />
          </div>
        </SheetContent>
      </Sheet>
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
