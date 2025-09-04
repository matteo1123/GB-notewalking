-- Rename scale_shape_id to scale_shape and add foreign key constraint
ALTER TABLE scales RENAME COLUMN scale_shape_id TO scale_shape;
ALTER TABLE scales ADD CONSTRAINT scales_scale_shape_fkey FOREIGN KEY (scale_shape) REFERENCES scale_shapes(id);