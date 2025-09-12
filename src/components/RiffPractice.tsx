import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { RepertoireItem } from "@/types/repertoire";
import { useMetronome, MetronomeSettings } from "@/hooks/useMetronome";
import { useBpmControls } from "@/hooks/useBpmControls";
import NoteDisplay from "./NoteDisplay";
import { BeatVisualizer } from "./BeatVisualizer";
import { MetronomeControls, MetronomeMode } from "./MetronomeControls";
import ExerciseHierarchy from "./ExerciseHierarchy";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Play, Pause, Square, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { PostgrestError } from "@supabase/supabase-js";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
// Defaults to quarter notes (1 step per beat) when subdivision is missing
// Accepts legacy notes with 'duration' in seconds; otherwise duration = 1 step

import { Note } from "@/types/repertoire";
import { applySequenceToScale } from "@/lib/sequenceUtils";
import { Scale } from "@/types/scales";

type AnyNote = Note & {
  subdivision?: number;
  highlightEvery?: number;
  highlightOffset?: number;
};

interface RiffPracticeProps {
  repertoireItem: RepertoireItem;
  sequences: Tables<"sequences">[];
  onComplete?: () => void;
  onExerciseSelect?: (exercise: RepertoireItem) => void;
  autoAdvance?: boolean;
  timeLimit?: number; // Time in seconds
  isControlledSession?: boolean; // If true, parent controls the session
  lessonExercise?: Tables<"lesson_exercises"> | null; // For lesson-specific settings
}

