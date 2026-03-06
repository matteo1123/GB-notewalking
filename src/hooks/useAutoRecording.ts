import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { ModuleType, ModuleConfig, MetronomeConfig } from '@/types/practice';
import { extractMonoFloat32Array, convertAudioToMidiInWorker } from '@/utils/audioProcessor';

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
    currentContext?: string | null; // Track current chord playing
}

export interface AutoRecordingState {
    isRecording: boolean;
    countdown: number | null; // Clicks until recording starts
    scheduledClickCount: number | null; // When recording will start
    hasRecorded: boolean;
    isEvaluating: boolean;
    feedback: string | null;
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
        currentContext = null,
    } = options;

    const { toast } = useToast();

    const [state, setState] = useState<AutoRecordingState>({
        isRecording: false,
        countdown: null,
        scheduledClickCount: null,
        hasRecorded: false,
        isEvaluating: false,
        feedback: null,
    });

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const recordingStreamRef = useRef<MediaStream | null>(null);
    const recordingStartTimeRef = useRef<number>(0);
    const contextHistoryRef = useRef<{ chord: string, startTime: number, endTime: number }[]>([]);
    const lastContextRef = useRef<{ chord: string | null, startTime: number }>({ chord: null, startTime: 0 });

    // Track context changes during recording
    useEffect(() => {
        if (state.isRecording) {
            const now = Date.now();
            if (lastContextRef.current.chord !== currentContext) {
                if (lastContextRef.current.chord !== null && recordingStartTimeRef.current > 0) {
                    contextHistoryRef.current.push({
                        chord: lastContextRef.current.chord,
                        startTime: (lastContextRef.current.startTime - recordingStartTimeRef.current) / 1000,
                        endTime: (now - recordingStartTimeRef.current) / 1000
                    });
                }
                lastContextRef.current = { chord: currentContext, startTime: now };
            }
        }
    }, [currentContext, state.isRecording]);

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
                // Finalize context history
                if (lastContextRef.current.chord !== null && recordingStartTimeRef.current > 0) {
                    contextHistoryRef.current.push({
                        chord: lastContextRef.current.chord,
                        startTime: (lastContextRef.current.startTime - recordingStartTimeRef.current) / 1000,
                        endTime: (Date.now() - recordingStartTimeRef.current) / 1000
                    });
                }

                const practiceLogId = await saveRecording();

                // Clean up stream only if we created it (not if cloned from existing)
                if (!existingMicStream && recordingStreamRef.current) {
                    recordingStreamRef.current.getTracks().forEach(track => track.stop());
                }
                recordingStreamRef.current = null;

                // Kick off AI Evaluation if save was successful
                if (practiceLogId && recordedChunksRef.current.length > 0) {
                    evaluateRecording(practiceLogId);
                }
            };

            mediaRecorder.start();
            recordingStartTimeRef.current = Date.now();
            contextHistoryRef.current = [];
            lastContextRef.current = { chord: currentContext, startTime: Date.now() };
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

            const { data: logData, error: logError } = await supabase
                .from('practice_log')
                .insert({
                    user_id: user.id,
                    duration: recordingDurationSeconds,
                    audio: publicUrl,
                    module_type: moduleType,
                    module_config: configWithMetronome,
                    session_id: sessionId || null,
                    created_at: new Date().toISOString(),
                })
                .select('id')
                .single();

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

            return logData.id;

        } catch (error) {
            console.error('Failed to save recording:', error);
            toast({
                title: 'Save failed',
                description: 'Recording could not be saved',
                variant: 'destructive',
            });

            setState(prev => ({ ...prev, isRecording: false }));
        }
    }, [supabase, moduleType, moduleConfig, sessionId, metronomeConfig, recordingDurationSeconds, toast]);

    /**
     * Evaluate recording internally
     */
    const evaluateRecording = useCallback(async (practiceLogId: number) => {
        setState(prev => ({ ...prev, isEvaluating: true }));
        try {
            toast({
                title: 'AI Analyzing',
                description: 'Converting audio to MIDI and requesting AI feedback...',
            });

            // 1. Convert WebM Blob to Mono Float32Array
            const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
            const audioData = await extractMonoFloat32Array(blob);

            // 2. Transcribe to MIDI Note Events using Web Worker
            const noteEvents = await convertAudioToMidiInWorker(audioData);

            // 3. Send to Edge Function
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("No active session");

            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evaluate-practice`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    practice_log_id: practiceLogId,
                    module_type: moduleType,
                    midi_data: noteEvents,
                    harmonic_context: contextHistoryRef.current
                })
            });

            if (!response.ok) {
                const errResult = await response.json();
                throw new Error(errResult.error || "Edge function failed");
            }

            const resultData = await response.json();

            setState(prev => ({ ...prev, feedback: resultData.feedback }));

            if (resultData.db_error) {
                console.error("Evaluation saved with DB error:", resultData.db_error);
                toast({
                    title: 'Evaluation Complete (Not Saved)',
                    description: `The AI Coach provided feedback, but we couldn't save it: ${resultData.db_error}`,
                    variant: 'destructive',
                });
            } else {
                toast({
                    title: 'Evaluation Complete',
                    description: 'The AI Coach has provided feedback on your performance!',
                });
            }

        } catch (err: any) {
            console.error("Evaluation pipeline failed:", err);
            toast({
                title: 'Evaluation Failed',
                description: err.message || 'Could not evaluate performance',
                variant: 'destructive',
            });
        } finally {
            setState(prev => ({ ...prev, isEvaluating: false }));
        }
    }, [moduleType, toast]);

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
            isEvaluating: false,
            feedback: null,
        });
        recordedChunksRef.current = [];
        contextHistoryRef.current = [];
        recordingStartTimeRef.current = 0;
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
