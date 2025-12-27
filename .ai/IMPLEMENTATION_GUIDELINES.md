# Implementation Guidelines

**Critical Rules for Making Changes to TempoTrekker**

---

## 🚨 Before You Code: The Checklist

### 1. Understand the Generative Nature

**TempoTrekker is NOT:**
- A static database of exercises
- A simple CRUD app
- Traditional lesson management

**TempoTrekker IS:**
- A generative exercise engine
- Scale + Sequence + Key → Infinite exercises
- Real-time rendering system

**Impact:** Changes to `scales` or `sequences` affect ALL exercises using them

---

### 2. Type Compatibility is Sacred

**The Golden Rule:**
```
sequence.compatible_type MUST EQUAL scale.Type
```

**Before adding a sequence:**
```typescript
// ✓ CORRECT
const scale = { Type: "3 notes per string scale", ... };
const sequence = { compatible_type: "3 notes per string scale", ... };

// ✗ WRONG - Will break rendering!
const scale = { Type: "3 notes per string scale", ... };
const sequence = { compatible_type: "4 notes per string scale", ... };
```

**Validation function:**
```typescript
function canUseSequenceWithScale(scale, sequence) {
  if (scale.Type !== sequence.compatible_type) {
    console.error(`Type mismatch: ${scale.Type} vs ${sequence.compatible_type}`);
    return false;
  }
  
  const maxIndex = Math.max(...sequence.pattern);
  const scaleLength = scale.intervals.length;
  
  if (maxIndex > scaleLength) {
    console.error(`Sequence needs ${maxIndex} notes, scale has ${scaleLength}`);
    return false;
  }
  
  return true;
}
```

---

### 3. Modules vs Lessons vs Sessions

**Confusion Point:** These terms overlap but mean different things

**Module** = Practice Mode (Rhythm, Scales, Arpeggios, etc.)
- Type: `ModuleType`
- Examples: `'rhythm'`, `'scale'`, `'arpeggio'`
- Stored in: `MODULE_REGISTRY`

**Lesson** = Teacher-Created Exercise Collection
- Type: `lesson` table
- Contains: Multiple exercises
- Purpose: Homework, curriculum
- Can include ANY module type

**Session** = System-Generated Practice Plan
- Type: `practice_sessions` table
- Contains: `SessionBlock[]`
- Purpose: Daily practice automation
- Based on user priorities

**Example:**
```typescript
// A lesson (teacher-assigned)
const lesson = {
  id: '...',
  title: 'Week 1: Basic Scales',
  exercises: [
    { module_type: 'scale', config: { scale_id: 'G-major' } },
    { module_type: 'rhythm', config: { rhythm_level: 5 } }
  ]
};

// A session (auto-generated)
const session = {
  id: '...',
  session_plan: [
    { type: 'warmup', module_type: 'scale', duration_minutes: 3 },
    { type: 'priority', module_type: 'rhythm', duration_minutes: 10 },
    { type: 'priority', module_type: 'arpeggio', duration_minutes: 7 }
  ]
};
```

**Recommendation:** 
- Use `lesson` for teacher-student workflow
- Use `session` for intelligent practice automation
- Both can coexist!

---

### 4. Notes Per Click is Critical

**Why it matters:** This determines exercise difficulty ranking

**Must store on sequences:**
```sql
ALTER TABLE sequences 
ADD COLUMN notes_per_click DECIMAL DEFAULT 1.0;
```

**Values:**
- `1.0` = Quarter notes
- `2.0` = 8th notes
- `3.0` = Triplets
- `4.0` = 16th notes
- `6.0` = Sextuplets

**How it's used:**
```typescript
function calculateActualSpeed(exercise, userBPM) {
  return (userBPM / 60) * exercise.sequence.notes_per_click;
}

// Example:
// 120 BPM, 16th notes (4.0) = 120/60 * 4 = 8 notes per second
// 100 BPM, quarter notes (1.0) = 100/60 * 1 = 1.67 notes per second
```

