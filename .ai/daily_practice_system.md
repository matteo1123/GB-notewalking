# Daily Practice System - Refined Design

## 🎯 Core Principle

**"Come to the guitar. Press Start. Practice efficiently. Never think about what to do."**

---

## 🎮 User Experience Flow

### Step 1: Set Priorities (One-time setup)

```
┌────────────────────────────────────────────┐
│ What are your practice priorities?        │
├────────────────────────────────────────────┤
│                                            │
│ 🥁 Rhythm Guitar          [========] 8/10 │
│   └─ Focus: All rhythm patterns           │
│                                            │
│ 🎹 Sweep Picking          [======  ] 6/10 │
│   └─ Focus: All arpeggios                 │
│                                            │
│ 🎵 Scales                 [====    ] 4/10 │
│   └─ Specific: G Major Scale → 120 BPM   │
│                                            │
│ 🎤 Ear Training           [===     ] 3/10 │
│   └─ Focus: All notewalking               │
│                                            │
│ [+ Add Priority]                           │
│                            [Save Settings] │
└────────────────────────────────────────────┘
```

**Two types of priorities:**
1. **Module-level** - "Work on all rhythm patterns" (general improvement)
2. **Specific** - "G Major Scale to 120 BPM" (specific goal)

**Both are valid!** Module-level means "keep feeding me the next thing in this category."

---

### Step 2: Daily Practice

```
┌────────────────────────────────────────────┐
│ 🎸 Ready to Practice?                      │
├────────────────────────────────────────────┤
│ How much time do you have today?          │
│                                            │
│  ⏱️  [15 min] [30 min] [45 min] [60 min]  │
│                                            │
│  Or custom: [___] minutes                  │
│                                            │
│ [🚀 Start Practice Session]                │
└────────────────────────────────────────────┘
```

**System automatically generates:**

**20-Minute Session:**
```
Your practice plan:
1. Warm-up: Scales Review (3 min) 🔥
2. Rhythm Level 8 (4 min) ⭐ Priority
3. Sweep Picking Arpeggio (4 min) ⭐ Priority
4. G Major Scale Practice (4 min) ⭐ Priority
5. Notewalking in C (3 min) ⭐ Priority
6. Cool-down: Previous rhythm (2 min) 🔥

[Start Session →]
```

**60-Minute Session:**
```
Your practice plan:
1. Warm-up: Mixed Review (5 min) 🔥
2. Rhythm Level 8 (12 min) ⭐ Priority
3. Sweep Picking Arpeggio (12 min) ⭐ Priority
4. G Major Scale Practice (12 min) ⭐ Priority
5. Rhythm Level 7 Review (5 min) 🔥
6. Notewalking in C (10 min) ⭐ Priority
7. Cool-down: Fun riff (4 min) 🔥

[Start Session →]
```

**Key Features:**
- ⭐ = Active priority (guaranteed every session)
- 🔥 = Warm-up/review (spaced repetition)
- Time scales proportionally
- **All priorities covered every session**

---

## 🧠 Session Generation Algorithm

### Formula: Time-Proportional Priority Allocation

```typescript
function generateDailySession(
  userPriorities: Priority[],
  availableMinutes: number
): SessionBlock[] {
  // Reserve 10-15% for warm-up
  const warmupTime = Math.max(3, Math.floor(availableMinutes * 0.1));
  const practiceTime = availableMinutes - warmupTime;
  
  // Calculate weight sum
  const totalWeight = userPriorities.reduce((sum, p) => sum + p.weight, 0);
  
  // Allocate time proportionally
  const blocks: SessionBlock[] = [];
  
  // 1. Warm-up Block
  blocks.push({
    type: 'warmup',
    duration: warmupTime,
    content: selectReviewItems(userPriorities),
  });
  
  // 2. Priority Blocks
  for (const priority of userPriorities) {
    const timeShare = (priority.weight / totalWeight) * practiceTime;
    const duration = Math.floor(timeShare);
    
    // Get next exercise for this priority
    const exercise = getNextExercise(priority);
    
    blocks.push({
      type: 'priority',
      priority: priority,
      duration: duration,
      exercise: exercise,
    });
  }
  
  // 3. Shuffle (but keep warm-up first)
  const [warmup, ...rest] = blocks;
  const shuffled = shuffle(rest);
  
  return [warmup, ...shuffled];
}
```

### Examples

**User has 20 minutes, 4 priorities:**
- Rhythm (weight 8) → 8/21 × 18min = **6.9 min**
- Sweep (weight 6) → 6/21 × 18min = **5.1 min**
- Scales (weight 4) → 4/21 × 18min = **3.4 min**
- Ear (weight 3) → 3/21 × 18min = **2.6 min**
- Warm-up = **2 min**

