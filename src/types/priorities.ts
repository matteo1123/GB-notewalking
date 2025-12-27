/**
 * User Priority System Types
 * For intelligent practice session planning
 */

export type PriorityType = 'module' | 'specific';

export interface UserPriority {
    id: string;
    user_id: string;
    type: PriorityType;
    weight: number; // 1-10

    // Module-level priority
    module_type?: string; // 'rhythm', 'scale', 'arpeggio', etc.

    // Specific exercise priority
    exercise_id?: string; // Specific scale/arpeggio/riff ID

    // Target metrics (for specific goals)
    target_metric?: {
        target_bpm?: number;
        target_level?: number;
        target_accuracy?: number;
    };

    // Tracking
    last_practiced?: string;
    current_progress?: {
        current_bpm?: number;
        current_level?: number;
        current_accuracy?: number;
        sessions_practiced?: number;
    };

    created_at: string;
    updated_at: string;
}

export interface CreatePriorityInput {
    type: PriorityType;
    weight: number;
    module_type?: string;
    exercise_id?: string;
    target_metric?: UserPriority['target_metric'];
}

export interface UpdatePriorityInput {
    weight?: number;
    target_metric?: UserPriority['target_metric'];
    last_practiced?: string;
    current_progress?: UserPriority['current_progress'];
}
