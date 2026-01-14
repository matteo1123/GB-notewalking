import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { ModuleType, ModuleConfig, MetronomeConfig } from '@/types/practice';

export interface AutoRecordingOptions {
    enabled: boolean;
    moduleType: ModuleType;
    moduleConfig?: ModuleConfig;
    metronomeConfig?: MetronomeConfig; // Current metronome state for encoding in practice log
    sessionId?: string; // Practice session ID to link recordings
    minClicksBeforeRecord?: number; // Min clicks before scheduling (default: 30)
    maxClicksBeforeRecord?: number; // Max clicks before scheduling (default: 90)
    recordingDurationSeconds?: number; // How long to record (default: 30)
    existingMicStream?: MediaStream; // For modules already using mic (notewalking)
}

export interface AutoRecordingState {
    isRecording: boolean;
    countdown: number | null; // Clicks until recording starts
    scheduledClickCount: number | null; // When recording will start
    hasRecorded: boolean;
}

/**
 * Auto-recording hook for practice sessions
 * 
 * Features:
 * - Schedules random recording during practice
 * - Shows countdown when approaching
 * - Supports dual-use with existing mic streams (for pitch detection)
 * - Automatically saves to Supabase storage
 * - Links recordings to practice_log
 * 
 * Usage:
 * ```ts
 * const recording = useAutoRecording({
 *   enabled: autoRecordEnabled,
 *   moduleType: 'rhythm',
 *   moduleConfig: { rhythm_level: 5 }
 * });
 * 
 * // In metronome tick handler:
 * recording.handleTick(tickCount);
 * ```
 */
export function useAutoRecording(options: AutoRecordingOptions) {
    const {
        enabled,
        moduleType,
        moduleConfig,
        metronomeConfig,
        sessionId,
        minClicksBeforeRecord = 30,
        maxClicksBeforeRecord = 90,
        recordingDurationSeconds = 30,
        existingMicStream,
    } = options;

    const { toast } = useToast();

    const [state, setState] = useState<AutoRecordingState>({
        isRecording: false,
        countdown: null,
        scheduledClickCount: null,
        hasRecorded: false,
    });

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const recordingStreamRef = useRef<MediaStream | null>(null);

    /**
     * Schedule when the recording will start (random time within range)
     */
    const scheduleRecording = useCallback(() => {
        if (!enabled || state.hasRecorded || state.scheduledClickCount !== null) return;

        const randomClickCount =
            Math.floor(Math.random() * (maxClicksBeforeRecord - minClicksBeforeRecord + 1)) +
            minClicksBeforeRecord;

        setState(prev => ({
            ...prev,
            scheduledClickCount: randomClickCount,
        }));
    }, [enabled, state.hasRecorded, state.scheduledClickCount, minClicksBeforeRecord, maxClicksBeforeRecord]);

    /**
     * Start recording
     * Handles both new mic access and cloning existing streams
     */
    const startRecording = useCallback(async () => {
        try {
            let stream: MediaStream;

            if (existingMicStream) {
                // Clone existing stream for dual use (pitch detection + recording)
                const audioTrack = existingMicStream.getAudioTracks()[0];
                if (!audioTrack) {
                    throw new Error('No audio track found in existing stream');
                }
                stream = new MediaStream([audioTrack.clone()]);
            } else {
                // Request new mic access
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            }

            recordingStreamRef.current = stream;
            recordedChunksRef.current = [];

            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                await saveRecording();

                // Clean up stream only if we created it (not if cloned from existing)
                if (!existingMicStream && recordingStreamRef.current) {
                    recordingStreamRef.current.getTracks().forEach(track => track.stop());
                }
                recordingStreamRef.current = null;
            };

            mediaRecorder.start();
            setState(prev => ({ ...prev, isRecording: true, countdown: null }));

            toast({
                title: 'Recording started',
                description: `Recording ${recordingDurationSeconds}s for practice review`,
            });

            // Auto-stop after duration
            setTimeout(() => {
                if (mediaRecorderRef.current?.state === 'recording') {
                    mediaRecorderRef.current.stop();
                }
            }, recordingDurationSeconds * 1000);

        } catch (error) {
            console.error('Failed to start recording:', error);
            toast({
                title: 'Recording failed',
                description: 'Could not access microphone',
                variant: 'destructive',
            });
        }
    }, [existingMicStream, recordingDurationSeconds, toast]);

    /**
     * Save recording to Supabase storage
     */
    const saveRecording = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
            const fileName = `${user.id}/${Date.now()}-${moduleType}.webm`;

            const { error: uploadError } = await supabase.storage
                .from('practice')
                .upload(fileName, blob);

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('practice')
                .getPublicUrl(fileName);

            // Log to practice_log with merged metronome config
            const configWithMetronome = moduleConfig ? {
                ...moduleConfig,
                metronome: metronomeConfig,
            } : metronomeConfig ? { metronome: metronomeConfig } : undefined;

            const { error: logError } = await supabase
                .from('practice_log')
                .insert({
                    user_id: user.id,
                    duration: recordingDurationSeconds,
                    audio: publicUrl,
                    module_type: moduleType,
                    module_config: configWithMetronome,
                    session_id: sessionId || null,
                    created_at: new Date().toISOString(),
                });

            if (logError) throw logError;

            setState(prev => ({
                ...prev,
                isRecording: false,
                hasRecorded: true
            }));

            toast({
                title: 'Recording saved',
                description: 'Your practice session has been recorded',
            });

        } catch (error) {
            console.error('Failed to save recording:', error);
            toast({
                title: 'Save failed',
                description: 'Recording could not be saved',
                variant: 'destructive',
            });

            setState(prev => ({ ...prev, isRecording: false }));
        }
    }, [supabase, moduleType, moduleConfig, recordingDurationSeconds, toast]);

    /**
     * Handle metronome tick - updates countdown and triggers recording
     */
    const handleTick = useCallback((currentTickCount: number) => {
        if (!enabled || state.hasRecorded) return;

        // Schedule if not scheduled yet
        if (state.scheduledClickCount === null) {
            scheduleRecording();
            return;
        }

        // Update countdown (show last 10 clicks)
        const clicksUntilRecord = state.scheduledClickCount - currentTickCount;
        if (clicksUntilRecord <= 10 && clicksUntilRecord > 0) {
            setState(prev => ({ ...prev, countdown: clicksUntilRecord }));
        } else {
            setState(prev => ({ ...prev, countdown: null }));
        }

        // Start recording when scheduled click is reached
        if (clicksUntilRecord === 0 && !state.isRecording) {
            startRecording();
        }
    }, [enabled, state.hasRecorded, state.scheduledClickCount, state.isRecording, scheduleRecording, startRecording]);

    /**
     * Manual recording trigger (for user-initiated recording)
     */
    const startManualRecording = useCallback(() => {
        if (!state.isRecording && !state.hasRecorded) {
            startRecording();
        }
    }, [state.isRecording, state.hasRecorded, startRecording]);

    /**
     * Stop recording early
     */
    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
    }, []);

    /**
     * Reset for new session
     */
    const reset = useCallback(() => {
        setState({
            isRecording: false,
            countdown: null,
            scheduledClickCount: null,
            hasRecorded: false,
        });
        recordedChunksRef.current = [];
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (mediaRecorderRef.current?.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
            if (!existingMicStream && recordingStreamRef.current) {
                recordingStreamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, [existingMicStream]);

    return {
        ...state,
        handleTick,
        startManualRecording,
        stopRecording,
        reset,
    };
}
