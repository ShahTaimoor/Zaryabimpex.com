-- Migration to add image and location fields to attendance

ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS image_in VARCHAR(1000),
ADD COLUMN IF NOT EXISTS image_out VARCHAR(1000),
ADD COLUMN IF NOT EXISTS location_in JSONB,
ADD COLUMN IF NOT EXISTS location_out JSONB;
