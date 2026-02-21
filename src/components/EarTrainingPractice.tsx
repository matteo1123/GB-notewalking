import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as Tone from 'tone';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Card, CardContent } from './ui/card';
import { Play, Square, Headphones, RefreshCw } from 'lucide-react';
import { useNotePlayer } from '@/hooks/useNotePlayer';
import { EarTrainingPracticeModuleConfig } from '@/types/practice';
import { useSession } from '@/contexts/SessionContext';

interface EarTrainingPracticeProps {
    config: EarTrainingPracticeModuleConfig;
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
    ['1', '3'],                   // Level 1
    ['1', '3', '5'],              // Level 2
    ['1', '2', '4'],              // Level 3 (Testing other non-chord tones)
    ['1', '2', '3', '4', '5'],    // Level 4
    ['1', '2', '3', '4', '5', '6'], // Level 5
    ['1', '2', '3', '4', '5', '6', '7'], // Level 6 - full major scale
    ['1', 'b3', '5'],             // Level 7 - minor intro
    ['1', '2', 'b3', '4', '5'],   // Level 8 - minor pentatonic (ish)
    ['1', '2', 'b3', '4', '5', 'b6', 'b7'] // Level 9 - full minor scale
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


export function EarTrainingPractice({ config, autoStart = false, sessionId }: EarTrainingPracticeProps) {
    const { activeSession } = useSession();
    const isPaused = activeSession?.isPaused || false;

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentLevel, setCurrentLevel] = useState(0);
    const [attempts, setAttempts] = useState<boolean[]>([]);

    const [currentTargetDegree, setCurrentTargetDegree] = useState<Degree | null>(null);
    const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const [showDegrees, setShowDegrees] = useState(false);

    const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
    const { playNote } = useNotePlayer(audioContext);
    const synthRef = useRef<Tone.PolySynth | null>(null);

    // Initialize Audio Context on start
    useEffect(() => {
        if (isPlaying && !audioContext) {
            setAudioContext(new AudioContext());
        }
    }, [isPlaying, audioContext]);

