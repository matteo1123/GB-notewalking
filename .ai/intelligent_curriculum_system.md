# Intelligent Adaptive Practice System - Design Doc

## 🎯 Vision

Create an intelligent curriculum engine that:
- **Tracks user priorities** (rhythm focus vs improv focus)
- **Knows what they've learned** and when
- **Feeds them the next logical step** in their development
- **Brings back old material** for maintenance (spaced repetition)
- **Spends most time** on what they need for the next level

---

## 🧠 The System

### Core Concept: Priority-Based Curriculum Paths

Users set **focus priorities** which determine their learning path:

#### Rhythm Focus Priority
**Goal**: Become a legit rhythm player

**Curriculum Path:**
1. **Basic Strumming** (Rhythm Levels 1-5)
   - Downstrokes, upstrokes, simple patterns
2. **16th Note Mastery** (Rhythm Levels 6-10)
   - Syncopation, skips, complex patterns
3. **Chord Vocabulary** (Chord Progressions 1-10)
   - Open chords → Barre chords → Jazz voicings
4. **Groove & Timing** (Advanced Rhythm + Notewalking)
   - Playing over changes, locking in with groove

#### Improv Focus Priority
**Goal**: Become a fluid improviser

**Curriculum Path:**
1. **Fretboard Knowledge** (Scales 1-5)
   - Major/minor scales in all positions
2. **Melodic Building Blocks** (Arpeggios 1-5)
   - Chord tones, visualization
3. **Ear Training** (Notewalking 1-10)
   - Hearing changes, singing chord tones
4. **Application** (Advanced Scales + Arpeggios)
   - Modes, advanced patterns, musical phrasing

#### Balanced Priority
Mix of both with intelligent weighting

---

## 📊 Tracking System

### User Profile
```typescript
interface UserProfile {
  priorities: {
    rhythm: number;     // 0-10 weight
    improv: number;     // 0-10 weight
    technique: number;  // 0-10 weight
    repertoire: number; // 0-10 weight
  };
  
  current_level_by_module: {
    rhythm: number;           // 0-10
    scales: number;           // 0-10
    notewalking: number;      // 0-10
    chord_progressions: number; // 0-10
    arpeggios: number;        // 0-10
    riffs: number;            // 0-10
  };
  
  mastery_by_concept: {
    [conceptId: string]: {
      mastery_level: number;      // 0-1
      last_practiced: string;
      times_practiced: number;
      best_performance: any;
    };
  };
}
```

### Curriculum Concepts
Each "concept" is a learning milestone:

```typescript
interface CurriculumConcept {
  id: string;
  module_type: ModuleType;
  level: number;              // 1-10
  name: string;
  description: string;
  
  // What paths this belongs to
  paths: {
    rhythm?: number;      // Priority weight
    improv?: number;
    technique?: number;
    repertoire?: number;
  };
  
  // Prerequisites
  requires: string[];     // IDs of concepts that must be mastered first
  
  // Practice configuration
  practice_config: ModuleConfig;
  
  // Mastery criteria
  mastery_criteria: {
    min_accuracy?: number;
    min_bpm?: number;
    min_level?: number;
    min_practice_time?: number;
  };
}
```

**Example Concepts:**
- `rhythm-downstrokes-level-1`: Basic downstroke strumming
- `rhythm-16th-notes-level-5`: 16th note patterns with 2 skips
- `scales-c-major-position-1`: C major scale, position 1
- `chords-i-iv-v-open`: Open I-IV-V progression in C

---

## 🎲 Session Generation Algorithm

### Step 1: Calculate Next Concepts Needed

