# Practice Module System - Architecture Design

## 🎯 Vision: Modular Practice Platform

Transform from **static tabs** → **flexible practice modules** that can be:
- Tried in freeplay mode
- Added to custom routines
- Assigned as goals by teachers
- Tracked for progress/graduation

---

## 🏗️ Architecture Overview

### 1. Practice Modules (Reusable Components)

Each module becomes a **self-contained practice component** that can run in different modes:

#### Available Modules:
1. **Scale Practice** - Existing scales/arpeggios
2. **Rhythm Training** - 16th note patterns ✅
3. **Notewalking** - Ear training over changes ✅
4. **Chord Progressions** - Chord shapes & transitions
5. **Riff Library** - Song/repertoire practice
6. **Ear Training** - Interval/note identification

#### Module Interface:
```typescript
interface PracticeModule {
  id: string;
  type: ModuleType;
  name: string;
  description: string;
  icon: string;
  difficulty: number; // 1-10
  
  // What mode is it running in?
  mode: 'freeplay' | 'routine' | 'goal';
  
  // If routine/goal mode
  config?: ModuleConfig;
  timeLimit?: number; // seconds
  targetMetrics?: ModuleMetrics;
  
  // Callbacks
  onComplete?: (results: ModuleResults) => void;
  onProgress?: (progress: number) => void;
}
```

---

## 📱 New UI Structure

### Home/Dashboard View
```
┌─────────────────────────────────────────┐
│  Practice Dashboard                     │
│  ─────────────────────────────────────  │
│                                         │
│  🎯 Active Routines (2)                │
│  ┌─────────────────┐ ┌───────────────┐ │
│  │ Morning Warmup  │ │ Jazz Studies  │ │
│  │ 20 min • 4 mod  │ │ 45 min • 6 mod│ │
│  │ [Start]         │ │ [Start]       │ │
│  └─────────────────┘ └───────────────┘ │
│                                         │
│  📚 Module Library                      │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│  │ 🎵   │ │ 🥁   │ │ 🎤   │ │ 🎼   │  │
│  │Scales│ │Rhythm│ │Notes │ │Chord │  │
│  │[Try] │ │[Try] │ │[Try] │ │[Try] │  │
│  └──────┘ └──────┘ └──────┘ └──────┘  │
│                                         │
│  🎓 Goals from Teacher (3)              │
│  ▢ Master G Major Scale @ 120 BPM      │
│  ▢ Rhythm Level 10 completion          │
│  ▢ Notewalking in all keys             │
└─────────────────────────────────────────┘
```

### Module Library (Storefront) View
```
┌─────────────────────────────────────────────────┐
│  Practice Modules                   [+ Create]  │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌────────────────────────────────────────┐    │
│  │  🎵 Scale Practice                     │    │
│  │  Master scales across the fretboard    │    │
│  │  ⭐⭐⭐⭐⭐ Beginner-Advanced            │    │
│  │                                        │    │
│  │  Your Progress: 45% • Level 6/10      │    │
│  │  [Try Now] [Add to Routine] [Details] │    │
│  └────────────────────────────────────────┘    │
│                                                 │
│  ┌────────────────────────────────────────┐    │
│  │  🥁 Rhythm Training                    │    │
│  │  16th note strumming patterns          │    │
│  │  ⭐⭐⭐⭐◯ Beginner-Intermediate        │    │
│  │                                        │    │
│  │  Your Progress: 78% • Level 8/10      │    │
│  │  [Try Now] [Add to Routine] [Details] │    │
│  └────────────────────────────────────────┘    │
│                                                 │
│  ┌────────────────────────────────────────┐    │
│  │  🎤 Notewalking                        │    │
│  │  Ear training over chord progressions  │    │
│  │  ⭐⭐⭐⭐⭐ All Levels                   │    │
│  │                                        │    │
│  │  Your Progress: 23% • Level 3/10      │    │
│  │  [Try Now] [Add to Routine] [Details] │    │
│  └────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

### Routine Builder
```
┌──────────────────────────────────────────┐
│  Create Routine                    [Save]│
├──────────────────────────────────────────┤
│  Name: Morning Warmup                   │
│  Duration: 20 minutes                    │
│                                          │
│  Modules:                                │
│  ┌────────────────────────────────────┐ │
│  │ 1. 🎵 Scales - G Major (5 min)     │ │
│  │    Target: 100 BPM                 │ │
│  │    [Edit] [Remove] [↑] [↓]         │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │ 2. 🥁 Rhythm - Level 5 (5 min)     │ │
│  │    Target: Complete level          │ │
│  │    [Edit] [Remove] [↑] [↓]         │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │ 3. 🎤 Notewalking - C Maj (10 min) │ │
│  │    Target: 80% accuracy            │ │
│  │    [Edit] [Remove] [↑] [↓]         │ │
│  └────────────────────────────────────┘ │
│                                          │
│  [+ Add Module]                          │
└──────────────────────────────────────────┘
```

---

## 🗄️ Data Model Changes

### New Table: `practice_routines`
```sql
CREATE TABLE practice_routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT,
  is_template BOOLEAN DEFAULT false, -- Teacher templates
  created_by UUID REFERENCES auth.users(id), -- For teacher-created
  estimated_duration_minutes INTEGER,
  modules JSONB NOT NULL, -- Array of module configs
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**modules JSONB structure:**
```json
[
  {
    "order": 1,
    "module_type": "scale",
    "duration_minutes": 5,
    "config": {
      "scale_id": "uuid",
      "target_bpm": 100
    }
  },
  {
    "order": 2,
    "module_type": "rhythm",
    "duration_minutes": 5,
    "config": {
      "rhythm_level": 5,
      "target_completion": true
    }
  }
]
```

