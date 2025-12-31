import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface AutoRecordContextValue {
    autoRecordEnabled: boolean;
    setAutoRecordEnabled: (enabled: boolean) => Promise<void>;
    isPremium: boolean;
    isLoading: boolean;
}

const AutoRecordContext = createContext<AutoRecordContextValue | undefined>(undefined);

interface AutoRecordProviderProps {
    children: ReactNode;
}

/**
 * Auto-Record Provider
 * 
 * Manages the global auto-record setting across all practice modules.
 * - Persists to user profile settings
 * - Default: ON for new users
 * - Only available for premium users
 */
export function AutoRecordProvider({ children }: AutoRecordProviderProps) {
    const { user } = useAuth();
    const [autoRecordEnabled, setAutoRecordEnabledState] = useState(true); // Default ON
    const [isPremium, setIsPremium] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Load settings from profile on mount
    useEffect(() => {
        const loadSettings = async () => {
            if (!user) {
                setIsLoading(false);
                return;
            }

            try {
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('settings, premium_until')
                    .eq('id', user.id)
                    .single();

                if (error) {
                    console.error('Error loading auto-record settings:', error);
                    setIsLoading(false);
                    return;
                }

                // Check premium status
                if (profile?.premium_until) {
                    const premiumUntil = new Date(profile.premium_until);
                    setIsPremium(premiumUntil > new Date());
                }

                // Load auto-record setting (default: true)
                if (profile?.settings && typeof profile.settings === 'object') {
                    const settings = profile.settings as { autoRecordEnabled?: boolean };
                    // Only set to false if explicitly set to false
                    setAutoRecordEnabledState(settings.autoRecordEnabled !== false);
                }

                setIsLoading(false);
            } catch (err) {
                console.error('Failed to load settings:', err);
                setIsLoading(false);
            }
        };

        loadSettings();
    }, [user]);

    // Persist setting to profile
    const setAutoRecordEnabled = useCallback(async (enabled: boolean) => {
        if (!user) return;

        // Optimistic update
        setAutoRecordEnabledState(enabled);

        try {
            // Get current settings
            const { data: profile } = await supabase
                .from('profiles')
                .select('settings')
                .eq('id', user.id)
                .single();

            const currentSettings = (profile?.settings as Record<string, unknown>) || {};

            // Merge with new setting
            const updatedSettings = {
                ...currentSettings,
                autoRecordEnabled: enabled,
            };

            // Update profile
            const { error } = await supabase
                .from('profiles')
                .update({ settings: updatedSettings })
                .eq('id', user.id);

            if (error) {
                console.error('Error saving auto-record setting:', error);
                // Revert on error
                setAutoRecordEnabledState(!enabled);
            }
        } catch (err) {
            console.error('Failed to save setting:', err);
            setAutoRecordEnabledState(!enabled);
        }
    }, [user]);

    return (
        <AutoRecordContext.Provider
            value={{
                autoRecordEnabled: isPremium ? autoRecordEnabled : false, // Non-premium always off
                setAutoRecordEnabled,
                isPremium,
                isLoading,
            }}
        >
            {children}
        </AutoRecordContext.Provider>
    );
}

/**
 * Hook to access auto-record context
 */
export function useAutoRecord() {
    const context = useContext(AutoRecordContext);
    if (context === undefined) {
        throw new Error('useAutoRecord must be used within an AutoRecordProvider');
    }
    return context;
}