**User has 60 minutes, same priorities:**
- Rhythm (weight 8) → 8/21 × 54min = **20.6 min**
- Sweep (weight 6) → 6/21 × 54min = **15.4 min**
- Scales (weight 4) → 4/21 × 54min = **10.3 min**
- Ear (weight 3) → 3/21 × 54min = **7.7 min**
- Warm-up = **6 min**

**Notice:** Every priority gets time, proportional to weight!

---

## 📊 Data Model

### Priority Types

```typescript
type PriorityType = 'module' | 'specific';

interface Priority {
  id: string;
  user_id: string;
  type: PriorityType;
  weight: number; // 1-10
  
  // Module-level priority
  module_type?: ModuleType; // 'rhythm', 'scale', etc.
  
  // Specific exercise priority
  exercise_id?: string; // Specific scale/arpeggio/riff
  target_metric?: {
    target_bpm?: number;
    target_level?: number;
    target_accuracy?: number;
  };
  
  // Tracking
  last_practiced?: string;
  current_progress?: any;
}
```

### Database Schema

```sql
-- User priorities
CREATE TABLE user_priorities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL CHECK (type IN ('module', 'specific')),
  weight INTEGER NOT NULL CHECK (weight >= 1 AND weight <= 10),
  
  -- Either module_type OR exercise_id
  module_type TEXT,
  exercise_id UUID,
  
  -- Target metrics (for specific priorities)
  target_metric JSONB,
  
  -- Tracking
  last_practiced TIMESTAMPTZ,
  current_progress JSONB,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, module_type),
  UNIQUE(user_id, exercise_id)
);

-- Ensure either module OR exercise, not both
ALTER TABLE user_priorities
ADD CONSTRAINT priority_type_check CHECK (
  (module_type IS NOT NULL AND exercise_id IS NULL) OR
  (module_type IS NULL AND exercise_id IS NOT NULL)
);
```

---

## 🔄 "Next Exercise" Logic

### For Module-Level Priorities

```typescript
function getNextExercise(priority: Priority): Exercise {
  if (priority.type === 'module') {
    // Get all exercises in this module
    const allExercises = getExercisesForModule(priority.module_type);
    
    // Filter to ones user hasn't mastered
    const unmastered = allExercises.filter(ex => 
      getUserMastery(ex.id) < 0.8
    );
    
    // Sort by:
    // 1. Prerequisites met
    // 2. Least recently practiced
    // 3. Next logical progression
    const sorted = sortByProgression(unmastered);
    
    return sorted[0]; // The "next" one
  }
}
```

**Example:**
- User has "Scales" as priority
- Has mastered: C Major, G Major
- Next: D Major (next in circle of 5ths)

### For Specific Priorities

```typescript
function getNextExercise(priority: Priority): Exercise {
  if (priority.type === 'specific') {
    // Always return this specific exercise
    return getExercise(priority.exercise_id);
  }
}
```

**Example:**
- User has "G Major Scale → 120 BPM" as goal
- Always practice G Major Scale
- Track current BPM, gradually increase

---

## 🔥 Warm-up Selection

```typescript
function selectReviewItems(priorities: Priority[]): Exercise[] {
  // Get recently mastered items
  const recentlyMastered = getAllExercises()
    .filter(ex => getUserMastery(ex.id) >= 0.8)
    .filter(ex => {
      const daysSince = getDaysSinceLastPracticed(ex.id);
      return daysSince >= 3 && daysSince <= 14; // Sweet spot
    })
    .sort((a, b) => {
      // Prioritize items from user's priorities
      const aInPriority = isPriorityRelated(a, priorities);
      const bInPriority = isPriorityRelated(b, priorities);
      if (aInPriority && !bInPriority) return -1;
      if (!aInPriority && bInPriority) return 1;
      
      // Then by least recently practiced
      return getLastPracticed(a) - getLastPracticed(b);
    });
  
  return recentlyMastered.slice(0, 2); // 1-2 review items
}
```

**Warm-up includes:**
- Items mastered 3-14 days ago
- Related to current priorities
- Quick review to maintain skills

---

## 🎯 UI for Setting Priorities

### Priority Manager Page

