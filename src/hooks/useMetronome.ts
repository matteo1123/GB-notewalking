import { useState, useEffect, useCallback, useRef } from 'react';

export interface MetronomeState {
  isPlaying: boolean;
  currentBpm: number;
  currentBeat: number;
  currentMeasure: number;
  progressiveRound: number;
}

export interface MetronomeSettings {
  mode: 'regular' | 'speed-trainer' | 'progressive';
  startBpm: number;
  endBpm: number;
  measures: number;
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
  const nextBeatTimeRef = useRef<number>(0);
  const beatCountRef = useRef<number>(0);
  const measureCountRef = useRef<number>(1);
  const progressiveRoundRef = useRef<number>(1);
  const intervalRef = useRef<number | null>(null);

  // Initialize audio context
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  // Play click sound
  const playClick = useCallback((isDownbeat = false) => {
    const audioContext = initAudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Higher pitch for downbeat (beat 1)
    oscillator.frequency.setValueAtTime(isDownbeat ? 1000 : 800, audioContext.currentTime);
    oscillator.type = 'square';

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  }, [initAudioContext]);

  // Calculate current BPM based on mode and progress
  const calculateCurrentBpm = useCallback((beat: number, measure: number, round: number) => {
    if (settings.mode === 'regular') {
      return settings.startBpm;
    }

    // Progress based on measures, not individual beats for smoother progression
    const progress = Math.min((measure - 1) / settings.measures, 1);

    let baseBpm = settings.startBpm;
    if (settings.mode === 'progressive') {
      baseBpm = settings.startBpm + (round - 1) * 5;
    }

    const targetBpm = settings.endBpm + (settings.mode === 'progressive' ? (round - 1) * 5 : 0);
    return baseBpm + (targetBpm - baseBpm) * progress;
  }, [settings]);

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
    setState(prev => ({
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
      
      // Check if we've completed the cycle for speed trainer or progressive mode
      if (settings.mode !== 'regular' && measureCountRef.current > settings.measures) {
        if (settings.mode === 'progressive') {
          // Start next progressive round
          progressiveRoundRef.current++;
          measureCountRef.current = 1;
          beatCountRef.current = 0;
        } else {
          // Speed trainer mode - stop
          setState(prev => ({ ...prev, isPlaying: false }));
          return;
        }
      }
    }
  }, [calculateCurrentBpm, playClick, settings]);

  // Main metronome loop using setInterval instead of requestAnimationFrame
  useEffect(() => {
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
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state.isPlaying, calculateCurrentBpm, scheduleNextBeat]);

  const start = useCallback(() => {
    initAudioContext();
    setState(prev => ({ ...prev, isPlaying: true }));
  }, [initAudioContext]);

  const pause = useCallback(() => {
    setState(prev => ({ ...prev, isPlaying: false }));
  }, []);

  const stop = useCallback(() => {
    // Clear the interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setState(prev => ({
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

  return {
    state,
    start,
    pause,
    stop,
    togglePlayPause,
  };
}