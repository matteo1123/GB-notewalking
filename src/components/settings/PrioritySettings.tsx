
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

interface Priorities {
    rhythm: number;
    improv: number;
    technique: number;
    repertoire: number;
}

const DEFAULT_PRIORITIES: Priorities = {
    rhythm: 5,
    improv: 5,
    technique: 5,
    repertoire: 5,
};

export const PrioritySettings = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [priorities, setPriorities] = useState<Priorities>(DEFAULT_PRIORITIES);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchPriorities = async () => {
            if (!user) return;
            setLoading(true);

            const { data, error } = await (supabase as any)
                .from("profiles")
                .select("priorities")
                .eq("id", user.id)
                .single();

            if (error) throw error;

            if (data?.priorities) {
                setPriorities(data.priorities as Priorities);
            }
            setLoading(false);
        };

        fetchPriorities();
    }, [user]);

    const handlePriorityChange = async (key: keyof Priorities, value: number) => {
        const newPriorities = { ...priorities, [key]: value };
        setPriorities(newPriorities);

        // Debounce saving effectively by just saving immediately?? 
        // Better to save on mouse up? Slider typically has onValueCommit.
        // For now, let's just update local state and have a separate save or debounce.
        // Shadcn Slider `onValueChange` is continuous. We should use `onValueCommit` if available or debounce.
        // But `Slider` only exposes onValueChange usually or onValueCommit.
    };

    const savePriorities = async (newPriorities: Priorities) => {
        if (!user) return;
        setSaving(true);

        const { error } = await (supabase as any)
            .from("profiles")
            .update({ priorities: newPriorities })
            .eq("id", user.id);

        setSaving(false);
        if (error) {
            toast({
                title: "Failed to save priorities",
                description: error.message,
                variant: "destructive"
            });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Curriculum Priorities</CardTitle>
                <CardDescription>
                    Customize your intelligent curriculum. Higher weight means these topics will appear more frequently in your generated sessions.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {loading ? (
                    <div className="flex justify-center p-4">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* Rhythm */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-base">Rhythm & Groove</Label>
                                <span className="text-sm font-medium">{priorities.rhythm}/10</span>
                            </div>
                            <Slider
                                value={[priorities.rhythm]}
                                min={0}
                                max={10}
                                step={1}
                                onValueChange={([val]) => handlePriorityChange("rhythm", val)}
                                onValueCommit={([val]) => savePriorities({ ...priorities, rhythm: val })}
                            />
                            <p className="text-xs text-muted-foreground">
                                Focus on timing, strumming patterns, and groove tightness.
                            </p>
                        </div>

                        {/* Improv */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-base">Improvisation & Theory</Label>
                                <span className="text-sm font-medium">{priorities.improv}/10</span>
                            </div>
                            <Slider
                                value={[priorities.improv]}
                                min={0}
                                max={10}
                                step={1}
                                onValueChange={([val]) => handlePriorityChange("improv", val)}
                                onValueCommit={([val]) => savePriorities({ ...priorities, improv: val })}
                            />
                            <p className="text-xs text-muted-foreground">
                                Focus on scales, arpeggios, and melodic phrasing.
                            </p>
                        </div>

                        {/* Technique */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-base">Technique & Speed</Label>
                                <span className="text-sm font-medium">{priorities.technique}/10</span>
                            </div>
                            <Slider
                                value={[priorities.technique]}
                                min={0}
                                max={10}
                                step={1}
                                onValueChange={([val]) => handlePriorityChange("technique", val)}
                                onValueCommit={([val]) => savePriorities({ ...priorities, technique: val })}
                            />
                            <p className="text-xs text-muted-foreground">
                                Focus on picking mechanics, legato, and dexterity.
                            </p>
                        </div>

                        {/* Repertoire */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-base">Repertoire & Songs</Label>
                                <span className="text-sm font-medium">{priorities.repertoire}/10</span>
                            </div>
                            <Slider
                                value={[priorities.repertoire]}
                                min={0}
                                max={10}
                                step={1}
                                onValueChange={([val]) => handlePriorityChange("repertoire", val)}
                                onValueCommit={([val]) => savePriorities({ ...priorities, repertoire: val })}
                            />
                            <p className="text-xs text-muted-foreground">
                                Focus on learning full songs, chord progressions, and riffs.
                            </p>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
};
