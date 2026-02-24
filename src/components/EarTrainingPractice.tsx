import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as Tone from 'tone';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Card, CardContent } from './ui/card';
import { Play, Square, Headphones, RefreshCw, Settings, Volume2, Ear } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { useNotePlayer } from '@/hooks/useNotePlayer';
import { EarTrainingPracticeModuleConfig } from '@/types/practice';
import { useSession } from '@/contexts/SessionContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface EarTrainingPracticeProps {
    moduleConfig?: EarTrainingPracticeModuleConfig;
    onConfigChange?: (config: EarTrainingPracticeModuleConfig) => void;
    onExit?: () => void;
    autoStart?: boolean;
    sessionId?: string;
}

// Map degrees to their semitone offset from root
const DEGREE_OFFSETS = {
    '1': 0,
    'b2': 1,
    '2': 2,
    'b3': 3,
    '3': 4,
    '4': 5,
    'b5': 6,
    '5': 7,
    'b6': 8,
    '6': 9,
    'b7': 10,
    '7': 11
} as const;

type Degree = keyof typeof DEGREE_OFFSETS;

// Define progression levels
const LEVELS: Degree[][] = [
    ['1', '3'],                   // Level 1: Major 3rd
    ['1', '3', '5'],              // Level 2: Major triad
    ['1', '2', '4'],              // Level 3: Steps and 4ths
    ['1', '2', '3', '4', '5'],    // Level 4: Major pentachord
    ['1', '2', '3', '4', '5', '6'], // Level 5: Major hexachord
    ['1', '2', '3', '4', '5', '6', '7'], // Level 6: Full major scale
    ['1', 'b3', '5'],             // Level 7: Minor triad
    ['1', '2', 'b3', '4', '5'],   // Level 8: Minor pentachord
    ['1', '2', 'b3', '4', '5', 'b6', 'b7'], // Level 9: Full minor (Aeolian)
    ['1', '3', '5', 'b7'],        // Level 10: Dominant 7 chord tones
    ['1', '2', 'b3', '4', '5', '6', 'b7'], // Level 11: Dorian
    ['1', '2', '3', '4', '5', '6', 'b7'],  // Level 12: Mixolydian
    ['1', 'b2', 'b3', '4', 'b5', 'b6', 'b7'], // Level 13: Locrian
    ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'] // Level 14: Chromatic
];

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const getNoteFromOffset = (rootNote: string, offset: number, targetOctave: number = 4) => {
    // Normalize root note
    let normalizedRoot = rootNote;
    if (rootNote === 'Db') normalizedRoot = 'C#';
    else if (rootNote === 'Eb') normalizedRoot = 'D#';
    else if (rootNote === 'Gb') normalizedRoot = 'F#';
    else if (rootNote === 'Ab') normalizedRoot = 'G#';
    else if (rootNote === 'Bb') normalizedRoot = 'A#';

    const rootIndex = NOTES.indexOf(normalizedRoot);
    if (rootIndex === -1) return "C4"; // Fallback

    const targetIndex = (rootIndex + offset) % 12;
    // We add octaves if the interval crosses C.
    const octaveShift = Math.floor((rootIndex + offset) / 12);
    const finalOctave = targetOctave + octaveShift;

    const finalNoteName = NOTES[targetIndex];
    const finalNote = `${finalNoteName}${finalOctave}`;

    // Flat conversion for Supabase storage
    return finalNote.replace('C#', 'Db')
        .replace('D#', 'Eb')
        .replace('F#', 'Gb')
        .replace('G#', 'Ab')
        .replace('A#', 'Bb');
};


