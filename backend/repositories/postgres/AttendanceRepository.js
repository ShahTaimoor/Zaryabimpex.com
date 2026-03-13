const { query } = require('../../config/postgres');

class AttendanceRepository {
  async findById(id) {
    const result = await query(
      'SELECT * FROM attendance WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM attendance WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filters.employeeId || filters.employee) {
      sql += ` AND employee_id = $${paramCount++}`;
      params.push(filters.employeeId || filters.employee);
    }
    if (filters.userId || filters.user) {
      sql += ` AND user_id = $${paramCount++}`;
      params.push(filters.userId || filters.user);
    }
    if (filters.status) {
      sql += ` AND status = $${paramCount++}`;
      params.push(filters.status);
    }

    sql += ' ORDER BY created_at DESC';
    if (options.limit) {
      sql += ` LIMIT $${paramCount++}`;
      params.push(options.limit);
    }
    if (options.offset) {
      sql += ` OFFSET $${paramCount++}`;
      params.push(options.offset);
    }

    const result = await query(sql, params);
    return result.rows;
  }

  async findOne(filters = {}) {
    let sql = 'SELECT * FROM attendance WHERE 1=1';
    const params = [];
    let paramCount = 1;
    if (filters.employeeId || filters.employee) {
      sql += ` AND employee_id = $${paramCount++}`;
      params.push(filters.employeeId || filters.employee);
    }
    if (filters.status) {
      sql += ` AND status = $${paramCount++}`;
      params.push(filters.status);
    }
    sql += ' LIMIT 1';
    const result = await query(sql, params);
    return result.rows[0] || null;
  }

  async findByEmployee(employeeId, options = {}) {
    return this.findAll({ employeeId, employee: employeeId }, options);
  }

  async findOpenSession(employeeId, options = {}) {
    return this.findOne({ employeeId: employeeId || undefined, employee: employeeId, status: 'open' });
  }

  async findWithPagination(filter = {}, options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;
    const getAll = options.getAll === true;

    let countSql = 'SELECT COUNT(*) FROM attendance WHERE 1=1';
    const countParams = [];
    let paramCount = 1;
    if (filter.employeeId || filter.employee) {
      countSql += ` AND employee_id = $${paramCount++}`;
      countParams.push(filter.employeeId || filter.employee);
    }
    if (filter.status) {
      countSql += ` AND status = $${paramCount++}`;
      countParams.push(filter.status);
    }
    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count, 10);

    const attendances = await this.findAll(filter, {
      limit: getAll ? total : limit,
      offset: getAll ? 0 : offset
    });

    return {
      attendances,
      total,
      pagination: getAll
        ? { current: 1, pages: 1, total, hasNext: false, hasPrev: false }
        : { current: page, pages: Math.ceil(total / limit), total, hasNext: page < Math.ceil(total / limit), hasPrev: page > 1 }
    };
  }

  async create(data) {
    const result = await query(
      `INSERT INTO attendance (employee_id, user_id, store_id, device_id, clocked_in_by, clock_in_at, clock_out_at, total_minutes, breaks, status, notes_in, notes_out, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        data.employee || data.employeeId,
        data.user || data.userId || null,
        data.storeId || data.store_id || null,
        data.deviceId || data.device_id || null,
        data.clockedInBy || data.clocked_in_by || null,
        data.clockInAt || data.clock_in_at || new Date(),
        data.clockOutAt || data.clock_out_at || null,
        data.totalMinutes ?? data.total_minutes ?? 0,
        data.breaks ? JSON.stringify(data.breaks) : '[]',
        data.status || 'open',
        data.notesIn || data.notes_in || '',
        data.notesOut || data.notes_out || ''
      ]
    );
    return result.rows[0];
  }

  async updateById(id, data) {
    const updates = [];
    const params = [];
    let paramCount = 1;
    const map = {
      clockOutAt: 'clock_out_at', totalMinutes: 'total_minutes', breaks: 'breaks',
      status: 'status', notesIn: 'notes_in', notesOut: 'notes_out'
    };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) {
        updates.push(`${col} = $${paramCount++}`);
        params.push(col === 'breaks' && typeof data[k] === 'object' ? JSON.stringify(data[k]) : data[k]);
      }
    }
    if (updates.length === 0) return this.findById(id);
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    const result = await query(
      `UPDATE attendance SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  /** Close an open session (clock out). Returns updated row or null. */
  async closeSession(id, notesOut) {
    const row = await this.findById(id);
    if (!row || row.status !== 'open') return null;
    let breaks = Array.isArray(row.breaks) ? row.breaks : (typeof row.breaks === 'string' ? JSON.parse(row.breaks || '[]') : []);
    const active = breaks.find(b => !b.endedAt);
    if (active) {
      active.endedAt = new Date();
      const ms = (new Date(active.endedAt)) - new Date(active.startedAt);
      active.durationMinutes = Math.max(0, Math.round(ms / 60000));
    }
    const clockOutAt = new Date();
    const clockInAt = new Date(row.clock_in_at);
    const workedMs = clockOutAt - clockInAt;
    const totalBreakMinutes = breaks.reduce((s, b) => s + (b.durationMinutes || 0), 0);
    const totalMinutes = Math.max(0, Math.round(workedMs / 60000) - totalBreakMinutes);
    return this.updateById(id, {
      clockOutAt,
      totalMinutes,
      breaks,
      status: 'closed',
      notesOut: notesOut || row.notes_out || ''
    });
  }

  /** Start a break. Returns updated row or null if not allowed. */
  async startBreak(id, type = 'break') {
    const row = await this.findById(id);
    if (!row || row.status !== 'open') return null;
    let breaks = Array.isArray(row.breaks) ? row.breaks : (typeof row.breaks === 'string' ? JSON.parse(row.breaks || '[]') : []);
    if (breaks.some(b => !b.endedAt)) return null;
    breaks.push({ type, startedAt: new Date() });
    return this.updateById(id, { breaks });
  }

  /** End current break. Returns updated row or null. */
  async endBreak(id) {
    const row = await this.findById(id);
    if (!row) return null;
    let breaks = Array.isArray(row.breaks) ? row.breaks : (typeof row.breaks === 'string' ? JSON.parse(row.breaks || '[]') : []);
    const active = breaks.find(b => !b.endedAt);
    if (!active) return null;
    active.endedAt = new Date();
    const ms = (new Date(active.endedAt)) - new Date(active.startedAt);
    active.durationMinutes = Math.max(0, Math.round(ms / 60000));
    return this.updateById(id, { breaks });
  }

  /** Get employee id for populate-style response (join). */
  async findByIdWithEmployee(id) {
    const result = await query(
      `SELECT a.*, e.first_name AS emp_first_name, e.last_name AS emp_last_name, e.employee_id AS emp_employee_id
       FROM attendance a
       LEFT JOIN employees e ON e.id = a.employee_id
       WHERE a.id = $1`,
      [id]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      ...row,
      employee: row.employee_id ? {
        firstName: row.emp_first_name,
        lastName: row.emp_last_name,
        employeeId: row.emp_employee_id
      } : null
    };
  }
}

module.exports = new AttendanceRepository();
