/**
 * Practice Module System - Core Types
 * Standardizes all practice modules to work in different modes
 */

import type { ModuleType, ModuleConfig } from './practice';

// ============================================================================
// Module Modes
// ============================================================================

export type PracticeMode = 'freeplay' | 'routine' | 'goal';

// ============================================================================
// Module Results
// ============================================================================

export interface ModuleResults {
    completed: boolean;
    duration_seconds: number;
    performance_metrics: {
        max_bpm?: number;
        accuracy?: number; // 0-1
        level_reached?: number;
        notes_correct?: number;
        notes_total?: number;
        clean_transitions?: number;
        mistakes?: number;
    };
    achievements?: string[];
    recordings?: string[];
}

// ============================================================================
// Module Configuration
// ============================================================================

export interface PracticeModuleProps {
    // Mode determines behavior
    mode: PracticeMode;

    // Module-specific configuration
    config: ModuleConfig;

    // Time limit (for routine/goal mode)
    timeLimit?: number; // seconds

    // Target metrics (for goal mode)
    targetMetrics?: {
        target_bpm?: number;
        target_accuracy?: number;
        target_level?: number;
        must_complete?: boolean;
    };

    // Callbacks
    onComplete?: (results: ModuleResults) => void;
    onProgress?: (progress: number) => void; // 0-1
    onTimeUp?: () => void;

    // Session tracking
    sessionId?: string;
    routineId?: string;
}

// ============================================================================
// Module Metadata
// ============================================================================

export interface ModuleMetadata {
    id: ModuleType;
    name: string;
    shortDescription: string;
    fullDescription: string;
    icon: string;
    emoji: string;

    difficulty: {
        min: number; // 1
        max: number; // 10
        current?: number; // User's current level
    };

    estimatedTime: {
        min: number; // minutes
        max: number; // minutes
        recommended: number; // minutes
    };

    skills: string[];

    capabilities: {
        supportsFreeplay: boolean;
        supportsGoals: boolean;
        supportsRoutines: boolean;
        requiresAudio: boolean;
        hasAutoRecord: boolean;
        hasLevels: boolean;
    };

    progress?: {
        current_level: number;
        mastery_percentage: number; // 0-100
        time_practiced_minutes: number;
        last_practiced?: string;
    };
}

// ============================================================================
// Module Registry
// ============================================================================

