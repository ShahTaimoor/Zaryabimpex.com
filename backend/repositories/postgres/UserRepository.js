const bcrypt = require('bcryptjs');
const { query } = require('../../config/postgres');

function rowToUser(row) {
  if (!row) return null;
  const roles = Array.isArray(row.roles) ? row.roles : (typeof row.roles === 'string' ? (tryParse(row.roles) || []) : []);
  const permissions = Array.isArray(row.permissions) ? row.permissions : (typeof row.permissions === 'string' ? (tryParse(row.permissions) || []) : []);
  const role = roles[0] || 'cashier';
  const user = {
    id: row.id,
    _id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    lastLogin: row.last_login,
    loginCount: row.login_count ?? 0,
    isActive: row.is_active,
    role,
    roles,
    permissions,
    status: row.is_active ? 'active' : 'inactive',
    loginAttempts: row.login_attempts ?? 0,
    lockUntil: row.lock_until,
    password_hash: row.password_hash,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
  user.isLocked = !!(user.lockUntil && new Date(user.lockUntil) > new Date());
  user.hasPermission = function (permission) {
    if (this.role === 'admin') return true;
    return Array.isArray(this.permissions) && this.permissions.includes(permission);
  };
  user.toSafeObject = function () {
    const o = { ...this };
    delete o.password_hash;
    delete o.loginAttempts;
    delete o.lockUntil;
    return o;
  };
  user.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, row.password_hash || '');
  };
  return user;
}

function tryParse(json) {
  try {
    return JSON.parse(json);
  } catch (_) {
    return null;
  }
}

class UserRepository {
  async findById(id) {
    const result = await query(
      'SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    const row = result.rows[0];
    return row ? rowToUser(row) : null;
  }

  async findByEmail(email, options = {}) {
    const result = await query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL',
      [email.trim()]
    );
    const row = result.rows[0];
    if (!row) return null;
    return options.includePassword ? rowToUser(row) : rowToUser({ ...row, password_hash: undefined });
  }

