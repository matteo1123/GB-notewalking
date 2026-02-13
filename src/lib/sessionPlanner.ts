import type { ModuleType, SessionBlock } from '@/types/practice';

export interface CurriculumPriorities {
    rhythm: number;
    improv: number;
    technique: number;
    repertoire: number;
}

export interface CurriculumConcept {
    id: string;
    module_type: ModuleType;
    level: number;
    name: string;
    description?: string;
    paths: Partial<CurriculumPriorities>;
    requires: string[];
    practice_config: any;
    mastery_criteria: any;
}

export interface UserConceptProgress {
    concept_id: string;
    mastery_level: number;
    last_practiced?: string;
    times_practiced: number;
}

export interface UserProfile {
    id: string;
    priorities: CurriculumPriorities;
    progress: Record<string, UserConceptProgress>; // Map concept_id -> progress
}

interface RankedConcept extends CurriculumConcept {
    priority_weight: number;
    is_maintenance: boolean;
}

/**
 * Get the next best concepts for the user to learn based on their priorities
 */
export function getNextConcepts(
    userProfile: UserProfile,
    allConcepts: CurriculumConcept[]
): RankedConcept[] {
    const candidates: RankedConcept[] = [];

    // 1. Identify what is already mastered or in progress
    const masteryMap = userProfile.progress;

    // 2. Filter for concepts that are "Ready"
    const readyConcepts = allConcepts.filter(concept => {
        // Check if already mastered (>= 0.8) - if so, it's maintenance, not "Next"
        const progress = masteryMap[concept.id];
        if (progress && progress.mastery_level >= 0.8) {
            return false;
        }

        // Check prerequisites
        const prereqsMet = concept.requires.every(reqId => {
            const freqProgress = masteryMap[reqId];
            return freqProgress && freqProgress.mastery_level >= 0.7; // Prereq considered met at 0.7
        });

        return prereqsMet;
    });

    // 3. Score candidates based on user priorities
    const { priorities } = userProfile;

    readyConcepts.forEach(concept => {
        let score = 0;

        // Add weight for each path this concept belongs to
        if (concept.paths.rhythm) score += concept.paths.rhythm * priorities.rhythm;
        if (concept.paths.improv) score += concept.paths.improv * priorities.improv;
        if (concept.paths.technique) score += concept.paths.technique * priorities.technique;
        if (concept.paths.repertoire) score += concept.paths.repertoire * priorities.repertoire;

        // Add slight boost for concepts already started but not finished
        const existingProgress = masteryMap[concept.id];
        if (existingProgress) {
            score += 20; // Momentum bonus
        }

        // Normalize: paths weights are 0-10, priorities are 0-10. Max score ~400 + bonus.

        if (score > 0) {
            candidates.push({
                ...concept,
                priority_weight: score,
                is_maintenance: false
            });
        }
    });

    // Sort by priority weight descending
    return candidates.sort((a, b) => b.priority_weight - a.priority_weight);
}

/**
 * Get concepts that need maintenance (spaced repetition)
 */
export function getMaintenanceConcepts(
    userProfile: UserProfile,
    allConcepts: CurriculumConcept[]
): RankedConcept[] {
    const masteryMap = userProfile.progress;

    // Find mastered concepts
    const masteredConcepts = allConcepts.filter(c => {
        const progress = masteryMap[c.id];
        return progress && progress.mastery_level >= 0.8;
    });

    // Rank by "Need to Practice" (Least recently practiced first)
    const maintenanceCandidates = masteredConcepts.map(c => {
        const progress = masteryMap[c.id]!;
        const lastPracticed = progress.last_practiced ? new Date(progress.last_practiced).getTime() : 0;
        // The older the date, the smaller the timestamp, so we sort ascending by time.
        // We'll invert this to a "weight" where older = higher weight logic if needed, 
        // but for now let's just use the sort directly in the return.

        return {
            ...c,
            // Timestamp: Old < New. 
            // MaxTimestamp - OwnTimestamp = Age. Age is good.
            priority_weight: Date.now() - lastPracticed,
            is_maintenance: true
        };
    });

    return maintenanceCandidates.sort((a, b) => b.priority_weight - a.priority_weight);
}

export interface SessionPlanOptions {
    availableTimeMinutes: number;
    blockDurationMinutes: number;
    maintenanceSplit: number; // 0.2 = 20% maintenance
}

/**
 * Generate Intelligent Session Plan
 */
export function generateSessionPlan(
    userProfile: UserProfile,
    allConcepts: CurriculumConcept[],
    options: SessionPlanOptions = { availableTimeMinutes: 20, blockDurationMinutes: 5, maintenanceSplit: 0.2 }
): SessionBlock[] {
    const nextConcepts = getNextConcepts(userProfile, allConcepts);
    const maintenanceConcepts = getMaintenanceConcepts(userProfile, allConcepts);

    const blocks: SessionBlock[] = [];
    const totalBlocks = Math.floor(options.availableTimeMinutes / options.blockDurationMinutes);

    const maintenanceCount = Math.floor(totalBlocks * options.maintenanceSplit);
    const learningCount = totalBlocks - maintenanceCount;

    // Add Learning Blocks
    // Take top N concepts. If we have fewer candidates than slots, cycle them or repeat.
    let learningIndex = 0;
    for (let i = 0; i < learningCount; i++) {
        if (nextConcepts.length === 0) break;

        // Use modulus to cycle if we run out of unique concepts
        // But maybe better to repeat high priority ones? 
        // For now, simple round robin of the top 5 candidates?
        // Let's just cycle through all candidates derived.
        const concept = nextConcepts[learningIndex % nextConcepts.length];

        blocks.push({
            module_type: concept.module_type,
            config: concept.practice_config,
            duration_minutes: options.blockDurationMinutes,
            order: blocks.length, // Will fix order later
            conceptId: concept.id
        });
        learningIndex++;
    }

    // Add Maintenance Blocks
    let maintenanceIndex = 0;
    for (let i = 0; i < maintenanceCount; i++) {
        if (maintenanceConcepts.length === 0) {
            // Fill with more learning if no maintenance needed
            if (nextConcepts.length > 0) {
                const concept = nextConcepts[learningIndex % nextConcepts.length];
                blocks.push({
                    module_type: concept.module_type,
                    config: concept.practice_config,
                    duration_minutes: options.blockDurationMinutes,
                    order: blocks.length,
                    conceptId: concept.id
                });
                learningIndex++;
            }
            break;
        }

        const concept = maintenanceConcepts[maintenanceIndex % maintenanceConcepts.length];
        blocks.push({
            module_type: concept.module_type,
            config: concept.practice_config,
            duration_minutes: options.blockDurationMinutes,
            order: blocks.length,
            conceptId: concept.id
        });
        maintenanceIndex++;
    }

    // Identify if any blocks are missing (e.g. absolutely no concepts found)
    if (blocks.length === 0) {
        // Fallback or empty? Function caller handles empty.
        return [];
    }

    // Shuffle blocks so maintenance acts as a break between new learning?
    // Or keep them separate? 
    // Spaced repetition usually implies mixing.
    // Let's shuffle.
    const shuffled = blocks.sort(() => Math.random() - 0.5);

    // Re-assign order
    return shuffled.map((b, i) => ({ ...b, order: i }));
}

export function formatSessionPlan(blocks: SessionBlock[]): string {
    return blocks.map((b, i) => `${i + 1}. ${b.module_type} (${b.duration_minutes}m)`).join('\n');
}

