const { query } = require('../../config/postgres');

function run(q, params, client) {
  return client ? client.query(q, params) : query(q, params);
}

const PREFIX = {
  invoice: 'INV',
  payment: 'PAY',
  refund: 'REF',
  credit_note: 'CN',
  debit_note: 'DN',
  adjustment: 'ADJ',
  write_off: 'WO',
  reversal: 'REV',
  opening_balance: 'OB'
};

class CustomerTransactionRepository {
  /**
   * Generate a globally unique transaction_number (table has UNIQUE on transaction_number).
   * Uses type + year + sequence + short random suffix to avoid duplicates across customers and under concurrency.
   */
  async generateTransactionNumber(transactionType, customerId) {
    const prefix = PREFIX[transactionType] || 'TXN';
    const year = new Date().getFullYear();
    const result = await query(
      `SELECT COUNT(*)::int AS c FROM customer_transactions
       WHERE transaction_type = $1 AND transaction_date >= $2`,
      [transactionType, `${year}-01-01`]
    );
    const seq = (result.rows[0]?.c || 0) + 1;
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${prefix}-${year}-${String(seq).padStart(6, '0')}-${suffix}`;
  }

  async create(data) {
    const result = await query(
      `INSERT INTO customer_transactions (
        customer_id, transaction_number, transaction_type, transaction_date, due_date,
        reference_type, reference_id, reference_number, gross_amount, discount_amount, tax_amount, net_amount,
        affects_pending_balance, affects_advance_balance, balance_impact,
        balance_before, balance_after, line_items, payment_details,
        status, paid_amount, remaining_amount, age_in_days, aging_bucket, is_overdue, days_overdue,
        created_by, posted_by, posted_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        data.customerId ?? data.customer,
        data.transactionNumber ?? data.transaction_number,
        data.transactionType ?? data.transaction_type,
        data.transactionDate ?? data.transaction_date ?? new Date(),
        data.dueDate ?? data.due_date ?? null,
        data.referenceType ?? data.reference_type ?? null,
        data.referenceId ?? data.reference_id ?? null,
        data.referenceNumber ?? data.reference_number ?? null,
        data.grossAmount ?? data.gross_amount ?? 0,
        data.discountAmount ?? data.discount_amount ?? 0,
        data.taxAmount ?? data.tax_amount ?? 0,
        data.netAmount ?? data.net_amount ?? 0,
        data.affectsPendingBalance ?? data.affects_pending_balance ?? false,
        data.affectsAdvanceBalance ?? data.affects_advance_balance ?? false,
        data.balanceImpact ?? data.balance_impact ?? 0,
        data.balanceBefore ? JSON.stringify(data.balanceBefore) : null,
        data.balanceAfter ? JSON.stringify(data.balanceAfter) : null,
        data.lineItems ? JSON.stringify(data.lineItems) : null,
        data.paymentDetails ? JSON.stringify(data.paymentDetails) : null,
        data.status ?? 'posted',
        data.paidAmount ?? data.paid_amount ?? 0,
        data.remainingAmount ?? data.remaining_amount ?? 0,
        data.ageInDays ?? data.age_in_days ?? 0,
        data.agingBucket ?? data.aging_bucket ?? 'current',
        data.isOverdue ?? data.is_overdue ?? false,
        data.daysOverdue ?? data.days_overdue ?? 0,
        data.createdBy ?? data.created_by,
        data.postedBy ?? data.posted_by ?? null,
        data.postedAt ?? data.posted_at ?? new Date()
      ]
    );
    return result.rows[0];
  }

  async findById(id) {
    const result = await query(
      'SELECT * FROM customer_transactions WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async updateById(id, data) {
    const updates = [];
    const params = [];
    let paramCount = 1;
    const map = {
      status: 'status',
      paidAmount: 'paid_amount',
      remainingAmount: 'remaining_amount',
      reversedBy: 'reversed_by',
      reversedAt: 'reversed_at'
    };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) {
        updates.push(`${col} = $${paramCount++}`);
        params.push(data[k]);
      }
    }
    if (updates.length === 0) return this.findById(id);
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    const result = await query(
      `UPDATE customer_transactions SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  async updateCustomerId(sourceCustomerId, targetCustomerId, client = null) {
    const result = await run(
      'UPDATE customer_transactions SET customer_id = $1, updated_at = CURRENT_TIMESTAMP WHERE customer_id = $2',
      [targetCustomerId, sourceCustomerId],
      client
    );
    return result.rowCount || 0;
  }

  async count(filters = {}) {
    let sql = 'SELECT COUNT(*)::int AS c FROM customer_transactions WHERE 1=1';
    const params = [];
    let paramCount = 1;
    if (filters.customerId || filters.customer) {
      sql += ` AND customer_id = $${paramCount++}`;
      params.push(filters.customerId || filters.customer);
    }
    if (filters.status) { sql += ` AND status = $${paramCount++}`; params.push(filters.status); }
    if (filters.statusNe) { sql += ` AND status != $${paramCount++}`; params.push(filters.statusNe); }
    if (filters.transactionType) { sql += ` AND transaction_type = $${paramCount++}`; params.push(filters.transactionType); }
    if (filters.transactionDateFrom || (filters.transactionDate && filters.transactionDate.$gte)) {
      sql += ` AND transaction_date >= $${paramCount++}`;
      params.push(filters.transactionDateFrom || filters.transactionDate.$gte);
    }
    if (filters.transactionDateTo || (filters.transactionDate && filters.transactionDate.$lte)) {
      sql += ` AND transaction_date <= $${paramCount++}`;
      params.push(filters.transactionDateTo || filters.transactionDate.$lte);
    }
    const result = await query(sql, params);
    return parseInt(result.rows[0]?.c || 0, 10);
  }

  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM customer_transactions WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filters.customerId || filters.customer) {
      sql += ` AND customer_id = $${paramCount++}`;
      params.push(filters.customerId || filters.customer);
    }
    if (filters.status) {
      sql += ` AND status = $${paramCount++}`;
      params.push(filters.status);
    }
    if (filters.statusNe) {
      sql += ` AND status != $${paramCount++}`;
      params.push(filters.statusNe);
    }
    if (filters.transactionDateFrom || (filters.transactionDate && filters.transactionDate.$gte)) {
      sql += ` AND transaction_date >= $${paramCount++}`;
      params.push(filters.transactionDateFrom || filters.transactionDate.$gte);
    }
    if (filters.transactionDateTo || (filters.transactionDate && filters.transactionDate.$lte)) {
      sql += ` AND transaction_date <= $${paramCount++}`;
      params.push(filters.transactionDateTo || filters.transactionDate.$lte);
    }
    if (filters.transactionType) {
      sql += ` AND transaction_type = $${paramCount++}`;
      params.push(filters.transactionType);
    }
    if (filters.statusIn && Array.isArray(filters.statusIn) && filters.statusIn.length > 0) {
      sql += ` AND status = ANY($${paramCount++}::text[])`;
      params.push(filters.statusIn);
    }
    if (filters.dueDateBefore != null) {
      sql += ` AND due_date < $${paramCount++}`;
      params.push(filters.dueDateBefore);
    }
    if (filters.dueDateAfter != null) {
      sql += ` AND due_date >= $${paramCount++}`;
      params.push(filters.dueDateAfter);
    }
    if (filters.remainingAmountGt != null) {
      sql += ` AND remaining_amount > $${paramCount++}`;
      params.push(filters.remainingAmountGt);
    }
    if (filters.isOverdue === true) {
      sql += ' AND is_overdue = TRUE';
    }
    if (filters.daysOverdueMin != null) {
      sql += ` AND days_overdue >= $${paramCount++}`;
      params.push(filters.daysOverdueMin);
    }
    if (filters.daysOverdueMax != null) {
      sql += ` AND days_overdue <= $${paramCount++}`;
      params.push(filters.daysOverdueMax);
    }

    const { toSortString } = require('../../utils/sortParam');
    const sortStr = toSortString(options.sort, 'transaction_date ASC');
    const allowed = { transaction_date: true, created_at: true, days_overdue: true, due_date: true };
    const [col, dir] = sortStr.trim().split(/\s+/);
    const orderCol = allowed[col] ? col : 'transaction_date';
    const orderDir = (dir || '').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    sql += ` ORDER BY ${orderCol} ${orderDir}, created_at ASC`;
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
}

module.exports = new CustomerTransactionRepository();
