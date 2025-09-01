import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RiffPractice from "@/components/RiffPractice";
import ExerciseList from "@/components/ExerciseList";
import { RepertoireItem } from "@/types/repertoire";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import Paywall from "@/components/Premium/Paywall";

const Premium = () => {
  const { user } = useAuth();
  const [selectedRiff, setSelectedRiff] = useState<RepertoireItem | null>(null);
  const [exercises, setExercises] = useState<RepertoireItem[]>([]);
  const [sequences, setSequences] = useState<Tables<"sequences">[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.state?.reset) {
      setSelectedRiff(null);
      // Clear the state to prevent re-triggering
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, navigate, location.pathname]);

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
        tonic: row.tonic,
        tonality: row.tonality,
        position: row.position,
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

      setError(null);
      setLoading(false);
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  if (!user) {
    return <Paywall />;
  }

  if (selectedRiff) {
    return (
      <div className="min-h-screen bg-background p-4 bpm-control-area">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Riff Practice */}
          <RiffPractice
            repertoireItem={selectedRiff}
            sequences={sequences}
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
