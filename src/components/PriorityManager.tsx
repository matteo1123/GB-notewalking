import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Badge } from './ui/badge';
import { Plus, Trash2, Target } from 'lucide-react';
import { useToast } from './ui/use-toast';
import { MODULE_REGISTRY } from '@/types/modules';
import type { UserPriority, CreatePriorityInput } from '@/types/priorities';
import { ModuleType } from '@/types/practice';

interface PriorityManagerProps {
    onStart?: () => void;
}

/**
 * Priority Manager Component
 * Allows users to set and manage their practice priorities
 */
export function PriorityManager({ onStart }: PriorityManagerProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [priorities, setPriorities] = useState<UserPriority[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);

    useEffect(() => {
        if (user) {
            loadPriorities();
        }
    }, [user]);

    const loadPriorities = async () => {
        if (!user) return;
        // ... rest of loadPriorities
        setLoading(true);
        const { data, error } = await supabase
            .from('user_priorities')
            .select('*')
            .eq('user_id', user.id)
            .order('weight', { ascending: false });

        if (error) {
            toast({
                title: 'Error loading priorities',
                description: error.message,
                variant: 'destructive',
            });
        } else {
            setPriorities(data as UserPriority[]);
        }
        setLoading(false);
    };

    const handleUpdateWeight = async (priorityId: string, newWeight: number) => {
        // ... rest of file ...
        const { error } = await supabase
            .from('user_priorities')
            .update({ weight: newWeight })
            .eq('id', priorityId);

        if (error) {
            toast({
                title: 'Error updating priority',
                description: error.message,
                variant: 'destructive',
            });
        } else {
            setPriorities(prev =>
                prev.map(p => (p.id === priorityId ? { ...p, weight: newWeight } : p))
            );
        }
    };

    const handleDelete = async (priorityId: string) => {
        const { error } = await supabase
            .from('user_priorities')
            .delete()
            .eq('id', priorityId);

        if (error) {
            toast({
                title: 'Error deleting priority',
                description: error.message,
                variant: 'destructive',
            });
        } else {
            setPriorities(prev => prev.filter(p => p.id !== priorityId));
            toast({
                title: 'Priority removed',
                description: 'Your practice priority has been removed.',
            });
        }
    };

    const handleAddPriority = async (moduleType: ModuleType) => {
        if (!user) return;

        const newPriority: CreatePriorityInput = {
            type: 'module',
            weight: 5,
            module_type: moduleType,
        };

        const { data, error } = await supabase
            .from('user_priorities')
            .insert([{ ...newPriority, user_id: user.id }])
            .select()
            .single();

        if (error) {
            toast({
                title: 'Error adding priority',
                description: error.message,
                variant: 'destructive',
            });
        } else {
            setPriorities(prev => [...prev, data as UserPriority]);
            setShowAddModal(false);
            toast({
                title: 'Priority added!',
                description: `${MODULE_REGISTRY[moduleType].name} added to your practice priorities.`,
            });
        }
    };

    // Calculate total weight
    const totalWeight = priorities.reduce((sum, p) => sum + p.weight, 0);

    // Available modules (not already added)
    const availableModules = (Object.keys(MODULE_REGISTRY) as ModuleType[]).filter(
        moduleType => !priorities.some(p => p.module_type === moduleType)
    );

    if (loading) {
        return <div className="p-4">Loading priorities...</div>;
    }

    return (
        <div className="space-y-4 sm:space-y-6">
            <div>
                <h2 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2">Your Practice Priorities</h2>
                <p className="text-muted-foreground text-sm sm:text-base">
                    Set your practice priorities. Higher weight = more practice time allocated.
                </p>
            </div>

            {/* Priority Cards */}
            <div className="grid gap-4">
                {priorities.length === 0 ? (
                    <Card>
                        <CardContent className="pt-6 text-center">
                            <Target className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                            <h3 className="text-lg font-semibold mb-2">No priorities set</h3>
                            <p className="text-muted-foreground mb-4">
                                Add your first practice priority to get started!
                            </p>
                            <Button onClick={() => setShowAddModal(true)}>
                                <Plus className="w-4 h-4 mr-2" />
                                Add Priority
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    priorities.map((priority) => {
                        const metadata = priority.module_type
                            ? MODULE_REGISTRY[priority.module_type as ModuleType]
                            : null;

                        const timePercentage = totalWeight > 0
                            ? Math.round((priority.weight / totalWeight) * 100)
                            : 0;

                        return (
                            <Card key={priority.id}>
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            {metadata && (
                                                <span className="text-3xl">{metadata.icon}</span>
                                            )}
                                            <div>
                                                <CardTitle className="text-xl">
                                                    {metadata?.name || 'Custom Goal'}
                                                </CardTitle>
                                                <CardDescription>
                                                    {metadata?.shortDescription}
                                                </CardDescription>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(priority.id)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3 sm:space-y-4 pt-2 sm:pt-4">
                                    {/* Weight Slider */}
                                    <div>
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 mb-2">
                                            <span className="text-xs sm:text-sm font-medium">Priority Weight</span>
                                            <div className="flex items-center gap-1 sm:gap-2">
                                                <Badge variant="secondary" className="text-xs">
                                                    {priority.weight}/10
                                                </Badge>
                                                <Badge variant="outline" className="text-xs">
                                                    ~{timePercentage}%
                                                </Badge>
                                            </div>
                                        </div>
                                        <Slider
                                            min={1}
                                            max={10}
                                            step={1}
                                            value={[priority.weight]}
                                            onValueChange={([value]) =>
                                                handleUpdateWeight(priority.id, value)
                                            }
                                            className="w-full"
                                        />
                                    </div>

                                    {/* Progress */}
                                    {priority.last_practiced && (
                                        <div className="text-sm text-muted-foreground">
                                            Last practiced:{' '}
                                            {new Date(priority.last_practiced).toLocaleDateString()}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>

            {/* Add Priority Button */}
            {priorities.length > 0 && availableModules.length > 0 && (
                <Button
                    onClick={() => setShowAddModal(true)}
                    variant="outline"
                    className="w-full"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Another Priority
                </Button>
            )}

            {/* Add Priority Modal (Simple) */}
            {showAddModal && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <Card className="max-w-2xl w-full">
                        <CardHeader>
                            <CardTitle>Add Practice Priority</CardTitle>
                            <CardDescription>
                                Choose a practice area to focus on
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {availableModules.map((moduleType) => {
                                    const metadata = MODULE_REGISTRY[moduleType];
                                    return (
                                        <Button
                                            key={moduleType}
                                            variant="outline"
                                            className="h-auto py-3 sm:py-4 flex flex-col items-start gap-1 sm:gap-2"
                                            onClick={() => handleAddPriority(moduleType)}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl sm:text-2xl">{metadata.icon}</span>
                                                <span className="font-semibold text-sm sm:text-base">{metadata.name}</span>
                                            </div>
                                            <span className="text-xs text-muted-foreground text-left line-clamp-2">
                                                {metadata.shortDescription}
                                            </span>
                                        </Button>
                                    );
                                })}
                            </div>
                            <Button
                                variant="ghost"
                                className="w-full mt-4"
                                onClick={() => setShowAddModal(false)}
                            >
                                Cancel
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}
            {/* Start Button */}
            {onStart && priorities.length > 0 && (
                <div className="pt-4 border-t mt-8">
                    <Button
                        size="lg"
                        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all"
                        onClick={onStart}
                    >
                        Start Practice Session →
                    </Button>
                    <p className="text-center text-sm text-muted-foreground mt-2">
                        Ready to go? Head to the start screen to begin.
                    </p>
                </div>
            )}
        </div>
    );
}
