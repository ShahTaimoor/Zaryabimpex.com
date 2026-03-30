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

  async emailExists(email, excludeId = null) {
    if (!email) return false;
    let sql =
      'SELECT 1 FROM investors WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL';
    const params = [email];
    if (excludeId) {
      sql += ' AND id != $2';
      params.push(excludeId);
    }
    sql += ' LIMIT 1';
    const result = await query(sql, params);
    return result.rows.length > 0;
  }

  /** Alias for services expecting Mongo-style API */
  async update(id, data) {
    return this.updateById(id, data);
  }

  async findWithFilters(filter = {}, options = {}) {
    let sql = 'SELECT * FROM investors WHERE deleted_at IS NULL';
    const params = [];
    let paramCount = 1;
    if (filter.status) {
      sql += ` AND status = $${paramCount++}`;
      params.push(filter.status);
    }
    const rawSearch =
      typeof filter.search === 'string'
        ? filter.search.trim()
        : filter.search != null
          ? String(filter.search).trim()
          : '';
    if (rawSearch) {
      const term = `%${rawSearch}%`;
      sql += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount} OR COALESCE(phone, '') ILIKE $${paramCount})`;
      params.push(term);
      paramCount++;
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

  /**
   * Apply investor payout inside an existing DB transaction (caller posts to ledger in same tx).
   * @param {import('pg').PoolClient} client
   * @returns {Promise<{ investor: object, payout: object }>}
   */
  async applyPayoutInTransaction(client, investorId, amount, createdBy, opts = {}) {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      throw new Error('Invalid payout amount');
    }
    const paymentMethod = opts.paymentMethod === 'bank' ? 'bank' : 'cash';
    const debitAccountCode = String(opts.debitAccountCode || '3100').toUpperCase();

    const invRes = await client.query(
      'SELECT * FROM investors WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
      [investorId]
    );
    const inv = invRes.rows[0];
    if (!inv) {
      throw new Error('Investor not found');
    }
    const balance = parseFloat(inv.current_balance) || 0;
    if (amt > balance) {
      throw new Error('Payout amount exceeds current balance');
    }
    const newPaidOut = (parseFloat(inv.total_paid_out) || 0) + amt;
    const newBalance = balance - amt;

    const ins = await client.query(
      `INSERT INTO investor_payouts (investor_id, amount, paid_at, created_by, payment_method, debit_account_code)
       VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5) RETURNING *`,
      [investorId, amt, createdBy || null, paymentMethod, debitAccountCode]
    );
    const payout = ins.rows[0];
    const upd = await client.query(
      `UPDATE investors SET total_paid_out = $1, current_balance = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND deleted_at IS NULL RETURNING *`,
      [newPaidOut, newBalance, investorId]
    );
    const investor = upd.rows[0] || null;
    if (!investor) {
      throw new Error('Investor not found');
    }
    return { investor, payout };
  }

  /** @param {string[]} ids */
  async getLastPayoutAtByInvestorIds(ids) {
    if (!ids || ids.length === 0) return new Map();
    const result = await query(
      `SELECT investor_id, MAX(paid_at) AS last_payout_at
       FROM investor_payouts WHERE investor_id = ANY($1::uuid[]) GROUP BY investor_id`,
      [ids]
    );
    const m = new Map();
    for (const row of result.rows) {
      m.set(row.investor_id, row.last_payout_at);
    }
    return m;
  }

  async findPayoutsByInvestorId(investorId, limit = 200) {
    const lim = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 500);
    const result = await query(
      `SELECT id, investor_id, amount, paid_at, created_at, created_by,
              payment_method, debit_account_code, ledger_transaction_id
       FROM investor_payouts WHERE investor_id = $1 ORDER BY paid_at DESC LIMIT $2`,
      [investorId, lim]
    );
    return result.rows;
  }

  /**
   * Record new capital from investor: increases total_investment and current_balance.
   */
  async recordInvestment(id, amount) {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      throw new Error('Invalid investment amount');
    }
    const inv = await this.findById(id);
    if (!inv) {
      throw new Error('Investor not found');
    }
    const newTotal = (parseFloat(inv.total_investment) || 0) + amt;
    const newBalance = (parseFloat(inv.current_balance) || 0) + amt;
    return this.updateById(id, { totalInvestment: newTotal, currentBalance: newBalance });
  }

  async softDelete(id) {
    const result = await query('UPDATE investors SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [id]);
    return result.rows[0] || null;
  }
}

module.exports = new InvestorRepository();
