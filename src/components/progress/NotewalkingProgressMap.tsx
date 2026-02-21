import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import Fretboard from '@/components/Fretboard';
import { createDegreeMap, findAllNoteOccurrences } from '@/lib/musicTheory';
import { Loader2 } from 'lucide-react';

interface NotewalkingProgressMapProps {
    userId: string;
}

interface ComfortDataRow {
    session_key: string;
    chord_pair: string;
    comfort_data: Record<string, number>;
}

export function NotewalkingProgressMap({ userId }: NotewalkingProgressMapProps) {
    const [data, setData] = useState<ComfortDataRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Selection state
    const [selectedKey, setSelectedKey] = useState<string>('C');
    const [selectedPair, setSelectedPair] = useState<string>('ALL');

    useEffect(() => {
        async function fetchData() {
            setIsLoading(true);
            try {
                const { data: comfortData, error } = await supabase
                    .from('notewalking_comfort')
                    .select('session_key, chord_pair, comfort_data')
                    .eq('user_id', userId);

                if (error) throw error;

                if (comfortData && comfortData.length > 0) {
                    setData(comfortData as ComfortDataRow[]);

                    // Auto-select the first key if 'C' isn't available
                    const keys = Array.from(new Set(comfortData.map(d => d.session_key)));
                    if (!keys.includes('C') && keys.length > 0) {
                        setSelectedKey(keys[0]);
                    }
                }
            } catch (err) {
                console.error("Error fetching notewalking progress:", err);
            } finally {
                setIsLoading(false);
            }
        }

        // Since practice logs could be updated while dashboard is open, fetch once on mount
        fetchData();
    }, [userId]);

    // Derived data for dropdowns
    const availableKeys = useMemo(() => {
        return Array.from(new Set(data.map(d => d.session_key))).sort();
    }, [data]);

    const dataForKey = useMemo(() => {
        return data.filter(d => d.session_key === selectedKey);
    }, [data, selectedKey]);

    const availablePairs = useMemo(() => {
        return Array.from(new Set(dataForKey.map(d => d.chord_pair))).sort();
    }, [dataForKey]);

    // Compute the aggregated comfort data to render
    const aggregatedComfort = useMemo(() => {
        const result: Record<string, number> = {};

        const rowsToProcess = selectedPair === 'ALL'
            ? dataForKey
            : dataForKey.filter(d => d.chord_pair === selectedPair);

        rowsToProcess.forEach(row => {
            const rowData = row.comfort_data || {};
            Object.entries(rowData).forEach(([fretKey, level]) => {
                if (!result[fretKey] || result[fretKey] < level) {
                    result[fretKey] = level;
                }
            });
        });

        return result;
    }, [dataForKey, selectedPair]);

    const degreeMap = useMemo(() => createDegreeMap(selectedKey), [selectedKey]);

    const getComfortColor = (level: number) => {
        switch (level) {
            case 1: return 'hsl(210, 100%, 75%)'; // Lightest
            case 2: return 'hsl(210, 100%, 60%)'; // Light
            case 3: return 'hsl(210, 100%, 45%)'; // Medium
            case 4: return 'hsl(210, 100%, 30%)'; // Darkest
            default: return 'hsl(210, 100%, 60%)';
        }
    };

    const fretboardNotes = useMemo(() => {
        const notes: any[] = [];
        Array.from(degreeMap.keys()).forEach(noteName => {
            const positions = findAllNoteOccurrences(noteName);
            positions.forEach(pos => {
                const key = `${pos.string}-${pos.fret}`;
                const hasComfortData = aggregatedComfort.hasOwnProperty(key);

                if (hasComfortData) {
                    notes.push({
                        string: pos.string,
                        fret: pos.fret,
                        color: getComfortColor(aggregatedComfort[key]),
                    });
                }
            });
        });
        return notes;
    }, [degreeMap, aggregatedComfort]);

    if (isLoading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center p-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    if (data.length === 0) {
        return (
            <Card>
                <CardContent className="pt-6 text-center">
                    <h3 className="text-xl font-bold mb-2">No Notewalking Data Yet</h3>
                    <p className="text-muted-foreground">
                        Complete some Notewalking routines and save your fretboard progress to see your map here!
                    </p>
                </CardContent>
            </Card>
        );
    }

    // Auto-fix selected pair if it's no longer valid for the selected key
    if (selectedPair !== 'ALL' && !availablePairs.includes(selectedPair)) {
        setSelectedPair('ALL');
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle>Notewalking Mastery View</CardTitle>
                            <CardDescription>
                                See your level of comfort across the fretboard for various chord combinations.
                            </CardDescription>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Select value={selectedKey} onValueChange={setSelectedKey}>
                                <SelectTrigger className="w-[120px]">
                                    <SelectValue placeholder="Key" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableKeys.map(k => (
                                        <SelectItem key={k} value={k}>Key of {k}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={selectedPair} onValueChange={setSelectedPair}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Chord Pair" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Pairs (Overlaid)</SelectItem>
                                    {availablePairs.map(p => (
                                        <SelectItem key={p} value={p}>{p.replace(',', ' − ')}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center gap-6">
                        {/* Legend */}
                        <div className="flex flex-wrap items-center justify-center gap-4 px-4 py-2 border rounded-md bg-muted/20">
                            <span className="text-sm font-semibold mr-2">Levels:</span>
                            <div className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: getComfortColor(1) }}></span>
                                <span className="text-xs text-muted-foreground">Scale/Root</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: getComfortColor(2) }}></span>
                                <span className="text-xs text-muted-foreground">Chord Tones</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: getComfortColor(3) }}></span>
                                <span className="text-xs text-muted-foreground">Degrees</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: getComfortColor(4) }}></span>
                                <span className="text-xs text-muted-foreground">Mastered</span>
                            </div>
                        </div>

                        {/* Fretboard Map */}
                        <div className="w-full bg-black/90 p-6 sm:p-8 rounded-xl border overflow-x-auto min-h-[250px] flex items-center justify-center">
                            {fretboardNotes.length > 0 ? (
                                <div className="min-w-[800px] w-full">
                                    <Fretboard
                                        selectedNotes={fretboardNotes}
                                        degreeMap={degreeMap}
                                        isEditable={false}
                                        showDegreeNumbers={true}
                                    />
                                </div>
                            ) : (
                                <div className="text-center text-muted-foreground p-8">
                                    <p>No fretboard data painted for this selection.</p>
                                </div>
                            )}
                        </div>

                        {selectedPair === 'ALL' && dataForKey.length > 0 && (
                            <div className="text-sm text-muted-foreground self-start mt-4">
                                Overlaid maps: {dataForKey.map(d => (
                                    <Badge key={d.chord_pair} variant="outline" className="mr-1 mb-1">
                                        {d.chord_pair.replace(',', ' − ')}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default NotewalkingProgressMap;
