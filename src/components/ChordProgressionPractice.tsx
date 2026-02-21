import React, { useState, useEffect, useCallback } from 'react';
import { Play, Square, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ChordProgressionsModuleConfig } from '@/types/practice';
import {
    MAJOR_KEYS, MINOR_KEYS,
    MAJOR_PROGRESSIONS, MINOR_PROGRESSIONS, ALL_PROGRESSIONS,
    getChordsForProgression, KeyQuality
} from '@/constants/progressions';
import { useMetronome, MetronomeState } from '@/hooks/useMetronome';

interface ChordProgressionPracticeProps {
    config?: ChordProgressionsModuleConfig;
    sessionId?: string;
}

export function ChordProgressionPractice({ config, sessionId }: ChordProgressionPracticeProps) {
    const isModuleConfig = !!config?.module_type;

    const [quality, setQuality] = useState<KeyQuality>('major');

    const [selectedKey, setSelectedKey] = useState<string>(config?.key || 'C');
    const [selectedProgressionId, setSelectedProgressionId] = useState<string>(config?.progression_id || MAJOR_PROGRESSIONS[0].id);
    const [bpm, setBpm] = useState<number>(config?.target_bpm || 90);

    const { state: metronomeState, togglePlayPause } = useMetronome({
        mode: "regular",
        startBpm: bpm,
        endBpm: bpm,
        measures: 0,
        drumBeat: true,
    });

    // Derived state for the play button
    const isPlaying = metronomeState.isPlaying;

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

    useEffect(() => {
        if (!isModuleConfig) {
            randomize();
        }
    }, [isModuleConfig, randomize]);

    useEffect(() => {
        if (config) {
            setSelectedKey(config.key);
            setSelectedProgressionId(config.progression_id);
            const isMinor = MINOR_KEYS.includes(config.key as any);
            setQuality(isMinor ? 'minor' : 'major');
        }
    }, [config]);

    // Derived state
    const currentProgressions = quality === 'major' ? MAJOR_PROGRESSIONS : MINOR_PROGRESSIONS;
    const currentKeys = quality === 'major' ? MAJOR_KEYS : MINOR_KEYS;

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

    const activeProgression = ALL_PROGRESSIONS.find(p => p.id === selectedProgressionId) || currentProgressions[0];
    const displayChords = getChordsForProgression(activeProgression.numeralString, selectedKey, quality);

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

                    <div className="flex-[2] space-y-2">
                        <Label className="text-slate-400">Progression</Label>
                        <Select value={selectedProgressionId} onValueChange={setSelectedProgressionId}>
                            <SelectTrigger className="bg-slate-800 border-none">
                                <SelectValue placeholder="Select progression" />
                            </SelectTrigger>
                            <SelectContent>
                                {currentProgressions.map(p => (
                                    <SelectItem key={p.id} value={p.id}>{p.numeralString}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                        {activeProgression.numeralString.split('-').map((numeral, idx) => (
                            <Card key={idx} className="bg-slate-900 border-slate-800 border-2 w-32 h-40 flex flex-col items-center justify-center relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 group-hover:from-indigo-500/10 group-hover:to-purple-500/10 transition-colors" />
                                <CardContent className="p-0 flex flex-col items-center justify-center h-full relative z-10 w-full gap-2">
                                    <span className="text-5xl font-bold text-white tracking-tight">{displayChords[idx]}</span>
                                    <span className="text-xl font-medium text-indigo-400">{numeral.trim()}</span>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* Practice Controls */}
                <div className="flex flex-col items-center gap-6 mt-12 bg-slate-900/50 p-8 rounded-full border border-slate-800/50">
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
                        {isPlaying ? "Keep strumming! Focus on smooth, in-time transitions." : "Hit play to start the backing track for this progression."}
                    </p>
                </div>
            </div>
        </div>
    );
}
