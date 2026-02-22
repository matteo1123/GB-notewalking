import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Flame, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { ModuleConfig, ModuleType } from "@/types/practice";

interface CreateSprintDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    moduleType: ModuleType | null;
    moduleConfig: ModuleConfig | null;
    onSuccess?: () => void;
}

export function CreateSprintDialog({ open, onOpenChange, moduleType, moduleConfig, onSuccess }: CreateSprintDialogProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [durationDays, setDurationDays] = useState(3);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleCreateSprint = async () => {
        if (!user || !moduleType || !moduleConfig) return;
        setIsSubmitting(true);
        try {
            const { data, error } = await supabase.from('sprints' as any).insert({
                user_id: user.id,
                module_type: moduleType,
                module_config: {
                    module_type: moduleType,
                    ...moduleConfig,
                },
                duration_days: durationDays,
                sessions_per_day: 3, // Target sessions per day for the user to try and hit
                status: "active",
            }).select().single();

            if (error) throw error;

            toast({
                title: "Sprint created! 🏃‍♂️💨",
                description: `Your ${durationDays}-day sprint challenge is ready.`,
            });

            onOpenChange(false);
            if (onSuccess) onSuccess();

            // Optionally, we could jump straight in, but for now we navigate to the home dashboard so they can see the widget.
            navigate('/premium');
        } catch (error: any) {
            toast({
                title: "Failed to create Sprint",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!moduleType || !moduleConfig) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Flame className="w-5 h-5 text-orange-500" />
                        Start Sprint Challenge
                    </DialogTitle>
                    <DialogDescription>
                        A Sprint is a focused, daily {durationDays}-day challenge consisting of short 2-minute sessions. It's the best way to break through a plateau.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <Label>Sprint Duration</Label>
                            <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                {durationDays} Days
                            </Badge>
                        </div>
                        <Slider
                            value={[durationDays]}
                            onValueChange={([val]) => setDurationDays(val)}
                            max={7}
                            min={1}
                            step={1}
                            className="[&_[role=slider]]:bg-orange-500"
                        />
                        <p className="text-xs text-muted-foreground">
                            Commit to {durationDays} days of focused practice on this specific configuration.
                        </p>
                    </div>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreateSprint}
                        disabled={isSubmitting}
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                    >
                        {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Flame className="w-4 h-4 mr-2" />}
                        Create Sprint
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