**Impact:** Without this, system can't rank exercises properly!

---

### 5. Database Schema Changes

**Process:**
1. Create migration file
2. Apply via MCP tool
3. Regenerate TypeScript types
4. Update UI components
5. Test rendering pipeline

**Example - Adding notes_per_click:**

```sql
-- Migration: 20241226_add_notes_per_click_to_sequences.sql
ALTER TABLE sequences 
ADD COLUMN IF NOT EXISTS notes_per_click DECIMAL DEFAULT 1.0;

UPDATE sequences 
SET notes_per_click = 4.0 
WHERE name LIKE '%16th%';

UPDATE sequences 
SET notes_per_click = 2.0 
WHERE name LIKE '%8th%';
```

**Then:**
```bash
# Apply migration
supabase db push

# Regenerate types
npm run generate-types

# Update code
// src/types/sequences.ts
export interface Sequence {
  id: string;
  name: string;
  pattern: number[];
  compatible_type: string;
  notes_per_click: number;  // NEW!
}
```

---

### 6. Polymorphic Module Config

**Old way (AVOID):**
```typescript
// Hardcoded scale_id
practice_log {
  scale_id: '123',
  exercise_category: 'scale'
}
```

**New way (USE THIS):**
```typescript
// Polymorphic config
practice_log {
  module_type: 'scale',
  module_config: {
    scale_id: '123',
    sequence_id: '456',
    key: 'G'
  }
}
```

**Why:** More flexible, supports all module types, future-proof

**Refactoring steps:**
1. Add `module_type` and `module_config` columns
2. Migrate existing data
3. Update UI to use new fields
4. Deprecate old fields (but keep for backward compat)

---

### 7. Thresholds & Graduation

**User's requirement:**
> "If logging 120 BPM for an exercise, move to warmup. If much slower, focus on it."

**Implementation:**
```typescript
const GRADUATION_THRESHOLD_BPM = 10; // BPM above target

function shouldGraduate(exercise, userBPM, targetBPM) {
  // Must exceed target by threshold
  if (userBPM < targetBPM + GRADUATION_THRESHOLD_BPM) {
    return false;
  }
  
  // Must maintain for 3 sessions
  const recentSessions = getRecentSessions(exercise, 3);
  const allAboveThreshold = recentSessions.every(
    s => s.max_bpm >= targetBPM + GRADUATION_THRESHOLD_BPM
  );
  
  return allAboveThreshold;
}

function categorizeExercises(exercises) {
  const ranked = exercises.map(ex => ({
    ...ex,
    notesPerSec: calculateNotesPerSecond(ex, ex.user_max_bpm)
  })).sort((a, b) => a.notesPerSec - b.notesPerSec);
  
  return {
    // Bottom 70% - need focus
    focus: ranked.slice(0, Math.floor(ranked.length * 0.7)),
    
    // Top 30% - for warmup
    warmup: ranked.slice(Math.floor(ranked.length * 0.7))
  };
}
```

---

### 8. UI/UX Consistency

**Module tabs should be organized:**

```
🚀 Start (Press Start - generates sessions)
⚙️ Priorities (Set weights)
─────────────────────────────
🎯 Modules (Storefront view - Try Now buttons)
  └─ When clicked → Opens module in freeplay
─────────────────────────────
📚 Lessons (Teacher-assigned collections)
─────────────────────────────
Individual Practice (direct access):
  - Rhythms
  - Scales  
  - Arpeggios
  - Notewalking
```

**Recommendation:**
- Remove duplicate module tabs
- Keep Modules tab as storefront
- Direct tabs are shortcuts for common practice

---

### 9. Sequence Application to Chords

**Open question:** How do sequences apply to chord progressions?

**Option A: Rhythmic Patterns**
```typescript
// Sequence defines strum pattern
sequence = {
  pattern: [1, 2, 2, 3, 3, 4],  // Down, up-up, down-down, down
  compatible_type: "chord"
};

progression = {
  chords: ['C', 'F', 'G', 'C']
};

// Result: Each chord gets strummed with pattern
```

