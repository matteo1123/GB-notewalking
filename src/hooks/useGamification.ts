import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface GamificationState {
    points: number;
    level: number;
    current_xp: number;
    levelProgressPercentage: number;
    isLoading: boolean;
    hasLeveledUp: boolean;
}

export function calculateLevelFromXP(xp: number): number {
    return 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 50.0));
}

export function getLevelProgress(xp: number) {
    const currentLevel = calculateLevelFromXP(xp);
    const xpForCurrentLevel = 50 * Math.pow(currentLevel - 1, 2);
    const xpForNextLevel = 50 * Math.pow(currentLevel, 2);

    const xpIntoLevel = xp - xpForCurrentLevel;
    const xpNeededForLevel = xpForNextLevel - xpForCurrentLevel;
    const progressPercentage = Math.max(0, Math.min(100, Math.round((xpIntoLevel / xpNeededForLevel) * 100)));

    return {
        level: currentLevel,
        progressPercentage
    };
}

export function useGamification() {
    const { user } = useAuth();
    const [state, setState] = useState<GamificationState>({
        points: 0,
        level: 1,
        current_xp: 0,
        levelProgressPercentage: 0,
        isLoading: true,
        hasLeveledUp: false,
    });
    const prevLevelRef = useRef<number | null>(null);

    const fetchGamificationData = async () => {
        if (!user) {
            setState(prev => ({ ...prev, isLoading: false }));
            return;
        }

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('points, level, current_xp')
                .eq('id', user.id)
                .single();

            if (error) {
                console.error("Error fetching gamification data:", error);
            } else if (data) {
                const fetchedXp = data.current_xp || 0;
                const { level: newLevel, progressPercentage } = getLevelProgress(fetchedXp);

                prevLevelRef.current = newLevel;

                setState({
                    points: data.points || 0,
                    level: newLevel,
                    current_xp: fetchedXp,
                    levelProgressPercentage: progressPercentage,
                    isLoading: false,
                    hasLeveledUp: false,
                });
            }
        } catch (err) {
            console.error("Failed to load gamification data:", err);
        } finally {
            setState(prev => ({ ...prev, isLoading: false }));
        }
    };

    useEffect(() => {
        fetchGamificationData();

        // Set up realtime subscription to listen for point updates (from Edge Function/RPC)
        if (!user) return;

        const channel = supabase
            .channel('gamification-updates')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${user.id}`
                },
                (payload: any) => {
                    if (payload.new) {
                        const updatedXp = payload.new.current_xp || 0;
                        const { level: newLevel, progressPercentage } = getLevelProgress(updatedXp);

                        let didLevelUp = false;
                        if (prevLevelRef.current !== null && newLevel > prevLevelRef.current) {
                            didLevelUp = true;
                        }
                        prevLevelRef.current = newLevel;

                        setState(prevState => ({
                            points: payload.new.points || 0,
                            level: newLevel,
                            current_xp: updatedXp,
                            levelProgressPercentage: progressPercentage,
                            isLoading: false,
                            hasLeveledUp: prevState.hasLeveledUp || didLevelUp, // Keep it true until acknowledged
                        }));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id]);

    const acknowledgeLevelUp = () => {
        setState(s => ({ ...s, hasLeveledUp: false }));
    };

    return { ...state, refresh: fetchGamificationData, acknowledgeLevelUp };
}
