# TempoTrekker Documentation Index

**Quick navigation to all project documentation**

---

## 📘 Main Documents

### [VISION.md](../VISION.md)
**The master document** - Complete system architecture, design philosophy, and roadmap
- Vision statement & problem definition
- System architecture (3 layers)
- All 6 practice modules detailed
- Priority system design
- Session generator algorithm
- Progress tracking & mastery model
- Database schema
- User experience flows
- Technical implementation
- Success metrics & roadmap

**READ THIS FIRST** for complete understanding of TempoTrekker.

### [TECHNICAL_ARCHITECTURE.md](./TECHNICAL_ARCHITECTURE.md) ⭐ **NEW**
**The technical bible** - Deep dive into how the system actually works
- Core concepts (Triadic Exercise Model)
- Exercise generation engine
- Data model & table relationships
- Module system architecture
- Progressive practice algorithm
- Type compatibility matrix
- Critical implementation notes

**READ THIS BEFORE MAKING CHANGES** to understand the generative system.

### [EXERCISE_ENGINE.md](./EXERCISE_ENGINE.md) ⭐ **NEW**
**The rendering pipeline** - How exercises are generated in real-time
- Scale shapes, sequences, and keys
- Step-by-step rendering process
- Type system deep dive
- Performance tracking
- Edge cases & gotchas
- UI integration examples

**READ THIS** to understand scale + sequence + key = exercise.

### [README.md](../README.md)
Quick start guide, tech stack, current status, and how to contribute

---

## 🔧 Technical Documentation

### Implementation Guides

#### [daily_practice_system.md](./daily_practice_system.md)
Priority-based practice session generation
- Priority types (module vs specific)
- Time-proportional allocation algorithm
- Warm-up selection logic
- User experience flows
- Database schema for priorities

#### [modular_practice_architecture.md](./modular_practice_architecture.md)
Module system design & storefront concept
- Practice module wrapper
- Module library UI
- Routine builder
- Dashboard design
- Implementation phases

#### [intelligent_curriculum_system.md](./intelligent_curriculum_system.md)
Curriculum paths & progression algorithms
- Rhythm focus path
- Improv focus path
- Concept hierarchy
- Next exercise logic
- Mastery calculation

#### [module_standardization_guide.md](./module_standardization_guide.md)
How to build/wrap practice modules
- PracticeModuleWrapper usage
- useModuleResults hook
- Module interface standards
- Integration examples

---

## 🎙️ Auto-Recording System

#### [auto_recording_complete.md](./auto_recording_complete.md)
Complete auto-recording implementation
- How it works
- Mic stream cloning
- Storage & database integration
- Module integration status

#### [auto_recording_guide.md](./auto_recording_guide.md)
Developer guide for using the auto-recording hook
- Hook API
- Usage examples
- Integration patterns
- All 3 modes (freeplay, routine, goal)

---

## 🗄️ Database

#### [database_analysis.md](./database_analysis.md)
Current database schema analysis & migration plan
- Table relationships
- Migration strategy
- Polymorphic tables

#### [migration_summary.md](./migration_summary.md)
All 7 migrations applied to production
- Migration descriptions
- Application order
- Next steps

#### Database Reference Files
- `database/table schema.csv` - All tables & columns
- `database/foreign keys.csv` - Relationships
- `database/storage buckets.csv` - Storage config
- `database/get_database_schema.sql` - Schema query

---

## 📊 Progress & Status

#### [implementation_progress.md](./implementation_progress.md)
Current implementation status
- ✅ Completed items
- 🔄 In progress
- 📋 Todo items
- Migration status

#### [implementation_plan_practice_system.md](./implementation_plan_practice_system.md)
Original practice system implementation plan
- Requirements
- Architecture
- Phased approach

#### [session_planner_complete.md](./session_planner_complete.md)
Session planning algorithm implementation
- Priority scoring
- Round-robin allocation
- Maintenance rotation
- Integration guide

---

## 🎼 Module-Specific

#### [chord_progressions_module.md](./chord_progressions_module.md)
Chord Progressions module design (planned)
- Module concept
- Progression library
- Practice interface

---

## 📁 File Organization

```
tempo-trekker/
├── VISION.md                    ← Master vision document
├── README.md                    ← Quick start
│
├── .ai/                         ← All documentation
│   ├── INDEX.md                 ← This file
│   │
│   ├── Core Design
│   │   ├── daily_practice_system.md
│   │   ├── modular_practice_architecture.md
│   │   └── intelligent_curriculum_system.md
│   │
│   ├── Implementation Guides
│   │   ├── module_standardization_guide.md
│   │   ├── auto_recording_guide.md
│   │   └── session_planner_complete.md
│   │
│   ├── Status & Progress
│   │   ├── implementation_progress.md
│   │   ├── implementation_plan_practice_system.md
│   │   └── auto_recording_complete.md
│   │
│   ├── Database
│   │   ├── database_analysis.md
│   │   ├── migration_summary.md
│   │   └── database/
│   │       ├── table schema.csv
│   │       ├── foreign keys.csv
│   │       └── storage buckets.csv
│   │
│   └── Module Designs
│       └── chord_progressions_module.md
│
├── src/                         ← Source code
└── supabase/migrations/         ← Database migrations (7 applied)
```

---

## 🎯 Quick References

### For New Developers
1. Read [VISION.md](../VISION.md) - Understand the big picture
2. Read [README.md](../README.md) - Set up your environment
3. Read [module_standardization_guide.md](./module_standardization_guide.md) - Learn module system
4. Read [implementation_progress.md](./implementation_progress.md) - See current status

### For Feature Development
1. **Adding a new module?** → [module_standardization_guide.md](./module_standardization_guide.md)
2. **Working on priorities?** → [daily_practice_system.md](./daily_practice_system.md)
3. **Building progression?** → [intelligent_curriculum_system.md](./intelligent_curriculum_system.md)
4. **Database changes?** → [database_analysis.md](./database_analysis.md)

### For Understanding Architecture
1. **System overview** → [VISION.md](../VISION.md) - Section "System Architecture"
2. **Module system** → [modular_practice_architecture.md](./modular_practice_architecture.md)
3. **Session generation** → [daily_practice_system.md](./daily_practice_system.md) - "Session Generation Algorithm"
4. **Auto-recording** → [auto_recording_complete.md](./auto_recording_complete.md)

---

## 🚀 Current Phase: Intelligence System

**Focus:** Building the priority-based practice planning system

**Active Documents:**
- [daily_practice_system.md](./daily_practice_system.md) - Primary design
- [intelligent_curriculum_system.md](./intelligent_curriculum_system.md) - Progression logic
- [implementation_progress.md](./implementation_progress.md) - Track progress

**Next Steps:**
1. Create `user_priorities` table
2. Build Priority Manager UI
3. Implement Session Generator
4. Deploy "Press Start" interface

---

## 📞 Contact

- **Project Lead**: Matteo
- **Status**: Active Development
- **Version**: 2.0 (Intelligent Practice System)

---

*Last Updated: December 25, 2024*
