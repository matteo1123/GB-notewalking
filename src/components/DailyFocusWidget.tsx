import { useState, useEffect } from 'react';
import { Sparkles, Target } from 'lucide-react';
import { cn } from '@/lib/utils'; // standard shadcn utility

const FOCUS_OPTIONS = [
    'Relaxation',
    'Structure',
    'Efficiency of Motion',
    'Efficiency of Force'
];

const STORAGE_KEY = 'tempo_trekker_daily_focus';
const STORAGE_DATE_KEY = 'tempo_trekker_daily_focus_date';

export function DailyFocusWidget() {
    const [currentFocus, setCurrentFocus] = useState<string>('Rolling...');
    const [isSpinning, setIsSpinning] = useState(true);

    useEffect(() => {
        // Find today's date string
        const todayStr = new Date().toDateString();

        // Check if we already have a focus for today
        const savedDate = localStorage.getItem(STORAGE_DATE_KEY);
        const savedFocus = localStorage.getItem(STORAGE_KEY);

        let targetFocusStr = '';

        if (savedDate === todayStr && savedFocus && FOCUS_OPTIONS.includes(savedFocus)) {
            // Already rolled today
            targetFocusStr = savedFocus;
        } else {
            // Need a new roll for today
            const randIndex = Math.floor(Math.random() * FOCUS_OPTIONS.length);
            targetFocusStr = FOCUS_OPTIONS[randIndex];

            // Save it
            localStorage.setItem(STORAGE_DATE_KEY, todayStr);
            localStorage.setItem(STORAGE_KEY, targetFocusStr);
        }

        // Slot machine effect
        let spinCount = 0;
        const maxSpins = 20; // total number of random text changes
        const spinIntervalMs = 70; // 70ms between each 'tick'

        const spinInterval = setInterval(() => {
            setCurrentFocus(FOCUS_OPTIONS[Math.floor(Math.random() * FOCUS_OPTIONS.length)]);
            spinCount++;

            if (spinCount >= maxSpins) {
                clearInterval(spinInterval);
                setCurrentFocus(targetFocusStr);
                setIsSpinning(false);
            }
        }, spinIntervalMs);

        return () => clearInterval(spinInterval);
    }, []);

    return (
        <div
            className="flex items-center gap-1.5 sm:gap-2 px-3 py-1 bg-gradient-to-r from-violet-500/10 to-transparent border border-violet-500/20 rounded-full select-none"
            title="Daily Technical Focus"
        >
            <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-violet-500" />
            <div className="flex items-center overflow-hidden min-w-[120px] sm:min-w-[150px] justify-center">
                <span className={cn(
                    "text-xs sm:text-sm font-medium tracking-wide whitespace-nowrap",
                    isSpinning ? "text-muted-foreground animate-pulse" : "text-violet-600 dark:text-violet-400"
                )}>
                    {currentFocus}
                </span>
            </div>
            {!isSpinning && <Sparkles className="w-3 h-3 text-amber-500 animate-pulse ml-1" />}
        </div>
    );
}
