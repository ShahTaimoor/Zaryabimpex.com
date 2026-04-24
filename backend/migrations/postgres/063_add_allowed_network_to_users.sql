-- Migration: Add allowed_network to users table
-- Description: Adds a column to store CIDR notation for restricted login

ALTER TABLE users ADD COLUMN IF NOT EXISTS allowed_network VARCHAR(255) DEFAULT NULL;

COMMENT ON COLUMN users.allowed_network IS 'Optional CIDR range (e.g. 192.168.1.0/24) to restrict employee login access.';
