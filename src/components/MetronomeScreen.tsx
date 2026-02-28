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
import { useAutoRecord } from "@/contexts/AutoRecordContext";
import { useAutoRecording } from "@/hooks/useAutoRecording";

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
  const [
    {
      mode,
      startBpm,
      endBpm,
      increments,
      measuresPerIncrement,
      progressiveStepBpm: currentProgressiveStepBpm,
      loop,
      drumBeat,
    },
    setSettings,
  ] = useState({
    mode: initialMode,
    startBpm: initialStartBpm,
    endBpm: initialEndBpm,
    increments: initialIncrements,
    measuresPerIncrement: initialMeasuresPerIncrement,
    progressiveStepBpm: progressiveStepBpm,
    loop: false,
    drumBeat: false,
  });

  const { autoRecordEnabled, isPremium } = useAutoRecord();
  const [tickCount, setTickCount] = useState(0);

  const recording = useAutoRecording({
    enabled: autoRecordEnabled && isPremium,
    moduleType: "metronome",
    metronomeConfig: {
      mode,
      bpm: startBpm,
      drum_beat: drumBeat,
      auto_record: autoRecordEnabled,
    },
  });

  const metronome = useMetronome({
    mode,
    startBpm,
    endBpm,
    measures: increments,
    measuresPerBpmChange: measuresPerIncrement,
    progressiveStepBpm: currentProgressiveStepBpm,
    drumBeat,
    onTick: (state) => {
      setTickCount((prev) => prev + 1);
      recording.handleTick(tickCount);
      if (onTick) onTick(state);
    },
  });

  const handleCurrentBpmChange = useCallback(
    (bpm: number) => {
      const wasPlaying = metronome.state.isPlaying;
      setSettings((prev) => ({ ...prev, startBpm: bpm }));
      if (mode !== "regular" && wasPlaying) {
        metronome.stop();
        setTimeout(() => {
          metronome.start();
        }, 100);
      }
    },
    [metronome, mode]
  );

  useBpmControls({
    currentBpm: startBpm,
    onBpmChange: handleCurrentBpmChange,
    isEnabled: true,
  });

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

  useEffect(() => {
    if (autoStart) {
      metronome.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const effectiveStartBpm =
    mode === "regular"
      ? startBpm
      : startBpm +
      (metronome.state.progressiveRound - 1) * currentProgressiveStepBpm;
  const effectiveTargetBpm =
    mode === "progressive"
      ? endBpm +
      (metronome.state.progressiveRound - 1) * currentProgressiveStepBpm
      : endBpm;

  return (
    <div className="flex flex-col h-full">
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

      {showControls && (
        <div className="flex-shrink-0 p-4 space-y-4">
          <MetronomeControls
            isPlaying={metronome.state.isPlaying}
            initialState={{
              mode,
              startBpm,
              endBpm,
              increments,
              measuresPerIncrement,
              progressiveStepBpm: currentProgressiveStepBpm,
              loop,
              drumBeat,
            }}
            onPlayPause={metronome.togglePlayPause}
            onRestart={metronome.restart}
            onStateChange={(newState) =>
              setSettings((prev) => ({ ...prev, ...newState }))
            }
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
            progressiveStepBpm={currentProgressiveStepBpm}
            isPlaying={metronome.state.isPlaying}
          />
        </div>
      )}
    </div>
  );
}

export default MetronomeScreen;
