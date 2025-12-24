# Chord Progressions Module - Design Doc

## Purpose
Teach students common chord progressions and smooth chord changes, starting from simple open chords to advanced jazz voicings.

## Difference from Notewalking
- **Notewalking**: Ear training - sing/play scale degrees over backing track
- **Chord Progressions**: Learn chord shapes, finger positions, and smooth transitions

## Learning Path

### Beginner (Levels 1-3)
**Open Chords**
- Basic major chords (C, G, D, A, E)
- Basic minor chords (Am, Em, Dm)
- Common progressions:
  - I-IV-V-I (e.g., C-F-G-C)
  - I-V-vi-IV (e.g., C-G-Am-F)
  - 12-bar blues in E, A
- Focus: Clean chord forms, smooth transitions at slow tempo

### Intermediate (Levels 4-6)
**Barre Chords + 7ths**
- Major/minor barre shapes (E and A forms)
- Dominant 7th chords (G7, D7, A7, E7)
- Minor 7th chords (Am7, Em7, Dm7)
- Progressions:
  - ii-V-I in major (Dm7-G7-Cmaj7)
  - 12-bar blues with 7ths
  - Jazz standards progressions
- Focus: Minimize finger movement, muting unwanted strings

### Advanced (Levels 7-10)
**Extensions, Substitutions, and Voicings**
- 9th, 11th, 13th chords
- Altered dominants (7#9, 7b9, 7#5)
- Drop 2 and Drop 3 voicings
- Chord melody concepts
- Progressions:
  - Jazz turnarounds
  - Modal progressions
  - Contemporary pop/R&B changes
- Focus: Voice leading, minimal hand movement

## UI Components

### Main View
```
┌─────────────────────────────────────────┐
│  Chord Progressions                     │
│  Level 3/10 - Beginner Open Chords      │
├─────────────────────────────────────────┤
│  Current Progression: I-IV-V-I in G     │
│  (G - C - D - G)                        │
├─────────────────────────────────────────┤
│  ┌───────┬───────┬───────┬───────┐      │
│  │   G   │   C   │   D   │   G   │      │
│  │ [TAB] │ [TAB] │ [TAB] │ [TAB] │      │
│  └───────┴───────┴───────┴───────┘      │
│                                          │
│  Current: G (1/4)                        │
│  ┌─────────────────────────────┐         │
│  │  [Detailed Chord Diagram]   │         │
│  │  Frets, Fingers, Notes      │         │
│  └─────────────────────────────┘         │
│                                          │
│  ⏱  BPM: 60  [- □ +]                     │
│  ▶ Play  ⏸ Pause  🔄 Restart             │
│                                          │
│  Progress: 45% mastery at 60 BPM        │
└─────────────────────────────────────────┘
```

### Features

#### 1. Progression Library
- Pre-loaded common progressions
- Organized by:
  - Genre (pop, rock, jazz, blues, country)
  - Difficulty (1-10)
  - Key (all 12 keys)
  - Chord types (open, barre, 7ths, extended)

#### 2. Practice Mode
- Metronome clicks per chord (1, 2, 4, 8 beats per chord)
- Loop mode with highlighting current chord
- Adjustable BPM (20-200)
- Auto-advance to next chord

#### 3. Chord Diagrams
- Interactive fretboard showing finger positions
- Multiple voicings for same chord
- Notes highlighted
- Finger numbers (1-4)
- Muted/open strings marked

#### 4. Smart Difficulty Progression
**Algorithm determines next lesson based on:**
- Smoothness of changes (tempo consistency)
- Clean chord tones (pitch detection on each string)
- Timing accuracy (metronome sync)

#### 5. Mastery Tracking
**Per Progression:**
- Current max BPM with clean changes
- Time practiced
- Last practice date
- Recordings (auto-capture smooth changes)

#### 6. Auto-Recording
- Randomly records during practice
- Captures 8-16 bars
- Saves best takes
- Teachers can review

## Database Schema

### New Table: `chord_progressions`
```sql
CREATE TABLE chord_progressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- "I-IV-V-I in C"
  progression TEXT NOT NULL, -- "I-IV-V-I"
  key TEXT NOT NULL, -- "C"
  genre TEXT, -- "pop", "jazz", "blues"
  difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 10),
  chords JSONB NOT NULL, -- Array of chord definitions
  measures_per_chord INTEGER DEFAULT 1,
  description TEXT,
  is_public BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**chords JSONB structure:**
```json
[
  {
    "numeral": "I",
    "name": "C",
    "voicing_type": "open",
    "frets": [null, 3, 2, 0, 1, 0], // Low to high strings
    "fingers": [null, 3, 2, 0, 1, 0],
    "notes": ["x", "C", "E", "G", "C", "E"]
  },
  {
    "numeral": "IV",
    "name": "F",
    "voicing_type": "open",
    "frets": [null, null, 3, 2, 1, 1],
    "fingers": [null, null, 3, 2, 1, 1],
    "notes": ["x", "x", "F", "A", "C", "F"]
  }
]
```

### New Table: `chord_progression_progress`
```sql
CREATE TABLE chord_progression_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  progression_id UUID NOT NULL REFERENCES chord_progressions(id),
  max_clean_bpm INTEGER DEFAULT 0,
  time_practiced_seconds INTEGER DEFAULT 0,
  last_practiced TIMESTAMPTZ,
  mastery_level DECIMAL(3,2), -- 0.00 to 1.00
  UNIQUE(user_id, progression_id)
);
```

## Implementation Tasks

### Phase 1: Data & Backend
- [ ] Create `chord_progressions` table
- [ ] Create `chord_progression_progress` table
- [ ] Seed database with ~50 common progressions
- [ ] Add RLS policies

### Phase 2: UI Components
- [ ] `ChordDiagram` component (fretboard visualization)
- [ ] `ProgressionDisplay` component (shows all chords)
- [ ] `ChordProgressionPractice` main component
- [ ] Add to Premium page as new tab

### Phase 3: Practice Logic
- [ ] Metronome integration (highlight current chord)
- [ ] Auto-advance chords based on timing
- [ ] Progress tracking (BPM, mastery)
- [ ] Auto-recording integration

### Phase 4: Teacher Features
- [ ] Create custom progressions UI
- [ ] Add to lesson builder
- [ ] Assign progressions to students

## Success Metrics
- Student can play progression at target BPM without looking
- Clean chord tones (detected via pitch detection)
- Smooth transitions (no rhythm hiccups detected by metronome)
- Time to mastery decreases with practice

## Future Enhancements
- Visual finger positioning animations
- Video tutorials per chord
- Community sharing of custom progressions
- Chord substitution suggestions
- "Learn this song" feature (matches progression to popular songs)
