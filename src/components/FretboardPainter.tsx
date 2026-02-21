import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Save, SkipForward } from 'lucide-react';
import Fretboard from './Fretboard';
import { useToast } from '@/hooks/use-toast';
import { createDegreeMap, findAllNoteOccurrences } from '@/lib/musicTheory';

interface FretboardPainterProps {
    sessionKey: string;
    chordPair: string[];
    onSave: () => void;
    onSkip: () => void;
}

export function FretboardPainter({ sessionKey, chordPair, onSave, onSkip }: FretboardPainterProps) {
    const [comfortLevel, setComfortLevel] = useState<number>(2);
    const [paintedFrets, setPaintedFrets] = useState<Record<string, number>>({});
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
                    setPaintedFrets(data.comfort_data as Record<string, number>);
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

            const { error } = await supabase
                .from('notewalking_comfort')
                .upsert({
                    user_id: user.id,
                    session_key: sessionKey,
                    chord_pair: sortedChordPairStr,
                    comfort_data: paintedFrets,
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
                const hasComfortData = paintedFrets.hasOwnProperty(key);

                let color = hasComfortData ? getComfortColor(paintedFrets[key]) : '#333333';

                notes.push({
                    string: pos.string,
                    fret: pos.fret,
                    color,
                });
            });
        });
        return notes;
    }, [degreeMap, paintedFrets]);

    const handleNoteClick = (string: number, fret: number) => {
        // Check if the note clicked is allowed (in key)
        const noteName = Array.from(degreeMap.keys()).find(n => {
            const pos = findAllNoteOccurrences(n);
            return pos.some(p => p.string === string && p.fret === fret);
        });
        if (!noteName) return;

        setPaintedFrets(prev => {
            const next = { ...prev };
            next[`${string}-${fret}`] = comfortLevel;
            return next;
        });
    };

    const handleNoteRightClick = (string: number, fret: number) => {
        setPaintedFrets(prev => {
            const next = { ...prev };
            delete next[`${string}-${fret}`];
            return next;
        });
    };

    if (isLoading) {
        return <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center">Loading...</div>;
    }

    return (
        <div className="fixed inset-0 z-[9999] bg-background flex flex-col">
            <div className="flex-shrink-0 flex items-center justify-between p-4 border-b bg-card">
                <div>
                    <h2 className="text-xl font-bold">Fretboard Mastery</h2>
                    <p className="text-sm text-muted-foreground">
                        {sessionKey} Major: {chordPair.join(' − ')}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" onClick={onSkip} disabled={isSaving}>
                        <SkipForward className="w-4 h-4 mr-2" /> Skip
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        <Save className="w-4 h-4 mr-2" /> {isSaving ? "Saving..." : "Save & Continue"}
                    </Button>
                </div>
            </div>

            <div className="p-4 border-b bg-muted/30 flex-shrink-0 flex flex-col items-center justify-center gap-4">
                <div className="max-w-md w-full text-center space-y-4">
                    <p className="text-sm text-muted-foreground mx-auto">
                        Select a comfort level and tap frets to paint them. Left click to paint, right click to erase.
                    </p>

                    <div className="flex flex-col gap-2 mt-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <Button
                                variant={comfortLevel === 1 ? 'default' : 'outline'}
                                onClick={() => setComfortLevel(1)}
                                className="h-auto w-full flex-col p-2 text-xs text-white"
                                style={{ backgroundColor: comfortLevel === 1 ? getComfortColor(1) : undefined, borderColor: getComfortColor(1) }}
                            >
                                <span className={comfortLevel === 1 ? 'font-bold' : 'text-foreground'}>Level 1</span>
                                <span className={`text-[10px] ${comfortLevel === 1 ? 'text-white/80' : 'text-muted-foreground'}`}>Scale / Root</span>
                            </Button>

                            <Button
                                variant={comfortLevel === 2 ? 'default' : 'outline'}
                                onClick={() => setComfortLevel(2)}
                                className="h-auto w-full flex-col p-2 text-xs text-white"
                                style={{ backgroundColor: comfortLevel === 2 ? getComfortColor(2) : undefined, borderColor: getComfortColor(2) }}
                            >
                                <span className={comfortLevel === 2 ? 'font-bold' : 'text-foreground'}>Level 2</span>
                                <span className={`text-[10px] ${comfortLevel === 2 ? 'text-white/80' : 'text-muted-foreground'}`}>Chord Tones</span>
                            </Button>

                            <Button
                                variant={comfortLevel === 3 ? 'default' : 'outline'}
                                onClick={() => setComfortLevel(3)}
                                className="h-auto w-full flex-col p-2 text-xs text-white"
                                style={{ backgroundColor: comfortLevel === 3 ? getComfortColor(3) : undefined, borderColor: getComfortColor(3) }}
                            >
                                <span className={comfortLevel === 3 ? 'font-bold' : 'text-foreground'}>Level 3</span>
                                <span className={`text-[10px] ${comfortLevel === 3 ? 'text-white/80' : 'text-muted-foreground'}`}>Scale Degrees</span>
                            </Button>

                            <Button
                                variant={comfortLevel === 4 ? 'default' : 'outline'}
                                onClick={() => setComfortLevel(4)}
                                className="h-auto w-full flex-col p-2 text-xs text-white"
                                style={{ backgroundColor: comfortLevel === 4 ? getComfortColor(4) : undefined, borderColor: getComfortColor(4) }}
                            >
                                <span className={comfortLevel === 4 ? 'font-bold' : 'text-foreground'}>Level 4</span>
                                <span className={`text-[10px] ${comfortLevel === 4 ? 'text-white/80' : 'text-muted-foreground'}`}>Total Mastery</span>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto bg-black flex items-center justify-center relative">
                <div className="absolute top-4 left-4 sm:top-auto sm:bottom-4 sm:left-4 bg-black/80 p-3 rounded-lg text-xs leading-5 text-start z-10 border pointer-events-none">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded" style={{ backgroundColor: getComfortColor(1) }}></div> Level 1: Scale/Root</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded" style={{ backgroundColor: getComfortColor(2) }}></div> Level 2: Chord Tones</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded" style={{ backgroundColor: getComfortColor(3) }}></div> Level 3: Scale Degrees</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded" style={{ backgroundColor: getComfortColor(4) }}></div> Level 4: Mastery</div>
                </div>

                <div
                    className="fretboard-modal-view p-8"
                    style={{ transform: 'rotate(90deg)', transformOrigin: 'center center' }}
                >
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
    );
}
