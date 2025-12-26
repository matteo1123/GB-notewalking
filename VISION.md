# TempoTrekker - The Ultimate Guitar Practice System

## 🎯 Vision Statement

**TempoTrekker is the intelligent practice companion that transforms how guitarists improve.** It eliminates the mental overhead of practice planning, automatically generates personalized daily sessions, tracks progress with precision, and ensures every minute of practice drives measurable progress toward your goals.

**Core Promise:** *"Pick up your guitar. Press Start. Practice efficiently. Never think about what to do."*

---

## 🌟 The Problem We Solve

Most guitarists struggle with:
- **Decision fatigue**: "What should I practice today?"
- **Inefficient time**: Practicing the wrong things or at the wrong time
- **Lack of structure**: No clear path from beginner to advanced
- **Forgotten skills**: Items learned months ago, now rusty
- **Goal confusion**: Multiple priorities, unclear how to balance them
- **Measurement gaps**: "Am I actually getting better?"

**TempoTrekker solves all of these.**

---

## 🏗️ System Architecture

### Three-Layer System

```
┌─────────────────────────────────────────────┐
│  1. USER LAYER - Practice Modules          │
│     Rhythm • Scales • Arpeggios • Ear      │
│     Training • Chord Changes • Repertoire  │
└─────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────┐
│  2. INTELLIGENCE LAYER - Smart System       │
│     • Priority Manager                      │
│     • Session Generator                     │
│     • Progress Tracker                      │
│     • Progression Algorithm                 │
│     • Spaced Repetition Engine              │
└─────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────┐
│  3. DATA LAYER - Supabase Backend           │
│     • User profiles & priorities            │
│     • Practice sessions & logs              │
│     • Exercise library & progress           │
│     • Auto-recorded performances            │
└─────────────────────────────────────────────┘
```

---

## 📚 Core Components

### 1. Practice Modules (The "What")

Six specialized practice modules, each with auto-recording:

#### 🥁 **Rhythm Training**
- **Purpose**: Master 16th note strumming patterns
- **Progression**: 50 levels from all-downstrokes to complex syncopation
- **Tracking**: Level reached, accuracy, patterns mastered
- **Time**: 5-20 minutes per session

#### 🎵 **Scale Practice**
- **Purpose**: Fretboard knowledge & muscle memory
- **Content**: Major, minor, modes, exotic scales
- **Progression**: Position by position, tempo increases
- **Tracking**: Max BPM per scale, positions mastered
- **Time**: 5-15 minutes per scale

#### 🎹 **Arpeggio Practice**
- **Purpose**: Chord tone visualization & sweep picking
- **Content**: Triads, 7th chords, extended arpeggios
- **Progression**: Shape memorization → tempo → clean technique
- **Tracking**: Shapes mastered, sweep picking fluency
- **Time**: 5-15 minutes per arpeggio

#### 🎤 **Notewalking (Ear Training)**
- **Purpose**: Hear chord changes, sing chord tones
- **Content**: Progressions in all keys (I-IV-V, ii-V-I, etc.)
- **Progression**: Simple progressions → complex changes → all keys
- **Tracking**: Keys mastered, accuracy, interval recognition
- **Time**: 10-20 minutes per session
- **Unique**: Uses pitch detection + auto-recording simultaneously

#### 🎼 **Chord Changes**
- **Purpose**: Smooth transitions & rhythm guitar mastery
- **Content**: Open chords → Barre chords → Jazz voicings
- **Progression**: Clean changes → tempo → musical application
- **Tracking**: Chord vocabulary, transition speed, clean changes
- **Time**: 10-15 minutes per session

#### 🎸 **Repertoire (Riff Practice)**
- **Purpose**: Learn songs & build playable repertoire
- **Content**: Riffs, solos, full songs
- **Progression**: Slow practice → tempo → performance ready
- **Tracking**: Riffs/songs learned, performance recordings
- **Time**: 10-30 minutes per piece

---

### 2. Priority System (The "Why")

Users set **flexible priorities** that drive daily practice:

#### Priority Types

**A. Module-Level Priority**
- *Definition*: "I want to improve in this entire category"
- *Example*: "Rhythm Guitar" with weight 8/10
- *Behavior*: System feeds you the next rhythm exercise in your progression
- *Use case*: General improvement, broad skill building

