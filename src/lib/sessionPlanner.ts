import type { ModuleType, SessionBlock, LessonProgress } from '@/types/practice';

/**
 * Session Planning Algorithm
 * Generates intelligent practice sessions based on student's active goals
 */

export interface GoalWithProgress {
    id: string;
    lesson_id: string;
    module_type: ModuleType;
    module_config: any;
    target_level: number;
    priority: number; // 1-10
    progress: {
        last_practiced?: string;
        best_bpm?: number;
        mastery_level?: number; // 0-1
        time_practiced_minutes: number;
    };
}

export interface SessionPlanOptions {
    availableTimeMinutes: number;
    blockDurationMinutes: number; // Default 5
    includeMaintenanceGoals: boolean; // Include mastered goals for review
    maintenancePercentage: number; // % of time for maintenance (default 20%)
}

/**
 * Calculate priority score for a goal
 * Higher score = should practice sooner
 */
export function calculatePriorityScore(goal: GoalWithProgress): number {
    let score = goal.priority * 10; // Base priority (1-10 → 10-100)

    // Recency penalty: Lower score if practiced recently
    if (goal.progress.last_practiced) {
        const daysSince = getDaysSince(goal.progress.last_practiced);
        const recencyPenalty = Math.max(0, 30 - daysSince * 3);
        score -= recencyPenalty;
    } else {
        // Never practiced = high priority
        score += 50;
    }

    // Progress bonus: Higher score if far from mastery
    const masteryLevel = goal.progress.mastery_level || 0;
    const progressBonus = (1 - masteryLevel) * 40;
    score += progressBonus;

    // Level bonus: Higher levels get slight boost
    score += goal.target_level * 2;

    return Math.max(0, score);
}

/**
 * Generate a practice session plan
 */
export function generateSessionPlan(
    activeGoals: GoalWithProgress[],
    masteredGoals: GoalWithProgress[],
    options: Partial<SessionPlanOptions> = {}
): SessionBlock[] {
    const {
        availableTimeMinutes = 30,
        blockDurationMinutes = 5,
        includeMaintenanceGoals = true,
        maintenancePercentage = 0.2,
    } = options;

    const blocks: SessionBlock[] = [];

    // Calculate how many blocks we can fit
    const totalBlocks = Math.floor(availableTimeMinutes / blockDurationMinutes);
    const maintenanceBlocks = includeMaintenanceGoals
        ? Math.floor(totalBlocks * maintenancePercentage)
        : 0;
    const activeBlocks = totalBlocks - maintenanceBlocks;

    // Score and sort active goals
    const scoredGoals = activeGoals.map(goal => ({
        ...goal,
        score: calculatePriorityScore(goal),
    }));
    scoredGoals.sort((a, b) => b.score - a.score);

    // Allocate blocks to active goals (round-robin if more blocks than goals)
    let goalIndex = 0;
    for (let i = 0; i < activeBlocks; i++) {
        if (scoredGoals.length === 0) break;

        const goal = scoredGoals[goalIndex % scoredGoals.length];
        blocks.push({
            module_type: goal.module_type,
            config: goal.module_config,
            duration_minutes: blockDurationMinutes,
            order: blocks.length,
        });

        goalIndex++;
    }

    // Add maintenance blocks (review mastered goals)
    if (includeMaintenanceGoals && masteredGoals.length > 0) {
        const maintenanceGoalsToReview = selectMaintenanceGoals(
            masteredGoals,
            maintenanceBlocks
        );

        maintenanceGoalsToReview.forEach(goal => {
            blocks.push({
                module_type: goal.module_type,
                config: goal.module_config,
                duration_minutes: blockDurationMinutes,
                order: blocks.length,
            });
        });
    }

    // Shuffle to mix maintenance with active goals
    return shuffleWithConstraints(blocks);
}

/**
 * Select which mastered goals to include for maintenance
 */
function selectMaintenanceGoals(
    masteredGoals: GoalWithProgress[],
    count: number
): GoalWithProgress[] {
    // Sort by least recently practiced
    const sorted = [...masteredGoals].sort((a, b) => {
        const aTime = a.progress.last_practiced
            ? new Date(a.progress.last_practiced).getTime()
            : 0;
        const bTime = b.progress.last_practiced
            ? new Date(b.progress.last_practiced).getTime()
            : 0;
        return aTime - bTime; // Oldest first
    });

    return sorted.slice(0, count);
}

/**
 * Shuffle blocks while maintaining some structure
 * - Don't put same module type back-to-back if possible
 */
function shuffleWithConstraints(blocks: SessionBlock[]): SessionBlock[] {
    if (blocks.length <= 2) return blocks;

    const shuffled = [...blocks];

    // Simple shuffle with constraint check
    for (let i = shuffled.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));

        // Avoid back-to-back same module if possible
        if (i > 0 && shuffled[i].module_type === shuffled[i - 1].module_type) {
            // Try to find different module
            for (let k = 0; k <= i; k++) {
                if (shuffled[k].module_type !== shuffled[i - 1].module_type) {
                    j = k;
                    break;
                }
            }
        }

        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Update order
    return shuffled.map((block, index) => ({ ...block, order: index }));
}

/**
 * Get days since a date
 */
function getDaysSince(dateString: string): number {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

/**
 * Format session plan for display
 */
export function formatSessionPlan(blocks: SessionBlock[]): string {
    const summary = blocks.map((block, i) => {
        const moduleLabel = formatModuleType(block.module_type);
        return `${i + 1}. ${moduleLabel} (${block.duration_minutes} min)`;
    });

    return summary.join('\n');
}

/**
 * Format module type for display
 */
function formatModuleType(type: ModuleType): string {
    const labels: Record<ModuleType, string> = {
        scale: 'Scale Practice',
        rhythm: 'Rhythm Training',
        notewalking: 'Notewalking',
        arpeggio: 'Arpeggio',
        riff: 'Riff Practice',
        chord_progressions: 'Chord Changes',
    };
    return labels[type];
}

/**
 * Estimate total session time
 */
export function estimateSessionTime(blocks: SessionBlock[]): number {
    return blocks.reduce((total, block) => total + block.duration_minutes, 0);
}

/**
 * Get module type icon/emoji
 */
export function getModuleIcon(type: ModuleType): string {
    const icons: Record<ModuleType, string> = {
        scale: '🎵',
        rhythm: '🥁',
        notewalking: '🎤',
        arpeggio: '🎹',
        riff: '🎸',
        chord_progressions: '🎼',
    };
    return icons[type];
}
