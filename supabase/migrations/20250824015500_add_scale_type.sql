CREATE TYPE scale_type AS ENUM (
    '2 notes per string scale',
    '3 notes per string scale',
    '4 notes per string scale',
    'chord',
    'arpeggio'
);

ALTER TABLE scales
ADD COLUMN "Type" scale_type;