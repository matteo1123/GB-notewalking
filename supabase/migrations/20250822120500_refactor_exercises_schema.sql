-- Step 1: Create the scales Table
CREATE TABLE scales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    tonic TEXT,
    tonality TEXT,
    "position" INT,
    difficulty INT,
    notes_json JSONB NOT NULL,
    is_public BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Step 2: Create the sequences Table
CREATE TABLE sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    pattern_string TEXT NOT NULL,
    repetition_style TEXT NOT NULL CHECK (repetition_style IN ('DIATONIC_SHIFT', 'STRING_BASED_SHIFT'))
);

-- Step 3: Parse and Insert the Scale Data
DO $$
DECLARE
    original_exercise RECORD;
    notes_array JSONB;
    clean_notes_array JSONB;
BEGIN
    -- Retrieve the Row
    SELECT * INTO original_exercise
    FROM exercises
    WHERE name = 'A Minor 5th fret 3 notes per string'
    LIMIT 1;

    -- Generate the notes_json Value
    -- a. Take the value from the notes column of the original row. This is a JSON string. Parse it into an array of objects.
    notes_array := original_exercise.notes::JSONB;

    -- b. From the resulting array, take only the first 18 objects.
    -- c. Create a new array by mapping over these 18 objects, containing only fret and string.
    SELECT jsonb_agg(jsonb_build_object('fret', elem->'fret', 'string', elem->'string'))
    INTO clean_notes_array
    FROM (
        SELECT value AS elem
        FROM jsonb_array_elements(notes_array)
        WITH ORDINALITY arr(value, rn)
        WHERE rn <= 18
    ) sub;

    -- Insert into scales
    INSERT INTO scales (name, tonic, tonality, "position", difficulty, is_public, created_by, notes_json)
    VALUES (
        'A Minor Pentatonic - Position 1',
        'A',
        'Minor',
        1,
        3,
        true,
        original_exercise.created_by,
        clean_notes_array
    );
END $$;

-- Step 4: Insert the Default Sequence
INSERT INTO sequences (name, pattern_string, repetition_style)
VALUES ('Simple Ascend/Descend', '1', 'DIATONIC_SHIFT');

-- Step 5: Rename the Old Table
ALTER TABLE exercises RENAME TO legacy_exercises;

-- Step 6: Create the New exercises Table
CREATE TABLE exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    scale_id UUID NOT NULL REFERENCES scales(id),
    sequence_id UUID NOT NULL REFERENCES sequences(id),
    name TEXT,
    bpm INT DEFAULT 120,
    rhythm_value DECIMAL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);