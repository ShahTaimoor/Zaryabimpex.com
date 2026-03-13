const { query } = require('../../config/postgres');

/** Normalize id from Mongoose (_id) or Postgres (id) to string for storage */
function toId(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (value && typeof value.toString === 'function') return value.toString();
  return String(value);
}

class AuditLogRepository {
  async create(data) {
    const result = await query(
      `INSERT INTO audit_logs (
        entity_type, entity_id, action, document_type, document_id,
        old_value, new_value, request_method, request_path, request_body,
        response_status, duration, approval_required, approved_by, description,
        changes, user_id, ip_address, user_agent, reason, metadata, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING *`,
      [
        data.entityType || data.entity_type,
        data.entityId ?? data.entity_id,
        data.action,
        data.documentType ?? data.document_type ?? null,
        toId(data.documentId ?? data.document_id),
        data.oldValue != null ? JSON.stringify(data.oldValue) : null,
        data.newValue != null ? JSON.stringify(data.newValue) : null,
        data.requestMethod ?? data.request_method ?? null,
        data.requestPath ?? data.request_path ?? null,
        data.requestBody != null ? JSON.stringify(data.requestBody) : null,
        data.responseStatus ?? data.response_status ?? null,
        data.duration ?? null,
        data.approvalRequired === true,
        toId(data.approvedBy ?? data.approved_by),
        data.description ?? null,
        data.changes != null ? JSON.stringify(data.changes) : '{}',
        toId(data.user ?? data.userId ?? data.user_id),
        data.ipAddress ?? data.ip_address ?? null,
        data.userAgent ?? data.user_agent ?? null,
        data.reason ?? null,
        data.metadata != null ? JSON.stringify(data.metadata) : '{}',
        data.timestamp || new Date()
      ]
    );
    return result.rows[0];
  }

  async find(filters = {}, options = {}) {
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filters.entityType != null) {
      sql += ` AND entity_type = $${paramCount++}`;
      params.push(filters.entityType);
    }
    if (filters.entityId != null) {
      sql += ` AND entity_id = $${paramCount++}`;
      params.push(filters.entityId);
    }
    if (filters.action != null) {
      sql += ` AND action = $${paramCount++}`;
      params.push(filters.action);
    }
    if (filters.userId != null || filters.user != null) {
      sql += ` AND user_id = $${paramCount++}`;
      params.push(filters.userId ?? filters.user);
    }
    if (filters.documentType != null) {
      sql += ` AND document_type = $${paramCount++}`;
      params.push(filters.documentType);
    }
    if (filters.documentId != null) {
      sql += ` AND document_id = $${paramCount++}`;
      params.push(filters.documentId);
    }
    if (filters.startDate != null || (filters.timestamp && filters.timestamp.$gte)) {
      sql += ` AND timestamp >= $${paramCount++}`;
      params.push(filters.startDate ?? filters.timestamp?.$gte);
    }
    if (filters.endDate != null || (filters.timestamp && filters.timestamp.$lte)) {
      sql += ` AND timestamp <= $${paramCount++}`;
      params.push(filters.endDate ?? filters.timestamp?.$lte);
    }

    sql += ' ORDER BY timestamp DESC';
    const limit = options.limit ?? 50;
    const offset = options.skip ?? options.offset ?? 0;
    sql += ` LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(limit, offset);

    const result = await query(sql, params);
    return result.rows;
  }
}

module.exports = new AuditLogRepository();
