import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const AudioSandbox = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [detectedNotes, setDetectedNotes] = useState<Array<{ note: string; time: number }>>([]);
  const [modelStatus, setModelStatus] = useState('Initializing...');

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();
  const recordingStartTimeRef = useRef<number>(0);

  useEffect(() => {
    const initAudio = async () => {
      try {
        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 2048;
        setModelStatus('Ready');
        console.log('Audio initialized successfully');
      } catch (error) {
        console.error('Failed to initialize audio:', error);
        setModelStatus('Error: Failed to initialize audio');
      }
    };
    initAudio();
    return () => {
      stopRecording();
    };
  }, []);

  const startRecording = async () => {
    if (modelStatus !== 'Ready') return;
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = audioContextRef.current!.createMediaStreamSource(streamRef.current);
      source.connect(analyserRef.current!);
      setDetectedNotes([]);
      recordingStartTimeRef.current = Date.now();
      setIsRecording(true);
      console.log('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const detectPitch = () => {
    if (!isRecording || !analyserRef.current) return;

    const buffer = new Float32Array(analyserRef.current.fftSize);
    analyserRef.current.getFloatTimeDomainData(buffer);

    const pitch = yin(buffer, audioContextRef.current!.sampleRate);
    if (pitch > 0) {
      const note = getNoteFromPitch(pitch);
      const time = (Date.now() - recordingStartTimeRef.current) / 1000;
      console.log(`Pitch: ${pitch}, Note: ${note}, Time: ${time}`);
      setDetectedNotes(prevNotes => [...prevNotes, { note, time }]);
    }

    animationFrameRef.current = requestAnimationFrame(detectPitch);
  };

  useEffect(() => {
    if (isRecording) {
      detectPitch();
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  }, [isRecording]);

  // YIN pitch detection algorithm
  const yin = (buffer: Float32Array, sampleRate: number) => {
    const threshold = 0.1;
    const yinBuffer = new Float32Array(buffer.length / 2);
    let tauEstimate = -1;

    // Step 2: Difference function
    for (let tau = 0; tau < yinBuffer.length; tau++) {
      yinBuffer[tau] = 0;
      for (let i = 0; i < yinBuffer.length; i++) {
        const delta = buffer[i] - buffer[i + tau];
        yinBuffer[tau] += delta * delta;
      }
    }

    // Step 3: Cumulative mean normalized difference
    yinBuffer[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau < yinBuffer.length; tau++) {
      runningSum += yinBuffer[tau];
      yinBuffer[tau] *= tau / runningSum;
    }

    // Step 4: Absolute threshold
    for (let tau = 2; tau < yinBuffer.length; tau++) {
      if (yinBuffer[tau] < threshold) {
        while (tau + 1 < yinBuffer.length && yinBuffer[tau + 1] < yinBuffer[tau]) {
          tau++;
        }
        tauEstimate = tau;
        console.log(`YIN tau estimate: ${tauEstimate}`);
        break;
      }
    }

    // Step 5: Parabolic interpolation
    if (tauEstimate !== -1) {
      let betterTau = tauEstimate;
      if (tauEstimate > 0 && tauEstimate < yinBuffer.length - 1) {
        const s0 = yinBuffer[tauEstimate - 1];
        const s1 = yinBuffer[tauEstimate];
        const s2 = yinBuffer[tauEstimate + 1];
        betterTau += (s2 - s0) / (2 * (2 * s1 - s2 - s0));
      }
      return sampleRate / betterTau;
    }
    return -1;
  };

  const getNoteFromPitch = (pitch: number) => {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const A4 = 440;
    const semitones = Math.round(12 * Math.log2(pitch / A4));
    const noteIndex = (semitones % 12 + 12) % 12;
    const octave = Math.floor(semitones / 12) + 4;
    return `${noteNames[noteIndex]}${octave}`;
  };

  console.log('Detected notes:', detectedNotes);
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Audio Sandbox - Pitch Detection with YIN</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              variant={isRecording ? "destructive" : "default"}
              disabled={modelStatus !== 'Ready'}
            >
              {isRecording ? "Stop Recording" : "Start Recording"}
            </Button>
          </div>

          <div className="w-full h-48 bg-gray-200 rounded-lg overflow-hidden">
            <div className="relative w-full h-full">
              {detectedNotes.map(({ note, time }, index) => (
                <div
                  key={index}
                  className="absolute bottom-0 bg-blue-500"
                  style={{
                    left: `${(time / 10) * 100}%`,
                    width: '2%',
                    height: `${(note.charCodeAt(0) - 65) * 10}%`,
                  }}
                >
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs">
                    {note}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AudioSandbox;