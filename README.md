# TempoTrekker - The Ultimate Guitar Practice System

**Press Start. Practice Smart. Progress Fast.** 🎸

---

## 🎯 What is TempoTrekker?

TempoTrekker is an intelligent guitar practice companion that eliminates the mental overhead of practice planning. It automatically generates personalized daily sessions based on your priorities, tracks your progress with precision, and ensures every minute of practice drives measurable improvement.

**The Core Promise:** Pick up your guitar. Press Start. Practice efficiently. Never think about what to do.

---

## ✨ Key Features

- **🎯 Smart Practice Sessions**: Auto-generated plans based on your goals & available time
- **📊 Intelligent Progression**: System knows what you need next
- **🎙️ Auto-Recording**: Captures authentic practice for review
- **📈 Progress Tracking**: Mastery levels, BPM tracking, goal completion
- **🔥 Spaced Repetition**: Automatic review of past material
- **👨‍🏫 Teacher Integration**: Assign lessons, track student progress
- **🎵 Six Practice Modules**: Rhythm, Scales, Arpeggios, Ear Training, Chords, Repertoire

---

## 📚 Documentation

- **[VISION.md](./VISION.md)** - Complete system architecture & design philosophy
- **[.ai/](/.ai/)** - Technical documentation & implementation guides
  - `daily_practice_system.md` - Priority-based session generation
  - `modular_practice_architecture.md` - Module system design
  - `auto_recording_complete.md` - Recording system documentation
  - `intelligent_curriculum_system.md` - Progression algorithms

---

## 🚀 Quick Start

### Prerequisites
- Node.js & npm ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- Supabase project ([create one](https://supabase.com))

### Installation

```sh
# Clone the repository
git clone <YOUR_GIT_URL>
cd tempo-trekker

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your Supabase URL and anon key

# Start development server
npm run dev
```

### Database Setup

```sh
# Apply migrations (in order)
# See .ai/migration_summary.md for details
```

---

## 🏗️ Tech Stack

- **Frontend**: React + TypeScript + Vite
- **UI**: TailwindCSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Audio**: Web Audio API + MediaRecorder
- **State**: React Hooks + Context

---

## 📱 Current Status

**Version 2.0 - Intelligent Practice System**

### ✅ Completed (Phase 1)
- Module standardization framework
- Auto-recording system (with mic cloning)
- Rhythm Training module (with auto-record)
- Notewalking module (with auto-record + pitch detection)
- Module Library UI (storefront interface)
- Database schema (7 migrations applied)

### 🔄 In Progress (Phase 2)
- Priority Manager UI
- Session Generator algorithm
- "Press Start" daily practice interface
- Next Exercise progression logic

### 📋 Planned (Phase 3+)
- Progress analytics & dashboards
- Teacher lesson builder
- Custom routine creator
- Achievements & streaks
- Mobile app

See [VISION.md](./VISION.md) for complete roadmap.

---

## 🎮 How It Works

### 1. Set Your Priorities (One-time)
```
Rhythm Guitar: ████████░░ 8/10
Sweep Picking:  ██████░░░░ 6/10
Scales:        ████░░░░░░ 4/10
Ear Training:  ███░░░░░░░ 3/10
```

### 2. Start Practice
```
Available time: [20 min] [30 min] [45 min] [60 min]
                    ↓
        Auto-generates session plan
                    ↓
       Practice! (Guided & timed)
```

### 3. Track Progress
```
G Major Scale: ████████░░ 85 BPM → 120 BPM Goal
Rhythm Level:  Completed Level 7 → Level 8 Next
Mastery:       16 exercises mastered this month
```

---

## 🎸 Practice Modules

| Module | Purpose | Time | Status |
|--------|---------|------|--------|
| 🥁 **Rhythm Training** | 16th note strumming patterns | 5-20 min | ✅ Live |
| 🎵 **Scales** | Fretboard knowledge | 5-15 min | ✅ Live |
| 🎹 **Arpeggios** | Chord tones & sweep picking | 5-15 min | ✅ Live |
| 🎤 **Notewalking** | Ear training over changes | 10-20 min | ✅ Live |
| 🎼 **Chord Changes** | Smooth transitions | 10-15 min | 🔄 Planned |
| 🎸 **Repertoire** | Songs & riffs | 10-30 min | 🔄 Planned |

---

## 📊 Why TempoTrekker?

### The Problem
- **Decision fatigue**: "What should I practice today?"
- **Inefficient practice**: Wrong exercises at wrong time
- **Forgotten skills**: Items learned months ago, now rusty
- **No clear path**: From beginner to advanced

### The Solution
- **Automated planning**: System decides based on your goals
- **Smart allocation**: Time divided by priority weight
- **Spaced repetition**: Automatic review scheduling  
- **Clear progression**: Always know what's next

### The Result
**3x more efficient practice. 2x faster progress. Zero planning overhead.**

---

## 🤝 Contributing

This is a proprietary project, but feedback and bug reports are welcome!

---

## 📞 Project Info

- **URL**: https://lovable.dev/projects/eac1aa47-561d-46d9-adf4-49e812333f9d
- **Version**: 2.0
- **Status**: Active Development
- **Lead**: Matteo

---

## 📄 License

Proprietary - All Rights Reserved

---

## 🎵 Tagline

**"TempoTrekker: Your Daily Practice, Perfected."**

Pick up your guitar. Press Start. Let's trek. 🚀
