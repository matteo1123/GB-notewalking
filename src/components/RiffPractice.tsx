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
}

const RiffPractice = ({
  repertoireItem,
  sequences,
  onComplete,
  onExerciseSelect,
  autoAdvance = false,
  timeLimit,
  isControlledSession = false,
}: RiffPracticeProps) => {
  const [noteIndex, setNoteIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState<MetronomeMode>("regular");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [metronomeBpm, setMetronomeBpm] = useState(80);
  const [pitchDetectionEnabled, setPitchDetectionEnabled] = useState(true);
  const [activeSequence, setActiveSequence] = useState<Tables<"sequences"> | null>(null);

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

  const metronomeSettings: MetronomeSettings = {
    mode,
    startBpm: metronomeBpm,
    endBpm: metronomeBpm,
    measures: 8,
    measuresPerBpmChange: 4,
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
    <div className="space-y-6 bpm-control-area">
      {/* Exercise Hierarchy */}
      {onExerciseSelect && (
        <ExerciseHierarchy
          currentExercise={repertoireItem}
          onExerciseSelect={onExerciseSelect}
        />
      )}

      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">
          {repertoireItem.name}
        </h2>
        <p className="text-muted-foreground">{repertoireItem.description}</p>
        <div className="flex items-center justify-center gap-4 text-sm">
          <span className="px-3 py-1 bg-secondary rounded-full text-secondary-foreground">
            {repertoireItem.category}
          </span>
          <span className="px-3 py-1 bg-secondary rounded-full text-secondary-foreground">
            {repertoireItem.difficulty}/10
          </span>
          <span className="px-3 py-1 bg-secondary rounded-full text-secondary-foreground">
            Highest Clean BPM: —
          </span>
        </div>
      </div>


      {/* Sequence Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {availableSequences.map((sequence) => (
          <Button
            key={sequence.id}
            onClick={() => setActiveSequence(sequence)}
            variant={activeSequence?.id === sequence.id ? 'secondary' : 'outline'}
          >
            {sequence.name}
          </Button>
        ))}
      </div>


      {/* Progress */}
      {(timeLimit || !isControlledSession) && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Progress</span>
            <span>
              {timeLimit
                ? `${Math.floor(elapsedTime)}s / ${timeLimit}s`
                : `${noteIndex} / ${displayNotes.length}`}
            </span>
          </div>
          <Progress value={Math.min(progress, 100)} className="h-2" />
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tablature - Takes up more space on desktop, full screen on mobile portrait */}
        <div className="lg:col-span-2 portrait:fixed portrait:inset-0 portrait:z-50 portrait:bg-background portrait:p-4 portrait:overflow-auto landscape:relative landscape:z-auto landscape:bg-transparent">
          <NoteDisplay
            notes={displayNotes}
            major_key={repertoireItem.major_key}
            currentPosition={currentTime}
            enableListening={pitchDetectionEnabled && !metronome.state.isPlaying}
            className="h-full"
          />
          {/* Mobile portrait instructions */}
          <div className="portrait:absolute portrait:bottom-4 portrait:left-1/2 portrait:transform portrait:-translate-x-1/2 portrait:text-center portrait:text-muted-foreground portrait:text-sm landscape:hidden hidden">
            <p>Swipe up/down to adjust BPM</p>
          </div>
        </div>

        {/* Controls and Visualizer - Compact on mobile landscape, hidden on portrait */}
        <div className="space-y-4 portrait:hidden landscape:block">
          {/* Beat Visualizer */}
          <div className="flex justify-center">
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
              size="sm"
            />
          </div>

          {/* Basic Controls */}
          {!isControlledSession && (
            <div className="space-y-3">
              <div className="flex justify-center gap-2">
                <Button
                  onClick={handlePlay}
                  variant={metronome.state.isPlaying ? "secondary" : "default"}
                  size="sm"
                >
                  {metronome.state.isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                <Button onClick={handleStop} variant="outline" size="sm">
                  <Square className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => setNoteIndex(0)}
                  variant="outline"
                  size="sm"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>

              {autoAdvance && (
                <Button onClick={handleComplete} className="w-full" size="sm">
                  Complete & Next
                </Button>
              )}
            </div>
          )}

          {/* Advanced Metronome Controls */}
          <MetronomeControls
            mode={mode}
            isPlaying={metronome.state.isPlaying}
            currentBpm={
              metronome.state.isPlaying
                ? metronome.state.currentBpm
                : metronomeBpm
            }
            endBpm={metronomeBpm}
            measures={8}
            measuresPerBpmChange={4}
            onModeChange={setMode}
            onPlayPause={handlePlay}
            onStop={handleStop}
            onEndBpmChange={() => {}} // Disabled
            onMeasuresChange={() => {}} // Disabled
            onMeasuresPerBpmChangeChange={() => {}} // Disabled
            onCurrentBpmChange={handleMetronomeBpmChange}
            compact={true}
          />

          {/* Pitch Detection Controls */}
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Guitar Tracking</label>
              <button
                onClick={() => setPitchDetectionEnabled(!pitchDetectionEnabled)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  pitchDetectionEnabled
                    ? "bg-green-500 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {pitchDetectionEnabled ? "ON" : "OFF"}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Tracking is automatically disabled while the metronome is playing
              to avoid false triggers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiffPractice;