```tsx
<div className="p-6 max-w-4xl mx-auto">
  <h1>Your Practice Priorities</h1>
  
  {/* Existing Priorities */}
  {priorities.map(priority => (
    <PriorityCard
      key={priority.id}
      priority={priority}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
    />
  ))}
  
  {/* Add New Priority */}
  <Button onClick={() => setShowAddModal(true)}>
    + Add Priority
  </Button>
  
  {/* Add Priority Modal */}
  <Modal open={showAddModal}>
    <h2>Add Practice Priority</h2>
    
    {/* Step 1: Choose Type */}
    <div>
      <label>What type of priority?</label>
      <RadioGroup value={priorityType}>
        <Radio value="module">
          Module-Level (e.g., "All rhythm patterns")
        </Radio>
        <Radio value="specific">
          Specific Goal (e.g., "G Major @ 120 BPM")
        </Radio>
      </RadioGroup>
    </div>
    
    {/* Step 2a: Module Selection */}
    {priorityType === 'module' && (
      <Select value={selectedModule}>
        <option value="rhythm">🥁 Rhythm Guitar</option>
        <option value="scale">🎵 Scales</option>
        <option value="arpeggio">🎹 Arpeggios</option>
        <option value="notewalking">🎤 Ear Training</option>
        <option value="riff">🎸 Repertoire</option>
      </Select>
    )}
    
    {/* Step 2b: Specific Exercise */}
    {priorityType === 'specific' && (
      <>
        <Select value={selectedModule}>
          <option value="scale">Scales</option>
          <option value="arpeggio">Arpeggios</option>
          <option value="riff">Riffs</option>
        </Select>
        
        <Select value={selectedExercise}>
          {/* Load exercises for selected module */}
        </Select>
        
        {/* Target Metrics */}
        <div>
          <label>Target BPM (optional)</label>
          <Input type="number" />
        </div>
      </>
    )}
    
    {/* Step 3: Set Weight */}
    <div>
      <label>How important? (1-10)</label>
      <Slider min={1} max={10} value={weight} />
      <p className="text-xs">
        Higher = more practice time allocated
      </p>
    </div>
    
    <Button onClick={handleSave}>Save Priority</Button>
  </Modal>
</div>
```

---

## 🚀 Implementation Plan

### Phase 1: Priority System
- [ ] Create `user_priorities` table
- [ ] Build Priority Manager UI
- [ ] Add/edit/delete priorities
- [ ] Weight slider

### Phase 2: Session Generation
- [ ] Implement time allocation algorithm
- [ ] "Press Start" interface with time selection
- [ ] Generate session plan preview
- [ ] Show warm-up + priorities

### Phase 3: "Next Exercise" Logic
- [ ] For module priorities: progression algorithm
- [ ] For specific priorities: return specific exercise
- [ ] Track mastery levels
- [ ] Update progression after each session

### Phase 4: Warm-up System
- [ ] Select recently mastered items
- [ ] Spaced repetition (3-14 days)
- [ ] Priority-related review
- [ ] Quick 2-3 min warm-up

### Phase 5: Progress Tracking
- [ ] Log practice time per priority
- [ ] Update mastery levels
- [ ] Graduation notifications ("You've mastered G Major!")
- [ ] Progress charts

---

## 💡 Example User Journeys

### Journey 1: Sweep Picking Focus

**User Setup:**
```
Priorities:
- Sweep Picking (Arpeggios) - Weight 9
- Rhythm Guitar - Weight 5
- Ear Training - Weight 3
```

**20-Min Session:**
```
1. Warm-up: C Major Scale (2 min)
2. A Minor Arpeggio Sweep (9 min) ⭐
3. Rhythm Level 5 (5 min) ⭐
4. Notewalking in G (4 min) ⭐
```

**60-Min Session:**
```
1. Warm-up: Mixed scales (5 min)
2. A Minor Arpeggio Sweep (28 min) ⭐
3. Rhythm Level 5 (16 min) ⭐
4. E Major Arpeggio Review (3 min)
5. Notewalking in G (8 min) ⭐
```

**Notice:** Sweep picking gets ~50% of time (weight 9/17)!

### Journey 2: Specific Goal

**User Setup:**
```
Priorities:
- G Major Scale → 120 BPM (Specific) - Weight 10
- Rhythm Guitar - Weight 7
```

**Every Session:**
- Always includes G Major Scale
- Tracks current BPM (starts at 60, gradually increases)
- When 120 BPM achieved → notification + graduation!

---

## 🎉 The Result

**User experience:**
1. Set priorities once (takes 5 min)
2. Every day:
   - Open app
   - Click "Start Practice"
   - Select time (20/30/45/60 min)
   -   Click "Go"
3. App handles everything:
   - Warm-up selection
   - Priority coverage
   - Progression tracking
   - Spaced repetition
   - Time management

**Zero thinking. Maximum progress. Every minute counts.** 🎸

---

## Next Steps?

Want me to start building:
1. **Priority Manager UI** - Add/edit priorities
2. **Session Generator** - "Press Start" interface
3. **Next Exercise Algorithm** - Smart progression
4. **Database migrations** - user_priorities table

Which would you like first? 🚀
