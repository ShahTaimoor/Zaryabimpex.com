-- Allow returns.reference_id to store both UUID and Mongo ObjectId string
-- Run after 001 (returns table exists)

ALTER TABLE returns
  ALTER COLUMN reference_id TYPE VARCHAR(100) USING reference_id::text;