**B. Specific Goal Priority**
- *Definition*: "I want to master this exact thing"
- *Example*: "G Major Scale → 120 BPM" with weight 10/10
- *Behavior*: Always practices this specific exercise
- *Use case*: Targeted goals, audition prep, specific weakness

#### Priority Weighting (1-10)

```
Weight 10: Critical (e.g., "Sweep picking for my band")
Weight 7-9: High priority (e.g., "Rhythm - I'm a rhythm player")
Weight 4-6: Moderate (e.g., "Scales - want to improve")
Weight 1-3: Maintenance (e.g., "Keep ear training sharp")
```

**Time Allocation Formula:**
```
YourTime = (YourWeight / TotalWeight) × AvailablePracticeTime
```

**Example:**
- User has 30 minutes
- Priorities: Rhythm (8), Sweep (6), Scales (4), Ear (3)
- Total weight: 21
- Allocations:
  - Rhythm: 8/21 × 27min (90% of 30) = **10.3 min**
  - Sweep: 6/21 × 27min = **7.7 min**
  - Scales: 4/21 × 27min = **5.1 min**
  - Ear: 3/21 × 27min = **3.9 min**
  - Warm-up: **3 min** (10% reserved)

**Key Feature:** Every priority gets time in every session!

---

### 3. Session Generator (The "How")

#### Daily Practice Flow

```
User arrives → "Start Practice" → Select time → Auto-generates plan → Practice!
```

#### Smart Session Structure

**1. Warm-up (10% of time, 3-6 min)**
- Reviews recently mastered items (3-14 days ago)
- Spaced repetition built-in
- Priority-related material
- Gets fingers & mind ready

**2. Priority Blocks (80% of time)**
- Each priority gets proportional time
- Order randomized for variety
- Progress tracked per block
- Auto-recording when enabled

**3. Cool-down (10% of time, optional)**
- Fun riff or review
- Builds positive association
- Ends on high note

#### Time Scaling

**20-Minute Session:**
```
1. Warm-up: Quick review (2 min)
2. Priority A (8 min)
3. Priority B (5 min)
4. Priority C (3 min)
5. Priority D (2 min)
```

**60-Minute Session:**
```
1. Warm-up: Comprehensive review (6 min)
2. Priority A (24 min)
3. Review break (3 min)
4. Priority B (15 min)
5. Priority C (9 min)
6. Priority D (6 min)
7. Cool-down: Fun riff (3 min)
```

**Adapts perfectly to available time!**

---

### 4. Auto-Recording System

**Purpose:** Capture authentic practice for teacher review & self-assessment

#### Features
- **Random scheduling**: Records at unpredictable intervals (30-90 clicks into session)
- **Countdown display**: "Recording in 5 clicks..." (last 10 clicks)
- **30-second captures**: Enough to assess technique & progress
- **Automatic storage**: Saves to Supabase storage with session metadata
- **Mic stream cloning**: Enables simultaneous pitch detection + recording (for notewalking)

#### Implementation
- **Rhythm Training**: ✅ Integrated
- **Notewalking**: ✅ Integrated with mic cloning
- **Scales**: ✅ Ready to integrate
- **Arpeggios**: ✅ Ready to integrate
- **Chord Changes**: 🔄 Planned
- **Riffs**: ✅ Existing (needs standardization)

#### Storage Structure
```
Bucket: practice (private)
Path: {user_id}/{timestamp}-{moduleType}.webm
Database: practice_log table
  - Links to session_id
  - Includes module_type & module_config
  - Audio URL reference
```

---

### 5. Progress Tracking System

#### Mastery Model

**Mastery Level**: 0.0 to 1.0 for each exercise

**Calculation Factors:**
- Time practiced
- Performance metrics (BPM, accuracy, clean execution)
- Consistency (practiced recently vs long ago)
- Recording quality (if available)

**Mastery Thresholds:**
- **0.0 - 0.3**: Beginner (learning)
- **0.3 - 0.6**: Developing (can play with focus)
- **0.6 - 0.8**: Competent (reliable performance)
- **0.8 - 1.0**: Mastered (effortless, musical)

#### Graduation System

