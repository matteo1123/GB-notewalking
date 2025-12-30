/**
 * Session Generator - The Brain of Guitar Brain
 * 
 * Takes user priorities and available time, generates intelligent practice sessions
 * with proportional time allocation and warm-up periods.
 */

import type { UserPriority } from '@/types/priorities';
import type { ModuleType, ModuleConfig } from '@/types/practice';

export interface SessionBlock {
    id: string;
    type: 'warmup' | 'priority' | 'cooldown';
    module_type: ModuleType;
    config: ModuleConfig;
    duration_minutes: number;
    priority_id?: string;
    title: string;
    description: string;
}

export interface PracticeSession {
    id: string;
    user_id: string;
    session_plan: SessionBlock[];
    total_duration_minutes: number;
    started_at?: string;
    ended_at?: string;
    created_at: string;
}

export interface GenerateSessionOptions {
    userId: string;
    priorities: UserPriority[];
    durationMinutes: number;
    includeWarmup?: boolean; // Default true
    warmupPercentage?: number; // Default 10%
}

/**
 * Generate a practice session based on priorities and available time
 */
export function generatePracticeSession(options: GenerateSessionOptions): SessionBlock[] {
    const {
        priorities,
        durationMinutes,
        includeWarmup = true,
        warmupPercentage = 0.1
    } = options;

    if (priorities.length === 0) {
        throw new Error('No priorities set. Add at least one priority to generate a session.');
    }

    const blocks: SessionBlock[] = [];

    // Calculate time allocations
    const warmupTime = includeWarmup
        ? Math.max(2, Math.floor(durationMinutes * warmupPercentage))
        : 0;

    const practiceTime = durationMinutes - warmupTime;

    // Calculate total weight
    const totalWeight = priorities.reduce((sum, p) => sum + p.weight, 0);

    // 1. Add warm-up block (if enabled)
    if (includeWarmup && warmupTime > 0) {
        blocks.push(createWarmupBlock(warmupTime, priorities));
    }

    // 2. Allocate time to each priority
    const priorityBlocks: SessionBlock[] = [];

    for (const priority of priorities) {
        // Calculate this priority's share of practice time
        const timeShare = (priority.weight / totalWeight) * practiceTime;
        const duration = Math.max(2, Math.floor(timeShare)); // Minimum 2 minutes

        // Create block for this priority
        const block = createPriorityBlock(priority, duration);
        priorityBlocks.push(block);
    }

    // 3. Shuffle priority blocks (ensures variety, avoids monotony)
    const shuffledBlocks = shuffleArray(priorityBlocks);

    // 4. Combine all blocks
    blocks.push(...shuffledBlocks);

    return blocks;
}

/**
 * Create a warm-up block
 * Reviews recently practiced items for muscle memory
 */
function createWarmupBlock(
    duration: number,
    priorities: UserPriority[]
): SessionBlock {
    // Pick the highest priority for warm-up
    const topPriority = priorities.sort((a, b) => b.weight - a.weight)[0];

    return {
        id: `warmup-${Date.now()}`,
        type: 'warmup',
        module_type: (topPriority.module_type || 'rhythm') as ModuleType,
        config: {
            module_type: (topPriority.module_type || 'rhythm') as ModuleType,
            // Add module-specific config here
        },
        duration_minutes: duration,
        title: '🔥 Warm-up',
        description: `Quick review to get your fingers ready`,
    };
}

/**
 * Create a practice block for a specific priority
 */
function createPriorityBlock(
    priority: UserPriority,
    duration: number
): SessionBlock {
    const moduleType = priority.module_type as ModuleType;

    // Get module-specific config
    const config: ModuleConfig = {
        module_type: moduleType,
        ...getModuleConfig(priority),
    };

    // Get user-friendly title
    const title = getModuleTitle(moduleType);
    const description = getModuleDescription(priority);

    return {
        id: `block-${priority.id}-${Date.now()}`,
        type: 'priority',
        module_type: moduleType,
        config,
        duration_minutes: duration,
        priority_id: priority.id,
        title,
        description,
    };
}

/**
 * Get module-specific configuration
 */
function getModuleConfig(priority: UserPriority): Partial<ModuleConfig> {
    const moduleType = priority.module_type;
    const currentProgress = priority.current_progress || {};

    switch (moduleType) {
        case 'rhythm':
            return {
                rhythm_level: currentProgress.current_level || 1,
            };

        case 'scale':
        case 'arpeggio':
            // If specific exercise, use that. Otherwise, let module pick next
            return priority.exercise_id
                ? { exercise_id: priority.exercise_id }
                : {};

        case 'notewalking':
            return {
                progression_id: priority.exercise_id || undefined,
            };

        default:
            return {};
    }
}

/**
 * Get user-friendly module title
 */
function getModuleTitle(moduleType: ModuleType): string {
    const titles: Record<ModuleType, string> = {
        rhythm: '🥁 Rhythm Training',
        scale: '🎵 Scale Practice',
        arpeggio: '🎹 Arpeggio Practice',
        notewalking: '🎤 Ear Training',
        chord_progressions: '🎼 Chord Changes',
        riff: '🎸 Repertoire',
    };

    return titles[moduleType] || moduleType;
}

/**
 * Get practice block description
 */
function getModuleDescription(priority: UserPriority): string {
    const currentProgress = priority.current_progress || {};
    const targetMetric = priority.target_metric || {};

    // Specific goal description
    if (priority.type === 'specific' && targetMetric.target_bpm) {
        const current = currentProgress.current_bpm || 60;
        return `Progress: ${current} BPM → Goal: ${targetMetric.target_bpm} BPM`;
    }

    if (priority.type === 'specific' && targetMetric.target_level) {
        const current = currentProgress.current_level || 1;
        return `Progress: Level ${current} → Goal: Level ${targetMetric.target_level}`;
    }

    // Module-level description
    return `Build your ${priority.module_type} skills`;
}

/**
 * Shuffle array (Fisher-Yates algorithm)
 */
function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Format session summary
 */
export function formatSessionSummary(blocks: SessionBlock[]): string {
    const totalTime = blocks.reduce((sum, b) => sum + b.duration_minutes, 0);
    const items = blocks.map((b, i) => `${i + 1}. ${b.title} (${b.duration_minutes} min)`);

    return `${totalTime}-minute session:\n` + items.join('\n');
}

/**
 * Calculate priority statistics
 */
export function calculatePriorityStats(
    priorities: UserPriority[],
    blocks: SessionBlock[]
): Record<string, { minutes: number; percentage: number }> {
    const stats: Record<string, { minutes: number; percentage: number }> = {};
    const totalTime = blocks.reduce((sum, b) => sum + b.duration_minutes, 0);

    for (const priority of priorities) {
        const priorityBlocks = blocks.filter(b => b.priority_id === priority.id);
        const minutes = priorityBlocks.reduce((sum, b) => sum + b.duration_minutes, 0);
        const percentage = totalTime > 0 ? (minutes / totalTime) * 100 : 0;

        stats[priority.id] = { minutes, percentage };
    }

    return stats;
}
