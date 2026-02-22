import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Save, SkipForward } from 'lucide-react';
import Fretboard from './Fretboard';
import { useToast } from '@/hooks/use-toast';
import { createDegreeMap, findAllNoteOccurrences } from '@/lib/musicTheory';
import { ForceLandscapeWrapper } from './ForceLandscapeWrapper';
import { X } from 'lucide-react';

interface FretboardPainterProps {
    sessionKey: string;
    chordPair: string[];
    revealedFrets: Set<string>;
    onSave: () => void;
    onSkip: () => void;
}

export function FretboardPainter({ sessionKey, chordPair, revealedFrets, onSave, onSkip }: FretboardPainterProps) {
    const [comfortLevel, setComfortLevel] = useState<number>(2);
    const [paintedFrets, setPaintedFrets] = useState<Set<string>>(new Set(revealedFrets));
    const [dbData, setDbData] = useState<Record<string, number>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const sortedChordPairStr = [...chordPair].sort().join(',');

    useEffect(() => {
        async function fetchComfort() {
            setIsLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data, error } = await supabase
                    .from('notewalking_comfort')
                    .select('comfort_data')
                    .eq('user_id', user.id)
                    .eq('session_key', sessionKey)
                    .eq('chord_pair', sortedChordPairStr)
                    .maybeSingle();

                if (error && error.code !== 'PGRST116') {
                    console.error("Error fetching comfort data", error);
                } else if (data && data.comfort_data) {
                    setDbData(data.comfort_data as Record<string, number>);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        }
        fetchComfort();
    }, [sessionKey, sortedChordPairStr]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast({ title: "Must be logged in to save", variant: "destructive" });
                onSkip();
                return;
            }

            const comfortDataToSave: Record<string, number> = { ...dbData };
            paintedFrets.forEach(key => {
                comfortDataToSave[key] = comfortLevel;
            });

            const { error } = await supabase
                .from('notewalking_comfort')
                .upsert({
                    user_id: user.id,
                    session_key: sessionKey,
                    chord_pair: sortedChordPairStr,
                    comfort_data: comfortDataToSave,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id, session_key, chord_pair'
                });

            if (error) throw error;

            toast({ title: "Fretboard mastery saved!" });
            onSave();
        } catch (err) {
            console.error(err);
            toast({ title: "Failed to save mastery", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const degreeMap = useMemo(() => createDegreeMap(sessionKey), [sessionKey]);

    const getComfortColor = (level: number) => {
        switch (level) {
            case 1: return 'hsl(210, 100%, 75%)'; // Lightest
            case 2: return 'hsl(210, 100%, 60%)'; // Light
            case 3: return 'hsl(210, 100%, 45%)'; // Medium
            case 4: return 'hsl(210, 100%, 30%)'; // Darkest
            default: return 'hsl(210, 100%, 60%)';
        }
    };

    // Generate the selectedNotes overlay for the fretboard.
    // We want to show notes that are in the key.
    const fretboardNotes = useMemo(() => {
        const notes: any[] = [];
        Array.from(degreeMap.keys()).forEach(noteName => {
            const positions = findAllNoteOccurrences(noteName);
            positions.forEach(pos => {
                const key = `${pos.string}-${pos.fret}`;
                // Only style if it is in the active painted set (keeping the fog of war state)
                const isActive = paintedFrets.has(key);

                if (!isActive) return;

                notes.push({
                    string: pos.string,
                    fret: pos.fret,
                    color: getComfortColor(comfortLevel),
                });
            });
        });
        return notes;
    }, [degreeMap, paintedFrets]);

    const handleNoteClick = (string: number, fret: number) => {
        setPaintedFrets(prev => {
            const next = new Set(prev);
            const clickedKey = `${string}-${fret}`;
            const isRevealing = !next.has(clickedKey);

            // Wide brush: +/- 1 string, +/- 2 frets
            for (let s = Math.max(1, string - 1); s <= Math.min(6, string + 1); s++) {
                for (let f = Math.max(0, fret - 2); f <= Math.min(24, fret + 2); f++) {
                    const key = `${s}-${f}`;
                    if (isRevealing) {
                        next.add(key);
                    } else {
                        next.delete(key);
                    }
                }
            }
            return next;
        });
    };

    const handleNoteRightClick = (string: number, fret: number) => {
        setPaintedFrets(prev => {
            const next = new Set(prev);
            const clickedKey = `${string}-${fret}`;
            // Always treat right-click as "erase wide brush area"
            for (let s = Math.max(1, string - 1); s <= Math.min(6, string + 1); s++) {
                for (let f = Math.max(0, fret - 2); f <= Math.min(24, fret + 2); f++) {
                    next.delete(`${s}-${f}`);
                }
            }
            return next;
        });
    };

    if (isLoading) {
        return <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center">Loading...</div>;
    }

    return (
        <ForceLandscapeWrapper>
            <div className="fixed inset-0 z-[9999] bg-black flex flex-col font-sans">
                {/* Header */}
                <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-gray-900 to-black border-b border-gray-800">
                    <div className="flex items-center gap-4">
                        <h3 className="font-bold text-lg text-white">Paint Your Progress</h3>
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gray-900 border border-gray-700">
                            <span className="text-xs font-mono text-gray-300">
                                {sessionKey} Major: {chordPair.join(' − ')}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            className="h-8 px-3 bg-gray-900 border-gray-700 hover:bg-gray-800 text-gray-300"
                            size="sm"
                            onClick={onSkip}
                            disabled={isSaving}
                        >
                            <SkipForward className="w-4 h-4 mr-1" /> Skip
                        </Button>
                        <Button
                            className="h-8 px-3 bg-purple-600 hover:bg-purple-700 text-white border-transparent"
                            size="sm"
                            onClick={handleSave}
                            disabled={isSaving}
                        >
                            <Save className="w-4 h-4 mr-1" /> {isSaving ? "Saving..." : "Save"}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={onSkip} className="h-8 px-2 ml-2">
                            <X className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Close</span>
                        </Button>
                    </div>
                </div>

                <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#0a0a0a]">

                    {/* LEFT PANEL / TOP PANEL (Mobile): Comfort Levels */}
                    <div className={`w-full md:w-[140px] h-[40px] md:h-auto flex flex-row md:flex-col justify-center items-center border-b md:border-b-0 md:border-r border-gray-800 transition-colors duration-300 gap-1 flex-shrink-0`}>
                        <Button
                            variant={comfortLevel === 1 ? 'default' : 'outline'}
                            onClick={() => setComfortLevel(1)}
                            className="h-8 md:h-12 w-full flex-col p-1 text-[10px] md:text-xs text-white justify-center items-center rounded-none md:border-b md:border-r-0 border-r md:border-b-gray-800"
                            style={{ backgroundColor: comfortLevel === 1 ? getComfortColor(1) : '#111', borderColor: 'transparent' }}
                        >
                            <span className={comfortLevel === 1 ? 'font-bold' : 'text-gray-400'}>Level 1</span>
                            <span className={`text-[8px] md:text-[10px] hidden sm:block ${comfortLevel === 1 ? 'text-white/80' : 'text-gray-500'}`}>Scale / Root</span>
                        </Button>
                        <Button
                            variant={comfortLevel === 2 ? 'default' : 'outline'}
                            onClick={() => setComfortLevel(2)}
                            className="h-8 md:h-12 w-full flex-col p-1 text-[10px] md:text-xs text-white justify-center items-center rounded-none md:border-b md:border-r-0 border-r md:border-b-gray-800"
                            style={{ backgroundColor: comfortLevel === 2 ? getComfortColor(2) : '#111', borderColor: 'transparent' }}
                        >
                            <span className={comfortLevel === 2 ? 'font-bold' : 'text-gray-400'}>Level 2</span>
                            <span className={`text-[8px] md:text-[10px] hidden sm:block ${comfortLevel === 2 ? 'text-white/80' : 'text-gray-500'}`}>Chord Tones</span>
                        </Button>
                        <Button
                            variant={comfortLevel === 3 ? 'default' : 'outline'}
                            onClick={() => setComfortLevel(3)}
                            className="h-8 md:h-12 w-full flex-col p-1 text-[10px] md:text-xs text-white justify-center items-center rounded-none md:border-b md:border-r-0 border-r md:border-b-gray-800"
                            style={{ backgroundColor: comfortLevel === 3 ? getComfortColor(3) : '#111', borderColor: 'transparent' }}
                        >
                            <span className={comfortLevel === 3 ? 'font-bold' : 'text-gray-400'}>Level 3</span>
                            <span className={`text-[8px] md:text-[10px] hidden sm:block ${comfortLevel === 3 ? 'text-white/80' : 'text-gray-500'}`}>Scale Degrees</span>
                        </Button>
                        <Button
                            variant={comfortLevel === 4 ? 'default' : 'outline'}
                            onClick={() => setComfortLevel(4)}
                            className="h-8 md:h-12 w-full flex-col p-1 text-[10px] md:text-xs text-white justify-center items-center rounded-none"
                            style={{ backgroundColor: comfortLevel === 4 ? getComfortColor(4) : '#111', borderColor: 'transparent' }}
                        >
                            <span className={comfortLevel === 4 ? 'font-bold' : 'text-gray-400'}>Level 4</span>
                            <span className={`text-[8px] md:text-[10px] hidden sm:block ${comfortLevel === 4 ? 'text-white/80' : 'text-gray-500'}`}>Mastery</span>
                        </Button>
                    </div>

                    {/* CENTER: The Fretboard */}
                    <div className="flex-1 overflow-auto flex items-center justify-center p-2 relative min-h-0">
                        <div className="w-full h-full max-w-[1200px] flex items-center justify-center notewalking-fretboard-override">
                            <Fretboard
                                selectedNotes={fretboardNotes}
                                degreeMap={degreeMap}
                                isEditable={true}
                                onNoteClick={handleNoteClick}
                                onNoteRightClick={handleNoteRightClick}
                                showDegreeNumbers={true}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </ForceLandscapeWrapper>
    );
}
