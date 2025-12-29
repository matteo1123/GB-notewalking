import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Trash2 } from "lucide-react";

interface Progression {
    id: string;
    name: string;
    progression: string; // CSV "I, V, vi"
    genre: string | null;
    description: string | null;
}

const ProgressionEditor = () => {
    const { toast } = useToast();
    const [progressions, setProgressions] = useState<Progression[]>([]);
    const [loading, setLoading] = useState(true);

    // New Item State
    const [newName, setNewName] = useState('');
    const [newProgression, setNewProgression] = useState('');
    const [newGenre, setNewGenre] = useState('');
    const [newDescription, setNewDescription] = useState('');

    const fetchProgressions = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('chord_progressions' as any)
            .select('*')
            .order('name');

        if (error) {
            toast({ title: "Error fetching", description: error.message, variant: "destructive" });
        } else {
            setProgressions((data as any) || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchProgressions();
    }, []);

    const handleAdd = async () => {
        if (!newName || !newProgression) {
            toast({ title: "Required", description: "Name and Sequence are required.", variant: "destructive" });
            return;
        }

        const { error } = await supabase.from('chord_progressions' as any).insert([{
            name: newName,
            progression: newProgression,
            genre: newGenre || null,
            description: newDescription || null,
            key: null, // Abstract
            measures_per_chord: 1 // Default
        }]);

        if (error) {
            toast({ title: "Error adding", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "Success", description: "Progression added." });
            setNewName('');
            setNewProgression('');
            setNewGenre('');
            setNewDescription('');
            fetchProgressions();
        }
    };

    const handleDelete = async (id: string) => {
        const { error } = await supabase.from('chord_progressions' as any).delete().eq('id', id);
        if (error) {
            toast({ title: "Error deleting", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "Deleted", description: "Progression removed." });
            fetchProgressions();
        }
    };

    return (
        <div className="container mx-auto p-4 max-w-4xl">
            <h1 className="text-3xl font-bold mb-6">Progression Editor</h1>

            {/* Add New Form */}
            <div className="bg-card border rounded-lg p-6 mb-8 shadow-sm">
                <h2 className="text-xl font-semibold mb-4">Create New Template</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Name</Label>
                        <Input placeholder="e.g. Pop Anthem" value={newName} onChange={e => setNewName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Numerals (CSV)</Label>
                        <Input placeholder="e.g. I, V, vi, IV" value={newProgression} onChange={e => setNewProgression(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Genre</Label>
                        <Input placeholder="Pop, Jazz..." value={newGenre} onChange={e => setNewGenre(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Description</Label>
                        <Input placeholder="Optional context" value={newDescription} onChange={e => setNewDescription(e.target.value)} />
                    </div>
                </div>
                <div className="mt-4 flex justify-end">
                    <Button onClick={handleAdd}>Add Template</Button>
                </div>
            </div>

            {/* List */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold">Library ({progressions.length})</h2>
                {loading ? (
                    <p>Loading...</p>
                ) : (
                    <div className="grid gap-4">
                        {progressions.map(p => (
                            <div key={p.id} className="bg-muted/30 border rounded-lg p-4 flex items-center justify-between">
                                <div>
                                    <div className="font-semibold text-lg">{p.name}</div>
                                    <div className="text-primary font-mono bg-primary/10 px-2 py-0.5 rounded inline-block text-sm mt-1">
                                        {p.progression}
                                    </div>
                                    {p.genre && <span className="text-xs text-muted-foreground ml-3">{p.genre}</span>}
                                    {p.description && <div className="text-sm text-muted-foreground mt-1">{p.description}</div>}
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)} className="text-destructive hover:text-destructive/90">
                                    <Trash2 className="h-5 w-5" />
                                </Button>
                            </div>
                        ))}
                        {progressions.length === 0 && <p className="text-muted-foreground">No progressions found.</p>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProgressionEditor;
