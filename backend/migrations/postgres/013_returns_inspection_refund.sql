-- Optional columns for return inspection and refund details (returnManagementService)
ALTER TABLE returns ADD COLUMN IF NOT EXISTS inspection JSONB DEFAULT NULL;
ALTER TABLE returns ADD COLUMN IF NOT EXISTS refund_details JSONB DEFAULT NULL;