### New Table: `routine_progress`
```sql
CREATE TABLE routine_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  routine_id UUID NOT NULL REFERENCES practice_routines(id),
  times_completed INTEGER DEFAULT 0,
  last_completed TIMESTAMPTZ,
  average_performance DECIMAL(3,2), -- 0.00-1.00
  best_session_id UUID REFERENCES practice_sessions(id),
  UNIQUE(user_id, routine_id)
);
```

### Extend `practice_sessions`
```sql
-- Add routine_id to existing table
ALTER TABLE practice_sessions
ADD COLUMN routine_id UUID REFERENCES practice_routines(id);
```

---

## 🎮 User Flows

### Flow 1: Freeplay Mode
1. User clicks "Try Now" on module card
2. Module opens in **standalone mode**
3. No time limit, no goals
4. Optional: Log to practice_log for tracking
5. User can exit anytime

### Flow 2: Build Custom Routine
1. User clicks "Create Routine"
2. Opens routine builder
3. Drag/add modules, set durations & targets
4. Save routine
5. Routine appears in dashboard

### Flow 3: Start Routine
1. User clicks "Start" on routine card
2. Creates `practice_session` with `routine_id`
3. Loads first module with config
4. Timer shows progress
5. On complete, load next module
6. At end, save results & update `routine_progress`

### Flow 4: Teacher Assigns Goal
1. Teacher creates routine (marked as template)
2. Assigns to student
3. Student sees in "Goals from Teacher"
4. Student practices routine to completion
5. Progress tracked in `lesson_progress`
6. Teacher reviews performance

### Flow 5: Graduation
1. Module tracks mastery level (0-1)
2. When mastery > 0.8 and target met:
   - Mark module complete
   - Celebrate achievement
   - Suggest next level/module
3. Update `routine_progress` or `lesson_progress`

---

## 🔧 Implementation Plan

### Phase 1: Module Standardization
- [ ] Create `PracticeModuleWrapper` component
- [ ] Standardize all modules to accept:
  - `mode`: 'freeplay' | 'routine' | 'goal'
  - `config`: Module-specific settings
  - `onComplete`: Callback with results
  - `timeLimit`: Optional duration
- [ ] Wrap existing modules (Rhythm, Notewalking)

### Phase 2: Module Library UI
- [ ] Create `ModuleCard` component
- [ ] Create `ModuleLibrary` page
- [ ] Add module metadata (name, desc, icon, difficulty)
- [ ] "Try Now" button → freeplay mode
- [ ] "Add to Routine" button → routine builder

### Phase 3: Routine System
- [ ] Create `practice_routines` table
- [ ] Create `RoutineBuilder` component
- [ ] Create `RoutineCard` component
- [ ] Save/load routines from DB
- [ ] Start routine → guided session

### Phase 4: Dashboard
- [ ] Redesign Premium page as dashboard
- [ ] Show active routines
- [ ] Show module library
- [ ] Show teacher-assigned goals
- [ ] Quick stats & progress

### Phase 5: Teacher Features
- [ ] Template routine creation
- [ ] Student assignment interface
- [ ] Progress review dashboard
- [ ] Graduation triggers

---

## 📊 Module Metadata

Each module needs:
```typescript
interface ModuleMetadata {
  id: ModuleType;
  name: string;
  shortDescription: string;
  fullDescription: string;
  icon: string;
  difficulty: {
    min: number; // 1
    max: number; // 10
  };
  estimatedTime: {
    min: number; // 5 minutes
    max: number; // 60 minutes
  };
  skills: string[]; // ['timing', 'fretboard-knowledge', 'ear-training']
  requiresAudio: boolean;
  supportsFreeplay: boolean;
  supportsGoals: boolean;
}
```

---

## 🎨 Visual Design

### Module Card Style
- Large icon/emoji
- Module name & tagline
- Difficulty stars (⭐)
- Your progress bar
- Action buttons (Try, Add, Details)
- Hover: Show more info

### Routine Card Style  
- Routine name
- Duration badge
- Module count badge
- Last practiced timestamp
- Start button (prominent)
- Edit/Delete icons

### Active Session
- Module name & icon
- Timer (large)
- Progress through routine
- Skip/Pause controls
- Next up preview

---

## 🚀 Benefits of This Approach

1. **Flexibility**: Users create personalized practice plans
2. **Discovery**: Browse and try modules easily
3. **Structure**: Teachers assign focused goals
4. **Progress**: Clear tracking per module & routine
5. **Motivation**: Visual progress, achievements, graduation
6. **Scalability**: Easy to add new modules later

---

## Next Steps

Want me to:
1. **Start with Phase 1** (Module standardization wrapper)?
2. **Build the Module Library UI** first (visual milestone)?
3. **Create the database migrations** for routines?
4. **Design a specific part** in more detail?

This is a significant but exciting refactor! 🎯
