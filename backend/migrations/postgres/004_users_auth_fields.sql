-- Add auth lock fields to users table (for login attempt tracking)
-- Run after 003_add_users_categories.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lock_until TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_lock_until ON users(lock_until) WHERE lock_until IS NOT NULL;
