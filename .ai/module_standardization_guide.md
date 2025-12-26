# Module Standardization - Implementation Guide

## ✅ Completed

### 1. Core Type System (`src/types/modules.ts`)
- **PracticeMode**: 'freeplay' | 'routine' | 'goal'
- **ModuleResults**: Standard results interface
- **PracticeModuleProps**: Standard props for all modules
- **ModuleMetadata**: Complete metadata registry
- **MODULE_REGISTRY**: Metadata for all 6 modules

### 2. Wrapper Component (`src/components/PracticeModuleWrapper.tsx`)
- Wraps any module with consistent UI
- Timer overlay (routine/goal mode)
- Progress tracking
- Target metrics display
- Completion handling
- **useModuleResults** hook for tracking

---

## 🔧 How to Use

### Example 1: Wrap RhythmTraining

**Old (standalone):**
```tsx
<RhythmTraining />
```

**New (with wrapper):**
```tsx
import { PracticeModuleWrapper } from '@/components/PracticeModuleWrapper';
import { RhythmTraining } from '@/components/RhythmTraining';

// Freeplay mode
<PracticeModuleWrapper
  mode="freeplay"
  config={{ module_type: 'rhythm', rhythm_level: 5 }}
>
  <RhythmTraining />
</PracticeModuleWrapper>

// Routine mode (10 min timer)
<PracticeModuleWrapper
  mode="routine"
  config={{ module_type: 'rhythm', rhythm_level: 5 }}
  timeLimit={600}
  onComplete={(results) => {
    console.log('Completed!', results);
    moveToNextModule();
  }}
>
  <RhythmTraining />
</PracticeModuleWrapper>

// Goal mode (with targets)
<PracticeModuleWrapper
  mode="goal"
  config={{ module_type: 'rhythm', rhythm_level: 10 }}
  targetMetrics={{
    target_level: 10,
    target_accuracy: 0.9,
  }}
  onComplete={(results) => {
    console.log('Goal complete!', results);
  }}
  onProgress={(progress) => {
    console.log('Progress:', progress); // 0-1
  }}
>
  <RhythmTraining />
</PracticeModuleWrapper>
```

### Example 2: Update Module to Report Results

**Inside RhythmTraining:**
```tsx
import { useModuleResults } from '@/components/PracticeModuleWrapper';

export function RhythmTraining() {
  const moduleResults = useModuleResults();
  
  // Report metrics as they happen
  const handleLevelComplete = (level: number) => {
    moduleResults.updateMetric('level_reached', level);
  };
  
  const handleAccuracy = (accuracy: number) => {
    moduleResults.updateMetric('accuracy', accuracy);
  };
  
  // Add achievements
  if (level === 10) {
    moduleResults.addAchievement('Completed Rhythm Level 10!');
    moduleResults.markComplete();
  }
  
  // Recording callback
  const handleRecording = (url: string) => {
    moduleResults.addRecording(url);
  };
  
  return (
    // Your existing component JSX
  );
}
```

---

## 🎯 Module Metadata Registry

All modules now have standardized metadata:

```typescript
const rhythmMeta = getModuleMetadata('rhythm');
// {
//   name: 'Rhythm Training',
//   icon: '🥁',
//   difficulty: { min: 1, max: 10 },
//   estimatedTime: { min: 5, max: 30, recommended: 10 },
//   capabilities: {
//     supportsFreeplay: true,
//     hasAutoRecord: true,
//     hasLevels: true,
//     ...
//   }
// }
```

Use in UI:
```tsx
import { MODULE_REGISTRY } from '@/types/modules';

// Module card
<div className="module-card">
  <span className="text-4xl">{MODULE_REGISTRY.rhythm.icon}</span>
  <h3>{MODULE_REGISTRY.rhythm.name}</h3>
  <p>{MODULE_REGISTRY.rhythm.shortDescription}</p>
  <span>{getDifficultyStars(5)} Beginner-Intermediate</span>
</div>
```

---

## 📊 Results Flow

```
┌─────────────────┐
│ Practice Module │
│ (Rhythm, etc.)  │
└────────┬────────┘
         │ useModuleResults()
         │ - updateMetric()
         │ - addAchievement()
         │ - markComplete()
         ▼
┌─────────────────┐
│ ModuleWrapper   │
│ - Tracks time   │
│ - Shows targets │
└────────┬────────┘
         │ onComplete()
         ▼
┌─────────────────┐
│ Parent          │
│ (Routine/Goal)  │ 
│ - Save to DB    │
│ - Next module   │
└─────────────────┘
```

