import { useState, useEffect, useCallback, useRef } from "react";

export interface MetronomeState {
  isPlaying: boolean;
  currentBpm: number;
  currentBeat: number;
  currentMeasure: number;
  progressiveRound: number;
}

export interface MetronomeSettings {
  mode: "regular" | "speed-trainer" | "progressive";
  startBpm: number;
  endBpm: number;
  measures: number;
  measuresPerBpmChange?: number;
  progressiveStepBpm?: number;
  onTick?: (state: MetronomeState) => void;
  loop?: boolean;
}

export const DEFAULT_PROGRESSIVE_STEP_BPM = 5;

export function useMetronome(settings: MetronomeSettings) {
  const [state, setState] = useState<MetronomeState>({
    isPlaying: false,
    currentBpm: settings.startBpm,
    currentBeat: 1,
    currentMeasure: 1,
    progressiveRound: 1,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const nextBeatTimeRef = useRef<number>(0);
  const beatCountRef = useRef<number>(0);
  const measureCountRef = useRef<number>(1);
  const progressiveRoundRef = useRef<number>(1);
  const intervalRef = useRef<number | null>(null);
  const measuresPerBpmChange = settings.measuresPerBpmChange || 1;
  const progressiveStepBpm =
    settings.progressiveStepBpm ?? DEFAULT_PROGRESSIVE_STEP_BPM;

  // Initialize audio context
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  // Play click sound
  const playClick = useCallback(
    (isDownbeat = false) => {
      const audioContext = initAudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Higher pitch for downbeat (beat 1)
      oscillator.frequency.setValueAtTime(
        isDownbeat ? 1000 : 800,
        audioContext.currentTime
      );
      oscillator.type = "square";

      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.1
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    },
    [initAudioContext]
  );

  // Calculate current BPM based on mode and progress
  const calculateCurrentBpm = useCallback(
    (beat: number, measure: number, round: number) => {
      if (settings.mode === "regular") {
        return settings.startBpm;
      }

      let baseBpm = settings.startBpm;
      let targetBpm = settings.endBpm;

      if (settings.mode === "progressive") {
        baseBpm = settings.startBpm + (round - 1) * progressiveStepBpm;
        targetBpm = settings.endBpm + (round - 1) * progressiveStepBpm;
      }

      // Both speed-trainer and progressive use the same logic
      if (
        settings.mode === "speed-trainer" ||
        settings.mode === "progressive"
      ) {
        const totalBeatsElapsed = (measure - 1) * 4 + (beat - 1);
        const beatsPerIncrement = measuresPerBpmChange * 4;
        const currentIncrement = Math.floor(
          totalBeatsElapsed / beatsPerIncrement
        );

        // settings.measures is number of increments
        const numberOfIncrements = settings.measures;
        // Allow reaching the target on the final increment; include the end step
        const clampedIncrement = Math.min(currentIncrement, numberOfIncrements);
        const bpmIncrementSize =
          numberOfIncrements > 0
            ? (targetBpm - baseBpm) / numberOfIncrements
            : 0;
        let currentBpmValue = baseBpm + clampedIncrement * bpmIncrementSize;
        // Clamp within [min(base, target), max(base, target)] so we never dip below base on first tick
        const low = Math.min(baseBpm, targetBpm);
        const high = Math.max(baseBpm, targetBpm);
        if (currentBpmValue < low) currentBpmValue = low;
        if (currentBpmValue > high) currentBpmValue = high;

        return Number(currentBpmValue.toFixed(2));
      }

      // Regular mode fallback
      return baseBpm;
    },
    [settings, measuresPerBpmChange]
  );

  // Process beat
  const scheduleNextBeat = useCallback(() => {
    const currentBpm = calculateCurrentBpm(
      (beatCountRef.current % 4) + 1,
      measureCountRef.current,
      progressiveRoundRef.current
    );

    const currentBeat = (beatCountRef.current % 4) + 1;
    const isDownbeat = currentBeat === 1;

    // Play the click sound
    playClick(isDownbeat);

    // Update state
    setState((prev) => ({
      ...prev,
      currentBpm,
      currentBeat,
      currentMeasure: measureCountRef.current,
      progressiveRound: progressiveRoundRef.current,
    }));

    // Advance counters
    beatCountRef.current++;

    if (beatCountRef.current % 4 === 0) {
      measureCountRef.current++;

      // After completing all planned increments, either loop (progressive) or linger (speed-trainer)
      if (settings.mode !== "regular") {
        const totalPlannedMeasures = settings.measures * measuresPerBpmChange;
        if (measureCountRef.current > totalPlannedMeasures) {
          if (settings.mode === "progressive" || settings.loop) {
            // Next progressive round
            progressiveRoundRef.current++;
            measureCountRef.current = 1;
            beatCountRef.current = 0;
          } else {
            // speed-trainer: linger at final tempo; do nothing
          }
        }
      }
    }
    if (settings.onTick) {
      settings.onTick(state);
    }
  }, [calculateCurrentBpm, playClick, settings, state]);

  // Main metronome loop using setInterval instead of requestAnimationFrame
  useEffect(() => {
    // Clear any existing interval first to prevent multiple intervals
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (state.isPlaying) {
      const currentBpm = calculateCurrentBpm(
        (beatCountRef.current % 4) + 1,
        measureCountRef.current,
        progressiveRoundRef.current
      );

      const beatLength = (60 / currentBpm) * 1000; // Convert to milliseconds

      intervalRef.current = window.setInterval(() => {
        scheduleNextBeat();
      }, beatLength);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state.isPlaying, state.currentBpm, calculateCurrentBpm, scheduleNextBeat]);

  const start = useCallback(() => {
    initAudioContext();
    setState((prev) => ({ ...prev, isPlaying: true }));
  }, [initAudioContext]);

  const pause = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: false }));
  }, []);

  const stop = useCallback(() => {
    // Clear the interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      isPlaying: false,
      currentBeat: 1,
      currentMeasure: 1,
      progressiveRound: 1,
      currentBpm: settings.startBpm,
    }));
    beatCountRef.current = 0;
    measureCountRef.current = 1;
    progressiveRoundRef.current = 1;
    nextBeatTimeRef.current = 0;
  }, [settings.startBpm]);

  const togglePlayPause = useCallback(() => {
    if (state.isPlaying) {
      pause();
    } else {
      start();
    }
  }, [state.isPlaying, start, pause]);

  const restart = useCallback(() => {
    stop();
    // Delay start to allow state to settle
    setTimeout(start, 50);
  }, [stop, start]);

  return {
    state,
    start,
    pause,
    stop,
    restart,
    togglePlayPause,
    stats: {
      beatsPerIncrement: measuresPerBpmChange * 4,
      totalPlannedIncrements: settings.measures,
      totalPlannedMeasures: settings.measures * measuresPerBpmChange,
      progressiveStepBpm,
    },
  };
}