    // Cleanup synth on unmount
    useEffect(() => {
        return () => {
            if (synthRef.current) {
                synthRef.current.dispose();
                synthRef.current = null;
            }
        };
    }, []);

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
                // Lower volume for the drone
                synthRef.current.volume.value = -12;
            }

            // Play root note drone in a low octave (e.g., octave 2 or 3)
            // Normalize flat to sharp for Tone.js
            let toneRoot = config.root_note;
            if (toneRoot === 'Db') toneRoot = 'C#';
            else if (toneRoot === 'Eb') toneRoot = 'D#';
            else if (toneRoot === 'Gb') toneRoot = 'F#';
            else if (toneRoot === 'Ab') toneRoot = 'G#';
            else if (toneRoot === 'Bb') toneRoot = 'A#';

            synthRef.current.triggerAttack([`${toneRoot}2`, `${toneRoot}3`]);
        };

        startDrone();

        return () => {
            if (synthRef.current) {
                synthRef.current.releaseAll();
            }
        };
    }, [isPlaying, isPaused, config.root_note]);

    // Play next note function
    const playNextChallenge = useCallback(() => {
        if (!isPlaying || isPaused) return;

        setFeedback(null);
        setShowDegrees(false);

        const availableDegrees = LEVELS[currentLevel];
        // Pick a random degree from the current level
        const randomDegree = availableDegrees[Math.floor(Math.random() * availableDegrees.length)];
        setCurrentTargetDegree(randomDegree);

        // Randomly pick octave 3, 4, or 5 to make it octave agnostic
        const targetOctave = Math.floor(Math.random() * 3) + 3;
        const offset = DEGREE_OFFSETS[randomDegree];

        const noteToPlay = getNoteFromOffset(config.root_note, offset, targetOctave);

        // Slight delay before playing the note to separate it from drone start/UI interaction
        setTimeout(() => {
            playNote(noteToPlay);
        }, 800);

    }, [isPlaying, isPaused, currentLevel, config.root_note, playNote]);

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
        if (feedback !== null || !currentTargetDegree) return; // Prevent multiple guesses

        const isCorrect = guessedDegree === currentTargetDegree;
        setFeedback(isCorrect ? 'correct' : 'incorrect');
        setShowDegrees(true); // Show the correct answer

        // Update attempts history
        setAttempts(prev => {
            const newAttempts = [...prev, isCorrect];
            // Keep only the last 20 attempts for accuracy calculation
            if (newAttempts.length > 20) {
                return newAttempts.slice(newAttempts.length - 20);
            }
            return newAttempts;
        });

        // Automatically progress after a delay
        setTimeout(() => {
            playNextChallenge();
        }, 1500);
    };

    // Check progression
    useEffect(() => {
        if (attempts.length >= 10) { // Require at least 10 attempts to evaluate
            const correctCount = attempts.filter(a => a).length;
            const accuracy = correctCount / attempts.length;

            if (accuracy >= 0.9 && currentLevel < LEVELS.length - 1) {
                // Advance to next level
                setCurrentLevel(prev => prev + 1);
                setAttempts([]); // Reset attempts for the new level
                // Optionally play a success chime or give visual feedback of level up
            }
        }
    }, [attempts, currentLevel]);


    const togglePlayback = () => {
        if (isPlaying) {
            setIsPlaying(false);
            setCurrentTargetDegree(null);
        } else {
            setIsPlaying(true);
        }
    };

    const replayNote = () => {
        if (currentTargetDegree) {
            const targetOctave = 4; // Or keep track of previous random octave
            const offset = DEGREE_OFFSETS[currentTargetDegree];
            const noteToPlay = getNoteFromOffset(config.root_note, offset, targetOctave);
            playNote(noteToPlay);
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
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <Headphones className="w-6 h-6" />
                            Ear Training
                        </h2>
                        <p className="text-muted-foreground">Identify the scale degree over the drone</p>
                    </div>
                    <div className="text-right">
                        <div className="text-xl font-bold">{config.root_note} Drone</div>
                        <div className="text-sm text-muted-foreground">Level {currentLevel + 1} of {LEVELS.length}</div>
                    </div>
                </div>

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
                                    <div className="text-5xl font-bold text-green-500 animate-in zoom-in duration-300">
                                        Correct!
                                    </div>
                                )}
                                {feedback === 'incorrect' && (
                                    <div className="text-4xl font-bold text-destructive animate-in shake duration-300">
                                        Incorrect
                                        <div className="text-2xl mt-2 text-foreground/80">
                                            It was the {currentTargetDegree}
                                        </div>
                                    </div>
                                )}
                                {feedback === null && (
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="flex gap-2 text-primary animate-pulse">
                                            <Headphones className="w-12 h-12" />
                                        </div>
                                        <Button variant="outline" size="sm" onClick={replayNote} className="gap-2">
                                            <RefreshCw className="w-4 h-4" /> Replay Note
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Guess Buttons */}
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:flex lg:flex-wrap justify-center gap-3">
                                {currentLevelDegrees.map(degree => {
                                    let btnVariant: 'default' | 'outline' | 'destructive' | 'secondary' = 'outline';

                                    if (showDegrees) {
                                        if (degree === currentTargetDegree) btnVariant = 'default'; // Highlight correct answer
                                        else btnVariant = 'secondary';
                                    }

                                    return (
                                        <Button
                                            key={degree}
                                            variant={btnVariant}
                                            size="lg"
                                            className={`h-16 text-xl min-w-[100px] ${showDegrees && degree === currentTargetDegree ? 'bg-green-500 hover:bg-green-600 text-white border-green-500' : ''
                                                }`}
                                            onClick={() => handleGuess(degree)}
                                            disabled={feedback !== null}
                                        >
                                            {degree}
                                        </Button>
                                    );
                                })}
                            </div>
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