---

## 🔄 Migration Checklist

For each existing module:

### RhythmTraining
- [ ] Accept wrapper props (optional)
- [ ] Use `useModuleResults()` hook
- [ ] Report `level_reached` metric
- [ ] Report `accuracy` metric (if tracked)
- [ ] Call `markComplete()` when done
- [ ] Link auto-recording to `addRecording()`

### ChordProgressionExercise (Notewalking)
- [ ] Accept wrapper props
- [ ] Use `useModuleResults()` hook
- [ ] Report `notes_correct` and `notes_total`
- [ ] Report `accuracy` metric
- [ ] Link auto-recording to `addRecording()`

### Scale Practice (when built)
- [ ] Use wrapper from start
- [ ] Report `max_bpm` metric
- [ ] Track progression through shapes
- [ ] Report completion

### Chord Progressions Module (when built)
- [ ] Use wrapper from start
- [ ] Report `clean_transitions` metric
- [ ] Report `max_bpm` for changes
- [ ] Track mastery

---

## 🎨 UI Behavior by Mode

### Freeplay Mode
- No timer shown
- No header overlay
- Module runs normally
- Can exit anytime
- Optional: log to practice_log

### Routine Mode
- Timer shown in header
- Auto-advances when time up
- Shows 2s completion screen
- Calls `onComplete()` → next module
- Logs to practice_log with session_id

### Goal Mode
- Timer shown (if set)
- Target metrics displayed
- "Mark Complete" button
- Requires user confirmation
- Tracks progress toward target
- Logs to practice_log & lesson_progress

---

## 🚀 Next Steps

### Phase 1a: Update Existing Modules ✅ (Ready)
- Wrap RhythmTraining
- Wrap ChordProgressionExercise
- Test all 3 modes for each

### Phase 1b: Module Cards
- Create `ModuleCard` component
- Use metadata registry
- Show progress, difficulty
- "Try Now" button → freeplay
- "Add to Routine" → builder

### Phase 2: Module Library
- Grid of all module cards
- Filter by skill/difficulty
- Search functionality
- User progress overlay

### Phase 3: Routines
- Routine builder UI
- Save to database
- Routine player
- Sequential module loading

---

## 📝 Example: Full Routine Flow

```tsx
// RoutinePlayer.tsx
function RoutinePlayer({ routine }: { routine: Routine }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentBlock = routine.modules[currentIndex];
  
  const handleModuleComplete = (results: ModuleResults) => {
    // Save to DB
    savePracticeLog(results, routine.id);
    
    // Next module
    if (currentIndex < routine.modules.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      completeRoutine();
    }
  };
  
  return (
    <PracticeModuleWrapper
      mode="routine"
      config={currentBlock.config}
      timeLimit={currentBlock.duration_minutes * 60}
      onComplete={handleModuleComplete}
      routineId={routine.id}
    >
      {renderModule(currentBlock.module_type, currentBlock.config)}
    </PracticeModuleWrapper>
  );
}

function renderModule(type: ModuleType, config: ModuleConfig) {
  switch (type) {
    case 'rhythm':
      return <RhythmTraining />;
    case 'notewalking':
      return <ChordProgressionExercise />;
    // ... other modules
  }
}
```

---

## ✨ Benefits

1. **Consistency**: All modules behave the same way
2. **Reusability**: Same module in freeplay, routines, goals
3. **Time Management**: Built-in timer for routines
4. **Progress Tracking**: Standardized metrics
5. **Future-Proof**: Easy to add new modules
6. **Separation of Concerns**: Module UI separate from mode logic

---

## 🎉 Status

**Module Standardization: 90% Complete**

**Completed:**
- ✅ Type system
- ✅ Module registry
- ✅ Wrapper component
- ✅ Results tracking hook
- ✅ Timer system
- ✅ Mode handling

**Next:**
- Update RhythmTraining to use wrapper
- Update Notewalking to use wrapper
- Build ModuleCard component
- Build Module Library page

Ready to update the existing modules! 🚀
