import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Piece } from "./types";

interface PieceEditorProps {
    initialData?: Piece | null;
    onSave: () => void;
    onCancel: () => void;
}

export function PieceEditor({ initialData, onSave, onCancel }: PieceEditorProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const [name, setName] = useState(initialData?.name || "");
    const [notes, setNotes] = useState(initialData?.notes || ""); // Chords/Tabs/Text
    const [segmentSeconds, setSegmentSeconds] = useState(initialData?.segment_seconds || 5);
    const [file, setFile] = useState<File | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setLoading(true);
        try {
            let audioUrl = initialData?.audio_url || null;
            let duration = initialData?.duration_seconds || null;

            // Upload Audio if changed
            if (file) {
                const fileExt = file.name.split('.').pop();
                const filePath = `${user.id}/${Date.now()}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('pieces')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('pieces')
                    .getPublicUrl(filePath);

                audioUrl = publicUrl;

                // Get duration (rough estimate or read from Audio element)
                // For accurate duration, we'd need to load it. 
                // For now, we'll let the metadata update later or stick to null duration and handle it in playback.
            }

            const pieceData = {
                name,
                notes,
                segment_seconds: Number(segmentSeconds),
                audio_url: audioUrl,
                user_id: user.id
            };

            if (initialData?.id) {
                const { error } = await supabase
                    .from('pieces')
                    .update(pieceData)
                    .eq('id', initialData.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('pieces')
                    .insert(pieceData);
                if (error) throw error;
            }

            toast({ title: "Piece saved successfully!" });
            onSave();
        } catch (error: any) {
            console.error("Error saving piece:", error);
            toast({
                title: "Error saving piece",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="name">Piece Name</Label>
                <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ex. Stairway to Heaven - Solo"
                    required
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="segment">Loop Segment Size (seconds)</Label>
                <Input
                    id="segment"
                    type="number"
                    min={1}
                    value={segmentSeconds}
                    onChange={(e) => setSegmentSeconds(Number(e.target.value))}
                    required
                />
                <p className="text-xs text-muted-foreground">
                    Base duration for practice loops (expands 5s → 10s → 20s)
                </p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="audio">Audio File (MP3)</Label>
                <Input
                    id="audio"
                    type="file"
                    accept="audio/*"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    required={!initialData?.audio_url}
                />
                {initialData?.audio_url && !file && (
                    <p className="text-xs text-green-600">✓ Current audio loaded</p>
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="notes">Notes / Chords / Tablature</Label>
                <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Paste tabs, chords, or practice notes here..."
                    className="min-h-[200px] font-mono whitespace-pre"
                />
            </div>

            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={onCancel}>
                    Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {initialData ? "Save Changes" : "Create Piece"}
                </Button>
            </div>
        </form>
    );
}
