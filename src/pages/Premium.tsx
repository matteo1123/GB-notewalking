import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import RiffPractice from "@/components/RiffPractice";
import ExerciseList from "@/components/ExerciseList";
import { RepertoireItem } from "@/types/repertoire";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import Paywall from "@/components/Premium/Paywall";
import { ChordProgressionExercise } from "@/components/ChordProgressionExercise";
import { RhythmTraining } from "@/components/RhythmTraining";
import { ModuleLibrary } from "@/components/ModuleLibrary";
import { PriorityManager } from "@/components/PriorityManager";
import { PressStart } from "@/components/PressStart";
import { ProgressDashboard } from "@/components/ProgressDashboard";

const Premium = () => {
  const { user } = useAuth();
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

  if (!user) {
    return <Paywall />;
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
          <h2 className="font-semibold">TempoTrekker</h2>
        </div>
        <div className="flex items-center gap-2">
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
        <Tabs defaultValue="start" className="flex-1 flex flex-col min-h-0 overflow-hidden">
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
            <PriorityManager />
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
