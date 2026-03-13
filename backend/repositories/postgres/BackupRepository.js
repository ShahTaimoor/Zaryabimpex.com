const { query } = require('../../config/postgres');

class BackupRepository {
  async findById(id) {
    const result = await query('SELECT * FROM backups WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM backups WHERE 1=1';
    const params = [];
    let paramCount = 1;
    if (filters.status) { sql += ` AND status = $${paramCount++}`; params.push(filters.status); }
    if (filters.type) { sql += ` AND type = $${paramCount++}`; params.push(filters.type); }
    sql += ' ORDER BY created_at DESC';
    if (options.limit) { sql += ` LIMIT $${paramCount++}`; params.push(options.limit); }
    if (options.offset) { sql += ` OFFSET $${paramCount++}`; params.push(options.offset); }
    const result = await query(sql, params);
    return result.rows;
  }

  async findOne(filters = {}) {
    if (filters.backupId) {
      const result = await query('SELECT * FROM backups WHERE backup_id = $1 LIMIT 1', [filters.backupId]);
      return result.rows[0] || null;
    }
    if (filters.id || filters._id) return this.findById(filters.id || filters._id);
    return null;
  }

  async create(data) {
    const backupId = data.backupId || data.backup_id || `backup_${new Date().toISOString().replace(/[:.]/g, '-')}_${Math.random().toString(36).slice(2, 8)}`;
    const result = await query(
      `INSERT INTO backups (backup_id, type, schedule, status, database_info, collections, files, compression, encryption, metadata, retention, verification, triggered_by, trigger_reason, notifications, error_info, tags, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *`,
      [
        backupId, data.type, data.schedule, data.status || 'pending',
        data.database ? JSON.stringify(data.database) : '{}',
        data.collections ? JSON.stringify(data.collections) : '[]',
        data.files ? JSON.stringify(data.files) : '{}',
        data.compression ? JSON.stringify(data.compression) : '{}',
        data.encryption ? JSON.stringify(data.encryption) : '{}',
        data.metadata ? JSON.stringify(data.metadata) : '{}',
        data.retention ? JSON.stringify(data.retention) : '{}',
        data.verification ? JSON.stringify(data.verification) : '{}',
        data.triggeredBy || data.triggered_by || null,
        data.triggerReason || data.trigger_reason || null,
        data.notifications ? JSON.stringify(data.notifications) : '[]',
        data.error ? JSON.stringify(data.error) : null,
        data.tags || [],
        data.notes || null
      ]
    );
    return result.rows[0];
  }

  async updateById(id, data) {
    const updates = [];
    const params = [];
    let paramCount = 1;
    const map = { status: 'status', collections: 'collections', files: 'files', metadata: 'metadata', verification: 'verification', error_info: 'error_info', error: 'error_info', notifications: 'notifications', notes: 'notes' };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) {
        updates.push(`${col} = $${paramCount++}`);
        params.push(typeof data[k] === 'object' ? JSON.stringify(data[k]) : data[k]);
      }
    }
    if (updates.length === 0) return this.findById(id);
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    const result = await query(`UPDATE backups SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`, params);
    return result.rows[0] || null;
  }

  async updateByBackupId(backupId, data) {
    const row = await this.findOne({ backupId });
    if (!row) return null;
    return this.updateById(row.id, data);
  }

  async findInProgress(schedule, type) {
    let sql = "SELECT * FROM backups WHERE status = 'in_progress'";
    const params = [];
    let p = 1;
    if (schedule) { sql += ` AND schedule = $${p++}`; params.push(schedule); }
    if (type) { sql += ` AND type = $${p++}`; params.push(type); }
    sql += ' LIMIT 1';
    const result = await query(sql, params);
    return result.rows[0] || null;
  }

  async findRecentCompleted(schedule, type, since) {
    const result = await query(
      "SELECT * FROM backups WHERE status = 'completed' AND schedule = $1 AND type = $2 AND created_at >= $3 ORDER BY created_at DESC LIMIT 1",
      [schedule, type, since]
    );
    return result.rows[0] || null;
  }

  async getBackupStats(days = 30) {
    const result = await query(
      `SELECT status, COUNT(*) AS count FROM backups WHERE created_at >= CURRENT_DATE - $1::int * INTERVAL '1 day' GROUP BY status`,
      [days]
    );
    const byStatus = {};
    let total = 0;
    for (const row of result.rows) {
      byStatus[row.status] = parseInt(row.count, 10);
      total += parseInt(row.count, 10);
    }
    return { total, byStatus };
  }

  async cleanupOldBackups(retentionDays = 90) {
    const result = await query(
      'DELETE FROM backups WHERE created_at < CURRENT_DATE - $1::int * INTERVAL \'1 day\' RETURNING id',
      [retentionDays]
    );
    return result.rowCount || 0;
  }

  async getFailedBackupsForRetry(limit = 10) {
    const result = await query(
      `SELECT * FROM backups WHERE status = 'failed' AND error_info->>'retryable' = 'true' ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows;
  }
}

module.exports = new BackupRepository();
