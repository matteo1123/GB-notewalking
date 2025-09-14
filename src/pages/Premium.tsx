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
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Content */}
        <Tabs defaultValue="sessions" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="sessions">Lessons</TabsTrigger>
            <TabsTrigger value="rhythms">Rhythms</TabsTrigger>
            <TabsTrigger value="scales">Scales</TabsTrigger>
            <TabsTrigger value="arpeggios">Arpeggios</TabsTrigger>
            <TabsTrigger value="ear-training">Ear Training</TabsTrigger>
          </TabsList>

          <TabsContent value="rhythms" className="space-y-4">
            <ExerciseList
              items={exercises.filter((e) => e.category === "rhythm")}
              defaultSort={{ key: "difficulty", dir: "asc" }}
              onSelect={handleExerciseSelect}
            />
          </TabsContent>

          <TabsContent value="scales" className="space-y-4">
            <ExerciseList
              items={exercises.filter((e) => e.category === "scale")}
              defaultSort={{ key: "position", dir: "asc" }}
              onSelect={handleExerciseSelect}
            />
          </TabsContent>

          <TabsContent value="arpeggios" className="space-y-4">
            <ExerciseList
              items={exercises.filter((e) => e.category === "arpeggio")}
              defaultSort={{ key: "difficulty", dir: "asc" }}
              onSelect={handleExerciseSelect}
            />
          </TabsContent>

          <TabsContent value="ear-training" className="space-y-4">
            <ExerciseList
              items={exercises.filter((e) => e.category === "ear-training")}
              defaultSort={{ key: "difficulty", dir: "asc" }}
              onSelect={handleExerciseSelect}
            />
          </TabsContent>

          <TabsContent value="sessions" className="space-y-4">
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