export const MODULE_REGISTRY: Record<ModuleType, Omit<ModuleMetadata, 'progress' | 'difficulty'> & { difficulty: { min: number; max: number } }> = {
    scale: {
        id: 'scale',
        name: 'Scale Practice',
        shortDescription: 'Master scales across the fretboard',
        fullDescription: 'Practice scales in all positions with various picking patterns. Build muscle memory and fretboard knowledge.',
        icon: '🎵',
        emoji: '🎵',
        difficulty: { min: 1, max: 10 },
        estimatedTime: { min: 5, max: 60, recommended: 15 },
        skills: ['fretboard-knowledge', 'muscle-memory', 'technique'],
        capabilities: {
            supportsFreeplay: true,
            supportsGoals: true,
            supportsRoutines: true,
            requiresAudio: false,
            hasAutoRecord: true,
            hasLevels: true,
        },
    },

    rhythm: {
        id: 'rhythm',
        name: 'Rhythm Training',
        shortDescription: '16th note strumming patterns',
        fullDescription: 'Master rhythmic accuracy with progressive 16th note strumming patterns. From simple downstrokes to complex syncopation.',
        icon: '🥁',
        emoji: '🥁',
        difficulty: { min: 1, max: 10 },
        estimatedTime: { min: 5, max: 30, recommended: 10 },
        skills: ['timing', 'rhythm', 'strumming'],
        capabilities: {
            supportsFreeplay: true,
            supportsGoals: true,
            supportsRoutines: true,
            requiresAudio: false,
            hasAutoRecord: true,
            hasLevels: true,
        },
    },

    notewalking: {
        id: 'notewalking',
        name: 'Notewalking',
        shortDescription: 'Ear training over chord progressions',
        fullDescription: 'Develop your ear by singing/playing chord tones over progressions. Learn to hear harmonic relationships.',
        icon: '🎤',
        emoji: '🎤',
        difficulty: { min: 1, max: 10 },
        estimatedTime: { min: 10, max: 45, recommended: 20 },
        skills: ['ear-training', 'harmony', 'improvisation'],
        capabilities: {
            supportsFreeplay: true,
            supportsGoals: true,
            supportsRoutines: true,
            requiresAudio: true,
            hasAutoRecord: true,
            hasLevels: false,
        },
    },

    chord_progressions: {
        id: 'chord_progressions',
        name: 'Chord Progressions',
        shortDescription: 'Smooth chord transitions & progressions',
        fullDescription: 'Practice common chord progressions and develop smooth, clean transitions between chord shapes.',
        icon: '🎼',
        emoji: '🎼',
        difficulty: { min: 1, max: 10 },
        estimatedTime: { min: 10, max: 45, recommended: 15 },
        skills: ['chord-knowledge', 'transitions', 'muscle-memory'],
        capabilities: {
            supportsFreeplay: true,
            supportsGoals: true,
            supportsRoutines: true,
            requiresAudio: false,
            hasAutoRecord: true,
            hasLevels: true,
        },
    },

    arpeggio: {
        id: 'arpeggio',
        name: 'Arpeggio Practice',
        shortDescription: 'Chord tones across the fretboard',
        fullDescription: 'Practice arpeggios in all positions. Build visualization of chord tones and improve melodic playing.',
        icon: '🎹',
        emoji: '🎹',
        difficulty: { min: 2, max: 10 },
        estimatedTime: { min: 5, max: 30, recommended: 15 },
        skills: ['fretboard-knowledge', 'technique', 'harmony'],
        capabilities: {
            supportsFreeplay: true,
            supportsGoals: true,
            supportsRoutines: true,
            requiresAudio: false,
            hasAutoRecord: true,
            hasLevels: true,
        },
    },

    piece_mastery: {
        id: 'piece_mastery',
        name: 'Piece Mastery',
        shortDescription: 'Master songs with looped practice',
        fullDescription: 'Practice pieces section by section with MP3 playback. Automatic loop expansion builds muscle memory progressively.',
        icon: '🎸',
        emoji: '🎸',
        difficulty: { min: 1, max: 10 },
        estimatedTime: { min: 10, max: 60, recommended: 20 },
        skills: ['repertoire', 'technique', 'musicality', 'ear-training'],
        capabilities: {
            supportsFreeplay: true,
            supportsGoals: true,
            supportsRoutines: true,
            requiresAudio: true,
            hasAutoRecord: true,
        },
    },

    ear_training: {
        id: 'ear_training',
        name: 'Ear Training',
        shortDescription: 'Identify scale degrees over a drone',
        fullDescription: 'Develop your ear by identifying intervals and scale degrees in an interactive environment over a continuous drone tone.',
        icon: '🎧',
        emoji: '🎧',
        difficulty: { min: 1, max: 10 },
        estimatedTime: { min: 5, max: 20, recommended: 10 },
        skills: ['ear-training', 'pitch-recognition', 'harmony'],
        capabilities: {
            supportsFreeplay: true,
            supportsGoals: true,
            supportsRoutines: true,
            requiresAudio: true,
            hasAutoRecord: true,
            hasLevels: true,
        },
    },
};

// ============================================================================
// Helper Functions
// ============================================================================

export function getModuleMetadata(type: ModuleType): Omit<ModuleMetadata, 'progress' | 'difficulty'> & { difficulty: { min: number; max: number } } {
    return MODULE_REGISTRY[type];
}

export function getModuleIcon(type: ModuleType): string {
    return MODULE_REGISTRY[type].icon;
}

export function getModuleName(type: ModuleType): string {
    return MODULE_REGISTRY[type].name;
}

export function calculateProgress(results: ModuleResults, target?: ModuleResults['performance_metrics']): number {
    if (!target) return 1.0; // Freeplay = always complete

    let progress = 0;
    let criteria = 0;

    if (target.target_bpm && results.performance_metrics.max_bpm) {
        criteria++;
        progress += Math.min(1, results.performance_metrics.max_bpm / target.target_bpm);
    }

    if (target.target_accuracy && results.performance_metrics.accuracy) {
        criteria++;
        progress += Math.min(1, results.performance_metrics.accuracy / target.target_accuracy);
    }

    if (target.target_level && results.performance_metrics.level_reached) {
        criteria++;
        progress += Math.min(1, results.performance_metrics.level_reached / target.target_level);
    }

    return criteria > 0 ? progress / criteria : 1.0;
}

export function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function getDifficultyStars(difficulty: number): string {
    const filled = Math.round(difficulty / 2); // 1-10 → 1-5 stars
    const empty = 5 - filled;
    return '⭐'.repeat(filled) + '◯'.repeat(empty);
}
