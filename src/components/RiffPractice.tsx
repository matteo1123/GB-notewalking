import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { RepertoireItem } from "@/types/repertoire";
import { useMetronome, MetronomeSettings } from "@/hooks/useMetronome";
import { useBpmControls } from "@/hooks/useBpmControls";
import { usePitchDetection } from "@/hooks/usePitchDetection";
import GuitarTablature from "./GuitarTablature";
import { BeatVisualizer } from "./BeatVisualizer";
import { MetronomeControls, MetronomeMode } from "./MetronomeControls";
import ExerciseHierarchy from "./ExerciseHierarchy";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Play, Pause, Square, RotateCcw } from "lucide-react";

// Normalize raw notes (supports optional 'subdivision' for per-beat steps)
// Defaults to quarter notes (1 step per beat) when subdivision is missing
// Accepts legacy notes with 'duration' in seconds; otherwise duration = 1 step

import { Note } from "@/types/repertoire";

type AnyNote = Note & {
  subdivision?: number;
  highlightEvery?: number;
  highlightOffset?: number;
};

function normalizeNotes(rawNotes: AnyNote[], bpm: number) {
  const secondsPerBeat = 60 / Math.max(bpm, 1);
  return (rawNotes || []).map((n) => {
    const sub =
      typeof n.subdivision === "number" && n.subdivision > 0
        ? n.subdivision
        : 1;
    // Interpret both time and duration in BEATS.
    const startTimeSeconds = (n.time ?? 0) * secondsPerBeat;
    const durationBeats =
      typeof n.duration === "number" && n.duration > 0 ? n.duration : 1 / sub;
    const durationSeconds = durationBeats * secondsPerBeat;
    return {
      time: startTimeSeconds,
      duration: durationSeconds,
      string: n.string,
      fret: n.fret,
      accent: n.accent ?? n.highlight,
    };
  });
}

interface RiffPracticeProps {
  repertoireItem: RepertoireItem;
  onComplete?: () => void;
  onExerciseSelect?: (exercise: RepertoireItem) => void;
  autoAdvance?: boolean;
  timeLimit?: number; // Time in seconds
  isControlledSession?: boolean; // If true, parent controls the session
}

const RiffPractice = ({
  repertoireItem,
  onComplete,
  onExerciseSelect,
  autoAdvance = false,
  timeLimit,
  isControlledSession = false,
}: RiffPracticeProps) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState<MetronomeMode>("regular");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [metronomeBpm, setMetronomeBpm] = useState(80);
  const [pitchDetectionEnabled, setPitchDetectionEnabled] = useState(true);
  const [detectedNote, setDetectedNote] = useState<{
    string: number;
    fret: number;
  } | null>(null);
  const noteTimesRef = useRef<number[]>([]);
  const noteIndexRef = useRef<number>(0);

  const metronomeSettings: MetronomeSettings = {
    mode,
    startBpm: metronomeBpm,
    endBpm: metronomeBpm,
    measures: 8,
    measuresPerBpmChange: 4,
  };

  const metronome = useMetronome(metronomeSettings);

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

  // Pitch detection
  const { isListening } = usePitchDetection({
    isEnabled: pitchDetectionEnabled && !metronome.state.isPlaying,
    onNoteDetected: (result) => {
      setDetectedNote({ string: result.string, fret: result.fret });
      // Advance to the next note index regardless of rhythmic value
      const times = noteTimesRef.current;
      if (times.length > 0) {
        noteIndexRef.current = (noteIndexRef.current + 1) % times.length;
        setCurrentTime(times[noteIndexRef.current]);
      }

      // Clear detected indicator quickly so UI remains responsive
      setTimeout(() => setDetectedNote(null), 200);
    },
    sensitivity: 0.6,
  });

  const handleStop = useCallback(() => {
    metronome.stop();
    setIsPlaying(false);
    setCurrentTime(0);
    setElapsedTime(0);
    setStartTime(null);
  }, [metronome]);

  const handleComplete = useCallback(() => {
    handleStop();
    onComplete?.();
  }, [handleStop, onComplete]);

  // Calculate current time and subdivision based on metronome beats (metronome is master)
  useEffect(() => {
    if (!metronome.state.isPlaying) {
      return;
    }

    // Calculate time based on metronome beats and BPM
    const beatLength = 60 / metronome.state.currentBpm; // seconds per beat
    const totalBeats =
      (metronome.state.currentMeasure - 1) * 4 +
      (metronome.state.currentBeat - 1);
    const calculatedTime = totalBeats * beatLength;

    setCurrentTime(calculatedTime);
    setElapsedTime(calculatedTime);

    // Check time limit completion
    if (timeLimit && autoAdvance && calculatedTime >= timeLimit) {
      handleComplete();
    }
  }, [
    metronome.state.currentBeat,
    metronome.state.currentMeasure,
    metronome.state.currentBpm,
    metronome.state.isPlaying,
    timeLimit,
    autoAdvance,
    handleComplete,
  ]);

  const handlePlay = useCallback(() => {
    if (!metronome.state.isPlaying) {
      metronome.start();
    } else {
      metronome.pause();
    }
    setIsPlaying(!metronome.state.isPlaying);
  }, [metronome]);

  const normalizedNotes = useMemo(
    () =>
      normalizeNotes(
        repertoireItem.notes as unknown as AnyNote[],
        metronomeBpm
      ),
    [repertoireItem.notes, metronomeBpm]
  );

  // Precompute unique, sorted note times for deterministic stepping
  useEffect(() => {
    const epsilon = 1e-3;
    const sorted = normalizedNotes.map((n) => n.time).sort((a, b) => a - b);
    const dedup: number[] = [];
    for (const t of sorted) {
      if (
        dedup.length === 0 ||
        Math.abs(dedup[dedup.length - 1] - t) > epsilon
      ) {
        dedup.push(t);
      }
    }
    noteTimesRef.current = dedup;
    // Reset index to nearest time so next detection moves forward cleanly
    const current = currentTime;
    let idx = dedup.findIndex((t) => t >= current - epsilon);
    if (idx < 0) idx = 0;
    noteIndexRef.current = idx;
  }, [normalizedNotes, currentTime]);
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
    normalizedNotes.length > 0
      ? Math.max(...normalizedNotes.map((note) => note.time + note.duration))
      : 0;
  const progress = timeLimit
    ? (elapsedTime / timeLimit) * 100
    : maxNoteTime > 0
    ? (currentTime / maxNoteTime) * 100
    : 0;

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

      {/* Progress */}
      {(timeLimit || !isControlledSession) && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Progress</span>
            <span>
              {timeLimit
                ? `${Math.floor(elapsedTime)}s / ${timeLimit}s`
                : `${Math.floor(currentTime)}s / ${Math.floor(maxNoteTime)}s`}
            </span>
          </div>
          <Progress value={Math.min(progress, 100)} className="h-2" />
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tablature - Takes up more space on desktop, full screen on mobile portrait */}
        <div className="lg:col-span-2 portrait:fixed portrait:inset-0 portrait:z-50 portrait:bg-background portrait:p-4 portrait:overflow-auto landscape:relative landscape:z-auto landscape:bg-transparent">
          <GuitarTablature
            notes={normalizedNotes}
            currentPosition={currentTime}
            detectedNote={detectedNote}
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
                  onClick={() => setCurrentTime(0)}
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
              {isListening && (
                <span className="ml-2 inline-flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1"></span>
                  Listening...
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiffPractice;