export function EarTrainingPractice({ moduleConfig, onConfigChange, onExit, autoStart = false, sessionId }: EarTrainingPracticeProps) {
    const { activeSession } = useSession();
    const { user } = useAuth();
    const isPaused = activeSession?.isPaused || false;

    const [maxUnlockedLevel, setMaxUnlockedLevel] = useState(1);

    // Fetch user's ear training level
    useEffect(() => {
        if (!user) return;
        const fetchLevel = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('ear_training_level')
                .eq('id', user.id)
                .single();
            if (!error && data) {
                setMaxUnlockedLevel(data.ear_training_level || 1);
            }
        };
        fetchLevel();
    }, [user]);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentLevel, setCurrentLevel] = useState(moduleConfig?.level || 0);
    const [autoLevel, setAutoLevel] = useState(true);
    const [attempts, setAttempts] = useState<boolean[]>([]);

    const [currentRootNote, setCurrentRootNote] = useState(() => moduleConfig?.root_note || NOTES[Math.floor(Math.random() * NOTES.length)]);
    const [droneOctave, setDroneOctave] = useState(moduleConfig?.drone_octave || 3);
    const [keyChangeInterval, setKeyChangeInterval] = useState(moduleConfig?.key_change_interval || 5);
    const [correctGuessesSinceKeyChange, setCorrectGuessesSinceKeyChange] = useState(0);

    // New persistent audio/feature settings
    const [droneVolume, setDroneVolume] = useState(() => {
        const saved = localStorage.getItem('ear-training-drone-volume');
        return saved ? parseInt(saved, 10) : 50;
    });
    const [noteVolume, setNoteVolume] = useState(() => {
        const saved = localStorage.getItem('ear-training-note-volume');
        return saved ? parseInt(saved, 10) : 80;
    });
    const [playScale, setPlayScale] = useState(() => {
        if (moduleConfig?.playScale !== undefined) return moduleConfig.playScale;
        const saved = localStorage.getItem('ear-training-play-scale');
        return saved ? saved === 'true' : false;
    });
    const [listenOnlyMode, setListenOnlyMode] = useState(() => {
        if (moduleConfig?.listenOnlyMode !== undefined) return moduleConfig.listenOnlyMode;
        const saved = localStorage.getItem('ear-training-listen-only');
        return saved ? saved === 'true' : true; // Default to true!
    });
    const [playAnswerScale, setPlayAnswerScale] = useState(() => {
        if (moduleConfig?.playAnswerScale !== undefined) return moduleConfig.playAnswerScale;
        const saved = localStorage.getItem('ear-training-play-answer-scale');
        return saved ? saved === 'true' : false;
    });
    const [targetNoteRepeats, setTargetNoteRepeats] = useState(() => {
        if (moduleConfig?.targetNoteRepeats !== undefined) return moduleConfig.targetNoteRepeats;
        const saved = localStorage.getItem('ear-training-note-repeats');
        return saved ? parseInt(saved, 10) : 1;
    });
    const [trainingMode, setTrainingMode] = useState<'guided' | 'custom'>(() => {
        if (moduleConfig?.trainingMode) return moduleConfig.trainingMode;
        const saved = localStorage.getItem('ear-training-mode');
        return (saved as 'guided' | 'custom') || 'guided';
    });
    const [customDegrees, setCustomDegrees] = useState<Degree[]>(() => {
        if (moduleConfig?.customDegrees) return moduleConfig.customDegrees as Degree[];
        const saved = localStorage.getItem('ear-training-custom-degrees');
        try {
            return saved ? JSON.parse(saved) : ['1', '3', '5'];
        } catch {
            return ['1', '3', '5'];
        }
    });

    // Enforce max level on load if in guided mode
    useEffect(() => {
        if (trainingMode === 'guided' && currentLevel > maxUnlockedLevel - 1) {
            setCurrentLevel(Math.max(0, maxUnlockedLevel - 1));
        }
    }, [maxUnlockedLevel, trainingMode, currentLevel]);

    // Save preferences to localStorage
    useEffect(() => {
        localStorage.setItem('ear-training-drone-volume', droneVolume.toString());
        localStorage.setItem('ear-training-note-volume', noteVolume.toString());
        localStorage.setItem('ear-training-play-scale', playScale.toString());
        localStorage.setItem('ear-training-listen-only', listenOnlyMode.toString());
        localStorage.setItem('ear-training-play-answer-scale', playAnswerScale.toString());
        localStorage.setItem('ear-training-note-repeats', targetNoteRepeats.toString());
        localStorage.setItem('ear-training-mode', trainingMode);
        localStorage.setItem('ear-training-custom-degrees', JSON.stringify(customDegrees));
    }, [droneVolume, noteVolume, playScale, listenOnlyMode, playAnswerScale, targetNoteRepeats, trainingMode, customDegrees]);

    // Sync state back to parent
    useEffect(() => {
        if (onConfigChange && moduleConfig) {
            onConfigChange({
                ...moduleConfig,
                root_note: currentRootNote,
                drone_octave: droneOctave,
                key_change_interval: keyChangeInterval,
                level: currentLevel,
                listenOnlyMode,
                playScale,
                playAnswerScale,
                targetNoteRepeats,
                trainingMode,
                customDegrees: customDegrees as string[]
            });
        }
    }, [currentRootNote, droneOctave, keyChangeInterval, currentLevel, listenOnlyMode, playScale, playAnswerScale, targetNoteRepeats, trainingMode, customDegrees]);

    const [currentTargetDegree, setCurrentTargetDegree] = useState<Degree | null>(null);
    const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const [showDegrees, setShowDegrees] = useState(false);

    const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
    const { playNote, preloadNotes } = useNotePlayer(audioContext);
    const synthRef = useRef<Tone.PolySynth | null>(null);
    const isPlayingRef = useRef(isPlaying);

    // Sync ref with playing state for async functions
    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    // Initialize Audio Context on start
    useEffect(() => {
        if (isPlaying && !audioContext) {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            setAudioContext(ctx);
        }
    }, [isPlaying, audioContext]);

    // Preload audio files for the current level/mode to prevent stuttering
    useEffect(() => {
        if (!audioContext || !isPlaying) return;

        const degreesToPreload: Degree[] = trainingMode === 'custom' && customDegrees.length > 0
            ? customDegrees
            : LEVELS[currentLevel];

        // Preload octaves 3, 4, and 5 for the target notes, plus the major scale notes for the "ruler"
        const notesToPreload: string[] = [];

        // Include major scale ruler offsets for the answer scale
        const majorOffsets = [0, 2, 4, 5, 7, 9, 11];
        const allRelevantOffsets = new Set([
            ...degreesToPreload.map(d => DEGREE_OFFSETS[d]),
            ...majorOffsets
        ]);

        Array.from(allRelevantOffsets).forEach(offset => {
            [3, 4, 5].forEach(octave => {
                notesToPreload.push(getNoteFromOffset(currentRootNote, offset, octave));
            });
        });

        if (notesToPreload.length > 0) {
            preloadNotes(notesToPreload).catch(console.error);
        }
    }, [audioContext, isPlaying, currentLevel, trainingMode, customDegrees, currentRootNote, preloadNotes]);

    // Drone management
    useEffect(() => {
        if (!isPlaying || isPaused) {
            if (synthRef.current) {
                synthRef.current.releaseAll();
            }
            return;
        }

        const startDrone = async () => {
            await Tone.start();
            if (!synthRef.current) {
                synthRef.current = new Tone.PolySynth(Tone.Synth, {
                    oscillator: { type: "sine" },
                    envelope: { attack: 2, decay: 0, sustain: 1, release: 2 }
                }).toDestination();

                // Set initial volume when starting
                if (droneVolume === 0) {
                    synthRef.current.volume.value = -100;
                } else {
                    synthRef.current.volume.value = (droneVolume / 100) * 40 - 40;
                }
            }

            // Play root note drone in a low octave (e.g., octave 2 or 3)
            // Normalize flat to sharp for Tone.js
            let toneRoot = currentRootNote;
            if (toneRoot === 'Db') toneRoot = 'C#';
            else if (toneRoot === 'Eb') toneRoot = 'D#';
            else if (toneRoot === 'Gb') toneRoot = 'F#';
            else if (toneRoot === 'Ab') toneRoot = 'G#';
            else if (toneRoot === 'Bb') toneRoot = 'A#';

            synthRef.current.triggerAttack([`${toneRoot}${droneOctave}`, `${toneRoot}${droneOctave + 1}`]);
        };

        startDrone();

        return () => {
            if (synthRef.current) {
                synthRef.current.releaseAll();
            }
        };
    }, [isPlaying, isPaused, currentRootNote, droneOctave]);

    // Handle drone volume changes independently to avoid restarting the drone
    useEffect(() => {
        if (synthRef.current) {
            if (droneVolume === 0) {
                synthRef.current.volume.rampTo(-100, 0.1);
            } else {
                const db = (droneVolume / 100) * 40 - 40;
                synthRef.current.volume.rampTo(db, 0.1);
            }
        }
    }, [droneVolume]);

    // Play next note function
    const playNextChallenge = useCallback(async () => {
        if (!isPlaying || isPaused || !audioContext) return;
        if (!isPlayingRef.current) return;

        setFeedback(null);
        setShowDegrees(false);

        const availableDegrees = trainingMode === 'custom' && customDegrees.length > 0
            ? customDegrees
            : LEVELS[currentLevel];
        // Pick a random degree from the current level
        const randomDegree = availableDegrees[Math.floor(Math.random() * availableDegrees.length)];
        setCurrentTargetDegree(randomDegree);

        // Randomly pick octave 3, 4, or 5 to make it octave agnostic
        const targetOctave = Math.floor(Math.random() * 3) + 3;
        const offset = DEGREE_OFFSETS[randomDegree];

        const noteToPlay = getNoteFromOffset(currentRootNote, offset, targetOctave);

        // If Play Scale is enabled, play the scale up to the highest degree in the level and back down
        if (playScale) {
            // Find the maximum offset in the current set
            let maxOffset = 0;
            availableDegrees.forEach(deg => {
                if (DEGREE_OFFSETS[deg] > maxOffset) {
                    maxOffset = DEGREE_OFFSETS[deg];
                }
            });

            // Build a diatonic scale ruler up to that max offset
            const majorOffsets = [0, 2, 4, 5, 7, 9, 11];
            // Start with all major scale notes up to the max offset
            const baseRuler = majorOffsets.filter(o => o <= maxOffset);

            // Add any custom/out-of-key notes from the available degrees
            availableDegrees.forEach(deg => {
                baseRuler.push(DEGREE_OFFSETS[deg]);
            });

            // Remove duplicates and sort
            const scaleOffsetsUp = Array.from(new Set(baseRuler)).sort((a, b) => a - b);

            const scaleOffsetsDown = [...scaleOffsetsUp].reverse().slice(1);
            const fullScaleOffsets = [...scaleOffsetsUp, ...scaleOffsetsDown];

            // Play the scale sequence slower
            for (const scaleOffset of fullScaleOffsets) {
                if (!isPlayingRef.current || isPaused) return;
                const scaleNote = getNoteFromOffset(currentRootNote, scaleOffset, targetOctave);
                await playNote(scaleNote, noteVolume / 100);
                await new Promise(resolve => setTimeout(resolve, 800)); // Time between scale notes
            }

            // Longer pause after the scale
            await new Promise(resolve => setTimeout(resolve, 1500));
            if (!isPlayingRef.current || isPaused) return;
        } else {
            // Delay before playing the note if not playing scale
            await new Promise(resolve => setTimeout(resolve, 1500));
            if (!isPlayingRef.current || isPaused) return;
        }

        // Play the target challenge note based on targetNoteRepeats
        for (let i = 0; i < targetNoteRepeats; i++) {
            if (!isPlayingRef.current || isPaused) return;
            playNote(noteToPlay, noteVolume / 100);
            if (i < targetNoteRepeats - 1) {
                // Slower repeat delay
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }

        // Listen Only Mode Logic
        if (listenOnlyMode) {
            // 2-second pause before revealing the answer
            await new Promise(resolve => setTimeout(resolve, 2000));
            if (!isPlayingRef.current || isPaused) return;

            setFeedback('correct'); // Highlight it as correct
            setShowDegrees(true); // Reveal the answer immediately

            // Answer Scale playback
            if (playAnswerScale) {
                const targetOffset = DEGREE_OFFSETS[randomDegree];
                const scaleOffsetsUp = Object.values(DEGREE_OFFSETS).filter(off => off <= targetOffset).sort((a, b) => a - b);
                // Use a major scale structure as the default "ruler"
                let rulerOffsets: number[] = scaleOffsetsUp;

                if (trainingMode === 'guided') {
                    rulerOffsets = availableDegrees.map(deg => DEGREE_OFFSETS[deg]).filter(off => off <= targetOffset).sort((a, b) => a - b);
                } else {
                    const majorOffsets = [0, 2, 4, 5, 7, 9, 11];
                    const baseRuler = new Set([...majorOffsets.filter(o => o < targetOffset), targetOffset]);
                    rulerOffsets = Array.from(baseRuler).sort((a, b) => a - b);
                }

                // Ensure Root is included
                if (!rulerOffsets.includes(0)) rulerOffsets.unshift(0);

                const scaleOffsetsDown = [...rulerOffsets].reverse().slice(1);
                const answerScaleOffsets = [...rulerOffsets, ...scaleOffsetsDown];

                // Brief pause before starting the answer scale
                await new Promise(resolve => setTimeout(resolve, 500));

                for (const scaleOffset of answerScaleOffsets) {
                    if (!isPlayingRef.current || isPaused) return;
                    const scaleNote = getNoteFromOffset(currentRootNote, scaleOffset, targetOctave);
                    await playNote(scaleNote, noteVolume / 100);
                    await new Promise(resolve => setTimeout(resolve, 800)); // Slower playback
                }
            }

            // Significant pause before automatically moving to the next challenge
            await new Promise(resolve => setTimeout(resolve, 2500));
            if (!isPlayingRef.current || isPaused) return;
            playNextChallenge();
        }

    }, [isPlaying, isPaused, currentLevel, currentRootNote, playNote, noteVolume, playScale, listenOnlyMode, audioContext, trainingMode, customDegrees, playAnswerScale, targetNoteRepeats]);

    // Auto-start logic
    useEffect(() => {
        if (autoStart && !isPlaying) {
            setIsPlaying(true);
        }
    }, [autoStart, isPlaying]);

    // Start challenge loop when playing state changes
    useEffect(() => {
        if (isPlaying && !currentTargetDegree && audioContext) {
            playNextChallenge();
        }
    }, [isPlaying, currentTargetDegree, playNextChallenge, audioContext]);


    const handleGuess = (guessedDegree: Degree) => {
        // If in listen-only mode, we don't process actual guesses from user clicks
        if (feedback !== null || !currentTargetDegree || listenOnlyMode) return; // Prevent multiple guesses

        const isCorrect = guessedDegree === currentTargetDegree;
        setFeedback(isCorrect ? 'correct' : 'incorrect');
        setShowDegrees(true); // Show the correct answer

        // Telemetry insert
        if (user) {
            supabase.from('ear_training_stats').insert({
                user_id: user.id,
                session_id: activeSession?.session.id || null,
                training_mode: trainingMode,
                listen_only: listenOnlyMode,
                root_note: currentRootNote,
                target_degree: currentTargetDegree,
                guessed_degree: guessedDegree,
                is_correct: isCorrect
            }).then(({ error }) => {
                if (error) console.error("Telemetry error", error);
            });
        }

        if (isCorrect && keyChangeInterval > 0) {
            const newCount = correctGuessesSinceKeyChange + 1;
            if (newCount >= keyChangeInterval) {
                // Time to change key
                setCorrectGuessesSinceKeyChange(0);
                const currentNoteIndex = NOTES.indexOf(currentRootNote);
                let nextNoteIndex = currentNoteIndex;
                while (nextNoteIndex === currentNoteIndex) {
                    nextNoteIndex = Math.floor(Math.random() * NOTES.length);
                }
                setCurrentRootNote(NOTES[nextNoteIndex]);
            } else {
                setCorrectGuessesSinceKeyChange(newCount);
            }
        } else if (!isCorrect) {
            // Reset streak on incorrect guess? Depends on design, we'll just not increment for now
        }

        // Update attempts history
        setAttempts(prev => {
            const newAttempts = [...prev, isCorrect];
            // Keep only the last 20 attempts for accuracy calculation
            if (newAttempts.length > 20) {
                return newAttempts.slice(newAttempts.length - 20);
            }
            return newAttempts;
        });

        if (isCorrect) {
            if (playAnswerScale) {
                const playAnswerSequence = async () => {
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Let the success effect play briefly
                    if (!isPlayingRef.current) return;

                    const targetOffset = DEGREE_OFFSETS[currentTargetDegree];
                    let rulerOffsets: number[] = Object.values(DEGREE_OFFSETS).filter(off => off <= targetOffset).sort((a, b) => a - b);

                    const availableDegrees = trainingMode === 'custom' && customDegrees.length > 0
                        ? customDegrees
                        : LEVELS[currentLevel];

                    if (trainingMode === 'guided') {
                        rulerOffsets = availableDegrees.map(deg => DEGREE_OFFSETS[deg]).filter(off => off <= targetOffset).sort((a, b) => a - b);
                    } else {
                        const majorOffsets = [0, 2, 4, 5, 7, 9, 11];
                        const baseRuler = new Set([...majorOffsets.filter(o => o < targetOffset), targetOffset]);
                        rulerOffsets = Array.from(baseRuler).sort((a, b) => a - b);
                    }

                    if (!rulerOffsets.includes(0)) rulerOffsets.unshift(0);

                    const scaleOffsetsDown = [...rulerOffsets].reverse().slice(1);
                    const answerScaleOffsets = [...rulerOffsets, ...scaleOffsetsDown];

                    for (const scaleOffset of answerScaleOffsets) {
                        if (!isPlayingRef.current || isPaused) return;
                        const scaleNote = getNoteFromOffset(currentRootNote, scaleOffset, 4);
                        await playNote(scaleNote, noteVolume / 100);
                        await new Promise(resolve => setTimeout(resolve, 600));
                    }
                    if (!isPlayingRef.current || isPaused) return;
                    playNextChallenge();
                };
                playAnswerSequence();
            } else {
                setTimeout(() => {
                    if (isPlayingRef.current) playNextChallenge();
                }, 1500);
            }
        } else {
            // Automatically progress after a delay if incorrect
            setTimeout(() => {
                if (isPlayingRef.current) playNextChallenge();
            }, 1500);
        }
    };

    // Check progression
    useEffect(() => {
        if (trainingMode === 'custom') return; // Do not eval levels in custom mode

        if (attempts.length >= 10 && autoLevel) { // Require at least 10 attempts to evaluate
            const correctCount = attempts.filter(a => a).length;
            const accuracy = correctCount / attempts.length;

            if (accuracy >= 0.9 && currentLevel < LEVELS.length - 1) {
                // Advance to next level
                const nextLevel = currentLevel + 1;
                setCurrentLevel(nextLevel);
                setAttempts([]); // Reset attempts for the new level

                // If they unlocked a new level, save it back to profile
                if (user && nextLevel + 1 > maxUnlockedLevel) {
                    setMaxUnlockedLevel(nextLevel + 1);
                    supabase.from('profiles').update({ ear_training_level: nextLevel + 1 }).eq('id', user.id)
                        .then(({ error }) => {
                            if (error) console.error("Failed to update max level", error);
                        });
                }
                // Optionally play a success chime or give visual feedback of level up
            }
        }
    }, [attempts, currentLevel, trainingMode, autoLevel, user, maxUnlockedLevel]);


    const togglePlayback = useCallback(() => {
        if (isPlaying) {
            setIsPlaying(false);
            isPlayingRef.current = false; // Synchronously abort loops
            setCurrentTargetDegree(null);
        } else {
            setIsPlaying(true);
            setFeedback(null);
            setShowDegrees(false);

            // Small delay to allow drone synthesis to initialize, then start the challenge loop
            setTimeout(() => {
                if (isPlayingRef.current) {
                    playNextChallenge();
                }
            }, 200);
        }
    }, [isPlaying, playNextChallenge]);

    // Bind Bluetooth Headphone / Media Session Controls
    useEffect(() => {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.setActionHandler('play', () => {
                if (!isPlayingRef.current) togglePlayback();
            });
            navigator.mediaSession.setActionHandler('pause', () => {
                if (isPlayingRef.current) togglePlayback();
            });
            // Update playback state so mobile OS knows it's active
            navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
        }

        return () => {
            if ('mediaSession' in navigator) {
                navigator.mediaSession.setActionHandler('play', null);
                navigator.mediaSession.setActionHandler('pause', null);
            }
        };
    }, [togglePlayback, isPlaying]);

    // Robustness: Abort playback if settings change drastically
    useEffect(() => {
        if (isPlayingRef.current) {
            setIsPlaying(false);
            isPlayingRef.current = false; // Synchronous abort
            setCurrentTargetDegree(null);
        }
    }, [trainingMode, listenOnlyMode, customDegrees, currentRootNote]);

    const replayNote = () => {
        if (currentTargetDegree) {
            const targetOctave = 4; // Or keep track of previous random octave
            const offset = DEGREE_OFFSETS[currentTargetDegree];
            const noteToPlay = getNoteFromOffset(currentRootNote, offset, targetOctave);
            playNote(noteToPlay, noteVolume / 100);
        }
    };

    const calculateAccuracy = () => {
        if (attempts.length === 0) return 0;
        return Math.round((attempts.filter(a => a).length / attempts.length) * 100);
    };

    const currentLevelDegrees = LEVELS[currentLevel];

    return (
        <div className="flex flex-col h-full bg-background p-4 md:p-8">
            <div className="max-w-3xl mx-auto w-full space-y-8 flex-1 flex flex-col">

                {/* Header info */}
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <Headphones className="w-6 h-6" />
                            Ear Training
                        </h2>
                        <p className="text-muted-foreground">Identify the scale degree over the drone</p>
                    </div>
                    <div className="flex gap-4 text-right">
                        <div>
                            <div className="flex items-center justify-end gap-2 text-xl font-bold mt-1">
                                {currentRootNote} Drone
                                {correctGuessesSinceKeyChange > 0 && keyChangeInterval > 0 && (
                                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-normal">
                                        Shift in {keyChangeInterval - correctGuessesSinceKeyChange}
                                    </span>
                                )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {trainingMode === 'custom' ? 'Custom Mode' : `Level ${currentLevel + 1} of ${LEVELS.length}`}
                            </div>
                        </div>

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="icon" className="h-10 w-10 shrink-0">
                                    <Settings className="w-5 h-5" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80" align="end">
                                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                                    <h4 className="font-medium leading-none mb-4">Training Settings</h4>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="auto-level">Auto-Progress Level</Label>
                                            <Switch
                                                id="auto-level"
                                                checked={autoLevel}
                                                onCheckedChange={setAutoLevel}
                                                disabled={trainingMode === 'custom'}
                                            />
                                        </div>

                                        <div className={`space-y-1.5 pt-2 ${trainingMode === 'custom' ? 'opacity-50 pointer-events-none' : ''}`}>
                                            <div className="flex justify-between items-center">
                                                <Label>Difficulty Level</Label>
                                                <span className="text-xs text-muted-foreground">{currentLevel + 1} / {LEVELS.length}</span>
                                            </div>
                                            <Slider
                                                value={[currentLevel]}
                                                min={0}
                                                max={trainingMode === 'custom' ? LEVELS.length - 1 : Math.min(maxUnlockedLevel - 1, LEVELS.length - 1)}
                                                step={1}
                                                onValueChange={([val]) => setCurrentLevel(val)}
                                                disabled={autoLevel}
                                            />
                                        </div>

                                        <div className="space-y-1.5 pt-2">
                                            <div className="flex justify-between items-center">
                                                <Label>Drone Octave</Label>
                                                <span className="text-xs text-muted-foreground">{droneOctave}</span>
                                            </div>
                                            <Slider
                                                value={[droneOctave]}
                                                min={1}
                                                max={5}
                                                step={1}
                                                onValueChange={([val]) => setDroneOctave(val)}
                                            />
                                        </div>

                                        <div className="space-y-1.5 pt-2">
                                            <div className="flex justify-between items-center">
                                                <Label>Key Change Interval</Label>
                                                <span className="text-xs text-muted-foreground">
                                                    {keyChangeInterval === 0 ? 'Never' : `Every ${keyChangeInterval} guesses`}
                                                </span>
                                            </div>
                                            <Slider
                                                value={[keyChangeInterval]}
                                                min={0}
                                                max={20}
                                                step={1}
                                                onValueChange={([val]) => setKeyChangeInterval(val)}
                                            />
                                        </div>

                                        <div className="space-y-1.5 pt-4 border-t">
                                            <div className="flex justify-between items-center bg-transparent">
                                                <Label className="flex items-center gap-2"><Volume2 className="w-4 h-4" /> Piano Volume</Label>
                                                <span className="text-xs text-muted-foreground">{noteVolume}%</span>
                                            </div>
                                            <Slider
                                                value={[noteVolume]}
                                                min={0}
                                                max={100}
                                                step={1}
                                                onValueChange={([val]) => setNoteVolume(val)}
                                            />
                                        </div>

                                        <div className="space-y-1.5 pt-2">
                                            <div className="flex justify-between items-center bg-transparent">
                                                <Label className="flex items-center gap-2"><Volume2 className="w-4 h-4" /> Drone Volume</Label>
                                                <span className="text-xs text-muted-foreground">{droneVolume}%</span>
                                            </div>
                                            <Slider
                                                value={[droneVolume]}
                                                min={0}
                                                max={100}
                                                step={1}
                                                onValueChange={([val]) => setDroneVolume(val)}
                                            />
                                        </div>

                                        <div className="space-y-3 pt-4 border-t">
                                            <div className="flex items-center justify-between">
                                                <Label htmlFor="play-scale" className="text-sm">Play Level/Scale Before</Label>
                                                <Switch
                                                    id="play-scale"
                                                    checked={playScale}
                                                    onCheckedChange={setPlayScale}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <Label htmlFor="play-answer-scale" className="text-sm">Play Answer Scale After</Label>
                                                <Switch
                                                    id="play-answer-scale"
                                                    checked={playAnswerScale}
                                                    onCheckedChange={setPlayAnswerScale}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <Label htmlFor="listen-only" className="text-sm">Listen Only Mode</Label>
                                                <Switch
                                                    id="listen-only"
                                                    checked={listenOnlyMode}
                                                    onCheckedChange={setListenOnlyMode}
                                                />
                                            </div>
                                            <div className="space-y-1.5 pt-2">
                                                <div className="flex justify-between items-center">
                                                    <Label className="text-sm">Listen Target Repeats</Label>
                                                    <span className="text-xs text-muted-foreground">{targetNoteRepeats}x</span>
                                                </div>
                                                <Slider
                                                    value={[targetNoteRepeats]}
                                                    min={1}
                                                    max={5}
                                                    step={1}
                                                    onValueChange={([val]) => setTargetNoteRepeats(val)}
                                                />
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                {/* Mode Selector */}
                <div className="flex justify-center mt-2 mb-6">
                    <div className="inline-flex items-center bg-muted p-1 rounded-lg">
                        <Button
                            variant={trainingMode === 'guided' ? 'default' : 'ghost'}
                            size="sm"
                            disabled={isPlaying}
                            onClick={() => setTrainingMode('guided')}
                            className="rounded-md"
                        >
                            Guided Levels
                        </Button>
                        <Button
                            variant={trainingMode === 'custom' ? 'default' : 'ghost'}
                            size="sm"
                            disabled={isPlaying}
                            onClick={() => setTrainingMode('custom')}
                            className="rounded-md"
                        >
                            Custom (Free Play)
                        </Button>
                    </div>
                </div>

                {/* Custom Mode Grid */}
                {trainingMode === 'custom' && (
                    <Card className="bg-muted/30 border-dashed border-2">
                        <CardContent className="p-4 pt-6">
                            <div className="mb-4 text-center">
                                <h3 className="font-semibold text-sm">Select Intervals to Train</h3>
                                <p className="text-xs text-muted-foreground">Pick the exact scale degrees you want to practice.</p>
                            </div>
                            <div className="flex flex-wrap gap-2 justify-center max-w-2xl mx-auto">
                                {Object.keys(DEGREE_OFFSETS).map((degreeKey) => {
                                    const degree = degreeKey as Degree;
                                    const isSelected = customDegrees.includes(degree);

                                    return (
                                        <Button
                                            key={degree}
                                            variant={isSelected ? 'default' : 'outline'}
                                            size="sm"
                                            disabled={isPlaying}
                                            onClick={() => {
                                                setCustomDegrees(prev => {
                                                    if (prev.includes(degree)) {
                                                        const noThis = prev.filter(d => d !== degree);
                                                        // Require at least 2 degrees
                                                        return noThis.length < 2 ? prev : noThis;
                                                    } else {
                                                        // Keep it sorted by offset using the DEGREE_OFFSETS map
                                                        const newArr = [...prev, degree];
                                                        return newArr.sort((a, b) => DEGREE_OFFSETS[a] - DEGREE_OFFSETS[b]);
                                                    }
                                                });
                                            }}
                                            className={`min-w-[48px] ${isSelected ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''}`}
                                        >
                                            {degree}
                                        </Button>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Progress / Accuracy */}
                <Card className="bg-muted/50">
                    <CardContent className="p-4 flex flex-col gap-2">
                        <div className="flex justify-between items-center text-sm mb-1">
                            <span>Level Progress (Advance at 90%)</span>
                            <span className="font-semibold">{calculateAccuracy()}% Accuracy</span>
                        </div>
                        <div className="flex gap-1 h-3">
                            {Array.from({ length: Math.max(10, attempts.length) }).map((_, i) => (
                                <div
                                    key={i}
                                    className={`flex-1 rounded-sm ${i >= attempts.length ? 'bg-secondary' :
                                        attempts[i] ? 'bg-green-500' : 'bg-destructive'
                                        }`}
                                />
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Main Interactive Area */}
                <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
                    {!isPlaying ? (
                        <div className="text-center space-y-4">
                            <Headphones className="w-24 h-24 mx-auto text-muted-foreground opacity-50" />
                            <p className="text-lg">Ready to test your ears?</p>
                            <Button size="lg" onClick={togglePlayback} className="gap-2">
                                <Play className="w-5 h-5" /> Start Training
                            </Button>
                        </div>
                    ) : (
                        <div className="w-full space-y-12">
                            {/* Visual Feedback Area */}
                            <div className="h-32 flex items-center justify-center">
                                {feedback === 'correct' && (
                                    <div className={`font-bold animate-in zoom-in duration-300 ${listenOnlyMode ? 'text-8xl text-indigo-500' : 'text-5xl text-green-500'}`}>
                                        {listenOnlyMode ? currentTargetDegree : "Correct!"}
                                    </div>
                                )}
                                {feedback === 'incorrect' && (
                                    <div className="text-4xl font-bold text-destructive animate-in shake duration-300 flex flex-col items-center">
                                        Incorrect
                                        <div className="text-2xl mt-2 text-foreground/80">
                                            It was the {currentTargetDegree}
                                        </div>
                                    </div>
                                )}
                                {feedback === null && (
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="flex gap-2 text-indigo-500/80 animate-pulse drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                                            <Headphones className="w-16 h-16" />
                                        </div>
                                        <Button variant="outline" size="sm" onClick={replayNote} className="gap-2">
                                            <RefreshCw className="w-4 h-4" /> Replay Note
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Guess Buttons or Listen Only Display */}
                            {listenOnlyMode ? (
                                <div className="flex flex-col items-center justify-center p-8 bg-muted/30 rounded-2xl border border-muted backdrop-blur-sm">
                                    <Ear className="w-16 h-16 text-indigo-500 mb-4 opacity-80" />
                                    <h3 className="text-xl font-medium text-muted-foreground">Listen Only Mode</h3>
                                    <p className="text-sm text-muted-foreground mt-2 max-w-[250px] text-center">
                                        Focus on the sound of the intervals. The answers will be revealed automatically.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:flex lg:flex-wrap justify-center gap-4">
                                    {currentLevelDegrees.map(degree => {
                                        let btnVariant: 'default' | 'outline' | 'destructive' | 'secondary' = 'outline';
                                        let extraClasses = 'hover:scale-105 transition-all shadow-sm';

                                        if (showDegrees) {
                                            if (degree === currentTargetDegree) {
                                                btnVariant = 'default'; // Highlight correct answer
                                                extraClasses = 'bg-green-500 hover:bg-green-600 text-white border-green-500 shadow-lg shadow-green-500/20 scale-105';
                                            } else {
                                                btnVariant = 'secondary';
                                                extraClasses = 'opacity-50 scale-95';
                                            }
                                        }

                                        return (
                                            <Button
                                                key={degree}
                                                variant={btnVariant}
                                                size="lg"
                                                className={`h-16 text-xl min-w-[100px] rounded-xl ${extraClasses}`}
                                                onClick={() => handleGuess(degree)}
                                                disabled={feedback !== null}
                                            >
                                                {degree}
                                            </Button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="flex justify-center pt-4">
                    {isPlaying && (
                        <Button variant="outline" onClick={togglePlayback} className="gap-2 text-destructive hover:text-destructive">
                            <Square className="w-4 h-4" /> Stop Training
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
