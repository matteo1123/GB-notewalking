import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { ModuleConfig, ScaleModuleConfig, ArpeggioModuleConfig } from '@/types/practice';

export interface SavedModuleInstance {
    id: string;
    name: string;
    module_type: string;
    module_config: ModuleConfig;
    created_at: string;
}

export interface UseModuleConfigReturn {
    savedInstances: SavedModuleInstance[];
    loading: boolean;
    saveConfig: (name: string, config: ModuleConfig) => Promise<string | null>;
    loadConfig: (instanceId: string) => Promise<ModuleConfig | null>;
    deleteConfig: (instanceId: string) => Promise<boolean>;
    refreshInstances: () => Promise<void>;
}

/**
 * Hook to manage module configurations persisted in practice_log.
 * Each saved config becomes a "module instance" that can be added to sessions.
 */
export function useModuleConfig(moduleType: 'scale' | 'arpeggio'): UseModuleConfigReturn {
    const { toast } = useToast();
    const [savedInstances, setSavedInstances] = useState<SavedModuleInstance[]>([]);
    const [loading, setLoading] = useState(true);

    // Load saved instances for this module type
    const refreshInstances = useCallback(async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            // Query practice_log for entries with module_config that are "template" entries
            // We'll identify saved configs by having a specific marker in module_config
            // Note: Cast to any since types may not be regenerated yet
            const { data, error } = await supabase
                .from('practice_log')
                .select('id, module_type, module_config, created_at, notes')
                .eq('user_id', user.id)
                .eq('module_type', moduleType)
                .not('module_config', 'is', null)
                .order('created_at', { ascending: false }) as { data: any[] | null, error: any };

            if (error) throw error;

            // Transform to SavedModuleInstance format
            const instances: SavedModuleInstance[] = (data || [])
                .filter((row: any) => {
                    // Only include entries that have a saved_as_instance marker
                    const config = row.module_config as any;
                    return config && config._saved_instance === true;
                })
                .map((row: any) => ({
                    id: row.id,
                    name: (row.module_config as any)._instance_name || `${moduleType} config`,
                    module_type: row.module_type || moduleType,
                    module_config: row.module_config as ModuleConfig,
                    created_at: row.created_at,
                }));

            setSavedInstances(instances);
        } catch (error) {
            console.error('Failed to load module configs:', error);
        } finally {
            setLoading(false);
        }
    }, [moduleType]);

    // Load on mount
    useEffect(() => {
        refreshInstances();
    }, [refreshInstances]);

    // Save a new config as a module instance
    const saveConfig = useCallback(async (name: string, config: ModuleConfig): Promise<string | null> => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast({
                    title: 'Not authenticated',
                    description: 'Please sign in to save configurations',
                    variant: 'destructive',
                });
                return null;
            }

            // Add instance markers to the config
            const configWithMeta = {
                ...config,
                _saved_instance: true,
                _instance_name: name,
            };

            // Cast to any since types may not be regenerated yet
            const { data, error } = await supabase
                .from('practice_log')
                .insert({
                    user_id: user.id,
                    module_type: moduleType,
                    module_config: configWithMeta as any,
                    duration: 0, // Template entry, no duration
                    notes: `Saved module instance: ${name}`,
                } as any)
                .select()
                .single() as { data: any, error: any };

            if (error) throw error;

            toast({
                title: 'Configuration saved!',
                description: `"${name}" is now available in your modules`,
            });

            await refreshInstances();
            return data.id;

        } catch (error) {
            console.error('Failed to save config:', error);
            toast({
                title: 'Failed to save',
                description: 'Please try again',
                variant: 'destructive',
            });
            return null;
        }
    }, [moduleType, toast, refreshInstances]);

    // Load a specific config by instance ID
    const loadConfig = useCallback(async (instanceId: string): Promise<ModuleConfig | null> => {
        try {
            // Cast to any since types may not be regenerated yet
            const { data, error } = await supabase
                .from('practice_log')
                .select('module_config')
                .eq('id', instanceId)
                .single() as { data: any, error: any };

            if (error) throw error;
            return data.module_config as ModuleConfig;

        } catch (error) {
            console.error('Failed to load config:', error);
            return null;
        }
    }, []);

    // Delete a saved config
    const deleteConfig = useCallback(async (instanceId: string): Promise<boolean> => {
        try {
            const { error } = await supabase
                .from('practice_log')
                .delete()
                .eq('id', instanceId);

            if (error) throw error;

            toast({
                title: 'Configuration deleted',
            });

            await refreshInstances();
            return true;

        } catch (error) {
            console.error('Failed to delete config:', error);
            toast({
                title: 'Failed to delete',
                variant: 'destructive',
            });
            return false;
        }
    }, [toast, refreshInstances]);

    return {
        savedInstances,
        loading,
        saveConfig,
        loadConfig,
        deleteConfig,
        refreshInstances,
    };
}
