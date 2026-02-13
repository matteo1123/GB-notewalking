-- Seed Initial Curriculum Concepts

INSERT INTO curriculum_concepts (id, module_type, level, name, description, paths, requires, practice_config, mastery_criteria)
VALUES
  -- Rhythm Path
  (
    'rhythm-level-1',
    'rhythm',
    1,
    'All Downstrokes',
    'Master steady downstrokes on the beat.',
    '{"rhythm": 10, "improv": 3, "technique": 5}'::jsonb,
    '{}',
    '{"rhythm_level": 0}'::jsonb, -- Assuming level 0 corresponds to basic downstrokes in logic
    '{"min_accuracy": 0.8, "min_practice_time": 300}'::jsonb
  ),
  (
    'rhythm-level-2',
    'rhythm',
    2,
    'First Skip Pattern',
    'Introduction to syncopation with note skips.',
    '{"rhythm": 10, "improv": 3, "technique": 5}'::jsonb,
    '{rhythm-level-1}',
    '{"rhythm_level": 1}'::jsonb,
    '{"min_accuracy": 0.8, "min_practice_time": 600}'::jsonb
  ),
  (
    'rhythm-level-3',
    'rhythm',
    3,
    'Basic Upstrokes',
    'incorporating upstrokes into your strumming.',
    '{"rhythm": 10, "improv": 4, "technique": 6}'::jsonb,
    '{rhythm-level-2}',
    '{"rhythm_level": 2}'::jsonb,
    '{"min_accuracy": 0.85}'::jsonb
  ),

  -- Chord Path (Repertoire/Technique)
  (
    'chords-open-i-iv-v-c',
    'chord_progressions',
    1,
    'Open I-IV-V in C',
    'The most fundamental chord progression in key of C.',
    '{"rhythm": 8, "repertoire": 10, "improv": 5}'::jsonb,
    '{}', -- No prereqs
    -- config needs to match ChordProgressionsModuleConfig
    '{"key": "C", "progression_id": "i-iv-v-open-c"}'::jsonb, 
    '{"min_bpm": 60}'::jsonb
  ),
  (
    'chords-barre-f-major',
    'chord_progressions',
    3,
    'F Major Barre Chord',
    'The first major hurdle: mastering the F barre chord.',
    '{"rhythm": 7, "technique": 10, "repertoire": 8}'::jsonb,
    '{chords-open-i-iv-v-c}',
    -- Assuming a progression exists that focuses on F major transitions
    '{"key": "C", "progression_id": "f-major-barre-drill"}'::jsonb,
    '{"min_bpm": 80}'::jsonb
  ),
  
  -- Scale Path (Improv)
  (
    'scale-c-major-pos1',
    'scale',
    1,
    'C Major Scale - Position 1',
    'The foundation of western music theory and improvisation.',
    '{"improv": 10, "technique": 8, "repertoire": 5}'::jsonb,
    '{}',
    -- config needs to match ScaleModuleConfig. We need real IDs usually, but for seed we use placeholders
    -- In a real app we'd query IDs, but here we assumeto existing or insert them.
    -- For now using empty ID placeholders which might need fixing if strict FKs exist elsewhere
    '{"scale_id": "scale_c_major", "shape_id": "shape_pos1"}'::jsonb, 
    '{"min_bpm": 60}'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  paths = EXCLUDED.paths,
  practice_config = EXCLUDED.practice_config,
  requires = EXCLUDED.requires;