const RiffPractice = ({
  repertoireItem,
  sequences,
  onComplete,
  onExerciseSelect,
  autoAdvance = false,
  timeLimit,
  isControlledSession = false,
  lessonExercise,
}: RiffPracticeProps) => {
  const { user } = useAuth();
  const [noteIndex, setNoteIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState<MetronomeMode>(lessonExercise?.metronome_mode as MetronomeMode || "regular");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [metronomeBpm, setMetronomeBpm] = useState(lessonExercise?.starting_bpm || 80);
  const [pitchDetectionEnabled, setPitchDetectionEnabled] = useState(true);
  const [activeSequence, setActiveSequence] = useState<Tables<"sequences"> | null>(null);
  const [practiceLog, setPracticeLog] = useState<Tables<'practice_log'> | null>(null);
  const [maxBpm, setMaxBpm] = useState<number | ''>('');
  const [perfectBpm, setPerfectBpm] = useState<number | ''>('');

  const availableSequences = useMemo(() => {
    const itemType = repertoireItem.Type;
    return sequences.filter((s) => s.Type === itemType);
  }, [sequences, repertoireItem]);

  useEffect(() => {
    if (availableSequences.length > 0) {
      setActiveSequence(availableSequences[0]);
    } else {
      setActiveSequence(null);
    }
  }, [availableSequences]);

  useEffect(() => {
    const fetchPracticeLog = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('practice_log')
        .select('*')
        .eq('user_id', user.id)
        .eq('scale_id', repertoireItem.id)
        .single();

      if (data) {
        setPracticeLog(data);
        setMaxBpm(data.max_bpm || '');
        setPerfectBpm(data.perfect_bpm || '');
      }
    };

    fetchPracticeLog();
  }, [repertoireItem.id, user]);

  const handleSavePractice = async () => {
    if (!practiceLog) return;

    const { error } = await supabase
      .from('practice_log')
      .update({
        max_bpm: maxBpm === '' ? null : maxBpm,
        perfect_bpm: perfectBpm === '' ? null : perfectBpm,
      })
      .eq('id', practiceLog.id);

    if (error) {
      console.error("Error saving practice log:", error);
    } else {
      if (lessonExercise) {
        const maxBpmNum = typeof maxBpm === 'number' ? maxBpm : parseInt(maxBpm as string, 10) || 0;
        const perfectBpmNum = typeof perfectBpm === 'number' ? perfectBpm : parseInt(perfectBpm as string, 10) || 0;
        const targetMet = ((lessonExercise.target_type === 'max' || lessonExercise.target_type === 'both') && maxBpmNum >= lessonExercise.target_bpm) ||
                          ((lessonExercise.target_type === 'perfect' || lessonExercise.target_type === 'both') && perfectBpmNum >= lessonExercise.target_bpm);
        if (targetMet) {
          console.log("Target achieved!");
          // Could add toast or update lesson_exercise status
        }
      }
    }
  };

  const metronomeSettings: MetronomeSettings = {
    mode,
    startBpm: lessonExercise?.starting_bpm || metronomeBpm,
    endBpm: lessonExercise?.target_bpm || metronomeBpm,
    measures: lessonExercise ? (lessonExercise.increments || 1) * (lessonExercise.measures_per_bpm || 4) : 8,
    measuresPerBpmChange: lessonExercise?.measures_per_bpm || 4,
  };

  const metronome = useMetronome({
    ...metronomeSettings,
    onTick: () => {
      if (isPlaying) {
        setNoteIndex((prevIndex) => prevIndex + 1);
      }
    },
  });

  // BPM control functionality
  const handleMetronomeBpmChange = useCallback(
    (bpm: number) => {
      const wasPlaying = metronome.state.isPlaying;
      setMetronomeBpm(bpm);
      if (mode !== "regular" && wasPlaying) {
        metronome.stop();
        setTimeout(() => metronome.start(), 100);
      }
    },
    [metronome, mode]
  );

  // Global BPM adjustment controls (anywhere on page)
  useBpmControls({
    currentBpm: metronomeBpm,
    onBpmChange: handleMetronomeBpmChange,
    isEnabled: true,
  });


  const handleStop = useCallback(() => {
    metronome.stop();
    setIsPlaying(false);
    setNoteIndex(0);
    setElapsedTime(0);
    setStartTime(null);
  }, [metronome]);

  const handleComplete = useCallback(() => {
    handleStop();
    onComplete?.();
  }, [handleStop, onComplete]);


  const handlePlay = useCallback(() => {
    if (!metronome.state.isPlaying) {
      metronome.start();
    } else {
      metronome.pause();
    }
    setIsPlaying(!metronome.state.isPlaying);
  }, [metronome]);

  const displayNotes = useMemo(() => {
    if (!activeSequence) {
      return repertoireItem.notes.map((note, index) => ({
        ...note,
        time: index,
        duration: 1,
      }));
    }

    const scale: Scale = {
      id: repertoireItem.id,
      name: repertoireItem.name,
      notes_json: repertoireItem.notes,
      Type: repertoireItem.Type || '',
    };

    return applySequenceToScale(
      scale,
      activeSequence.pattern_string,
      activeSequence.note_value,
      activeSequence.is_triplet
    );
  }, [activeSequence, repertoireItem]);

  const currentTime = useMemo(() => {
    if (noteIndex >= displayNotes.length) {
      return 0;
    }
    return displayNotes[noteIndex].time;
  }, [noteIndex, displayNotes]);
  const highlightDirectives = useMemo(() => {
    let highlightEvery: number | undefined;
    let highlightOffset: number | undefined;
    for (const n of repertoireItem.notes as unknown as AnyNote[]) {
      const he = n.highlightEvery;
      const ho = n.highlightOffset;
      if (typeof he === "number" && he > 0) highlightEvery = he;
      if (typeof ho === "number") highlightOffset = ho;
      if (highlightEvery !== undefined && highlightOffset !== undefined) break;
    }
    return { highlightEvery, highlightOffset };
  }, [repertoireItem.notes]);
  const maxNoteTime =
    displayNotes.length > 0
      ? Math.max(...displayNotes.map((note) => note.time + note.duration))
      : 0;
  const progress =
    displayNotes.length > 0 ? (noteIndex / displayNotes.length) * 100 : 0;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-card border-b border-border p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold">{repertoireItem.name}</h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 bg-secondary rounded-full text-secondary-foreground">
                {repertoireItem.category}
              </span>
              <span className="px-2 py-0.5 bg-secondary rounded-full text-secondary-foreground">
                {repertoireItem.difficulty}/10
              </span>
            </div>
          </div>
          {onExerciseSelect && (
            <ExerciseHierarchy
              currentExercise={repertoireItem}
              onExerciseSelect={onExerciseSelect}
            />
          )}
        </div>
      </header>

      {/* Controls */}
      <div className="flex-shrink-0 bg-card border-b border-border p-2">
        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="max-bpm" className="text-xs">Max BPM</Label>
            <Input
              id="max-bpm"
              type="number"
              value={maxBpm}
              onChange={(e) => setMaxBpm(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              className="w-20 h-8 text-center"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="perfect-bpm" className="text-xs">Perfect BPM</Label>
            <Input
              id="perfect-bpm"
              type="number"
              value={perfectBpm}
              onChange={(e) => setPerfectBpm(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              className="w-20 h-8 text-center"
            />
          </div>
          <Button onClick={handleSavePractice} size="sm">Save</Button>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {availableSequences.map((sequence) => (
              <Button
                key={sequence.id}
                onClick={() => setActiveSequence(sequence)}
                variant={activeSequence?.id === sequence.id ? 'secondary' : 'outline'}
                size="sm"
              >
                {sequence.name}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-grow flex flex-col gap-4 p-4 overflow-hidden">
        {/* Fretboard/Note Display */}
        <div className="flex-grow">
          <NoteDisplay
            notes={displayNotes}
            major_key={repertoireItem.major_key}
            currentPosition={currentTime}
            enableListening={pitchDetectionEnabled && !metronome.state.isPlaying}
            className="h-full w-full"
            mode={lessonExercise?.display_view === 'tab' ? 'tablature' : lessonExercise?.display_view === 'grid' ? 'grid' : 'tablature'}
          />
        </div>

        {/* Metronome and Controls */}
        <div className="flex-shrink-0">
          <div className="bg-card rounded-lg border border-border p-4">
            <BeatVisualizer
              currentBeat={metronome.state.currentBeat}
              isPlaying={metronome.state.isPlaying}
              currentBpm={
                metronome.state.isPlaying
                  ? metronome.state.currentBpm
                  : metronomeBpm
              }
              onBpmChange={handleMetronomeBpmChange}
              canEdit={true}
              size="lg"
            >
              <MetronomeControls
                mode={mode}
                isPlaying={metronome.state.isPlaying}
                currentBpm={
                  metronome.state.isPlaying
                    ? metronome.state.currentBpm
                    : metronomeBpm
                }
                endBpm={lessonExercise?.target_bpm || metronomeBpm}
                measures={lessonExercise ? (lessonExercise.increments || 1) * (lessonExercise.measures_per_bpm || 4) : 8}
                measuresPerBpmChange={lessonExercise?.measures_per_bpm || 4}
                onModeChange={lessonExercise ? () => {} : setMode}
                onPlayPause={handlePlay}
                onStop={handleStop}
                onEndBpmChange={() => {}}
                onMeasuresChange={() => {}}
                onMeasuresPerBpmChangeChange={() => {}}
                onCurrentBpmChange={lessonExercise ? () => {} : handleMetronomeBpmChange}
                compact={false}
              />
            </BeatVisualizer>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RiffPractice;