```typescript
function getNextConcepts(userProfile: UserProfile): CurriculumConcept[] {
  const candidates: CurriculumConcept[] = [];
  
  // For each priority (rhythm, improv, etc.)
  for (const [priority, weight] of Object.entries(userProfile.priorities)) {
    if (weight === 0) continue;
    
    // Get all concepts in this path
    const pathConcepts = CURRICULUM_CONCEPTS.filter(c => c.paths[priority] > 0);
    
    // Filter to concepts user is ready for
    const readyConcepts = pathConcepts.filter(concept => {
      // Check prerequisites
      const prereqsMet = concept.requires.every(reqId => {
        const mastery = userProfile.mastery_by_concept[reqId];
        return mastery && mastery.mastery_level >= 0.7;
      });
      
      // Check not already mastered
      const notMastered = !userProfile.mastery_by_concept[concept.id] ||
        userProfile.mastery_by_concept[concept.id].mastery_level < 0.8;
      
      return prereqsMet && notMastered;
    });
    
    // Add weighted by priority
    candidates.push(...readyConcepts.map(c => ({
      ...c,
      priority_weight: weight * c.paths[priority]
    })));
  }
  
  // Sort by priority weight
  return candidates.sort((a, b) => b.priority_weight - a.priority_weight);
}
```

### Step 2: Select Maintenance Concepts

```typescript
function getMaintenanceConcepts(userProfile: UserProfile): CurriculumConcept[] {
  const masteredConcepts = Object.entries(userProfile.mastery_by_concept)
    .filter(([id, mastery]) => mastery.mastery_level >= 0.8)
    .map(([id]) => CURRICULUM_CONCEPTS.find(c => c.id === id))
    .filter(Boolean);
  
  // Sort by least recently practiced
  return masteredConcepts.sort((a, b) => {
    const aTime = new Date(userProfile.mastery_by_concept[a.id].last_practiced).getTime();
    const bTime = new Date(userProfile.mastery_by_concept[b.id].last_practiced).getTime();
    return aTime - bTime; // Oldest first
  });
}
```

### Step 3: Build Session

```typescript
function buildPracticeSession(
  userProfile: UserProfile,
  durationMinutes: number
): PracticeSession {
  const nextConcepts = getNextConcepts(userProfile);
  const maintenanceConcepts = getMaintenanceConcepts(userProfile);
  
  // 80% new learning, 20% maintenance
  const learningTime = durationMinutes * 0.8;
  const maintenanceTime = durationMinutes * 0.2;
  
  const blocks: SessionBlock[] = [];
  
  // Add learning blocks (5 min each)
  const learningBlocks = Math.floor(learningTime / 5);
  for (let i = 0; i < learningBlocks && i < nextConcepts.length; i++) {
    const concept = nextConcepts[i];
    blocks.push({
      module_type: concept.module_type,
      config: concept.practice_config,
      duration_minutes: 5,
      conceptId: concept.id,
    });
  }
  
  // Add maintenance blocks
  const maintenanceBlocks = Math.floor(maintenanceTime / 5);
  for (let i = 0; i < maintenanceBlocks && i < maintenanceConcepts.length; i++) {
    const concept = maintenanceConcepts[i];
    blocks.push({
      module_type: concept.module_type,
      config: concept.practice_config,
      duration_minutes: 5,
      conceptId: concept.id,
    });
  }
  
  // Shuffle to mix learning and maintenance
  return {
    user_id: userProfile.id,
    session_plan: shuffleBlocks(blocks),
    ...
  };
}
```

---

## 🗄️ Database Schema

