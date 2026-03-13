const { query } = require('../../config/postgres');

class InvestorRepository {
  async findById(id) {
    const result = await query('SELECT * FROM investors WHERE id = $1 AND deleted_at IS NULL', [id]);
    return result.rows[0] || null;
  }

  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM investors WHERE deleted_at IS NULL';
    const params = [];
    let paramCount = 1;
    if (filters.status) { sql += ` AND status = $${paramCount++}`; params.push(filters.status); }
    sql += ' ORDER BY created_at DESC';
    if (options.limit) { sql += ` LIMIT $${paramCount++}`; params.push(options.limit); }
    if (options.offset) { sql += ` OFFSET $${paramCount++}`; params.push(options.offset); }
    const result = await query(sql, params);
    return result.rows;
  }

  async findOne(filters = {}) {
    if (filters.email) {
      const result = await query('SELECT * FROM investors WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL LIMIT 1', [filters.email]);
      return result.rows[0] || null;
    }
    if (filters.id || filters._id) return this.findById(filters.id || filters._id);
    return null;
  }

  async findByEmail(email) {
    return this.findOne({ email: (email || '').toLowerCase() });
  }

  async findWithFilters(filter = {}, options = {}) {
    return this.findAll(filter, options);
  }

  async create(data) {
    const result = await query(
      `INSERT INTO investors (name, email, phone, address, total_investment, default_profit_share_percentage, total_earned_profit, total_paid_out, current_balance, status, notes, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *`,
      [
        data.name, (data.email || '').toLowerCase(), data.phone || null, data.address ? JSON.stringify(data.address) : null,
        data.totalInvestment ?? 0, data.defaultProfitSharePercentage ?? 30, data.totalEarnedProfit ?? 0, data.totalPaidOut ?? 0, data.currentBalance ?? 0,
        data.status || 'active', data.notes || null, data.createdBy || data.created_by
      ]
    );
    return result.rows[0];
  }

  async updateById(id, data) {
    const updates = [];
    const params = [];
    let paramCount = 1;
    const map = { name: 'name', email: 'email', phone: 'phone', address: 'address', totalInvestment: 'total_investment', defaultProfitSharePercentage: 'default_profit_share_percentage', totalEarnedProfit: 'total_earned_profit', totalPaidOut: 'total_paid_out', currentBalance: 'current_balance', status: 'status', notes: 'notes' };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) {
        updates.push(`${col} = $${paramCount++}`);
        params.push(col === 'address' && typeof data[k] === 'object' ? JSON.stringify(data[k]) : data[k]);
      }
    }
    if (updates.length === 0) return this.findById(id);
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    const result = await query(`UPDATE investors SET ${updates.join(', ')} WHERE id = $${paramCount} AND deleted_at IS NULL RETURNING *`, params);
    return result.rows[0] || null;
  }

  async addProfit(id, amount) {
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) return this.findById(id);
    const inv = await this.findById(id);
    if (!inv) return null;
    const newEarned = (parseFloat(inv.total_earned_profit) || 0) + amt;
    const newBalance = (parseFloat(inv.current_balance) || 0) + amt;
    return this.updateById(id, { totalEarnedProfit: newEarned, currentBalance: newBalance });
  }

  async subtractProfit(id, amount) {
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) return this.findById(id);
    const inv = await this.findById(id);
    if (!inv) return null;
    const newEarned = Math.max(0, (parseFloat(inv.total_earned_profit) || 0) - amt);
    const newBalance = Math.max(0, (parseFloat(inv.current_balance) || 0) - amt);
    return this.updateById(id, { totalEarnedProfit: newEarned, currentBalance: newBalance });
  }

  async softDelete(id) {
    const result = await query('UPDATE investors SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [id]);
    return result.rows[0] || null;
  }
}

module.exports = new InvestorRepository();
