-- Audit log table for Group B audit services (replaces Mongoose AuditLog)
-- entity_id/document_id/user_id as VARCHAR to accept both UUID and legacy ObjectId string
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    action VARCHAR(50) NOT NULL,
    document_type VARCHAR(50),
    document_id VARCHAR(64),
    old_value JSONB,
    new_value JSONB,
    request_method VARCHAR(20),
    request_path VARCHAR(500),
    request_body JSONB,
    response_status INT,
    duration INT,
    approval_required BOOLEAN DEFAULT FALSE,
    approved_by VARCHAR(64),
    description TEXT,
    changes JSONB DEFAULT '{}',
    user_id VARCHAR(64),
    ip_address VARCHAR(45),
    user_agent TEXT,
    reason VARCHAR(500),
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
