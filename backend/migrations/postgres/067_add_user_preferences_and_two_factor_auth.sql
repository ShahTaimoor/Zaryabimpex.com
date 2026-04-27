-- Add user preferences and two-factor auth support
-- Run after existing auth/user migrations

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS two_factor_code_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS two_factor_expires_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_two_factor_expires_at
  ON users(two_factor_expires_at)
  WHERE two_factor_expires_at IS NOT NULL;
