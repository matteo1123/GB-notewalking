-- Step 1: Create the scale_shapes Table
CREATE TABLE scale_shapes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    intervals INT[],
    shape_json JSONB NOT NULL
);

-- Step 2: Create the '3 Notes Per String' Shape Record
INSERT INTO scale_shapes (name, intervals, shape_json)
VALUES (
    'Minor Pentatonic (3 Notes Per String, Position 1)',
    ARRAY[0, 3, 5, 7, 10],
    '[
      {"string": 6, "fret_offset": 0},
      {"string": 6, "fret_offset": 2},
      {"string": 6, "fret_offset": 3},
      {"string": 5, "fret_offset": 0},
      {"string": 5, "fret_offset": 2},
      {"string": 5, "fret_offset": 3},
      {"string": 4, "fret_offset": 0},
      {"string": 4, "fret_offset": 2},
      {"string": 4, "fret_offset": 4},
      {"string": 3, "fret_offset": 0},
      {"string": 3, "fret_offset": 2},
      {"string": 3, "fret_offset": 4},
      {"string": 2, "fret_offset": 1},
      {"string": 2, "fret_offset": 3},
      {"string": 2, "fret_offset": 5},
      {"string": 1, "fret_offset": 2},
      {"string": 1, "fret_offset": 3},
      {"string": 1, "fret_offset": 5}
    ]'::JSONB
);

-- Step 3: Generate and Insert the Concrete Scale
DO $$
DECLARE
    shape_data JSONB;
    root_fret INT := 5;
    new_notes_json JSONB;
    legacy_user_id UUID;
BEGIN
    -- Fetch the Blueprint
    SELECT shape_json INTO shape_data
    FROM scale_shapes
    WHERE name = 'Minor Pentatonic (3 Notes Per String, Position 1)';

    -- Calculate the Absolute Frets
    SELECT jsonb_agg(
        jsonb_build_object(
            'fret', (elem->>'fret_offset')::INT + root_fret,
            'string', elem->'string'
        )
    )
    INTO new_notes_json
    FROM jsonb_array_elements(shape_data) AS elem;

    -- Get the created_by from the legacy table to associate the new scale
    SELECT created_by INTO legacy_user_id
    FROM legacy_exercises
    WHERE name = 'A Minor 5th fret 3 notes per string'
    LIMIT 1;

    -- Insert the Final Record into scales
    INSERT INTO scales (name, tonic, tonality, "position", difficulty, is_public, created_by, notes_json)
    VALUES (
        'A Minor Pentatonic - Position 1',
        'A',
        'Minor',
        1,
        3,
        true,
        legacy_user_id,
        new_notes_json
    );
END $$;