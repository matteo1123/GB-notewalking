import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useRecorder } from './useRecorder';
import { useToast } from './use-toast';

export type PracticePhase = 'piece' | 'user' | 'playback' | 'idle';

interface UsePieceMasteryProps {
    audioUrl: string | null;
    segmentSeconds?: number;
    initialBlockIndex?: number;
    onProgress?: (blockIndex: number) => void;
    onLoopComplete?: (blockIndex: number, loopCount: number) => void;
}

interface LoopRange {
    start: number;
    end: number;
    label: string;
}

// Binary-tree block expansion algorithm
// Pattern: A, B, AB, C, D, CD, ABCD...
export function getBlockRange(index: number, segmentSeconds: number): LoopRange {
    const width = segmentSeconds;
    let currentIndex = 0;

    // Recursive search for the Nth node in post-order traversal
    function findRangeAt(h: number, startTime: number): LoopRange | null {
        const duration = width * Math.pow(2, h);

        // Leaf node (h=0) matches logic
        if (h === 0) {
            if (currentIndex === index) {
                return {
                    start: startTime,
                    end: startTime + width,
                    label: `${formatTime(startTime)} - ${formatTime(startTime + width)}`
                };
            }
            currentIndex++;
            return null;
        }

        // Left child
        const left = findRangeAt(h - 1, startTime);
        if (left) return left;

        // Right child
        const right = findRangeAt(h - 1, startTime + (duration / 2));
        if (right) return right;

        // Self (Merge)
        if (currentIndex === index) {
            return {
                start: startTime,
                end: startTime + duration,
                label: `Block ${formatTime(startTime)} - ${formatTime(startTime + duration)}`
            };
        }
        currentIndex++;
        return null;
    }

    // Start heavily enough to cover realistic usage (h=10 ~ 1.4 hours)
    return findRangeAt(10, 0) || { start: 0, end: segmentSeconds, label: "Start" };
}

