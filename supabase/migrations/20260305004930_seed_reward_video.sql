-- Insert a sample reward video that users can unlock at Level 5 or for 30 Points

INSERT INTO videos (title, description, url, unlock_cost, prerequisite_level)
VALUES (
  'Mastering the Hendrix Thumb Wrap',
  'Learn the secret to playing chords like Jimi Hendrix using your thumb on the low E string.',
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ', -- Placeholder URL for testing
  30, 
  5
);
