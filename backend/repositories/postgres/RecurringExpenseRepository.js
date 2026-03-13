const { query } = require('../../config/postgres');

function rowToRecurringExpense(row) {
  if (!row) return null;
  const r = {
    id: row.id,
    name: row.name,
    description: row.description,
    amount: parseFloat(row.amount),
    frequency: row.frequency,
    dayOfMonth: row.day_of_month,
    nextDueDate: row.next_due_date,
    reminderDaysBefore: row.reminder_days_before,
    lastReminderSentAt: row.last_reminder_sent_at,
    lastPaidAt: row.last_paid_at,
    supplier_id: row.supplier_id,
    customer_id: row.customer_id,
    expense_account_id: row.expense_account_id,
    defaultPaymentType: row.default_payment_type,
    bank_id: row.bank_id,
    notes: row.notes,
    status: row.status,
    tags: row.tags || [],
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
  if (row.supplier_id) r.supplier = { id: row.supplier_id, name: row.supplier_name, companyName: row.supplier_company_name, businessName: row.supplier_company_name, displayName: row.supplier_display_name };
  if (row.customer_id) r.customer = { id: row.customer_id, name: row.customer_name, firstName: row.customer_name, businessName: row.customer_business_name, displayName: row.customer_display_name, email: row.customer_email };
  if (row.bank_id) r.bank = { id: row.bank_id, bankName: row.bank_name, accountNumber: row.bank_account_number, accountName: row.bank_account_name };
  if (row.expense_account_id) r.expenseAccount = { id: row.expense_account_id, accountName: row.expense_account_name, accountCode: row.expense_account_code };
  return r;
}

class RecurringExpenseRepository {
  async findById(id) {
    const result = await query('SELECT * FROM recurring_expenses WHERE id = $1 AND deleted_at IS NULL', [id]);
    return result.rows[0] || null;
  }

  async findByIdWithJoins(id) {
    const sql = `SELECT r.*,
      s.id AS supplier_id, s.name AS supplier_name, s.company_name AS supplier_company_name, (COALESCE(s.company_name, s.name)) AS supplier_display_name,
      c.id AS customer_id, c.name AS customer_name, c.business_name AS customer_business_name, (COALESCE(c.business_name, c.name)) AS customer_display_name, c.email AS customer_email,
      b.id AS bank_id, b.bank_name AS bank_name, b.account_number AS bank_account_number, b.account_name AS bank_account_name,
      a.id AS expense_account_id, a.account_name AS expense_account_name, a.account_code AS expense_account_code
      FROM recurring_expenses r
      LEFT JOIN suppliers s ON s.id = r.supplier_id AND s.is_deleted = FALSE
      LEFT JOIN customers c ON c.id = r.customer_id AND c.is_deleted = FALSE
      LEFT JOIN banks b ON b.id = r.bank_id AND b.deleted_at IS NULL
      LEFT JOIN chart_of_accounts a ON a.id = r.expense_account_id
      WHERE r.id = $1 AND r.deleted_at IS NULL`;
    const result = await query(sql, [id]);
    return rowToRecurringExpense(result.rows[0]) || null;
  }

  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM recurring_expenses WHERE deleted_at IS NULL';
    const params = [];
    let paramCount = 1;
    if (filters.status) { sql += ` AND status = $${paramCount++}`; params.push(filters.status); }
    if (filters.supplierId) { sql += ` AND supplier_id = $${paramCount++}`; params.push(filters.supplierId); }
    sql += ' ORDER BY next_due_date ASC';
    if (options.limit) { sql += ` LIMIT $${paramCount++}`; params.push(options.limit); }
    if (options.offset) { sql += ` OFFSET $${paramCount++}`; params.push(options.offset); }
    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Find with filter (status, search, dueInDays, includePastDue). Options: sort, withJoins.
   * Returns rows; if withJoins, runs JOINs and maps to recurring expense shape with supplier/customer/bank/expenseAccount.
   */
  async findWithFilter(filter = {}, options = {}) {
    let sql = `SELECT r.*,
      s.id AS supplier_id, s.name AS supplier_name, s.company_name AS supplier_company_name, (COALESCE(s.company_name, s.name)) AS supplier_display_name,
      c.id AS customer_id, c.name AS customer_name, c.business_name AS customer_business_name, (COALESCE(c.business_name, c.name)) AS customer_display_name, c.email AS customer_email,
      b.id AS bank_id, b.bank_name AS bank_name, b.account_number AS bank_account_number, b.account_name AS bank_account_name,
      a.id AS expense_account_id, a.account_name AS expense_account_name, a.account_code AS expense_account_code
      FROM recurring_expenses r
      LEFT JOIN suppliers s ON s.id = r.supplier_id AND s.is_deleted = FALSE
      LEFT JOIN customers c ON c.id = r.customer_id AND c.is_deleted = FALSE
      LEFT JOIN banks b ON b.id = r.bank_id AND b.deleted_at IS NULL
      LEFT JOIN chart_of_accounts a ON a.id = r.expense_account_id
      WHERE r.deleted_at IS NULL`;
    const params = [];
    let paramCount = 1;
    if (filter.status && filter.status !== 'all') {
      sql += ` AND r.status = $${paramCount++}`;
      params.push(filter.status);
    }
    if (filter.search && filter.search.trim()) {
      sql += ` AND (r.name ILIKE $${paramCount} OR r.description ILIKE $${paramCount} OR r.notes ILIKE $${paramCount} OR EXISTS (SELECT 1 FROM unnest(r.tags) t WHERE t ILIKE $${paramCount}))`;
      params.push(`%${filter.search.trim()}%`);
      paramCount += 1;
    }
    if (filter.dueInDays !== undefined && filter.dueInDays !== null) {
      const days = parseInt(filter.dueInDays, 10);
      if (!Number.isNaN(days)) {
        const includePastDue = filter.includePastDue !== false;
        if (!includePastDue) {
          sql += ` AND r.next_due_date >= CURRENT_DATE`;
        }
        sql += ` AND r.next_due_date <= CURRENT_DATE + $${paramCount}::integer`;
        params.push(days);
        paramCount++;
      }
    }
    if (filter.nextDueDateLte) {
      sql += ` AND r.next_due_date <= $${paramCount++}`;
      params.push(filter.nextDueDateLte);
    }
    const sort = options.sort || { nextDueDate: 1, name: 1 };
    const orderParts = [];
    if (sort.nextDueDate !== undefined) orderParts.push(`r.next_due_date ${sort.nextDueDate === -1 ? 'DESC' : 'ASC'}`);
    if (sort.name !== undefined) orderParts.push(`r.name ${sort.name === -1 ? 'DESC' : 'ASC'}`);
    if (orderParts.length) sql += ` ORDER BY ${orderParts.join(', ')}`;
    else sql += ' ORDER BY r.next_due_date ASC, r.name ASC';
    const result = await query(sql, params);
    return result.rows.map(rowToRecurringExpense);
  }

  async create(data, client) {
    const q = client ? client.query.bind(client) : query;
    const tags = data.tags && Array.isArray(data.tags) ? data.tags : null;
    const result = await q(
      `INSERT INTO recurring_expenses (name, description, amount, frequency, day_of_month, next_due_date, reminder_days_before, supplier_id, customer_id, expense_account_id, default_payment_type, bank_id, notes, status, tags, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *`,
      [
        data.name, data.description || null, data.amount, data.frequency || 'monthly', data.dayOfMonth ?? data.day_of_month,
        data.nextDueDate || data.next_due_date, data.reminderDaysBefore ?? 3, data.supplier || data.supplierId || null,
        data.customer || data.customerId || null, data.expenseAccount || data.expense_account_id || null,
        data.defaultPaymentType || data.default_payment_type || 'cash', data.bank || data.bankId || null,
        data.notes || null, data.status || 'active', tags, data.createdBy || data.created_by || null
      ]
    );
    return result.rows[0];
  }

  async updateById(id, data, client) {
    const q = client ? client.query.bind(client) : query;
    const updates = [];
    const params = [];
    let paramCount = 1;
    const map = {
      name: 'name', description: 'description', amount: 'amount', frequency: 'frequency',
      dayOfMonth: 'day_of_month', nextDueDate: 'next_due_date', reminderDaysBefore: 'reminder_days_before',
      lastPaidAt: 'last_paid_at', lastReminderSentAt: 'last_reminder_sent_at',
      supplierId: 'supplier_id', customerId: 'customer_id', expenseAccountId: 'expense_account_id',
      defaultPaymentType: 'default_payment_type', bankId: 'bank_id', notes: 'notes', status: 'status', tags: 'tags'
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
    const result = await q(`UPDATE recurring_expenses SET ${updates.join(', ')} WHERE id = $${paramCount} AND deleted_at IS NULL RETURNING *`, params);
    return result.rows[0] || null;
  }

  async softDelete(id) {
    const result = await query('UPDATE recurring_expenses SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [id]);
    return result.rows[0] || null;
  }
}

module.exports = new RecurringExpenseRepository();
