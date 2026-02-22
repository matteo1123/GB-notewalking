import { useState, useEffect, useCallback, useRef } from "react";

// Supabase storage URLs for drum samples
const SUPABASE_STORAGE_URL = "https://idsufbsfywgmcrhldqxq.supabase.co/storage/v1/object/public/drums";
const DRUM_SAMPLES = {
  ride: `${SUPABASE_STORAGE_URL}/Ride.wav`,
  kick: `${SUPABASE_STORAGE_URL}/Kick.wav`,
  snare: `${SUPABASE_STORAGE_URL}/Snare.wav`,
};

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
  onComplete?: () => void; // Called when progressive/speed-trainer cycle finishes
  loop?: boolean;
  muted?: boolean;
  drumBeat?: boolean; // When true, plays kick on 1, snare on 3
  subdivisions?: number; // Defines how many ticks occur per audible metronome click
}

export const DEFAULT_PROGRESSIVE_STEP_BPM = 5;


function clamp(value: number, min: number, max: number) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function useMetronome(settings: MetronomeSettings) {
  const [state, setState] = useState<MetronomeState>({
    isPlaying: false,
    currentBpm: settings.startBpm,
    currentBeat: 1,
    currentMeasure: 1,
    progressiveRound: 1,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);
  const beatCountRef = useRef<number>(0);
  const measureCountRef = useRef<number>(1);
  const progressiveRoundRef = useRef<number>(1);
  const settingsRef = useRef(settings);

  // Drum sample audio buffers
  const rideBufferRef = useRef<AudioBuffer | null>(null);
  const kickBufferRef = useRef<AudioBuffer | null>(null);
  const snareBufferRef = useRef<AudioBuffer | null>(null);
  const samplesLoadedRef = useRef(false);
  const skipFirstBeatRef = useRef(false); // Skip sound on first beat after restart

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const clearScheduledBeat = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      isPlayingRef.current = false;
      clearScheduledBeat();
    };
  }, [clearScheduledBeat]);

  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  // Load drum samples
  const loadDrumSamples = useCallback(async () => {
    if (samplesLoadedRef.current) return;

    const audioContext = initAudioContext();
    if (!audioContext) return;

    try {
      const responses = await Promise.all([
        fetch(DRUM_SAMPLES.ride),
        fetch(DRUM_SAMPLES.kick),
        fetch(DRUM_SAMPLES.snare),
      ]);

      // Check if any fetch failed
      for (const response of responses) {
        if (!response.ok) {
          console.error(`Failed to fetch drum sample: ${response.url} (${response.status} ${response.statusText})`);
          throw new Error(`Failed to fetch ${response.url}`);
        }
      }

      const [rideBuffer, kickBuffer, snareBuffer] = await Promise.all(
        responses.map(async (res) => audioContext.decodeAudioData(await res.arrayBuffer()))
      );

      rideBufferRef.current = rideBuffer;
      kickBufferRef.current = kickBuffer;
      snareBufferRef.current = snareBuffer;
      samplesLoadedRef.current = true;
      console.log("Drum samples loaded successfully");
    } catch (error) {
      console.error("Failed to load drum samples:", error);
    }
  }, [initAudioContext]);

  // Load samples on mount
  useEffect(() => {
    loadDrumSamples();
  }, [loadDrumSamples]);

  // Play a sample buffer with optional fade-out
  const playSample = useCallback((buffer: AudioBuffer | null, volume: number = 0.5, fadeOutMs: number = 0) => {
    if (!buffer) return;

    const audioContext = initAudioContext();
    if (!audioContext) return;

    try {
      const source = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();

      source.buffer = buffer;
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);

      // Apply fade-out if specified
      if (fadeOutMs > 0) {
        const fadeOutTime = fadeOutMs / 1000;
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + fadeOutTime);
        source.start(0);
        source.stop(audioContext.currentTime + fadeOutTime);
      } else {
        source.start(0);
      }
    } catch (error) {
      console.error("Failed to play sample:", error);
    }
  }, [initAudioContext]);

  const playClick = useCallback(
    (beat: number = 1) => {
      // Don't play click if muted
      if (settingsRef.current.muted) return;

      const audioContext = initAudioContext();
      if (!audioContext) return;

      // If samples are loaded, use drum sounds
      if (samplesLoadedRef.current) {
        // Always play ride for the click (with 150ms fade-out for smoother ending)
        playSample(rideBufferRef.current, 0.4, 150);

        // If drum beat is enabled, add kick on 1 and snare on 3
        if (settingsRef.current.drumBeat) {
          if (beat === 1) {
            playSample(kickBufferRef.current, 0.7);
          } else if (beat === 3) {
            playSample(snareBufferRef.current, 0.6);
          }
        }
        return;
      }

      // Fallback to oscillator if samples not loaded
      try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(
          beat === 1 ? 1000 : 800,
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
      } catch (error) {
        console.error("Metronome click failed", error);
      }
    },
    [initAudioContext, playSample]
  );

  const calculateCurrentBpm = useCallback(
    (beat: number, measure: number, round: number) => {
      const currentSettings = settingsRef.current;
      const measuresPerBpmChange = currentSettings.measuresPerBpmChange || 1;
      const progressiveStepBpm =
        currentSettings.progressiveStepBpm ?? DEFAULT_PROGRESSIVE_STEP_BPM;

      if (currentSettings.mode === "regular") {
        return currentSettings.startBpm;
      }

      let baseBpm = currentSettings.startBpm;
      let targetBpm = currentSettings.endBpm;

      if (currentSettings.mode === "progressive") {
        baseBpm = currentSettings.startBpm + (round - 1) * progressiveStepBpm;
        targetBpm = currentSettings.endBpm + (round - 1) * progressiveStepBpm;
      }

      if (
        currentSettings.mode === "speed-trainer" ||
        currentSettings.mode === "progressive"
      ) {
        const totalBeatsElapsed = (measure - 1) * 4 + (beat - 1);
        const beatsPerIncrement = measuresPerBpmChange * 4;
        const currentIncrement = Math.floor(
          totalBeatsElapsed / beatsPerIncrement
        );

        const numberOfIncrements = currentSettings.measures;
        const clampedIncrement = clamp(currentIncrement, 0, numberOfIncrements);
        const bpmIncrementSize =
          numberOfIncrements > 0
            ? (targetBpm - baseBpm) / numberOfIncrements
            : 0;

        let currentBpmValue = baseBpm + clampedIncrement * bpmIncrementSize;
        currentBpmValue = clamp(
          currentBpmValue,
          Math.min(baseBpm, targetBpm),
          Math.max(baseBpm, targetBpm)
        );

        return Number(currentBpmValue.toFixed(2));
      }

      return baseBpm;
    },
    []
  );

  const scheduleNextBeat = useCallback(() => {
    if (!isPlayingRef.current) {
      return;
    }

    const currentSettings = settingsRef.current;
    const measuresPerBpmChange = currentSettings.measuresPerBpmChange || 1;
    const subdivisions = currentSettings.subdivisions || 1;

    // beatCountRef now counts total subdivisions (notes). Calculate the actual beat (1-4).
    const beat = Math.floor(beatCountRef.current / subdivisions) % 4 + 1;
    const exactSubdivision = beatCountRef.current % subdivisions;

    const currentBpm = calculateCurrentBpm(
      beat,
      measureCountRef.current,
      progressiveRoundRef.current
    );

    // Skip sound on first beat after restart (to avoid rapid clicks when adjusting settings)
    if (skipFirstBeatRef.current) {
      skipFirstBeatRef.current = false;
    } else {
      // Only play the audible click on the downbeat of the subdivision
      if (exactSubdivision === 0) {
        playClick(beat);
      }
    }

    const nextState: MetronomeState = {
      isPlaying: true,
      currentBpm,
      currentBeat: beat,
      currentMeasure: measureCountRef.current,
      progressiveRound: progressiveRoundRef.current,
    };

    setState(nextState);

    if (currentSettings.onTick) {
      currentSettings.onTick(nextState);
    }

    // Increment subdivision counter
    beatCountRef.current += 1;

    if (beatCountRef.current > 0 && beatCountRef.current % (4 * subdivisions) === 0) {
      measureCountRef.current += 1;

      if (currentSettings.mode !== "regular") {
        const plannedMeasures =
          (currentSettings.measures || 0) * measuresPerBpmChange;

        if (
          plannedMeasures > 0 &&
          measureCountRef.current > plannedMeasures
        ) {
          // Cycle complete - always reset for progressive and speed-trainer
          progressiveRoundRef.current += 1;
          measureCountRef.current = 1;
          beatCountRef.current = 0;

          // If loop=false (session auto-advance mode), fire onComplete and STOP
          // Otherwise (loop=true, which is default), continue looping forever
          if (currentSettings.loop === false) {
            currentSettings.onComplete?.();
            isPlayingRef.current = false;
            setState(prev => ({ ...prev, isPlaying: false }));
            return;
          }
          // If loop=true (default), just continue - the counters are already reset
        }
      }
    }

    if (!isPlayingRef.current) {
      return;
    }

    const nextBeat = Math.floor(beatCountRef.current / subdivisions) % 4 + 1;
    const nextBpm = calculateCurrentBpm(
      nextBeat,
      measureCountRef.current,
      progressiveRoundRef.current
    );
    // Divide beat length by subdivisions to tick exactly on each note
    const beatLength = ((60 / nextBpm) * 1000) / subdivisions;

    clearScheduledBeat();
    timeoutRef.current = window.setTimeout(scheduleNextBeat, beatLength);
  }, [calculateCurrentBpm, playClick, clearScheduledBeat]);

  const start = useCallback(() => {
    const audioContext = initAudioContext();
    if (audioContext?.state === "suspended") {
      audioContext.resume().catch((error) => {
        console.error("Unable to resume audio context", error);
      });
    }

    if (isPlayingRef.current) {
      return;
    }

    isPlayingRef.current = true;

    beatCountRef.current = 0;
    measureCountRef.current = 1;
    progressiveRoundRef.current = 1;

    setState((prev) => ({
      ...prev,
      isPlaying: true,
      currentBpm: settingsRef.current.startBpm,
      currentBeat: 1,
      currentMeasure: 1,
      progressiveRound: 1,
    }));

    clearScheduledBeat();
    skipFirstBeatRef.current = true; // Silent first beat to avoid click spam when adjusting
    scheduleNextBeat();
  }, [initAudioContext, scheduleNextBeat, clearScheduledBeat]);

  const pause = useCallback(() => {
    if (!isPlayingRef.current) {
      return;
    }
    isPlayingRef.current = false;
    clearScheduledBeat();
    setState((prev) => ({ ...prev, isPlaying: false }));
  }, [clearScheduledBeat]);

  const stop = useCallback(() => {
    isPlayingRef.current = false;
    clearScheduledBeat();

    setState((prev) => ({
      ...prev,
      isPlaying: false,
      currentBeat: 1,
      currentMeasure: 1,
      progressiveRound: 1,
      currentBpm: settingsRef.current.startBpm,
    }));

    beatCountRef.current = 0;
    measureCountRef.current = 1;
    progressiveRoundRef.current = 1;
  }, [clearScheduledBeat]);

  const togglePlayPause = useCallback(() => {
    if (isPlayingRef.current) {
      pause();
    } else {
      start();
    }
  }, [start, pause]);

  const restart = useCallback(() => {
    stop();
    setTimeout(start, 50);
  }, [stop, start]);

  useEffect(() => {
    if (!isPlayingRef.current) {
      setState((prev) => ({
        ...prev,
        currentBpm: settings.startBpm,
      }));
    }
  }, [settings.startBpm]);

  useEffect(() => {
    if (!isPlayingRef.current) {
      return;
    }

    clearScheduledBeat();
    timeoutRef.current = window.setTimeout(scheduleNextBeat, 0);
  }, [
    settings.mode,
    settings.startBpm,
    settings.endBpm,
    settings.measures,
    settings.measuresPerBpmChange,
    settings.progressiveStepBpm,
    settings.loop,
    scheduleNextBeat,
    clearScheduledBeat,
  ]);

  return {
    state,
    start,
    pause,
    stop,
    restart,
    togglePlayPause,
    audioContext: audioContextRef.current,
    stats: {
      beatsPerIncrement: (settings.measuresPerBpmChange || 1) * 4,
      totalPlannedIncrements: settings.measures,
      totalPlannedMeasures:
        (settings.measuresPerBpmChange || 1) * settings.measures,
      progressiveStepBpm:
        settings.progressiveStepBpm ?? DEFAULT_PROGRESSIVE_STEP_BPM,
    },
  };
}