### New Table: `curriculum_concepts`
```sql
CREATE TABLE curriculum_concepts (
  id TEXT PRIMARY KEY,
  module_type TEXT NOT NULL,
  level INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  paths JSONB NOT NULL, -- { rhythm: 8, improv: 2 }
  requires TEXT[], -- Array of prerequisite concept IDs
  practice_config JSONB NOT NULL,
  mastery_criteria JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### New Table: `user_concept_progress`
```sql
CREATE TABLE user_concept_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  concept_id TEXT NOT NULL REFERENCES curriculum_concepts(id),
  mastery_level DECIMAL(3,2) DEFAULT 0.00,
  last_practiced TIMESTAMPTZ,
  times_practiced INTEGER DEFAULT 0,
  best_performance JSONB,
  UNIQUE(user_id, concept_id)
);
```

### Extend: `profiles`
```sql
ALTER TABLE profiles
ADD COLUMN priorities JSONB DEFAULT '{"rhythm": 5, "improv": 5, "technique": 5, "repertoire": 5}';
```

---

## 🎮 User Experience Flow

### 1. Onboarding: Set Priorities
```
┌──────────────────────────────────────┐
│ What do you want to focus on?       │
├──────────────────────────────────────┤
│ 🥁 Rhythm Guitar     [====    ] 7/10│
│ 🎤 Improvisation     [===     ] 5/10│
│ 🎸 Technique         [=       ] 2/10│
│ 🎼 Repertoire/Songs  [======  ] 8/10│
│                                      │
│ [Save Priorities]                    │
└──────────────────────────────────────┘
```

### 2. Dashboard: Next Steps
```
┌──────────────────────────────────────┐
│ 🎯 Your Next Steps                   │
├──────────────────────────────────────┤
│ Based on your rhythm focus:          │
│                                      │
│ ✓ Rhythm Level 7 Complete            │
│ → Rhythm Level 8 (Next)              │
│   Master 3-skip patterns             │
│                                      │
│ ✓ Open Chords Mastered               │
│ → Barre Chords (Ready to start!)    │
│                                      │
│ [Start 30-Min Session]               │
└──────────────────────────────────────┘
```

### 3. Auto-Generated

 Session
```
Your 30-min session:
1. Rhythm Level 8 (5 min) - NEW
2. Notewalking in C (5 min) - MAINTENANCE
3. Barre Chords F Major (5 min) - NEW
4. Rhythm Level 8 (5 min) - NEW
5. Scales G Major (5 min) - MAINTENANCE
6. Barre Chords (5 min) - NEW
```

---

## 🚀 Implementation Phases

### Phase 1: Curriculum Definition
- [ ] Define concept hierarchy for rhythm path
- [ ] Define concept hierarchy for improv path
- [ ] Seed `curriculum_concepts` table
- [ ] Create prerequisite relationships

### Phase 2: Priority System
- [ ] Add priority sliders to user settings
- [ ] Save to `profiles.priorities`
- [ ] UI to visualize current priorities

### Phase 3: Progress Tracking
- [ ] Track mastery after each practice session
- [ ] Update `user_concept_progress`
- [ ] Calculate mastery level based on performance

### Phase 4: Session Generation
- [ ] Implement `getNextConcepts()` algorithm
- [ ] Implement `getMaintenanceConcepts()`
- [ ] Build session with 80/20 split
- [ ] Show preview before starting

### Phase 5: Adaptive Feedback
- [ ] "You're ready for Level 8!" notifications
- [ ] Progress charts per concept
- [ ] Achievement badges

---

## 📈 Example Curriculum: Rhythm Path

```typescript
const rhythmCurriculum = [
  {
    id: 'rhythm-level-1',
    module_type: 'rhythm',
    level: 1,
    name: 'All Downstrokes',
    paths: { rhythm: 10, improv: 2 },
    requires: [],
    mastery_criteria: { min_accuracy: 0.8, min_practice_time: 300 },
  },
  {
    id: 'rhythm-level-2',
    module_type: 'rhythm',
    level: 2,
    name: 'First Skip Pattern',
    paths: { rhythm: 10, improv: 2 },
    requires: ['rhythm-level-1'],
    mastery_criteria: { min_accuracy: 0.8, min_practice_time: 600 },
  },
  // ... continues to level 10
  {
    id: 'chords-open-i-iv-v',
    module_type: 'chord_progressions',
    level: 1,
    name: 'Open I-IV-V in C',
    paths: { rhythm: 9, improv: 3, repertoire: 7 },
    requires: [],
    mastery_criteria: { min_bpm: 60, clean_transitions: 20 },
  },
  {
    id: 'chords-barre-f-major',
    module_type: 'chord_progressions',
    level: 3,
    name: 'F Major Barre Chord',
    paths: { rhythm: 8, technique: 7 },
    requires: ['chords-open-i-iv-v'],
    mastery_criteria: { min_bpm: 80, clean_transitions: 30 },
  },
];
```

---

## ✨ Benefits

1. **Personalized**: Each user gets a unique path
2. **Efficient**: No time wasted on irrelevant exercises
3. **Motivating**: Clear next steps, visible progress
4. **Spaced Repetition**: Automatic maintenance of skills
5. **Scalable**: Easy to add new concepts/paths

---

## Next Steps

Want me to start building this? We could:
1. Define the rhythm curriculum (10 concepts)
2. Create the priority settings UI
3. Build the session generation algorithm
4. Show "Next Steps" dashboard

This is the future! 🚀
