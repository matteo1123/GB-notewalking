import { useState, useCallback, useEffect, MutableRefObject } from "react";
import { BeatVisualizer } from "@/components/BeatVisualizer";
import {
  MetronomeControls,
  MetronomeMode,
} from "@/components/MetronomeControls";
import { ProgressIndicator } from "@/components/ProgressIndicator";
import {
  useMetronome,
  DEFAULT_PROGRESSIVE_STEP_BPM,
  MetronomeState,
} from "@/hooks/useMetronome";
import { useBpmControls } from "@/hooks/useBpmControls";

export interface MetronomeScreenProps {
  initialMode?: MetronomeMode;
  initialStartBpm?: number;
  initialEndBpm?: number;
  initialIncrements?: number; // number of increments
  initialMeasuresPerIncrement?: number; // measures per BPM change
  progressiveStepBpm?: number;
  showControls?: boolean;
  autoStart?: boolean;
  exposeControlsRef?: MutableRefObject<{
    start: () => void;
    pause: () => void;
    stop: () => void;
    togglePlayPause: () => void;
  } | null>;
  onProgress?: (info: {
    currentBeat: number;
    currentMeasure: number;
    currentBpm: number;
    progressiveRound: number;
    totalPlannedMeasures: number;
  }) => void;
  onTick?: (state: MetronomeState) => void;
  onStop?: () => void;
}

export function MetronomeScreen({
  initialMode = "regular",
  initialStartBpm = 80,
  initialEndBpm = 120,
  initialIncrements = 8,
  initialMeasuresPerIncrement = 4,
  progressiveStepBpm = DEFAULT_PROGRESSIVE_STEP_BPM,
  showControls = true,
  autoStart = false,
  exposeControlsRef,
  onProgress,
  onTick,
  onStop,
}: MetronomeScreenProps) {
  const [mode, setMode] = useState<MetronomeMode>(initialMode);
  const [startBpm, setStartBpm] = useState<number>(initialStartBpm);
  const [endBpm, setEndBpm] = useState<number>(initialEndBpm);
  const [increments, setIncrements] = useState<number>(initialIncrements);
  const [measuresPerIncrement, setMeasuresPerIncrement] = useState<number>(
    initialMeasuresPerIncrement
  );

  const metronome = useMetronome({
    mode,
    startBpm,
    endBpm,
    measures: increments,
    measuresPerBpmChange: measuresPerIncrement,
    progressiveStepBpm,
    onTick,
  });

  const handleModeChange = useCallback(
    (newMode: MetronomeMode) => {
      metronome.stop();
      setMode(newMode);
    },
    [metronome]
  );

  const handleCurrentBpmChange = useCallback(
    (bpm: number) => {
      const wasPlaying = metronome.state.isPlaying;
      setStartBpm(bpm);
      if (mode !== "regular" && wasPlaying) {
        metronome.stop();
        setTimeout(() => {
          metronome.start();
        }, 100);
      }
    },
    [metronome, mode]
  );

  // Global BPM adjustment controls - always adjust the base/start BPM
  useBpmControls({
    currentBpm: startBpm,
    onBpmChange: handleCurrentBpmChange,
    isEnabled: true,
  });

  // Optional progress callback for parent controllers (Exercise/Lesson)
  useEffect(() => {
    if (!onProgress) return;
    onProgress({
      currentBeat: metronome.state.currentBeat,
      currentMeasure: metronome.state.currentMeasure,
      currentBpm: metronome.state.currentBpm,
      progressiveRound: metronome.state.progressiveRound,
      totalPlannedMeasures: metronome.stats.totalPlannedMeasures,
    });
  }, [
    metronome.state.currentBeat,
    metronome.state.currentMeasure,
    metronome.state.currentBpm,
    metronome.state.progressiveRound,
    metronome.stats.totalPlannedMeasures,
    onProgress,
  ]);

  // Expose control functions to parent
  useEffect(() => {
    if (!exposeControlsRef) return;
    exposeControlsRef.current = {
      start: metronome.start,
      pause: metronome.pause,
      stop: metronome.stop,
      togglePlayPause: metronome.togglePlayPause,
    };
    return () => {
      if (exposeControlsRef) exposeControlsRef.current = null;
    };
  }, [
    exposeControlsRef,
    metronome.start,
    metronome.pause,
    metronome.stop,
    metronome.togglePlayPause,
  ]);

  // Auto start if requested
  useEffect(() => {
    if (autoStart) {
      metronome.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const effectiveStartBpm =
    mode === "regular"
      ? startBpm
      : startBpm + (metronome.state.progressiveRound - 1) * progressiveStepBpm;
  const effectiveTargetBpm =
    mode === "progressive"
      ? endBpm + (metronome.state.progressiveRound - 1) * progressiveStepBpm
      : endBpm;

  return (
    <div className="flex flex-col h-full">
      {/* Beat Visualizer */}
      <div className="flex-grow flex items-center justify-center">
        <BeatVisualizer
          currentBeat={metronome.state.currentBeat}
          isPlaying={metronome.state.isPlaying}
          currentBpm={
            mode === "regular" || !metronome.state.isPlaying
              ? startBpm
              : metronome.state.currentBpm
          }
          onBpmChange={handleCurrentBpmChange}
          canEdit={true}
          size="lg"
        />
      </div>

      {/* Controls */}
      {showControls && (
        <div className="flex-shrink-0 p-4 space-y-4">
          <MetronomeControls
            mode={mode}
            isPlaying={metronome.state.isPlaying}
            currentBpm={
              mode === "regular" || !metronome.state.isPlaying
                ? startBpm
                : metronome.state.currentBpm
            }
            endBpm={endBpm}
            measures={increments}
            measuresPerBpmChange={measuresPerIncrement}
            onModeChange={handleModeChange}
            onPlayPause={metronome.togglePlayPause}
            onStop={() => {
              metronome.stop();
              onStop?.();
            }}
            onEndBpmChange={setEndBpm}
            onMeasuresChange={setIncrements}
            onMeasuresPerBpmChangeChange={setMeasuresPerIncrement}
            onCurrentBpmChange={handleCurrentBpmChange}
            progressiveStepBpm={progressiveStepBpm}
            onProgressiveStepBpmChange={() => {
              /* parent may control */
            }}
            compact
          />

          <ProgressIndicator
            mode={mode}
            currentMeasure={metronome.state.currentMeasure}
            totalMeasures={increments * measuresPerIncrement}
            progressiveRound={metronome.state.progressiveRound}
            currentBpm={metronome.state.currentBpm}
            targetBpm={effectiveTargetBpm}
            startBpmBase={startBpm}
            progressiveStepBpm={progressiveStepBpm}
            isPlaying={metronome.state.isPlaying}
          />
        </div>
      )}
    </div>
  );
}

export default MetronomeScreen;
