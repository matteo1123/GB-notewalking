import { useCallback, useRef, useState } from "react";

interface DroneAudioState {
    isPlaying: boolean;
    currentNote: string | null;
}

export function useDroneAudio(audioContext: AudioContext | null) {
    const [state, setState] = useState<DroneAudioState>({
        isPlaying: false,
        currentNote: null,
    });

    const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const currentGainRef = useRef<GainNode | null>(null);
    const audioBufferCache = useRef<Record<string, AudioBuffer>>({});
    const volumeRef = useRef<number>(0.5);

    /**
     * Convert sharps to flats for URL compatibility
     */
    const convertSharpsToFlats = (note: string): string => {
        return note
            .replace("C#", "Db")
            .replace("D#", "Eb")
            .replace("F#", "Gb")
            .replace("G#", "Ab")
            .replace("A#", "Bb");
    };

    /**
     * Fetch and decode audio buffer
     */
    const fetchAudioBuffer = useCallback(
        async (note: string): Promise<AudioBuffer | null> => {
            if (!audioContext) return null;

            const flatNote = convertSharpsToFlats(note);
            const noteUrl = `https://idsufbsfywgmcrhldqxq.supabase.co/storage/v1/object/public/Piano/${flatNote}.mp3`;

            // Check cache first
            if (audioBufferCache.current[noteUrl]) {
                return audioBufferCache.current[noteUrl];
            }

            try {
                const response = await fetch(noteUrl);
                const arrayBuffer = await response.arrayBuffer();
                const buffer = await audioContext.decodeAudioData(arrayBuffer);
                audioBufferCache.current[noteUrl] = buffer;
                return buffer;
            } catch (error) {
                console.error(`Failed to fetch audio for ${note}:`, error);
                return null;
            }
        },
        [audioContext]
    );

    /**
     * Play a looping drone note
     */
    const playDrone = useCallback(
        async (rootNote: string, volume: number = 0.5) => {
            console.log('playDrone called with:', rootNote, 'volume:', volume, 'audioContext:', audioContext);
            if (!audioContext) {
                console.error('No audioContext available');
                return;
            }

            // Use octave 3 for drone (octave 2 files don't exist in storage)
            const droneNote = `${rootNote}3`;
            console.log('Fetching audio for:', droneNote);

            const buffer = await fetchAudioBuffer(droneNote);
            if (!buffer) {
                console.error('Failed to load buffer for', droneNote);
                return;
            }

            console.log('Buffer loaded successfully, creating source...');

            // Create source and gain nodes
            const source = audioContext.createBufferSource();
            const gain = audioContext.createGain();

            source.buffer = buffer;
            source.loop = true; // Enable looping

            // Set initial volume
            gain.gain.value = volume;
            volumeRef.current = volume;

            // Connect nodes
            source.connect(gain);
            gain.connect(audioContext.destination);

            // Start playback
            source.start(0);
            console.log('Drone started playing!');

            // Store references
            currentSourceRef.current = source;
            currentGainRef.current = gain;

            setState({
                isPlaying: true,
                currentNote: rootNote,
            });
        },
        [audioContext, fetchAudioBuffer]
    );

    /**
     * Stop the current drone
     */
    const stopDrone = useCallback(() => {
        if (currentSourceRef.current) {
            try {
                currentSourceRef.current.stop();
            } catch (e) {
                // Already stopped
            }
            currentSourceRef.current = null;
        }

        if (currentGainRef.current) {
            currentGainRef.current = null;
        }

        setState({
            isPlaying: false,
            currentNote: null,
        });
    }, []);

    /**
     * Smoothly transition to a new drone note with crossfade
     */
    const transitionTo = useCallback(
        async (newRootNote: string, fadeDuration: number = 0.3) => {
            if (!audioContext) return;

            const oldGain = currentGainRef.current;
            const oldSource = currentSourceRef.current;

            // Start new drone at zero volume
            const droneNote = `${newRootNote}3`;
            const buffer = await fetchAudioBuffer(droneNote);
            if (!buffer) return;

            const newSource = audioContext.createBufferSource();
            const newGain = audioContext.createGain();

            newSource.buffer = buffer;
            newSource.loop = true;
            newGain.gain.value = 0; // Start silent

            newSource.connect(newGain);
            newGain.connect(audioContext.destination);
            newSource.start(0);

            // Crossfade: fade out old, fade in new
            const currentTime = audioContext.currentTime;

            if (oldGain) {
                oldGain.gain.linearRampToValueAtTime(0, currentTime + fadeDuration);
            }

            newGain.gain.linearRampToValueAtTime(
                volumeRef.current,
                currentTime + fadeDuration
            );

            // Stop old source after fade completes
            setTimeout(() => {
                if (oldSource) {
                    try {
                        oldSource.stop();
                    } catch (e) {
                        // Already stopped
                    }
                }
            }, fadeDuration * 1000);

            // Update references
            currentSourceRef.current = newSource;
            currentGainRef.current = newGain;

            setState({
                isPlaying: true,
                currentNote: newRootNote,
            });
        },
        [audioContext, fetchAudioBuffer]
    );

    /**
     * Adjust the volume of the current drone
     */
    const setVolume = useCallback((volume: number) => {
        volumeRef.current = volume;
        if (currentGainRef.current && audioContext) {
            currentGainRef.current.gain.linearRampToValueAtTime(
                volume,
                audioContext.currentTime + 0.1
            );
        }
    }, [audioContext]);

    return {
        state,
        playDrone,
        stopDrone,
        transitionTo,
        setVolume,
    };
}
