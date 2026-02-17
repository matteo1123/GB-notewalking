import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Lightbulb, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export function SuggestionBox() {
    const [open, setOpen] = useState(false);
    const [suggestion, setSuggestion] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { user } = useAuth();
    const { toast } = useToast();

    const handleSubmit = async () => {
        if (!suggestion.trim()) return;

        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('suggestions').insert({
                content: suggestion,
                user_id: user?.id || null, // Allow anon suggestions if we want, but schema allows null
                source: 'user'
            });

            if (error) throw error;

            toast({
                title: "Suggestion received!",
                description: "Thank you for your feedback. We read every suggestion.",
            });
            setSuggestion('');
            setOpen(false);
        } catch (error) {
            console.error('Error submitting suggestion:', error);
            toast({
                title: "Error",
                description: "Failed to submit suggestion. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="hidden sm:flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" />
                    <span className="hidden lg:inline">Suggest</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Make a Suggestion</DialogTitle>
                    <DialogDescription>
                        Have an idea for a new feature or improvement? Let us know!
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <Textarea
                        placeholder="I think it would be cool if..."
                        value={suggestion}
                        onChange={(e) => setSuggestion(e.target.value)}
                        className="min-h-[100px]"
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={!suggestion.trim() || isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Submit
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
