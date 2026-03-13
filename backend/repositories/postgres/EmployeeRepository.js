const { query } = require('../../config/postgres');

class EmployeeRepository {
  async findById(id) {
    const result = await query(
      'SELECT * FROM employees WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    return result.rows[0] || null;
  }

  async findOne(filters = {}) {
    let sql = 'SELECT * FROM employees WHERE deleted_at IS NULL';
    const params = [];
    let paramCount = 1;
    if (filters.employeeId) {
      sql += ` AND employee_id = $${paramCount++}`;
      params.push(String(filters.employeeId).toUpperCase());
    }
    if (filters.email) {
      sql += ` AND LOWER(email) = LOWER($${paramCount++})`;
      params.push(String(filters.email).trim());
    }
    if (filters.userAccount) {
      sql += ` AND user_account = $${paramCount++}`;
      params.push(filters.userAccount);
    }
    sql += ' LIMIT 1';
    const result = await query(sql, params);
    return result.rows[0] || null;
  }

  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM employees WHERE deleted_at IS NULL';
    const params = [];
    let paramCount = 1;

    if (filters.status) {
      sql += ` AND status = $${paramCount++}`;
      params.push(filters.status);
    }
    if (filters.department) {
      sql += ` AND department = $${paramCount++}`;
      params.push(filters.department);
    }
    if (filters.position) {
      sql += ` AND position = $${paramCount++}`;
      params.push(filters.position);
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

  async findByEmployeeId(employeeId, options = {}) {
    return this.findOne({ employeeId: (employeeId || '').toUpperCase() });
  }

  async findByEmail(email, options = {}) {
    return this.findOne({ email: (email || '').toLowerCase().trim() });
  }

  async findWithPagination(filter = {}, options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;
    const getAll = options.getAll === true;

    let countSql = 'SELECT COUNT(*) FROM employees WHERE deleted_at IS NULL';
    const countParams = [];
    let paramCount = 1;
    if (filter.status) {
      countSql += ` AND status = $${paramCount++}`;
      countParams.push(filter.status);
    }
    if (filter.department) {
      countSql += ` AND department = $${paramCount++}`;
      countParams.push(filter.department);
    }
    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count, 10);

    const employees = await this.findAll(filter, {
      limit: getAll ? total : limit,
      offset: getAll ? 0 : offset
    });

    return {
      employees,
      total,
      pagination: getAll ? { page: 1, limit: total, total, pages: 1 } : { page, limit, total, pages: Math.ceil(total / limit) }
    };
  }

  async search(searchTerm, options = {}) {
    if (!searchTerm) return [];
    const term = `%${searchTerm}%`;
    const result = await query(
      `SELECT * FROM employees WHERE deleted_at IS NULL AND (
        first_name ILIKE $1 OR last_name ILIKE $1 OR employee_id ILIKE $1 OR
        email ILIKE $1 OR phone ILIKE $1 OR position ILIKE $1 OR department ILIKE $1
      ) ORDER BY created_at DESC LIMIT $2`,
      [term, options.limit || 100]
    );
    return result.rows;
  }

  async getDistinctDepartments() {
    const result = await query(
      'SELECT DISTINCT department FROM employees WHERE deleted_at IS NULL AND department IS NOT NULL AND TRIM(department) != \'\' ORDER BY department',
      []
    );
    return result.rows.map(r => r.department).filter(Boolean);
  }

  async getDistinctPositions() {
    const result = await query(
      'SELECT DISTINCT position FROM employees WHERE deleted_at IS NULL AND position IS NOT NULL AND TRIM(position) != \'\' ORDER BY position',
      []
    );
    return result.rows.map(r => r.position).filter(Boolean);
  }

  async findByStatus(status, options = {}) {
    return this.findAll({ status }, options);
  }

  async findByDepartment(department, options = {}) {
    return this.findAll({ department }, options);
  }

  async findByPosition(position, options = {}) {
    return this.findAll({ position }, options);
  }

  async employeeIdExists(employeeId, excludeId = null) {
    if (!employeeId) return false;
    let sql = 'SELECT 1 FROM employees WHERE employee_id = $1 AND deleted_at IS NULL';
    const params = [(employeeId || '').toUpperCase()];
    if (excludeId) {
      sql += ' AND id != $2';
      params.push(excludeId);
    }
    sql += ' LIMIT 1';
    const result = await query(sql, params);
    return result.rows.length > 0;
  }

  async emailExists(email, excludeId = null) {
    if (!email) return false;
    let sql = 'SELECT 1 FROM employees WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL';
    const params = [String(email).trim()];
    if (excludeId) {
      sql += ' AND id != $2';
      params.push(excludeId);
    }
    sql += ' LIMIT 1';
    const result = await query(sql, params);
    return result.rows.length > 0;
  }

  async findByUserAccount(userAccountId, options = {}) {
    if (!userAccountId) return null;
    return this.findOne({ userAccount: userAccountId });
  }

  async findLatest() {
    const result = await query(
      'SELECT * FROM employees WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 1',
      []
    );
    return result.rows[0] || null;
  }

  async create(data) {
    const employeeId = (data.employeeId || data.employee_id || `EMP${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`).toUpperCase();
    const result = await query(
      `INSERT INTO employees (
        employee_id, first_name, last_name, email, phone, alternate_phone, address,
        position, department, hire_date, termination_date, employment_type, salary, hourly_rate,
        pay_frequency, work_schedule, shift, emergency_contact, date_of_birth, gender, notes,
        user_account, status, documents, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        employeeId,
        data.firstName || data.first_name,
        data.lastName || data.last_name,
        data.email ? String(data.email).toLowerCase() : null,
        data.phone || null,
        data.alternatePhone || data.alternate_phone || null,
        data.address ? JSON.stringify(data.address) : null,
        data.position,
        data.department || null,
        data.hireDate || data.hire_date || new Date(),
        data.terminationDate || data.termination_date || null,
        data.employmentType || data.employment_type || 'full_time',
        data.salary ?? null,
        data.hourlyRate ?? data.hourly_rate ?? null,
        data.payFrequency || data.pay_frequency || 'monthly',
        data.workSchedule || data.work_schedule || 'fixed',
        data.shift || 'morning',
        data.emergencyContact ? JSON.stringify(data.emergencyContact) : null,
        data.dateOfBirth || data.date_of_birth || null,
        data.gender || null,
        data.notes || null,
        data.userAccount || data.user_account || null,
        data.status || 'active',
        data.documents ? JSON.stringify(data.documents) : '[]'
      ]
    );
    return result.rows[0];
  }

  async updateById(id, data) {
    const updates = [];
    const params = [];
    let paramCount = 1;
    const map = {
      firstName: 'first_name', lastName: 'last_name', email: 'email', phone: 'phone',
      alternatePhone: 'alternate_phone', address: 'address', position: 'position', department: 'department',
      hireDate: 'hire_date', terminationDate: 'termination_date', employmentType: 'employment_type',
      salary: 'salary', hourlyRate: 'hourly_rate', payFrequency: 'pay_frequency',
      workSchedule: 'work_schedule', shift: 'shift', emergencyContact: 'emergency_contact',
      dateOfBirth: 'date_of_birth', gender: 'gender', notes: 'notes', userAccount: 'user_account',
      status: 'status', documents: 'documents'
    };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) {
        updates.push(`${col} = $${paramCount++}`);
        params.push(typeof data[k] === 'object' && (col === 'address' || col === 'emergency_contact' || col === 'documents') ? JSON.stringify(data[k]) : data[k]);
      }
    }
    if (updates.length === 0) return this.findById(id);
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    const result = await query(
      `UPDATE employees SET ${updates.join(', ')} WHERE id = $${paramCount} AND deleted_at IS NULL RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  async softDelete(id) {
    const result = await query(
      'UPDATE employees SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }
}

module.exports = new EmployeeRepository();