**Triggers:**
- Mastery level ≥ 0.8
- Target metrics met (if specific goal)
- Consistent performance over multiple sessions

**Actions:**
- Celebration notification 🎉
- Move to "mastered" list
- Reduce practice frequency (spaced repetition)
- Suggest next exercise in progression

**Example:**
```
"Congratulations! You've mastered G Major Scale @ 120 BPM!
Next up: D Major Scale"
```

---

### 6. Progression Algorithm

#### For Module-Level Priorities

**"What's next?" Logic:**

```typescript
function getNextExercise(userProfile, moduleType) {
  // 1. Get all exercises in this module
  const allExercises = getModuleExercises(moduleType);
  
  // 2. Filter to non-mastered (< 0.8 mastery)
  const unmastered = allExercises.filter(ex => 
    ex.mastery < 0.8
  );
  
  // 3. Filter by prerequisites met
  const ready = unmastered.filter(ex =>
    ex.prerequisites.every(prereq => 
      userProfile.mastered.includes(prereq)
    )
  );
  
  // 4. Sort by progression logic
  const sorted = ready.sort((a, b) => {
    // Prefer: least recently practiced
    const recencyA = daysSince(a.lastPracticed);
    const recencyB = daysSince(b.lastPracticed);
    if (recencyA !== recencyB) return recencyB - recencyA;
    
    // Then: lower difficulty first
    return a.difficulty - b.difficulty;
  });
  
  // 5. Return the "next" exercise
  return sorted[0];
}
```

**Progression Paths:**

**Scales:**
```
C Major Pos 1 → C Major Pos 2 → ... → C Major All Positions
→ G Major Pos 1 → ... (Circle of 5ths)
→ C Minor → G Minor → ...
→ C Dorian → C Phrygian → ... (Modes)
```

**Rhythm:**
```
Level 1 (All down) → Level 2 (1 skip) → ... → Level 10 (Complex syncopation)
→ Level 11 (Shuffle feel) → ... → Level 20 (Advanced jazz)
```

**Arpeggios:**
```
C Major Triad → C Major 7 → C Major 9
→ G Major Triad → ...
→ C Minor Triad → ...
→ Sweep picking technique → Advanced patterns
```

#### For Specific Goals

**Simple:** Always return the specific exercise until mastered.

**Example:**
- Goal: "G Major Scale @ 120 BPM"
- Current BPM: 85
- Practice: G Major Scale every session at increasing tempo
- When 120 achieved → graduation!

---

### 7. Spaced Repetition (Warm-up System)

**Ebbinghaus Forgetting Curve:** Skills decay without review

**TempoTrekker Solution:** Automatic review scheduling

#### Review Windows

```
Mastered item → Practice immediately after → 1 day → 3 days 
→ 7 days → 14 days → 30 days → ...
```

**Warm-up Selection:**
1. Get all mastered items (mastery ≥ 0.8)
2. Filter to review window (3-14 days since last practiced)
3. Prioritize items related to current priorities
4. Select 1-2 items
5. Practice for 30-90 seconds each

**Benefits:**
- Maintains skills long-term
- No manual tracking needed
- Prevents "I used to know this" moments
- Efficient use of warm-up time

---

## 🗄️ Database Schema

### Core Tables

#### `profiles` (Extended)
```sql
- id: UUID (auth.users reference)
- settings: JSONB
  - autoRecord: boolean
  - metronome_volume: number
  - preferred_session_length: number
- created_at: TIMESTAMPTZ
```

#### `user_priorities`
```sql
- id: UUID PRIMARY KEY
- user_id: UUID (references profiles)
- type: TEXT ('module' | 'specific')
- weight: INTEGER (1-10)
- module_type: TEXT (if module-level)
- exercise_id: UUID (if specific)
- target_metric: JSONB (for specific goals)
- last_practiced: TIMESTAMPTZ
- current_progress: JSONB
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ

Constraints:
- Either module_type OR exercise_id (not both)
- Unique per user+module or user+exercise
```

#### `practice_sessions`
```sql
- id: UUID PRIMARY KEY
- user_id: UUID
- lesson_id: UUID (optional, for teacher-assigned)
- routine_id: UUID (optional, for custom routines)
- started_at: TIMESTAMPTZ
- ended_at: TIMESTAMPTZ
- total_duration_seconds: INTEGER
- session_plan: JSONB (array of SessionBlock)
- completed: BOOLEAN
- created_at: TIMESTAMPTZ
```

