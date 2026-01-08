import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface PracticeSettings {
    practiceMode: 'static' | 'progressive';
    autoAdvance: boolean;
    exerciseDurationMinutes: number;
    bpmIncrement: number;
}

const DEFAULT_SETTINGS: PracticeSettings = {
    practiceMode: 'progressive',
    autoAdvance: true,
    exerciseDurationMinutes: 2,
    bpmIncrement: 5,
};

interface PracticeSettingsContextValue {
    settings: PracticeSettings;
    updateSettings: (newSettings: Partial<PracticeSettings>) => Promise<void>;
    isLoading: boolean;
}

const PracticeSettingsContext = createContext<PracticeSettingsContextValue | undefined>(undefined);

interface PracticeSettingsProviderProps {
    children: ReactNode;
}

export function PracticeSettingsProvider({ children }: PracticeSettingsProviderProps) {
    const { user } = useAuth();
    const [settings, setSettings] = useState<PracticeSettings>(DEFAULT_SETTINGS);
    const [isLoading, setIsLoading] = useState(true);

    // Load settings from profile
    useEffect(() => {
        if (!user) {
            setIsLoading(false);
            return;
        }

        const loadSettings = async () => {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('settings')
                    .eq('id', user.id)
                    .single();

                if (error) {
                    console.error('Error loading practice settings:', error);
                } else if (data?.settings) {
                    const profileSettings = data.settings as Record<string, any>;
                    setSettings({
                        practiceMode: profileSettings.practiceMode || DEFAULT_SETTINGS.practiceMode,
                        autoAdvance: profileSettings.autoAdvance ?? DEFAULT_SETTINGS.autoAdvance,
                        exerciseDurationMinutes: profileSettings.exerciseDurationMinutes || DEFAULT_SETTINGS.exerciseDurationMinutes,
                        bpmIncrement: profileSettings.bpmIncrement || DEFAULT_SETTINGS.bpmIncrement,
                    });
                }
            } catch (err) {
                console.error('Failed to load practice settings:', err);
            } finally {
                setIsLoading(false);
            }
        };

        loadSettings();
    }, [user]);

    const updateSettings = useCallback(async (newSettings: Partial<PracticeSettings>) => {
        if (!user) return;

        const merged = { ...settings, ...newSettings };
        setSettings(merged);

        try {
            // Get current profile settings and merge
            const { data: profile } = await supabase
                .from('profiles')
                .select('settings')
                .eq('id', user.id)
                .single();

            const currentSettings = (profile?.settings as Record<string, any>) || {};
            const updatedSettings = {
                ...currentSettings,
                practiceMode: merged.practiceMode,
                autoAdvance: merged.autoAdvance,
                exerciseDurationMinutes: merged.exerciseDurationMinutes,
                bpmIncrement: merged.bpmIncrement,
            };

            const { error } = await supabase
                .from('profiles')
                .update({ settings: updatedSettings })
                .eq('id', user.id);

            if (error) {
                console.error('Error saving practice settings:', error);
                // Revert on error
                setSettings(settings);
            }
        } catch (err) {
            console.error('Failed to save practice settings:', err);
            setSettings(settings);
        }
    }, [user, settings]);

    return (
        <PracticeSettingsContext.Provider value={{ settings, updateSettings, isLoading }}>
            {children}
        </PracticeSettingsContext.Provider>
    );
}

export function usePracticeSettings() {
    const context = useContext(PracticeSettingsContext);
    if (!context) {
        throw new Error('usePracticeSettings must be used within a PracticeSettingsProvider');
    }
    return context;
}
