import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Square, Shuffle, Volume2, VolumeX, Guitar, ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ChordProgressionsModuleConfig } from '@/types/practice';
import {
    MAJOR_KEYS, MINOR_KEYS,
    MAJOR_PROGRESSIONS, MINOR_PROGRESSIONS, ALL_PROGRESSIONS,
    getChordsForProgression, KeyQuality
} from '@/constants/progressions';
import { useMetronome, MetronomeState, MetronomeSettings } from '@/hooks/useMetronome';
import { useNotePlayer } from '@/hooks/useNotePlayer';

interface ChordProgressionPracticeProps {
    moduleConfig?: ChordProgressionsModuleConfig;
    onConfigChange?: (config: ChordProgressionsModuleConfig) => void;
    onExit?: () => void;
    sessionId?: string;
}

export function ChordProgressionPractice({ moduleConfig, onConfigChange, onExit, sessionId }: ChordProgressionPracticeProps) {
    const isModuleConfig = !!moduleConfig?.module_type;

    const [quality, setQuality] = useState<KeyQuality>('major');

    const [selectedKey, setSelectedKey] = useState<string>(moduleConfig?.key || 'C');
    const [selectedProgressionId, setSelectedProgressionId] = useState<string>(moduleConfig?.progression_id || MAJOR_PROGRESSIONS[0].id);
    const [bpm, setBpm] = useState<number>(moduleConfig?.target_bpm || 90);
    const [autoPlayChords, setAutoPlayChords] = useState<boolean>(moduleConfig?.auto_play_chords ?? true);

    // Chord tracking
    const [currentChordIndex, setCurrentChordIndex] = useState(0);
    const lastMeasureRef = useRef(0);
    const currentMeasureInProgressionRef = useRef(0);
    const [chordDurations, setChordDurations] = useState<number[]>([]);

    // Audio setup
    const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

    useEffect(() => {
        const ctx = new AudioContext();
        setAudioContext(ctx);
        return () => { ctx.close(); };
    }, []);

    const { playChord, preloadChords } = useNotePlayer(audioContext);

    // Derived state
    const currentProgressions = quality === 'major' ? MAJOR_PROGRESSIONS : MINOR_PROGRESSIONS;
    const currentKeys = quality === 'major' ? MAJOR_KEYS : MINOR_KEYS;
    const activeProgression = ALL_PROGRESSIONS.find(p => p.id === selectedProgressionId) || currentProgressions[0];
    const numerals = activeProgression.numeralString.split('-').map(n => n.trim());
    const displayChords = getChordsForProgression(activeProgression.numeralString, selectedKey, quality);

    // Preload chord audio when key/progression changes
    useEffect(() => {
        if (audioContext && displayChords.length > 0) {
            // displayChords are like "C", "Dm", "G", "Am" — exactly what playChord expects
            preloadChords(displayChords);
        }
    }, [audioContext, displayChords.join(','), preloadChords]);

    // Metronome with onTick for chord advancement + auto-play
    const metronomeSettings: MetronomeSettings = {
        mode: "regular",
        startBpm: bpm,
        endBpm: bpm,
        measures: 0,
        drumBeat: true,
        onTick: (state: MetronomeState) => {
            if (state.currentBeat !== 1) return;

            if (state.currentMeasure !== lastMeasureRef.current) {
                lastMeasureRef.current = state.currentMeasure;

                if (state.currentMeasure === 1) {
                    currentMeasureInProgressionRef.current = 0;
                    setCurrentChordIndex(0);
                    if (autoPlayChords && displayChords[0]) {
                        playChord(displayChords[0], 0.6);
                    }
                    return;
                }

                currentMeasureInProgressionRef.current++;

                let accumulatedMeasures = 0;
                let nextChordIdx = 0;

                const totalMeasuresInProgression = chordDurations.reduce((a, b) => a + b, 0) || 1;
                const measureInCycle = currentMeasureInProgressionRef.current % totalMeasuresInProgression;

                for (let i = 0; i < chordDurations.length; i++) {
                    accumulatedMeasures += chordDurations[i];
                    if (measureInCycle < accumulatedMeasures) {
                        nextChordIdx = i;
                        break;
                    }
                }

                const didChordChange = nextChordIdx !== currentChordIndex;
                setCurrentChordIndex(nextChordIdx);

                // Play the chord if auto-play is enabled AND it changed
                if (autoPlayChords && displayChords[nextChordIdx] && didChordChange) {
                    playChord(displayChords[nextChordIdx], 0.6);
                }
            }
        },
    };

    const { state: metronomeState, togglePlayPause, stop: stopMetronome } = useMetronome(metronomeSettings);
    const isPlaying = metronomeState.isPlaying;

    // Reset chord tracking when progression/key changes
    useEffect(() => {
        setCurrentChordIndex(0);
        lastMeasureRef.current = 0;
        currentMeasureInProgressionRef.current = 0;

        setChordDurations(prev => {
            if (prev.length === numerals.length) return prev;
            return new Array(numerals.length).fill(1);
        });
    }, [selectedKey, selectedProgressionId, quality, numerals.length]);

    // Cleanup metronome on unmount
    useEffect(() => {
        return () => { stopMetronome(); };
    }, []);

    const randomize = useCallback(() => {
        const isMajor = Math.random() > 0.5;
        const targetKeys = isMajor ? MAJOR_KEYS : MINOR_KEYS;
        const targetProgressions = isMajor ? MAJOR_PROGRESSIONS : MINOR_PROGRESSIONS;

        const rQuality = isMajor ? 'major' : 'minor';
        const rKey = targetKeys[Math.floor(Math.random() * targetKeys.length)];
        const rProgression = targetProgressions[Math.floor(Math.random() * targetProgressions.length)];
        const rBpm = Math.floor(Math.random() * (145 - 60 + 1)) + 60;

        setQuality(rQuality);
        setSelectedKey(rKey);
        setSelectedProgressionId(rProgression.id);
        setBpm(rBpm);
    }, []);

    const randomizeKeyForProgression = useCallback((progression: any) => {
        const isMajor = progression.quality === 'major';
        const targetKeys = isMajor ? MAJOR_KEYS : MINOR_KEYS;
        const rKey = targetKeys[Math.floor(Math.random() * targetKeys.length)];

        setQuality(progression.quality);
        setSelectedKey(rKey);
        setSelectedProgressionId(progression.id);
    }, []);

    useEffect(() => {
        if (!isModuleConfig) {
            randomize();
        }
    }, [isModuleConfig, randomize]);

    useEffect(() => {
        if (moduleConfig) {
            setSelectedKey(moduleConfig.key);
            setSelectedProgressionId(moduleConfig.progression_id);
            const isMinor = MINOR_KEYS.includes(moduleConfig.key as any);
            setQuality(isMinor ? 'minor' : 'major');
            if (moduleConfig.auto_play_chords !== undefined) {
                setAutoPlayChords(moduleConfig.auto_play_chords);
            }
        }
    }, [moduleConfig]);

    useEffect(() => {
        if (onConfigChange && moduleConfig) {
            onConfigChange({
                ...moduleConfig,
                key: selectedKey,
                progression_id: selectedProgressionId,
                target_bpm: bpm,
                auto_play_chords: autoPlayChords,
            });
        }
    }, [selectedKey, selectedProgressionId, bpm, autoPlayChords]);

    // Ensure the selected key and progression are valid for the given quality when quality changes manually
    useEffect(() => {
        if (!isModuleConfig) {
            if (quality === 'major') {
                if (!MAJOR_KEYS.includes(selectedKey as any)) setSelectedKey(MAJOR_KEYS[0]);
                if (!MAJOR_PROGRESSIONS.find(p => p.id === selectedProgressionId)) setSelectedProgressionId(MAJOR_PROGRESSIONS[0].id);
            } else {
                if (!MINOR_KEYS.includes(selectedKey as any)) setSelectedKey(MINOR_KEYS[0]);
                if (!MINOR_PROGRESSIONS.find(p => p.id === selectedProgressionId)) setSelectedProgressionId(MINOR_PROGRESSIONS[0].id);
            }
        }
    }, [quality, isModuleConfig]);

    return (
        <div className="flex flex-col h-full bg-slate-950 p-6 overflow-y-auto">
            {/* Header Controls (Only shown if NOT in a structured session block config) */}
            {!isModuleConfig && (
                <div className="flex flex-col md:flex-row gap-4 mb-8 bg-slate-900 border border-slate-800 p-4 rounded-xl items-end">
                    <div className="flex-1 space-y-2">
                        <Label className="text-slate-400">Quality</Label>
                        <Select value={quality} onValueChange={(val: KeyQuality) => setQuality(val)}>
                            <SelectTrigger className="bg-slate-800 border-none">
                                <SelectValue placeholder="Select quality" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="major">Major</SelectItem>
                                <SelectItem value="minor">Minor</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex-1 space-y-2">
                        <Label className="text-slate-400">Key</Label>
                        <Select value={selectedKey} onValueChange={setSelectedKey}>
                            <SelectTrigger className="bg-slate-800 border-none">
                                <SelectValue placeholder="Select key" />
                            </SelectTrigger>
                            <SelectContent>
                                {currentKeys.map(k => (
                                    <SelectItem key={k} value={k}>{k}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex-[3] space-y-2">
                        <Label className="text-slate-400">Progression</Label>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-10 w-10 border-slate-700 hover:bg-slate-800 shrink-0"
                                onClick={() => {
                                    const idx = currentProgressions.findIndex(p => p.id === selectedProgressionId);
                                    if (idx !== -1) {
                                        const prev = idx > 0 ? currentProgressions[idx - 1] : currentProgressions[currentProgressions.length - 1];
                                        randomizeKeyForProgression(prev);
                                    }
                                }}
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </Button>
                            <Select value={selectedProgressionId} onValueChange={setSelectedProgressionId}>
                                <SelectTrigger className="bg-slate-800 border-none flex-1">
                                    <SelectValue placeholder="Select progression" />
                                </SelectTrigger>
                                <SelectContent>
                                    {currentProgressions.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.numeralString}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-10 w-10 border-slate-700 hover:bg-slate-800 shrink-0"
                                onClick={() => {
                                    const idx = currentProgressions.findIndex(p => p.id === selectedProgressionId);
                                    if (idx !== -1) {
                                        const next = idx < currentProgressions.length - 1 ? currentProgressions[idx + 1] : currentProgressions[0];
                                        randomizeKeyForProgression(next);
                                    }
                                }}
                            >
                                <ChevronRight className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>

                    <Button variant="outline" className="h-10 border-slate-700 hover:bg-slate-800" onClick={randomize}>
                        <Shuffle className="w-4 h-4 mr-2" />
                        Shuffle
                    </Button>
                </div>
            )}

            {/* Main Display Area */}
            <div className="flex-1 flex flex-col items-center justify-center space-y-12">
                {/* Progression Display */}
                <div className="text-center space-y-6">
                    <h2 className="text-2xl md:text-3xl font-medium text-slate-400 mb-2">
                        Key of {selectedKey} <span className="text-xl ml-2 text-indigo-400/80">({bpm} BPM)</span>
                    </h2>

                    <div className="flex flex-wrap justify-center gap-4 md:gap-8">
                        {numerals.map((numeral, idx) => {
                            const isActive = isPlaying && idx === currentChordIndex;
                            const duration = chordDurations[idx] || 1;
                            return (
                                <div key={idx} className="flex flex-col items-center gap-3">
                                    <Card
                                        className={`border-2 w-32 h-40 flex flex-col items-center justify-center relative overflow-hidden group transition-all duration-300
                                            ${isActive
                                                ? 'bg-yellow-500/10 border-yellow-500/60 shadow-[0_0_25px_rgba(234,179,8,0.25)] scale-105'
                                                : 'bg-slate-900 border-slate-800'
                                            }`}
                                    >
                                        {isActive && (
                                            <div className="absolute top-2 left-0 right-0 text-center">
                                                <span className="text-[10px] font-black text-yellow-400 animate-pulse tracking-widest">
                                                    ▶ NOW
                                                </span>
                                            </div>
                                        )}
                                        <div className={`absolute inset-0 transition-colors ${isActive
                                            ? 'bg-gradient-to-br from-yellow-500/10 to-amber-500/10'
                                            : 'bg-gradient-to-br from-indigo-500/5 to-purple-500/5 group-hover:from-indigo-500/10 group-hover:to-purple-500/10'
                                            }`} />
                                        <CardContent className="p-0 flex flex-col items-center justify-center h-full relative z-10 w-full gap-2">
                                            <span className={`text-5xl font-bold tracking-tight transition-colors ${isActive ? 'text-yellow-300' : 'text-white'}`}>
                                                {displayChords[idx]}
                                            </span>
                                            <span className={`text-xl font-medium ${isActive ? 'text-yellow-400/80' : 'text-indigo-400'}`}>
                                                {numeral}
                                            </span>
                                        </CardContent>
                                    </Card>

                                    {/* Duration Controls */}
                                    <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 rounded-lg p-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 rounded hover:bg-slate-800 text-slate-400"
                                            onClick={() => {
                                                setChordDurations(prev => {
                                                    const next = [...prev];
                                                    if (next[idx] > 1) next[idx]--;
                                                    return next;
                                                });
                                            }}
                                        >
                                            <Minus className="w-3 h-3" />
                                        </Button>
                                        <span className="text-xs font-medium text-slate-300 w-6 text-center">
                                            {duration}m
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 rounded hover:bg-slate-800 text-slate-400"
                                            onClick={() => {
                                                setChordDurations(prev => {
                                                    const next = [...prev];
                                                    if (next[idx] < 16) next[idx]++;
                                                    return next;
                                                });
                                            }}
                                        >
                                            <Plus className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Beat indicator dots */}
                    {isPlaying && (
                        <div className="flex justify-center gap-2 mt-2">
                            {[1, 2, 3, 4].map(beat => (
                                <div
                                    key={beat}
                                    className={`w-3 h-3 rounded-full transition-all duration-100 ${metronomeState.currentBeat === beat
                                        ? 'bg-indigo-400 scale-125 shadow-[0_0_8px_rgba(99,102,241,0.6)]'
                                        : 'bg-slate-700'
                                        }`}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Practice Controls */}
                <div className="flex flex-col items-center gap-6 mt-8">
                    {/* Auto-Play Toggle */}
                    <div className="flex items-center gap-3 bg-slate-900/80 px-5 py-3 rounded-xl border border-slate-800/80">
                        <Guitar className={`w-5 h-5 ${autoPlayChords ? 'text-emerald-400' : 'text-slate-500'}`} />
                        <Label htmlFor="auto-play" className={`text-sm font-medium cursor-pointer select-none ${autoPlayChords ? 'text-emerald-300' : 'text-slate-400'}`}>
                            {autoPlayChords ? 'Playing Chords For You' : 'Metronome Only'}
                        </Label>
                        <Switch
                            id="auto-play"
                            checked={autoPlayChords}
                            onCheckedChange={setAutoPlayChords}
                            className="data-[state=checked]:bg-emerald-500"
                        />
                    </div>

                    {/* Play/Stop Button */}
                    <div className="flex flex-col items-center gap-6 bg-slate-900/50 p-8 rounded-full border border-slate-800/50">
                        <Button
                            size="lg"
                            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${isPlaying
                                ? 'bg-rose-500/20 text-rose-500 hover:bg-rose-500/30 hover:scale-105 border border-rose-500/50 shadow-[0_0_30px_rgba(244,63,94,0.3)]'
                                : 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 hover:scale-105 border border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.2)]'
                                }`}
                            onClick={togglePlayPause}
                        >
                            {isPlaying ? <Square className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
                        </Button>
                        <p className="text-slate-500 text-sm max-w-xs text-center">
                            {isPlaying
                                ? autoPlayChords
                                    ? "Chords are playing — practice your lead!"
                                    : "Keep strumming! Focus on smooth, in-time transitions."
                                : autoPlayChords
                                    ? "Hit play to hear the chords and practice lead over them."
                                    : "Hit play to start the backing track for this progression."
                            }
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