**Option B: Voicing Patterns**
```typescript
// Sequence defines which chord tones to emphasize
sequence = {
  pattern: [1, 3, 5, 3, 1],  // Root, 5th, 7th, 5th, root
  compatible_type: "chord"
};

chord = {
  notes: ['C', 'E', 'G', 'B']  // Cmaj7
};

// Result: Arpeggiates chord
```

**Recommendation:** Test both, let users choose

---

### 10. Testing Changes

**Before committing:**

```bash
# 1. Test type compatibility
npm run test:types

# 2. Generate sample exercise
const testExercise = {
  scale: getScale('G-major-3nps'),
  sequence: getSequence('ascending-3s'),
  key: 'C'
};
console.log(renderExercise(testExercise));

# 3. Test all module types
for (const moduleType of MODULE_TYPES) {
  testModule(moduleType);
}

# 4. Check database constraints
-- Ensure no orphaned references
SELECT * FROM sequences WHERE id NOT IN (SELECT DISTINCT sequence_id FROM exercises);
```

---

## 🎯 Decision Framework

**When adding a new feature, ask:**

1. Does it fit the generative model?
   - If yes → Great!
   - If no → Rethink approach

2. Does it require a new Type?
   - If yes → Document type compatibility
   - If no → Use existing types

3. Does it change the data model?
   - If yes → Create migration + update types
   - If no → Proceed

4. Can it break existing exercises?
   - If yes → Add validation
   - If no → Proceed

5. Does it need tracking?
   - If yes → Add to `practice_log`
   - If no → Keep stateless

---

## 🚧 Common Pitfalls

### 1. Hardcoding Exercise Data
```typescript
// ✗ WRONG
const exercise = {
  notes: ['C', 'D', 'E', 'F', 'G']
};

// ✓ RIGHT
const exercise = renderExercise(scale, sequence, key);
```

### 2. Storing Rendered Output
```typescript
// ✗ WRONG
await supabase.from('exercises').insert({
  rendered_notes: renderedExercise  // Don't store this!
});

// ✓ RIGHT
await supabase.from('exercises').insert({
  scale_id: scale.id,
  sequence_id: sequence.id,
  key: 'C'
  // Render on-demand later
});
```

### 3. Ignoring Type Compatibility
```typescript
// ✗ WRONG
const anySequence = sequences[0];  // Pick random
applySequence(scale, anySequence);  // BREAKS!

// ✓ RIGHT
const compatibleSequences = sequences.filter(
  s => s.compatible_type === scale.Type
);
const sequence = compatibleSequences[0];
```

### 4. Not Tracking notes_per_click
```typescript
// ✗ WRONG
function rankExercises(exercises) {
  return exercises.sort((a, b) => a.max_bpm - b.max_bpm);
}

// ✓ RIGHT
function rankExercises(exercises) {
  return exercises.sort((a, b) => {
    const aSpeed = (a.max_bpm / 60) * a.sequence.notes_per_click;
    const bSpeed = (b.max_bpm / 60) * b.sequence.notes_per_click;
    return aSpeed - bSpeed;
  });
}
```

---

## 📋 Change Checklist

Before pushing changes:

- [ ] Read TECHNICAL_ARCHITECTURE.md
- [ ] Read EXERCISE_ENGINE.md
- [ ] Understand type compatibility
- [ ] Test with multiple types (3nps, 4nps, arpeggio)
- [ ] Verify notes_per_click is tracked
- [ ] Check database migrations applied
- [ ] Regenerate TypeScript types
- [ ] Test rendering pipeline
- [ ] Validate user flow
- [ ] Update documentation

---

## 🎸 Remember

> TempoTrekker's power comes from its generative nature.  
> One scale + one sequence = 12 exercises (all keys).  
> 10 scales + 10 sequences = 1,200 exercises.  
> Always think: "Does this preserve the generative model?"

**When in doubt:** Consult the architecture docs!

---

*Keep this document updated as the system evolves.*