function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export function usePieceMastery({
    audioUrl,
    segmentSeconds = 5,
    initialBlockIndex = 0,
    onProgress,
    onLoopComplete
}: UsePieceMasteryProps) {
    const { toast } = useToast();

    // Refs
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const playbackRef = useRef<HTMLAudioElement | null>(null);
    const loopTimeoutRef = useRef<number | null>(null);
    const phaseStartTimeRef = useRef<number>(0);

    // State
    const [phase, setPhase] = useState<PracticePhase>('idle');
    const [currentBlockIndex, setCurrentBlockIndex] = useState(initialBlockIndex);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
    const [loopCount, setLoopCount] = useState(0);

    // Derived
    const loopRange = useMemo(() =>
        getBlockRange(currentBlockIndex, segmentSeconds),
        [currentBlockIndex, segmentSeconds]
    );

    // Hooks
    const {
        recorderState,
        startRecording,
        stopRecording,
        resetRecording
    } = useRecorder();

    // Initialization
    useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio();
            audioRef.current.preload = 'auto'; // Optimize for tight looping
        }
        if (audioUrl) {
            audioRef.current.src = audioUrl;
        }
        if (!playbackRef.current) {
            playbackRef.current = new Audio();
        }
        return () => stopPractice();
    }, [audioUrl]);

    // Phase Transition Logic
    const transitionPhase = useCallback(async () => {
        const nextPhaseMap: Record<PracticePhase, PracticePhase> = {
            'idle': 'piece',
            'piece': 'user',
            'user': 'playback',
            'playback': 'piece'
        };

        const nextPhase = nextPhaseMap[phase];
        const duration = loopRange.end - loopRange.start;

        // Cleanup previous phase
        if (phase === 'piece') {
            audioRef.current?.pause();
        } else if (phase === 'user') {
            stopRecording();
            // recorderState.audioBlob update is handled by effect below
        } else if (phase === 'playback') {
            playbackRef.current?.pause();
            // Cycle complete, increment loop count
            setLoopCount(c => c + 1);
        }

        setPhase(nextPhase);
        phaseStartTimeRef.current = Date.now();

        // Start next phase
        if (nextPhase === 'piece') {
            if (audioRef.current) {
                audioRef.current.currentTime = loopRange.start;
                try {
                    await audioRef.current.play();
                    scheduleTransition(duration * 1000);
                } catch (e) {
                    console.error("Play failed", e);
                    setIsPlaying(false);
                }
            }
        } else if (nextPhase === 'user') {
            try {
                await startRecording();
                scheduleTransition(duration * 1000);
            } catch (e) {
                console.error("Recording failed", e);
                toast({ title: "Recording failed", variant: "destructive" });
                setIsPlaying(false);
            }
        }
        // 'playback' phase is started by the effect watching `recorderState.audioBlob`

    }, [phase, loopRange, startRecording, stopRecording, toast]);

    const scheduleTransition = (ms: number) => {
        if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
        loopTimeoutRef.current = window.setTimeout(() => {
            transitionPhase();
        }, ms);
    };

    // Start playback when recording is ready
    useEffect(() => {
        if (phase === 'playback' && recorderState.audioBlob && recorderState.status === 'stopped') {
            const url = URL.createObjectURL(recorderState.audioBlob);
            setPlaybackUrl(url);

            if (playbackRef.current) {
                playbackRef.current.src = url;
                playbackRef.current.currentTime = 0;
                playbackRef.current.play().catch(e => console.error("Playback failed", e));

                const duration = loopRange.end - loopRange.start;
                scheduleTransition(duration * 1000);
            }
        }
    }, [phase, recorderState.audioBlob, recorderState.status, loopRange]);

    // Notify parent of loop completion
    useEffect(() => {
        if (loopCount > 0) {
            onLoopComplete?.(currentBlockIndex, loopCount);
        }
    }, [loopCount, currentBlockIndex, onLoopComplete]);

    // Controls
    const togglePlay = useCallback(() => {
        if (isPlaying) {
            stopPractice();
        } else {
            startPractice();
        }
    }, [isPlaying]);

    const startPractice = () => {
        setIsPlaying(true);
        setPhase('piece'); // Always start with piece
        if (audioRef.current) {
            audioRef.current.currentTime = loopRange.start;
            const duration = loopRange.end - loopRange.start;

            audioRef.current.play().then(() => {
                scheduleTransition(duration * 1000);
            }).catch(e => {
                console.error("Start failed", e);
                setIsPlaying(false);
            });
        }
    };

    const stopPractice = () => {
        setIsPlaying(false);
        setPhase('idle');
        if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
        audioRef.current?.pause();
        playbackRef.current?.pause();
        stopRecording();
    };

    const resetBlock = (newIndex: number) => {
        stopPractice();
        setLoopCount(0);
        setCurrentBlockIndex(newIndex);
        onProgress?.(newIndex);
    };

    const nextBlock = () => resetBlock(currentBlockIndex + 1);
    const prevBlock = () => currentBlockIndex > 0 && resetBlock(currentBlockIndex - 1);
    const setBlock = (index: number) => resetBlock(index);

    // Animation Loop for UI progress
    useEffect(() => {
        let raf: number;
        const updateTime = () => {
            if (phase === 'piece' && audioRef.current) {
                setCurrentTime(audioRef.current.currentTime);
            } else if (phase === 'user') {
                const elapsed = (Date.now() - phaseStartTimeRef.current) / 1000;
                setCurrentTime(loopRange.start + elapsed);
            } else if (phase === 'playback' && playbackRef.current) {
                setCurrentTime(loopRange.start + playbackRef.current.currentTime);
            }
            raf = requestAnimationFrame(updateTime);
        };

        if (isPlaying) {
            raf = requestAnimationFrame(updateTime);
        }
        return () => cancelAnimationFrame(raf);
    }, [isPlaying, phase, loopRange]);

    return {
        state: {
            phase,
            isPlaying,
            currentBlockIndex,
            loopRange,
            currentTime,
            duration: audioRef.current?.duration || 0,
            loopCount,
            audioRef
        },
        controls: {
            togglePlay,
            nextBlock,
            prevBlock,
            setBlock
        }
    };
}
