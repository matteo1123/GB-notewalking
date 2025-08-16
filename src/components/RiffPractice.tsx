import { useState, useEffect, useCallback, useMemo } from 'react';
import { RepertoireItem } from '@/types/repertoire';
import { useMetronome, MetronomeSettings } from '@/hooks/useMetronome';
import GuitarTablature from './GuitarTablature';
import { BeatVisualizer } from './BeatVisualizer';
import { MetronomeControls, MetronomeMode } from './MetronomeControls';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Play, Pause, Square, RotateCcw } from 'lucide-react';

// Normalize raw notes (supports optional 'subdivision' for per-beat steps)
// Defaults to quarter notes (1 step per beat) when subdivision is missing
// Accepts legacy notes with 'duration' in seconds; otherwise duration = 1 step

type AnyNote = { time: number; string: number; fret: number; subdivision?: number; duration?: number };

function normalizeNotes(rawNotes: AnyNote[], bpm: number) {
  const secondsPerBeat = 60 / Math.max(bpm, 1);
  return (rawNotes || []).map((n) => {
    const sub = typeof n.subdivision === 'number' && n.subdivision > 0 ? n.subdivision : 1;
    const stepDuration = secondsPerBeat / sub;
    const startTimeSeconds = (n.time ?? 0) * stepDuration;
    const durationSeconds = typeof n.duration === 'number' && n.duration > 0 ? n.duration : stepDuration;
    return { time: startTimeSeconds, duration: durationSeconds, string: n.string, fret: n.fret, accent: (n as any).accent ?? (n as any).highlight };
  });
}

interface RiffPracticeProps {
  repertoireItem: RepertoireItem;
  onComplete?: () => void;
  autoAdvance?: boolean;
  timeLimit?: number; // Time in seconds
  isControlledSession?: boolean; // If true, parent controls the session
}

const RiffPractice = ({ 
  repertoireItem, 
  onComplete, 
  autoAdvance = false, 
  timeLimit,
  isControlledSession = false 
}: RiffPracticeProps) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState<MetronomeMode>('regular');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const metronomeSettings: MetronomeSettings = {
    mode,
    startBpm: repertoireItem.tempo,
    endBpm: repertoireItem.tempo,
    measures: 8,
    measuresPerBpmChange: 4,
  };

  const metronome = useMetronome(metronomeSettings);

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
    const totalBeats = (metronome.state.currentMeasure - 1) * 4 + (metronome.state.currentBeat - 1);
    const calculatedTime = totalBeats * beatLength;
    
    setCurrentTime(calculatedTime);
    setElapsedTime(calculatedTime);

    // Check time limit completion
    if (timeLimit && autoAdvance && calculatedTime >= timeLimit) {
      handleComplete();
    }
  }, [metronome.state.currentBeat, metronome.state.currentMeasure, metronome.state.currentBpm, metronome.state.isPlaying, timeLimit, autoAdvance, handleComplete]);


  const handlePlay = useCallback(() => {
    if (!metronome.state.isPlaying) {
      metronome.start();
    } else {
      metronome.pause();
    }
    setIsPlaying(!metronome.state.isPlaying);
  }, [metronome]);

  const normalizedNotes = useMemo(
    () => normalizeNotes(repertoireItem.notes as unknown as AnyNote[], repertoireItem.tempo),
    [repertoireItem.notes, repertoireItem.tempo]
  );
  const highlightDirectives = useMemo(() => {
    let highlightEvery: number | undefined;
    let highlightOffset: number | undefined;
    for (const n of (repertoireItem.notes as unknown as AnyNote[])) {
      const he = (n as any).highlightEvery;
      const ho = (n as any).highlightOffset;
      if (typeof he === 'number' && he > 0) highlightEvery = he;
      if (typeof ho === 'number') highlightOffset = ho;
      if (highlightEvery !== undefined && highlightOffset !== undefined) break;
    }
    return { highlightEvery, highlightOffset };
  }, [repertoireItem.notes]);
  const maxNoteTime = normalizedNotes.length > 0 ? Math.max(...normalizedNotes.map(note => note.time + note.duration)) : 0;
  const progress = timeLimit ? (elapsedTime / timeLimit) * 100 : (maxNoteTime > 0 ? (currentTime / maxNoteTime) * 100 : 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">{repertoireItem.name}</h2>
        <p className="text-muted-foreground">{repertoireItem.description}</p>
        <div className="flex items-center justify-center gap-4 text-sm">
          <span className="px-3 py-1 bg-secondary rounded-full text-secondary-foreground">
            {repertoireItem.category}
          </span>
          <span className="px-3 py-1 bg-secondary rounded-full text-secondary-foreground">
            {repertoireItem.difficulty}
          </span>
          <span className="px-3 py-1 bg-secondary rounded-full text-secondary-foreground">
            {repertoireItem.tempo} BPM
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
                : `${Math.floor(currentTime)}s / ${Math.floor(maxNoteTime)}s`
              }
            </span>
          </div>
          <Progress value={Math.min(progress, 100)} className="h-2" />
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tablature - Takes up more space */}
        <div className="lg:col-span-2">
          <GuitarTablature 
            notes={repertoireItem.notes}
            className="h-full"
          />
        </div>

        {/* Controls and Visualizer */}
        <div className="space-y-4">
          {/* Beat Visualizer */}
          <div className="flex justify-center">
            <BeatVisualizer
              currentBeat={metronome.state.currentBeat}
              isPlaying={metronome.state.isPlaying}
              currentBpm={metronome.state.currentBpm}
              onBpmChange={(bpm) => {}} // Disabled for riff practice
              canEdit={false}
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
                  {metronome.state.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button onClick={handleStop} variant="outline" size="sm">
                  <Square className="h-4 w-4" />
                </Button>
                <Button onClick={() => setCurrentTime(0)} variant="outline" size="sm">
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
            currentBpm={metronome.state.currentBpm}
            endBpm={repertoireItem.tempo}
            measures={8}
            measuresPerBpmChange={4}
            onModeChange={setMode}
            onPlayPause={handlePlay}
            onStop={handleStop}
            onEndBpmChange={() => {}} // Disabled
            onMeasuresChange={() => {}} // Disabled
            onMeasuresPerBpmChangeChange={() => {}} // Disabled
            onCurrentBpmChange={() => {}} // Disabled
            compact={true}
          />
        </div>
      </div>
    </div>
  );
};

export default RiffPractice;