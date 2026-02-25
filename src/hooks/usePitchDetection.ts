import { useState, useRef, useEffect, useCallback } from "react";

interface PitchDetectionResult {
  frequency: number;
  note: string;
  string: number;
  fret: number;
  confidence: number;
}

interface UsePitchDetectionProps {
  isEnabled: boolean;
  onNoteDetected?: (result: PitchDetectionResult) => void;
  onPitchUpdate?: (centsOffset: number, note: string, frequency: number) => void;
  sensitivity?: number; // 0-1, higher = more sensitive
}

// Standard guitar tuning frequencies (Hz) - Low E to High E
const GUITAR_STRINGS = [
  { string: 6, openFreq: 82.41 }, // Low E
  { string: 5, openFreq: 110.0 }, // A
  { string: 4, openFreq: 146.83 }, // D
  { string: 3, openFreq: 196.0 }, // G
  { string: 2, openFreq: 246.94 }, // B
  { string: 1, openFreq: 329.63 }, // High E
];

// Convert frequency to note name
const frequencyToNote = (frequency: number): string => {
  const A4 = 440;
  const C0 = A4 * Math.pow(2, -4.75);
  const noteNames = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];

  if (frequency <= 0) return "";

  const h = Math.round(12 * Math.log2(frequency / C0));
  const octave = Math.floor(h / 12);
  const n = h % 12;

  return noteNames[n] + octave;
};

// Convert frequency to note data including target frequency for tuning
const frequencyToNoteData = (frequency: number): { note: string; targetFreq: number } | null => {
  const A4 = 440;
  const C0 = A4 * Math.pow(2, -4.75);
  const noteNames = [
    "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
  ];

  if (frequency <= 0) return null;

  const h = Math.round(12 * Math.log2(frequency / C0));
  const octave = Math.floor(h / 12);
  const n = h % 12;

  const targetFreq = C0 * Math.pow(2, h / 12);
  return { note: noteNames[n] + octave, targetFreq };
};

// Convert frequency to guitar string and fret
const frequencyToGuitarPosition = (
  frequency: number
): { string: number; fret: number } | null => {
  if (frequency <= 0) return null;

  for (const guitarString of GUITAR_STRINGS) {
    const { string, openFreq } = guitarString;

    // Calculate fret based on frequency ratio
    const fretFloat = 12 * Math.log2(frequency / openFreq);
    const fret = Math.round(fretFloat);

    // Check if this is a reasonable fret (0-24)
    if (fret >= 0 && fret <= 24) {
      const expectedFreq = openFreq * Math.pow(2, fret / 12);
      const error = Math.abs(frequency - expectedFreq) / expectedFreq;

      // If error is less than 3%, it's likely this string/fret
      if (error < 0.03) {
        return { string, fret };
      }
    }
  }

  return null;
};

// Autocorrelation pitch detection
const detectPitch = (audioData: Float32Array, sampleRate: number): number => {
  const bufferSize = audioData.length;
  const autocorrelation = new Float32Array(bufferSize);

  // Calculate autocorrelation
  for (let lag = 0; lag < bufferSize; lag++) {
    let sum = 0;
    for (let i = 0; i < bufferSize - lag; i++) {
      sum += audioData[i] * audioData[i + lag];
    }
    autocorrelation[lag] = sum;
  }

  // Find the peak (excluding lag 0)
  let maxValue = 0;
  let maxIndex = 0;
  const minPeriod = Math.floor(sampleRate / 800); // Highest reasonable frequency
  const maxPeriod = Math.floor(sampleRate / 80); // Lowest reasonable frequency

  for (let i = minPeriod; i < maxPeriod && i < bufferSize; i++) {
    if (autocorrelation[i] > maxValue) {
      maxValue = autocorrelation[i];
      maxIndex = i;
    }
  }

  if (maxIndex === 0) return 0;

  // Parabolic interpolation for better precision
  const y1 = autocorrelation[maxIndex - 1] || 0;
  const y2 = autocorrelation[maxIndex];
  const y3 = autocorrelation[maxIndex + 1] || 0;

  const a = (y1 - 2 * y2 + y3) / 2;
  const b = (y3 - y1) / 2;

  const adjustedIndex = a !== 0 ? maxIndex - b / (2 * a) : maxIndex;

  return sampleRate / adjustedIndex;
};

