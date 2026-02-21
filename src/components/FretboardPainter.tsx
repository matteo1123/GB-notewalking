import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
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
    const [comfortLevel, setComfortLevel] = useState<number>(5);
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

    // Generate the selectedNotes overlay for the fretboard.
    // We want to show notes that are in the key.
    const fretboardNotes = useMemo(() => {
        const notes: any[] = [];
        Array.from(degreeMap.keys()).forEach(noteName => {
            const positions = findAllNoteOccurrences(noteName);
            positions.forEach(pos => {
                const key = `${pos.string}-${pos.fret}`;
                const hasComfortData = paintedFrets.hasOwnProperty(key);

                let color = hasComfortData ? `hsl(${paintedFrets[key] * 12}, 100%, 45%)` : '#333333';

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
                    <h3 className="font-semibold text-lg flex items-center justify-center gap-2">
                        Comfort Level: {comfortLevel}
                        <span className="inline-block w-4 h-4 rounded-full shadow-lg" style={{ backgroundColor: `hsl(${comfortLevel * 12}, 100%, 45%)` }}></span>
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                        Select a comfort level and tap frets to paint them. Left click to paint, right click to erase.
                    </p>
                    <Slider
                        value={[comfortLevel]}
                        min={0}
                        max={10}
                        step={1}
                        onValueChange={([val]) => setComfortLevel(val)}
                        className="mt-4"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-auto bg-black flex items-center justify-center relative">
                <div className="absolute top-4 left-4 sm:top-auto sm:bottom-4 sm:left-4 bg-black/80 p-3 rounded-lg text-xs leading-5 text-start z-10 border pointer-events-none">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded" style={{ backgroundColor: `hsl(0, 100%, 45%)` }}></div> 0: Total Guess</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded" style={{ backgroundColor: `hsl(60, 100%, 45%)` }}></div> 5: Kinda Know It</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded" style={{ backgroundColor: `hsl(120, 100%, 45%)` }}></div> 10: Instant Recall</div>
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