#### `practice_log` (Polymorphic)
```sql
- id: UUID PRIMARY KEY
- user_id: UUID
- session_id: UUID (references practice_sessions)
- module_type: TEXT ('rhythm', 'scale', etc.)
- module_config: JSONB (module-specific settings)
- started_at: TIMESTAMPTZ
- duration_seconds: INTEGER
- performance_metrics: JSONB
  - max_bpm: INTEGER
  - accuracy: DECIMAL
  - level_reached: INTEGER
  - notes_correct: INTEGER
  - clean_transitions: INTEGER
- audio: TEXT (URL to recording)
- created_at: TIMESTAMPTZ
```

#### `user_exercise_mastery`
```sql
- id: UUID PRIMARY KEY
- user_id: UUID
- exercise_id: UUID (scale/arpeggio/riff)
- module_type: TEXT
- mastery_level: DECIMAL(3,2) (0.00-1.00)
- best_bpm: INTEGER
- last_practiced: TIMESTAMPTZ
- times_practiced: INTEGER
- best_recording_url: TEXT
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ

Unique: (user_id, exercise_id)
```

#### `lesson_progress` (Teacher-Student)
```sql
- id: UUID PRIMARY KEY
- user_id: UUID (student)
- lesson_id: UUID
- started_at: TIMESTAMPTZ
- completed_at: TIMESTAMPTZ
- current_metrics: JSONB
- goal_metrics: JSONB
- progress_percentage: DECIMAL(3,2)
- created_at: TIMESTAMPTZ
```

### Supporting Tables

- `scales` - Scale library
- `lessons` - Teacher-created lessons
- `lesson_exercises` - Exercises per lesson (polymorphic)
- `sequences` - Exercise sequences
- `chord_progressions` - Chord progression library
- `chord_progression_progress` - User progress on progressions

---

## 🎨 User Experience Flows

### First-Time User Setup

```
1. Sign up → Email verification
2. "Welcome! Let's set up your practice."
3. Priority Selection:
   - "What do you want to focus on?"
   - Slider UI for each module
   - Add specific goals
4. "When do you typically practice?"
   - Morning/afternoon/evening
   - Typical duration (20/30/45/60 min)
5. "Enable auto-recording for teacher review?"
   - Yes/No toggle
6. Done! → Dashboard
```

### Daily Practice (Core Flow)

```
1. Open app
2. Dashboard shows:
   - "Ready to practice?"
   - Last session: "2 days ago"
   - Streak: "5 days"
   - Today's suggestion: "30 minutes"
3. Click "Start Practice"
4. Select time (or use suggestion)
5. System generates session plan
6. Preview:
   - Warm-up: C Major Scale (3 min)
   - Rhythm Level 8 (10 min)
   - Sweep Picking Arpeggio (10 min)
   - G Major Goal (5 min)
   - Notewalking (2 min)
7. Click "Let's Go!"
8. Guided session:
   - Auto-loads each module
   - Timer shows progress
   - Auto-advances when time up
   - Auto-recording happens randomly
9. Session complete!
   - Summary screen
   - "Great work! Come back tomorrow."
   - Streak maintained ✅
```

### Teacher-Student Flow

```
Teacher:
1. Creates lesson
2. Adds exercises (scales, rhythms, etc.)
3. Sets goals & targets
4. Assigns to student
5. Views progress & recordings

Student:
1. Sees assigned lesson in dashboard
2. Practices lesson modules
3. Auto-recording captures performances
4. Progress tracked automatically
5. Teacher receives notification when milestone hit
```

---

## 🚀 Technical Implementation

### Tech Stack

**Frontend:**
- React + TypeScript
- Vite (build tool)
- TailwindCSS + shadcn/ui
- React Hook Form
- Zustand (state management)

**Backend:**
- Supabase (PostgreSQL + Auth + Storage)
- Row Level Security (RLS) for data isolation
- Real-time subscriptions (future feature)

**Audio:**
- Web Audio API
- MediaRecorder API
- Pitch detection (autocorrelation algorithm)
- MediaStream cloning (for dual mic use)

