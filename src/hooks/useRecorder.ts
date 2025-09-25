import { useState, useRef, useCallback } from 'react';

export type RecordingStatus = 'idle' | 'preparing' | 'recording' | 'stopped' | 'playing';

export interface RecorderState {
  status: RecordingStatus;
  audioBlob: Blob | null;
  duration: number; // in seconds
  error: string | null;
}

export function useRecorder() {
  const [recorderState, setRecorderState] = useState<RecorderState>({
    status: 'idle',
    audioBlob: null,
    duration: 0,
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const startRecording = useCallback(async () => {
    setRecorderState({ status: 'preparing', audioBlob: null, duration: 0, error: null });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const duration = audioBlob.size / 48000; // Assuming 48kHz sample rate
        setRecorderState((prev) => ({ ...prev, status: 'stopped', audioBlob, duration }));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setRecorderState((prev) => ({ ...prev, status: 'recording' }));
    } catch (err) {
      setRecorderState({ status: 'idle', audioBlob: null, duration: 0, error: 'Could not start recording.' });
      console.error('Error starting recording:', err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const playRecording = useCallback(() => {
    if (recorderState.audioBlob) {
      const audioUrl = URL.createObjectURL(recorderState.audioBlob);
      audioPlayerRef.current = new Audio(audioUrl);
      audioPlayerRef.current.play();
      setRecorderState((prev) => ({ ...prev, status: 'playing' }));
      audioPlayerRef.current.onended = () => {
        setRecorderState((prev) => ({ ...prev, status: 'stopped' }));
      };
    }
  }, [recorderState.audioBlob]);

  const resetRecording = useCallback(() => {
    setRecorderState({ status: 'idle', audioBlob: null, duration: 0, error: null });
  }, []);

  return {
    recorderState,
    startRecording,
    stopRecording,
    playRecording,
    resetRecording,
  };
}