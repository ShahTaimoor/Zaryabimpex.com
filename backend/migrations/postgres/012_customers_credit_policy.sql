-- Optional columns for customer credit policy / suspension (customerCreditPolicyService)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive'));
ALTER TABLE customers ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS suspended_by UUID;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_policy JSONB DEFAULT '{}';