**Key Libraries:**
- `@supabase/supabase-js` - Backend client
- `lucide-react` - Icons
- `recharts` - Progress visualization
- Custom metronome hook
- Custom pitch detection hook
- Custom auto-recording hook

---

## 📈 Success Metrics

### User Metrics
- **Daily Active Users (DAU)**: Users who start a practice session
- **Session Completion Rate**: % of started sessions finished
- **Practice Streak**: Consecutive days practiced
- **Average Session Length**: Time spent per session
- **Priority Coverage**: % of priorities practiced per week

### Progress Metrics
- **Mastery Growth**: Avg mastery level increase per month
- **Exercises Mastered**: Count of items graduated
- **BPM Improvements**: Tempo increases on scales/exercises
- **Recording Quality**: Teacher-rated improvement

### Engagement Metrics
- **Weekly Active Users (WAU)**: Consistent practice
- **Retention**: 7-day, 30-day, 90-day retention rates
- **Teacher-Student Adoption**: % of lessons completed
- **Referrals**: Users who invite others

---

## 🎯 Roadmap

### Phase 1: Foundation ✅ **COMPLETE**
- [x] Database migrations (7 migrations)
- [x] Module standardization system
- [x] Auto-recording hook (with mic cloning)
- [x] Rhythm Training + auto-recording
- [x] Notewalking + auto-recording
- [x] Module Library UI (storefront)

### Phase 2: Intelligence System 🔄 **IN PROGRESS**
- [ ] Priority Manager UI
- [ ] user_priorities table
- [ ] Session Generator algorithm
- [ ] "Press Start" interface
- [ ] Next Exercise logic (progression algorithm)
- [ ] Warm-up selection system

### Phase 3: Progress & Analytics
- [ ] Mastery calculation
- [ ] user_exercise_mastery table
- [ ] Progress dashboard
- [ ] Charts & visualizations
- [ ] Graduation notifications
- [ ] Streak tracking

### Phase 4: Teacher Features
- [ ] Lesson builder (all module types)
- [ ] Student progress review
- [ ] Recording playback interface
- [ ] Assignment system
- [ ] Progress reports

### Phase 5: Advanced Features
- [ ] Custom routines (user-created)
- [ ] Social features (share progress)
- [ ] Achievements & badges
- [ ] Practice challenges
- [ ] AI-powered feedback (future)
- [ ] Mobile app (React Native)

---

## 💡 Design Principles

1. **Zero Friction**: The app should never be the obstacle. Practice should be easier than planning.

2. **Intelligent Defaults**: System should make smart decisions so users don't have to think.

3. **Flexibility Within Structure**: Rigid enough to drive progress, flexible enough to adapt to individual goals.

4. **Evidence-Based**: Every feature backed by learning science (spaced repetition, deliberate practice, feedback loops).

5. **Teacher-Friendly**: Empower teachers to guide students without manual tracking overhead.

6. **Musician-First**: Built by musicians, for musicians. UI/UX understands the practice experience.

7. **Progressive Disclosure**: Simple at first, deep features available when needed.

8. **Measurable Progress**: "Am I getting better?" should always have a clear answer.

---

## 🎸 Why TempoTrekker Will Revolutionize Practice

### Current State (Most Apps)
- Manual lesson planning
- Generic "exercise of the day"
- No personalization
- Progress tracking requires discipline
- Teachers assign worksheets, hope for the best

### TempoTrekker's Innovation
- **Personalized**: Your priorities drive everything
- **Automated**: Zero manual planning
- **Intelligent**: Knows what you need before you do
- **Efficient**: Every minute counts toward your goals
- **Accountable**: Auto-recording keeps you honest
- **Teacher-Integrated**: Lessons + auto-grading + progress reports

### The Result
**Musicians practice 3x more efficiently, progress 2x faster, and enjoy the journey.**

---

## 📞 Contact & Contribution

- **Project Lead**: Matteo
- **Version**: 2.0 (Intelligent Practice System)
- **Status**: Active Development
- **License**: Proprietary

---

## 🎵 Tagline

**"TempoTrekker: Your Daily Practice, Perfected."**

**Press Start. Practice Smart. Progress Fast.** 🚀
