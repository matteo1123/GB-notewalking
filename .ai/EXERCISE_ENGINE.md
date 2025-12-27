# Exercise Rendering Engine

**How TempoTrekker Generates Exercises in Real-Time**

---

## Overview

The Exercise Rendering Engine is the core innovation of TempoTrekker. Instead of storing pre-made exercises, it **generates them on-demand** by combining three elements:

```
SCALE SHAPE + SEQUENCE PATTERN + KEY = RENDERED EXERCISE
```

---

## The Three Components

### 1. Scale Shape (The Template)

**What it is:** A pattern of intervals relative to a root note

**Example - G Major Scale (3nps)**
```json
{
  "name": "G Major Pos 1",
  "Type": "3 notes per string scale",
  "root_note": "G",
  "intervals": [0, 2, 4, 5, 7, 9, 11],  // Whole steps from root
  "notes_json": [
    { "fret": 3, "string": 6 },  // G
    { "fret": 5, "string": 6 },  // A
    { "fret": 2, "string": 5 },  // B
    // ... etc
  ]
}
```

**Key Properties:**
- `intervals`: Mathematical representation (transposable!)
- `notes_json`: Fretboard layout (visual representation)
- `Type`: Must match sequence compatibility

### 2. Sequence Pattern (The Motion)

**What it is:** A series of indices that create musical patterns

**Example - Ascending 3-Note Groups**
```json
{
  "name": "Ascending 3s",
  "pattern": [1, 2, 3, 2, 3, 4, 3, 4, 5, 4, 5, 6, 5, 6, 7],
  "compatible_type": "3 notes per string scale",
  "notes_per_click": 4  // 16th notes
}
```

**How it works:**
- Indices are **1-based** (not 0-based!)
- Each number picks a note from the scale
- Pattern repeats as needed

**Visualization:**
```
Scale notes:  G  A  B  C  D  E  F#
Index:        1  2  3  4  5  6  7

Pattern: [1, 2, 3, 2, 3, 4]
Result:  G  A  B  A  B  C
```

### 3. Key (The Transposition)

**What it is:** The root note that shifts everything

**Example:**
- Same shape + sequence in **G** = G Major scale exercise
- Same shape + sequence in **C** = C Major scale exercise
- Same shape + sequence in **A** = A Major scale exercise

**How it works:**
```typescript
function transpose(intervals, key) {
  const keyOffset = getNoteNumber(key); // G = 7, C = 0, etc.
  return intervals.map(interval => (keyOffset + interval) % 12);
}
```

---

## Rendering Pipeline

### Step 1: Validate Compatibility

```typescript
function validateExercise(scale, sequence) {
  if (scale.Type !== sequence.compatible_type) {
    throw new Error(
      `Type mismatch: Scale is ${scale.Type} but sequence requires ${sequence.compatible_type}`
    );
  }
  
  // Check sequence indices don't exceed scale length
  const maxIndex = Math.max(...sequence.pattern);
  const scaleLength = scale.intervals.length;
  
  if (maxIndex > scaleLength) {
    throw new Error(
      `Sequence requires ${maxIndex} notes but scale only has ${scaleLength}`
    );
  }
}
```

### Step 2: Apply Sequence to Scale

```typescript
function applySequence(scale, sequence) {
  const notes = [];
  
  for (const index of sequence.pattern) {
    // Sequences use 1-based indexing
    const noteIndex = index - 1;
    const note = scale.intervals[noteIndex];
    notes.push(note);
  }
  
  return notes;
}
```

### Step 3: Transpose to Key

```typescript
function transposeToKey(intervals, key) {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const keyOffset = noteNames.indexOf(key);
  
  return intervals.map(interval => {
    const noteNumber = (keyOffset + interval) % 12;
    return noteNames[noteNumber];
  });
}
```

### Step 4: Map to Fretboard

