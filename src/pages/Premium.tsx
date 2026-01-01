import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import RiffPractice from "@/components/RiffPractice";
import ExerciseList from "@/components/ExerciseList";
import { RepertoireItem } from "@/types/repertoire";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import Paywall from "@/components/Premium/Paywall";
import { ChordProgressionExercise } from "@/components/ChordProgressionExercise";
import { RhythmTraining } from "@/components/RhythmTraining";
import { ModuleLibrary } from "@/components/ModuleLibrary";
import { PriorityManager } from "@/components/PriorityManager";
import { PressStart } from "@/components/PressStart";
import { ProgressDashboard } from "@/components/ProgressDashboard";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

// Updated Stripe Price ID
const STRIPE_PRICE_ID = "price_1SknWkEOnRZP4MxPtX889sCh";

const Premium = () => {
  const { user } = useAuth();
  const navigate = useNavigate(); // Hook
  const [selectedRiff, setSelectedRiff] = useState<RepertoireItem | null>(null);
  const [exercises, setExercises] = useState<RepertoireItem[]>([]);
  const [sequences, setSequences] = useState<Tables<"sequences">[]>([]);
  const [lessons, setLessons] = useState<Tables<"lessons">[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Tables<"lessons"> | null>(null);
  const [lessonExercises, setLessonExercises] = useState<Tables<"lesson_exercises">[]>([]);
  const [selectedLessonExercise, setSelectedLessonExercise] = useState<Tables<"lesson_exercises"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const exerciseId = searchParams.get("exerciseId");
  const [isPremium, setIsPremium] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [checkingPremium, setCheckingPremium] = useState(true); // New loading state for premium check specifically
  const [activeTab, setActiveTab] = useState("priorities");

  useEffect(() => {
    // Check for success/canceled params from Stripe
    if (searchParams.get("success")) {
      toast.success("Subscription successful! Welcome to Guitar Brain Premium.");
      // optionally refresh profile here
    }
    if (searchParams.get("canceled")) {
      toast.error("Subscription canceled.");
    }
  }, [searchParams]);

  useEffect(() => {
    // If not logged in, Paywall component handles it (or we can redirect)
    // User said: "send someone back to the homepage if they aren't premium and signed in"
    // Paywall covers !user case generally, but let's see. logic below covers user && !premium.
  }, []);

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

      // Check premium status
      if (user) {
        console.log('[Premium] Checking premium for user:', user.id);
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('premium_until') // Changed from is_premium
          .eq('id', user.id)
          .single();

        console.log('[Premium] Profile query result:', { profile, error: profileError });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((profile as any)?.premium_until) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const expiryDate = new Date((profile as any).premium_until);
          console.log('[Premium] Expiry date:', expiryDate, 'Now:', new Date(), 'Is future?', expiryDate > new Date());
          // Check if future
          if (expiryDate > new Date()) {
            setIsPremium(true);
          }
        } else {
          console.log('[Premium] No premium_until found or profile is null');
        }

        // Check for recent sessions to determine initial tab
        const { data: sessionsData } = await supabase
          .from('practice_sessions' as any)
          .select('id')
          .eq('user_id', user.id)
          .not('started_at', 'is', null)
          .limit(1);

        // If user has sessions, show Start tab; otherwise show Priorities
        if (sessionsData && sessionsData.length > 0) {
          setActiveTab("start");
        } else {
          setActiveTab("priorities");
        }
      } else {
        console.log('[Premium] No user, skipping premium check');
      }
      setCheckingPremium(false); // Done checking

      // Note: We might not want to fetch if not premium to save bandwidth? 
      // User said they should be redirected.

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

      const { data: lessonsData, error: lessonsError } = await supabase
        .from("lessons")
        .select("*");

      if (lessonsError) {
        setError(lessonsError.message);
        setLessons([]);
      } else {
        setLessons(lessonsData as Tables<"lessons">[]);
      }

      setError(null);
      setLoading(false);
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  // Redirect effect - REMOVED so users can see the Paywall/Upgrade button
  // useEffect(() => {
  //   if (!checkingPremium && user && !isPremium) {
  //     toast.error("Premium subscription expired or invalid.");
  //     navigate("/");
  //   }
  // }, [checkingPremium, user, isPremium, navigate]);

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
        duration: 0, // Default duration
      });

    if (error) {
      console.error("Error creating practice log:", error);
    }

    setSearchParams({ exerciseId: item.id });
  };

  const handleLessonSelect = async (lesson: Tables<"lessons">) => {
    const { data, error } = await supabase
      .from('lesson_exercises')
      .select('*')
      .eq('lesson_id', lesson.id);

    if (error) {
      console.error("Error fetching lesson exercises:", error);
      return;
    }

    setSelectedLesson(lesson);
    setLessonExercises(data as Tables<"lesson_exercises">[]);
  };

  const handleBackToLessons = () => {
    setSelectedLesson(null);
    setLessonExercises([]);
    setSelectedLessonExercise(null);
  };

  // Determine what to render based on premium status
  if (loading || checkingPremium) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  // If not logged in, OR (logged in but Not Premium), show paywall
  // We pass handleSubscribe ONLY if user is logged in
  if (!user || (!isPremium && user)) {
    return <Paywall onSubscribe={user ? handleSubscribe : undefined} isLoading={isSubscribing} />;
  }

  if (selectedRiff) {
    return (
      <div className="bg-background p-4 bpm-control-area">
        <div className="space-y-6">
          {selectedLessonExercise?.description && (
            <div
              className="prose dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: selectedLessonExercise.description }}
            />
          )}
          {/* Riff Practice */}
          <RiffPractice
            repertoireItem={selectedRiff}
            sequences={sequences}
            onComplete={() => setSearchParams({})}
            onExerciseSelect={(exercise) => setSearchParams({ exerciseId: exercise.id })}
            lessonExercise={selectedLessonExercise}
            timeLimit={selectedLessonExercise?.time}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden">
      {/* Fixed Header with Back Button */}
      <div className="flex-shrink-0 border-b bg-card px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.href = '/'}
            className="gap-2"
          >
            ← Back
          </Button>
          <h2 className="font-semibold">Guitar Brain</h2>
          {isPremium && <span className="text-xs bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold px-2 py-0.5 rounded-full">PREMIUM</span>}
        </div>
        <div className="flex items-center gap-2">
          {!isPremium && (
            <Button
              size="sm"
              variant="default"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0"
              onClick={handleSubscribe}
              disabled={isSubscribing}
            >
              {isSubscribing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Upgrade ($9.99/mo)
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.href = '/profile'}
          >
            Profile
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-4">
        {/* Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList className="grid w-full grid-cols-5 flex-shrink-0 mb-4">
            <TabsTrigger value="start">🚀 Start</TabsTrigger>
            <TabsTrigger value="priorities">⚙️ Priorities</TabsTrigger>
            <TabsTrigger value="progress">📊 Progress</TabsTrigger>
            <TabsTrigger value="modules">🎯 Modules</TabsTrigger>
            <TabsTrigger value="sessions">📚 Lessons</TabsTrigger>
          </TabsList>

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

          <TabsContent value="sessions" className="flex-1 min-h-0 overflow-y-auto data-[state=active]:block">
            {selectedLesson ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Button variant="outline" onClick={handleBackToLessons}>
                    Back to Lessons
                  </Button>
                  <h3 className="text-xl font-semibold">{selectedLesson.name}</h3>
                </div>
                <div className="grid gap-4">
                  {lessonExercises.map((le) => {
                    const exercise = exercises.find((e) => e.id === le.scale_id);
                    if (!exercise) return null;
                    return (
                      <Button
                        key={le.id}
                        variant="outline"
                        className="justify-start"
                        onClick={() => {
                          setSelectedLessonExercise(le);
                          handleExerciseSelect(exercise);
                        }}
                      >
                        {exercise.name} - {exercise.category}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                {lessons.map((lesson) => (
                  <Button
                    key={lesson.id}
                    variant="outline"
                    className="justify-start"
                    onClick={() => handleLessonSelect(lesson)}
                  >
                    {lesson.name}
                  </Button>
                ))}
                {lessons.length === 0 && (
                  <div className="text-center py-12">
                    <h3 className="text-xl font-semibold mb-4">
                      No Lessons Yet
                    </h3>
                    <p className="text-muted-foreground">
                      Create lessons in the Admin section to get started.
                    </p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Premium;
