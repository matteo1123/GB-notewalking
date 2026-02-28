import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Play, Edit, Trash2, Music, X, Repeat, Mic } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Piece } from "./types";
import { PieceEditor } from "./PieceEditor";

interface PieceListProps {
    onSelectPiece: (piece: Piece) => void;
    // Exit callback for standalone/freeplay mode
    onExit?: () => void;
}

export function PieceList({ onSelectPiece, onExit }: PieceListProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [pieces, setPieces] = useState<Piece[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingPiece, setEditingPiece] = useState<Piece | null>(null);

    const fetchPieces = async () => {
        if (!user) {
            // No user logged in - show empty state instead of endless loading
            setLoading(false);
            setPieces([]);
            return;
        }
        try {
            const { data, error } = await supabase
                .from('pieces')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPieces(data as Piece[]);
        } catch (error) {
            console.error("Error fetching pieces:", error);
            // On error, show empty state rather than endless loading
            setPieces([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPieces();
    }, [user]);

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this piece?")) return;

        try {
            const { error } = await supabase.from('pieces').delete().eq('id', id);
            if (error) throw error;
            toast({ title: "Piece deleted" });
            fetchPieces();
        } catch (error: any) {
            toast({ title: "Error deleting piece", description: error.message, variant: "destructive" });
        }
    };

    const handleEdit = (piece: Piece, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingPiece(piece);
        setIsEditorOpen(true);
    };

    const handleCreate = () => {
        setEditingPiece(null);
        setIsEditorOpen(true);
    };

    const handleEditorClose = () => {
        setIsEditorOpen(false);
        setEditingPiece(null);
        fetchPieces();
    };

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading pieces...</div>;
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto p-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Piece Mastery</h2>
                    <p className="text-muted-foreground mt-2">
                        Master your favorite songs chunk by chunk.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={handleCreate}>
                        <Plus className="mr-2 h-4 w-4" /> New Piece
                    </Button>
                    {onExit && (
                        <Button size="sm" variant="ghost" className="gap-1" onClick={onExit}>
                            <X className="w-4 h-4" /> Exit
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Static Mock Piece for "Free Feedback Loop" */}
                <Card
                    className="cursor-pointer border-dashed hover:border-primary hover:bg-muted/50 transition-colors group relative overflow-hidden flex flex-col items-center justify-center p-6 text-center"
                    onClick={() => onSelectPiece({
                        id: 'free-loop',
                        user_id: user?.id || '',
                        name: 'Free Feedback Loop',
                        audio_url: null,
                        segment_seconds: 15, // default
                        duration_seconds: 0,
                        notes: '',
                        created_at: new Date().toISOString()
                    })}
                >
                    <Repeat className="w-12 h-12 text-muted-foreground mb-4 group-hover:text-primary transition-colors" />
                    <h3 className="text-xl font-bold mb-2">Free Feedback Loop</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        A tight play-and-listen cycle. No backing track needed.
                    </p>
                    <Button variant="secondary" className="w-full group-hover:bg-primary group-hover:text-primary-foreground">
                        <Mic className="mr-2 h-4 w-4" /> Start Loop
                    </Button>
                </Card>

                {pieces.map((piece) => (
                    <Card
                        key={piece.id}
                        className="cursor-pointer hover:border-primary transition-colors group relative overflow-hidden"
                        onClick={() => onSelectPiece(piece)}
                    >
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent group-hover:via-primary/50" />

                        <CardHeader className="pb-2">
                            <CardTitle className="flex justify-between items-start gap-2">
                                <span className="truncate" title={piece.name}>{piece.name}</span>
                                <Music className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex justify-between items-center mt-4">
                                <div className="text-sm text-muted-foreground">
                                    {piece.segment_seconds}s segments
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => handleEdit(piece, e)}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-destructive" onClick={(e) => handleDelete(piece.id, e)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <Button className="w-full mt-4 group-hover:bg-primary group-hover:text-primary-foreground">
                                <Play className="mr-2 h-4 w-4" /> Practice
                            </Button>
                        </CardContent>
                    </Card>
                ))}

                {pieces.length === 0 && (
                    <div className="col-span-full text-center py-12 border-2 border-dashed rounded-lg">
                        <h3 className="text-lg font-medium">No pieces yet</h3>
                        <p className="text-muted-foreground mb-4">Upload a song to start mastering it.</p>
                        <Button onClick={handleCreate} variant="outline">Create your first piece</Button>
                    </div>
                )}
            </div>

            <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingPiece ? "Edit Piece" : "New Piece"}</DialogTitle>
                    </DialogHeader>
                    <PieceEditor
                        initialData={editingPiece}
                        onSave={handleEditorClose}
                        onCancel={() => setIsEditorOpen(false)}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}