```typescript
function mapToFretboard(notes, tuning = ['E', 'A', 'D', 'G', 'B', 'E']) {
  const positions = [];
  
  for (const note of notes) {
    const position = findBestPosition(note, tuning, positions);
    positions.push(position);
  }
  
  return positions;
}

function findBestPosition(note, tuning, existingPositions) {
  // Find fret on each string
  const options = tuning.map((openString, stringIndex) => {
    const fret = calculateFret(openString, note);
    return { fret, string: stringIndex + 1 };
  });
  
  // Pick option closest to previous position
  const lastPosition = existingPositions[existingPositions.length - 1];
  if (!lastPosition) return options[0];
  
  return options.reduce((best, current) => {
    const bestDistance = Math.abs(best.fret - lastPosition.fret);
    const currentDistance = Math.abs(current.fret - lastPosition.fret);
    return currentDistance < bestDistance ? current : best;
  });
}
```

### Step 5: Display

```typescript
function renderExercise(fretboardPositions, bpm, sequence) {
  const clicksPerBeat = 4; // 16th notes
  const msPerClick = (60 * 1000) / (bpm * clicksPerBeat);
  
  for (let i = 0; i < fretboardPositions.length; i++) {
    setTimeout(() => {
      highlightNote(fretboardPositions[i]);
      playNote(fretboardPositions[i]);
    }, i * msPerClick);
  }
}
```

---

## Complete Example

**Input:**
```javascript
const exercise = {
  scale: {
    name: "G Major Pos 1",
    intervals: [0, 2, 4, 5, 7, 9, 11],
    Type: "3 notes per string scale"
  },
  sequence: {
    pattern: [1, 2, 3, 2, 3, 4],
    compatible_type: "3 notes per string scale"
  },
  key: "C",  // Transpose from G to C
  bpm: 120
};
```

**Rendering Steps:**

1. **Validate:** ✓ Types match, indices valid
2. **Apply Sequence:**
   ```
   Scale intervals: [0, 2, 4, 5, 7, 9, 11]
   Pattern: [1, 2, 3, 2, 3, 4]
   Result intervals: [0, 2, 4, 2, 4, 5]
   ```

3. **Transpose to C:**
   ```
   Key offset: 0 (C = 0)
   Result: [0, 2, 4, 2, 4, 5]
   Notes: [C, D, E, D, E, F]
   ```

4. **Map to Fretboard:**
   ```
   C → {fret: 3, string: 5}
   D → {fret: 5, string: 5}
   E → {fret: 2, string: 4}
   D → {fret: 5, string: 5}
   E → {fret: 2, string: 4}
   F → {fret: 3, string: 4}
   ```

5. **Display at 120 BPM:**
   - Highlight each position in sequence
   - Play note sound
   - Advance at tempo

---

## Type System Deep Dive

### Why Types Matter

**Problem:** Not all sequences work with all scales

**Example - BAD:**
```javascript
// 4nps scale has 4 notes per string
const scale = {
  Type: "4 notes per string scale",
  intervals: [0, 1, 2, 3, 4, 5, 6, 7]  // 8 notes
};

// 3nps sequence expects 3 notes per string
const sequence = {
  pattern: [1, 2, 3, 4, 5, 6],  // Jumps to note 4 (next string)
  compatible_type: "3 notes per string scale"
};

// BREAKS! Note 4 doesn't align with string change
```

**Solution:** Strict type matching

```typescript
const VALID_TYPES = [
  "2 notes per string scale",
  "3 notes per string scale",
  "4 notes per string scale",
  "arpeggio",
  "chord"
];

function isCompatible(scale, sequence) {
  return scale.Type === sequence.compatible_type;
}
```

### Type-Specific Rendering

Each type has unique rendering logic:

**3 Notes Per String:**
- 3 notes on one string
- Shift to next string
- Repeat

**4 Notes Per String:**
- 4 notes on one string
- Shift to next string
- Repeat

**Arpeggio:**
- Often spans multiple strings per note
- Focus on chord tones
- May skip notes

**Chord:**
- Multiple notes simultaneously
- One "click" = full chord strum
- Sequence might be rhythmic pattern

---

## Performance Tracking

### Notes Per Second Calculation

```typescript
function calculateDifficulty(exercise, userBPM) {
  const notesPerClick = exercise.sequence.notes_per_click;
  const clicksPerSecond = (userBPM / 60) * 4; // Assumes 16th note grid
  
  return {
    notesPerSecond: notesPerClick * clicksPerSecond,
    totalNotes: exercise.sequence.pattern.length,
    duration: exercise.sequence.pattern.length / clicksPerSecond
  };
}
```

