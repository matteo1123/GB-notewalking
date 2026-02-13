import { Button } from './ui/button';
import { Progress } from './ui/progress';
import {
    Play,
    Pause,
    SkipForward,
    SkipBack,
    ChevronLeft,
    ChevronRight,
    X,
    Clock,
} from 'lucide-react';
import { getModuleIcon } from '@/types/modules';
import type { ModuleType } from '@/types/practice';

/**
 * LessonNavWrapper — Unified navigation chrome for guided practice sessions.
 *
 * Wraps any practice module as `children` and provides:
 *  - Previous / Next block navigation
 *  - Block counter ("2 of 5")
 *  - Timer (time remaining in current block)
 *  - Pause / Skip / Exit controls
 *
 * This is the single source of truth for session navigation UI.
 * All modules rendered inside a GuidedPracticeSession should go through this wrapper.
 */

interface LessonNavWrapperProps {
    children: React.ReactNode;
    currentIndex: number;
    totalBlocks: number;
    blockLabel: string;
    blockModuleType?: string;
    timeRemaining?: number; // seconds
    isPaused?: boolean;
    hasPrevious?: boolean;
    hasNext?: boolean;
    onPrevious?: () => void;
    onNext?: () => void;
    onPause?: () => void;
    onResume?: () => void;
    onSkip?: () => void;
    onExit: () => void;
    /** Optional next block label to show in footer */
    nextBlockLabel?: string;
}

function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function LessonNavWrapper({
    children,
    currentIndex,
    totalBlocks,
    blockLabel,
    blockModuleType,
    timeRemaining = 0,
    isPaused = false,
    hasPrevious = false,
    hasNext = false,
    onPrevious,
    onNext,
    onPause,
    onResume,
    onSkip,
    onExit,
    nextBlockLabel,
}: LessonNavWrapperProps) {
    const blockProgress = ((currentIndex + 1) / totalBlocks) * 100;

    return (
        <div className="flex flex-col h-full">
            {/* ── Navigation Bar ── */}
            <div className="flex-shrink-0 flex items-center justify-between px-2 sm:px-4 py-1.5 sm:py-2 border-b bg-card gap-1 sm:gap-2">
                {/* Left: Previous */}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onPrevious}
                    disabled={!hasPrevious}
                    className="px-2 sm:px-3"
                >
                    <ChevronLeft className="w-4 h-4 sm:mr-1" />
                    <span className="hidden sm:inline">Prev</span>
                </Button>

                {/* Center: Block info + controls */}
                <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-center min-w-0">
                    {/* Module icon + label */}
                    {blockModuleType && (
                        <span className="text-lg hidden sm:inline">{getModuleIcon(blockModuleType as ModuleType)}</span>
                    )}
                    <span className="text-xs sm:text-sm font-medium truncate max-w-[120px] sm:max-w-none">
                        {blockLabel}
                    </span>

                    {/* Block counter */}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {currentIndex + 1}/{totalBlocks}
                    </span>

                    {/* Timer */}
                    <div className="flex items-center gap-1 text-sm">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="font-mono font-bold tabular-nums text-xs sm:text-sm">
                            {formatTime(timeRemaining)}
                        </span>
                    </div>

                    {/* Pause/Resume */}
                    {onPause && onResume && (
                        <Button
                            variant={isPaused ? 'default' : 'outline'}
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={isPaused ? onResume : onPause}
                        >
                            {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                        </Button>
                    )}

                    {/* Skip */}
                    {onSkip && (
                        <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={onSkip}>
                            <SkipForward className="w-3 h-3" />
                        </Button>
                    )}
                </div>

                {/* Right: Next + Exit */}
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onNext}
                        disabled={!hasNext}
                        className="px-2 sm:px-3"
                    >
                        <span className="hidden sm:inline">Next</span>
                        <ChevronRight className="w-4 h-4 sm:ml-1" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="px-2 text-xs gap-1"
                        onClick={onExit}
                    >
                        <X className="w-3 h-3" />
                        <span className="hidden sm:inline">Exit</span>
                    </Button>
                </div>
            </div>

            {/* ── Progress Bar ── */}
            <div className="flex-shrink-0">
                <Progress value={blockProgress} className="h-1 rounded-none" />
            </div>

            {/* ── Module Content (children) ── */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {children}
            </div>

            {/* ── Footer: upcoming info ── */}
            {nextBlockLabel && (
                <div className="flex-shrink-0 text-xs text-muted-foreground text-center py-1 border-t bg-card/50">
                    Next: {nextBlockLabel}
                </div>
            )}
        </div>
    );
}