  async findByEmailWithPassword(email) {
    const result = await query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL',
      [email.trim()]
    );
    const row = result.rows[0];
    return row ? rowToUser(row) : null;
  }

  async emailExists(email, excludeId = null) {
    let sql = 'SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL';
    const params = [email.trim()];
    if (excludeId) {
      sql += ' AND id != $2';
      params.push(excludeId);
    }
    const result = await query(sql, params);
    return result.rows.length > 0;
  }

  async create(data) {
    const passwordHash = await bcrypt.hash(data.password, 12);
    const roles = data.role ? [data.role] : (data.roles || ['cashier']);
    const permissions = Array.isArray(data.permissions) ? data.permissions : [];

    const result = await query(
      `INSERT INTO users (first_name, last_name, email, password_hash, phone, is_active, roles, permissions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.firstName || data.first_name || '',
        data.lastName || data.last_name || '',
        (data.email || '').toLowerCase().trim(),
        passwordHash,
        data.phone || null,
        data.status !== 'inactive' && data.status !== 'suspended',
        JSON.stringify(roles),
        JSON.stringify(permissions)
      ]
    );
    return rowToUser(result.rows[0]);
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    let n = 1;
    if (data.firstName !== undefined) { fields.push(`first_name = $${n++}`); values.push(data.firstName); }
    if (data.lastName !== undefined) { fields.push(`last_name = $${n++}`); values.push(data.lastName); }
    if (data.email !== undefined) { fields.push(`email = $${n++}`); values.push((data.email || '').toLowerCase().trim()); }
    if (data.phone !== undefined) { fields.push(`phone = $${n++}`); values.push(data.phone); }
    if (data.isActive !== undefined) { fields.push(`is_active = $${n++}`); values.push(data.isActive); }
    if (data.status !== undefined) { fields.push(`is_active = $${n++}`); values.push(data.status === 'active'); }
    if (data.roles !== undefined) { fields.push(`roles = $${n++}`); values.push(JSON.stringify(Array.isArray(data.roles) ? data.roles : [data.roles])); }
    if (data.role !== undefined) { fields.push(`roles = $${n++}`); values.push(JSON.stringify([data.role])); }
    if (data.permissions !== undefined) { fields.push(`permissions = $${n++}`); values.push(JSON.stringify(data.permissions)); }
    if (data.password !== undefined) {
      const hash = await bcrypt.hash(data.password, 12);
      fields.push(`password_hash = $${n++}`);
      values.push(hash);
    }
    if (fields.length === 0) return this.findById(id);
    values.push(id);
    const result = await query(
      `UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${n} AND deleted_at IS NULL RETURNING *`,
      values
    );
    return result.rows[0] ? rowToUser(result.rows[0]) : null;
  }

  async updateById(id, updateData) {
    return this.update(id, updateData);
  }

  async findAll(query = {}, options = {}) {
    const { limit = 1000 } = options;
    const result = await this.findWithPagination(query, { page: 1, limit });
    return result.users;
  }

  async incrementLoginAttempts(id) {
    const user = await this.findById(id);
    if (!user) return;
    const attempts = (user.loginAttempts || 0) + 1;
    const lockUntil = attempts >= 5 ? new Date(Date.now() + 2 * 60 * 60 * 1000) : null;
    await query(
      'UPDATE users SET login_attempts = $1, lock_until = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [attempts, lockUntil, id]
    );
  }

  async resetLoginAttempts(id) {
    await query(
      'UPDATE users SET login_attempts = 0, lock_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
  }

  async trackLogin(id, ipAddress, userAgent) {
    await query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP, login_count = COALESCE(login_count, 0) + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
  }

  async trackPermissionChange(id, changedBy, changeType, oldData, newData, notes) {
    // Optional: store in an audit table; for now no-op to match interface
  }

  async softDelete(id) {
    await query(
      'UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
  }

  async updateMany(filter, updateOp) {
    const role = filter.role;
    const permissions = updateOp?.$set?.permissions;
    if (!role || !permissions) return { modifiedCount: 0 };
    const result = await query(
      'UPDATE users SET permissions = $1, updated_at = CURRENT_TIMESTAMP WHERE deleted_at IS NULL AND roles::jsonb @> $2::jsonb',
      [JSON.stringify(permissions), JSON.stringify([role])]
    );
    return { modifiedCount: result.rowCount || 0 };
  }

  async findByIdWithPassword(id) {
    return this.findById(id);
  }

  async updateProfile(id, updateData) {
    const data = {};
    if (updateData.firstName !== undefined) data.firstName = updateData.firstName;
    if (updateData.lastName !== undefined) data.lastName = updateData.lastName;
    if (updateData.email !== undefined) data.email = updateData.email;
    if (updateData.phone !== undefined) data.phone = updateData.phone;
    return this.update(id, data);
  }

  async updatePassword(id, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passwordHash, id]
    );
    return this.findById(id);
  }

  async findSearch(searchTerm, limit = 10) {
    if (!searchTerm || String(searchTerm).trim().length < 2) {
      return [];
    }
    const term = '%' + String(searchTerm).trim().replace(/%/g, '\\%') + '%';
    const result = await query(
      `SELECT id, first_name, last_name, email FROM users WHERE deleted_at IS NULL AND is_active = TRUE
       AND (first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1)
       ORDER BY first_name, last_name LIMIT $2`,
      [term, limit]
    );
    return result.rows.map(row => ({
      id: row.id,
      _id: row.id,
      name: [row.first_name, row.last_name].filter(Boolean).join(' ') || row.email,
      username: row.email,
      email: row.email
    }));
  }

  async findWithPagination(filters = {}, options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;
    let where = 'WHERE deleted_at IS NULL';
    const params = [];
    let n = 1;
    if (filters.role) {
      where += ` AND roles::jsonb ? $${n++}`;
      params.push(filters.role);
    }
    if (filters.isActive !== undefined) {
      where += ` AND is_active = $${n++}`;
      params.push(filters.isActive);
    }
    if (filters.ids || filters.userIds) {
      where += ` AND id = ANY($${n++}::uuid[])`;
      params.push(filters.ids || filters.userIds);
    }
    const countResult = await query(`SELECT COUNT(*) FROM users ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);
    const listParams = [...params, limit, offset];
    const result = await query(
      `SELECT * FROM users ${where} ORDER BY created_at DESC LIMIT $${n++} OFFSET $${n++}`,
      listParams
    );
    const users = result.rows.map(row => rowToUser(row));
    return { users, total, page, limit, pages: Math.ceil(total / limit) };
  }
}

module.exports = new UserRepository();