**Example:**
```javascript
const exercise = {
  sequence: {
    pattern: [1, 2, 3, 4, 5, 6, 7, 8],  // 8 notes
    notes_per_click: 4  // 16th notes
  }
};

const userBPM = 120;

// Result:
// clicks/sec = 120/60 * 4 = 8
// notes/sec = 4 * 8 = 32 notes per second!
```

### Ranking Exercises

```typescript
function rankExercisesByDifficulty(exercises, userProgress) {
  return exercises.map(exercise => {
    const userBPM = userProgress[exercise.id]?.max_bpm || 60;
    const { notesPerSecond } = calculateDifficulty(exercise, userBPM);
    
    return {
      ...exercise,
      userBPM,
      notesPerSecond,
      needsPractice: notesPerSecond < TARGET_NOTES_PER_SECOND
    };
  }).sort((a, b) => a.notesPerSecond - b.notesPerSecond);
}
```

---

## Edge Cases & Gotchas

### 1. Sequence Index Out of Bounds

**Problem:**
```javascript
scale.intervals = [0, 2, 4, 5, 7];  // 5 notes
sequence.pattern = [1, 2, 3, 4, 5, 6];  // Asks for note 6!
```

**Solution:**
```typescript
// Modulo wrapping
const noteIndex = (pattern[i] - 1) % scale.intervals.length;

// Or validation
if (Math.max(...pattern) > scale.intervals.length) {
  throw new Error("Sequence exceeds scale length");
}
```

### 2. Empty Sequences

**Problem:** Pattern = []

**Solution:**
```typescript
if (sequence.pattern.length === 0) {
  // Generate ascending pattern
  sequence.pattern = Array.from(
    { length: scale.intervals.length },
    (_, i) => i + 1
  );
}
```

### 3. Key Transposition Limits

**Problem:** Not all keys work on guitar in all positions

**Solution:**
- Validate fret range (0-24)
- Suggest alternative positions
- Or use capo simulation

### 4. Timing Precision

**Problem:** JavaScript setTimeout isn't perfectly accurate

**Solution:**
- Use Web Audio API for timing
- Schedule ahead (look-ahead scheduling)
- Compensate for drift

---

## Integration with UI

### Fretboard Display

```tsx
function FretboardDisplay({ exercise, currentNoteIndex }) {
  const positions = renderExercise(exercise);
  
  return (
    <Fretboard>
      {positions.map((pos, i) => (
        <Note
          key={i}
          fret={pos.fret}
          string={pos.string}
          active={i === currentNoteIndex}
          played={i < currentNoteIndex}
        />
      ))}
    </Fretboard>
  );
}
```

### Metronome Integration

```tsx
function ExercisePlayer({ exercise, bpm }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const positions = renderExercise(exercise);
  
  const { start, stop } = useMetronome({
    bpm,
    onBeat: (beatNumber) => {
      const clicksPerBeat = 4;
      const totalClick = (beatNumber - 1) * clicksPerBeat;
      
      if (totalClick < positions.length) {
        setCurrentIndex(totalClick);
      } else {
        stop();
      }
    }
  });
  
  return (
    <div>
      <FretboardDisplay 
        exercise={exercise} 
        currentNoteIndex={currentIndex} 
      />
      <Button onClick={start}>Play</Button>
      <Button onClick={stop}>Stop</Button>
    </div>
  );
}
```

---

## Summary

**The Engine's Job:**

1. ✓ Take abstract data (intervals, indices, keys)
2. ✓ Validate compatibility
3. ✓ Generate concrete note sequence
4. ✓ Map to fretboard positions
5. ✓ Display with timing
6. ✓ Track performance

**Key Advantages:**

- **Infinite variations** from finite data
- **Transposable** to all keys instantly
- **Reusable sequences** across shapes
- **Trackable performance** per shape/sequence/key combo
- **Storage efficient** - no pre-rendered data

**Remember:**

> The engine generates exercises **on-demand**. Never store the rendered output - always recompute from scale + sequence + key!

---

*See TECHNICAL_ARCHITECTURE.md for the full system overview*
