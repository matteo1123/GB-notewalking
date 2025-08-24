import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RiffPractice from "@/components/RiffPractice";
import ExerciseList from "@/components/ExerciseList";
import { MetronomeScreen } from "@/components/MetronomeScreen";
import { RepertoireItem } from "@/types/repertoire";
import { useAuth } from "@/contexts/AuthContext";
import { Music, Star, Zap, Home, Crown, LogIn } from "lucide-react";
import { Link } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";


const Premium = () => {
  const { user } = useAuth();
  const [selectedRiff, setSelectedRiff] = useState<RepertoireItem | null>(null);
  const [exercises, setExercises] = useState<RepertoireItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadExercises() {
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

      const mapped: RepertoireItem[] = (scalesData ?? []).map((row: Tables<'scales'>) => ({
        id: row.id,
        name: row.name,
        category: 'scale',
        difficulty: row.difficulty,
        description: undefined,
        notes: (row.notes_json as unknown as RepertoireItem['notes']) ?? [],
        notes_per_beat: 4,
        tonic: row.tonic,
        tonality: row.tonality,
        position: row.position,
        parent: undefined,
      }));

      setExercises(mapped);
      setError(null);
      setLoading(false);
    }
    loadExercises();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  if (!user) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Paywall */}
          <div className="text-center space-y-6">
            <div className="space-y-4">
              <h2 className="text-4xl font-bold text-foreground">
                Unlock Advanced Practice Tools
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Take your guitar practice to the next level with
                repertoire-based training, visual tablature, and structured
                practice sessions.
              </p>
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-12">
              <Card className="text-center">
                <CardHeader>
                  <Music className="h-12 w-12 text-primary mx-auto mb-4" />
                  <CardTitle>Repertoire Library</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Access hundreds of scales, arpeggios, riffs, and exercises
                    with visual tablature display.
                  </p>
                </CardContent>
              </Card>

              <Card className="text-center">
                <CardHeader>
                  <Zap className="h-12 w-12 text-primary mx-auto mb-4" />
                  <CardTitle>Smart Practice Sessions</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Structured routines that automatically guide you through
                    exercises for maximum practice efficiency.
                  </p>
                </CardContent>
              </Card>

              <Card className="text-center">
                <CardHeader>
                  <Star className="h-12 w-12 text-primary mx-auto mb-4" />
                  <CardTitle>Progress Tracking</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Track your improvement across different techniques and
                    difficulty levels over time.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* CTA */}
            <div className="space-y-4">
              <Link to="/auth">
                <Button
                  size="lg"
                  className="text-lg px-8 py-6 flex items-center gap-2"
                >
                  <LogIn className="h-5 w-5" />
                  Sign In to Access Premium Features
                </Button>
              </Link>
              <p className="text-sm text-muted-foreground">
                Create an account to access premium guitar training tools
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (selectedRiff) {
    return (
      <div className="min-h-screen bg-background p-4 bpm-control-area">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Riff Practice */}
          <RiffPractice
            repertoireItem={selectedRiff}
            onComplete={() => setSelectedRiff(null)}
            onExerciseSelect={(exercise) => setSelectedRiff(exercise)}
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="sessions">Lessons</TabsTrigger>
            <TabsTrigger value="rhythms">Rhythms</TabsTrigger>
            <TabsTrigger value="scales">Scales</TabsTrigger>
            <TabsTrigger value="arpeggios">Arpeggios</TabsTrigger>
          </TabsList>

          <TabsContent value="rhythms" className="space-y-4">
            <ExerciseList
              items={exercises.filter((e) => e.category === "rhythm")}
              defaultSort={{ key: "difficulty", dir: "asc" }}
              onSelect={(item) => setSelectedRiff(item)}
            />
          </TabsContent>

          <TabsContent value="scales" className="space-y-4">
            <ExerciseList
              items={exercises.filter((e) => e.category === "scale")}
              defaultSort={{ key: "position", dir: "asc" }}
              onSelect={(item) => setSelectedRiff(item)}
            />
          </TabsContent>

          <TabsContent value="arpeggios" className="space-y-4">
            <ExerciseList
              items={exercises.filter((e) => e.category === "arpeggio")}
              defaultSort={{ key: "difficulty", dir: "asc" }}
              onSelect={(item) => setSelectedRiff(item)}
            />
          </TabsContent>

          <TabsContent value="sessions" className="space-y-4">
            <div className="text-center py-12">
              <h3 className="text-xl font-semibold mb-4">
                Lessons Coming Soon
              </h3>
              <p className="text-muted-foreground">
                Structured practice routines that automatically guide you
                through multiple exercises.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Premium;