export const usePitchDetection = ({
  isEnabled,
  onNoteDetected,
  onPitchUpdate,
  sensitivity = 0.7,
}: UsePitchDetectionProps) => {
  const [isListening, setIsListening] = useState(false);
  const [currentNote, setCurrentNote] = useState<PitchDetectionResult | null>(
    null
  );

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();

  const lastFreqRef = useRef<number>(0);
  const lastRmsRef = useRef<number>(0);
  const lastTriggerTsRef = useRef<number>(0);
  const lastPeriodRef = useRef<number>(0);

  const processAudio = useCallback(() => {
    if (!analyserRef.current || !isEnabled) return;

    const analyser = analyserRef.current;
    const bufferSize = analyser.fftSize;
    const audioData = new Float32Array(bufferSize);
    analyser.getFloatTimeDomainData(audioData);

    // Calculate RMS to determine if there's enough signal
    let rms = 0;
    for (let i = 0; i < audioData.length; i++) {
      rms += audioData[i] * audioData[i];
    }
    rms = Math.sqrt(rms / audioData.length);

    const rmsThreshold = 0.012 * sensitivity;

    // Only process if signal is strong enough
    if (rms > rmsThreshold) {
      const frequency = detectPitch(
        audioData,
        audioContextRef.current!.sampleRate
      );

      if (frequency > 80 && frequency < 800) {

        // --- NEW TUNER CONTINUOUS DATA ---
        if (onPitchUpdate) {
          const noteData = frequencyToNoteData(frequency);
          if (noteData) {
            const cents = 1200 * Math.log2(frequency / noteData.targetFreq);
            onPitchUpdate(cents, noteData.note, frequency);
          }
        }

        // --- EXISTING DISCRETE NOTE DETECTION ---
        // Guitar frequency range
        const note = frequencyToNote(frequency);
        const position = frequencyToGuitarPosition(frequency);

        if (position && note) {
          // Trigger conditions: strong attack (rms rising) or significant pitch change (~>= 1 semitone)
          const now = performance.now();
          const minIntervalMs = 90; // a bit longer debounce to avoid double-firing
          const sinceLast = now - (lastTriggerTsRef.current || 0);
          const attack =
            lastRmsRef.current <= rmsThreshold && rms > rmsThreshold * 1.2;
          const semitoneRatio = Math.pow(2, 1 / 12);
          const pitchChanged =
            lastFreqRef.current > 0 &&
            (frequency / lastFreqRef.current > semitoneRatio ||
              lastFreqRef.current / frequency > semitoneRatio);
          // Coarse period bucket change (helps first note of triplets register)
          const periodBucket = Math.round(1000 / frequency);
          const newPeriod = periodBucket !== lastPeriodRef.current;

          if (
            sinceLast > minIntervalMs &&
            (attack || pitchChanged || newPeriod)
          ) {
            const result: PitchDetectionResult = {
              frequency,
              note,
              string: position.string,
              fret: position.fret,
              confidence: Math.min(rms * 10, 1),
            };
            setCurrentNote(result);
            if (onNoteDetected) onNoteDetected(result);
            lastTriggerTsRef.current = now;
            lastPeriodRef.current = periodBucket;
          }

          lastFreqRef.current = frequency;
          lastRmsRef.current = rms;
        }
      }
    }

    if (isListening) {
      animationFrameRef.current = requestAnimationFrame(processAudio);
    }
  }, [isEnabled, sensitivity, isListening, onNoteDetected, onPitchUpdate]);

  const startListening = useCallback(async () => {
    console.log("Attempting to start pitch detection...");
    try {
      console.log("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      console.log("Microphone access granted, setting up audio processing...");
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.8;

      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      streamRef.current = stream;

      setIsListening(true);
      console.log("Pitch detection started successfully");
    } catch (error) {
      console.error("Error accessing microphone:", error);
      console.error(
        "Make sure to allow microphone permissions in your browser"
      );
    }
  }, []);

  const stopListening = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setIsListening(false);
    setCurrentNote(null);
  }, []);

  useEffect(() => {
    if (isEnabled && !isListening) {
      startListening();
    } else if (!isEnabled && isListening) {
      stopListening();
    }
  }, [isEnabled, isListening, startListening, stopListening]);

  useEffect(() => {
    if (isListening && isEnabled) {
      processAudio();
    }
  }, [isListening, isEnabled, processAudio]);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    isListening,
    currentNote,
    audioStream: streamRef.current, // Expose stream for auto-recording
    startListening,
    stopListening,
  };
};
