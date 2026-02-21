import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfDay, subDays, format, parseISO, differenceInDays } from 'date-fns';

export interface DailyMinutes {
    date: string;
    minutes: number;
}

export interface CategoryData {
    subject: string;
    minutes: number;
    fullMark: number;
}

export interface RecentAchievement {
    id: string;
    title: string;
    max_bpm: number;
    date: string;
    module_type: string;
}

export function useProgressStats() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [dailyMinutes, setDailyMinutes] = useState<DailyMinutes[]>([]);
    const [categoryDistribution, setCategoryDistribution] = useState<CategoryData[]>([]);
    const [recentAchievements, setRecentAchievements] = useState<RecentAchievement[]>([]);
    const [totalMinutes30Days, setTotalMinutes30Days] = useState(0);

    const loadStats = async () => {
        if (!user) return;
        setLoading(true);

        const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

        // Fetch logs from last 30 days
        const { data: logs, error } = await supabase
            .from('practice_log')
            .select('id, created_at, duration, module_type, max_bpm, scales(name), scale_shapes(name)')
            .eq('user_id', user.id)
            .gte('created_at', thirtyDaysAgo)
            .order('created_at', { ascending: false });

        if (error || !logs) {
            console.error("Error fetching practice logs:", error);
            setLoading(false);
            return;
        }

        // 1. Process Daily Minutes
        const daysMap = new Map<string, number>();
        // Initialize last 30 days with 0
        for (let i = 29; i >= 0; i--) {
            const dateStr = format(subDays(new Date(), i), 'MMM dd');
            daysMap.set(dateStr, 0);
        }

        let totalTime = 0;
        const categoryMap = new Map<string, number>();
        const achievementsList: RecentAchievement[] = [];
        const seenAchievementKeys = new Set<string>();

        logs.forEach(log => {
            const dateStr = format(parseISO(log.created_at), 'MMM dd');
            const minutes = (log.duration || 0) / 60;

            // Daily Minutes
            if (daysMap.has(dateStr)) {
                daysMap.set(dateStr, daysMap.get(dateStr)! + minutes);
            }
            totalTime += minutes;

            // Category Distribution
            const category = log.module_type || 'other';
            categoryMap.set(category, (categoryMap.get(category) || 0) + minutes);

            // Recent Achievements (Top BPMs)
            if (log.max_bpm && log.max_bpm > 0) {
                const title = (log as any).scales?.name || (log as any).scale_shapes?.name || category.replace('_', ' ');
                const key = `${category}-${title}`;
                if (!seenAchievementKeys.has(key) && achievementsList.length < 5) {
                    seenAchievementKeys.add(key);
                    achievementsList.push({
                        id: log.id,
                        title,
                        max_bpm: log.max_bpm,
                        date: log.created_at,
                        module_type: category
                    });
                }
            }
        });

        const dailyDataArray = Array.from(daysMap.entries()).map(([date, minutes]) => ({
            date,
            minutes: Math.round(minutes)
        }));

        // 2. Process Categories for Radar Chart
        // We want a fixed set of categories so the radar looks consistent
        const radarCategories = ['scale', 'arpeggio', 'rhythm', 'ear_training', 'notewalking', 'chord_progressions', 'piece_mastery', 'riff'];

        let maxCategoryMinutes = Math.max(...Array.from(categoryMap.values()), 10); // at least 10 for scale
        // round up to nearest 10
        maxCategoryMinutes = Math.ceil(maxCategoryMinutes / 10) * 10;

        const categoryDataArray: CategoryData[] = radarCategories.map(cat => ({
            subject: cat.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
            minutes: Math.round(categoryMap.get(cat) || 0),
            fullMark: maxCategoryMinutes
        }));

        setDailyMinutes(dailyDataArray);
        setCategoryDistribution(categoryDataArray);
        setRecentAchievements(achievementsList);
        setTotalMinutes30Days(Math.round(totalTime));

        setLoading(false);
    };

    useEffect(() => {
        loadStats();
    }, [user]);

    return {
        dailyMinutes,
        categoryDistribution,
        recentAchievements,
        totalMinutes30Days,
        loading,
        refresh: loadStats
    };
}
