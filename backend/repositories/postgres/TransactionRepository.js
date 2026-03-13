const { query } = require('../../config/postgres');

/**
 * Map account_ledger row (snake_case) to camelCase for compatibility with accountLedgerService.
 */
function toCamel(row) {
  if (!row) return null;
  return {
    id: row.id,
    transactionId: row.transaction_id,
    transactionDate: row.transaction_date,
    accountCode: row.account_code,
    debitAmount: row.debit_amount != null ? parseFloat(row.debit_amount) : 0,
    creditAmount: row.credit_amount != null ? parseFloat(row.credit_amount) : 0,
    description: row.description,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    referenceNumber: row.reference_number,
    reference: row.reference_number,
    customerId: row.customer_id,
    supplierId: row.supplier_id,
    productId: row.product_id,
    currency: row.currency,
    status: row.status,
    paymentMethod: row.payment_method,
    orderId: row.order_id,
    paymentId: row.payment_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reversedAt: row.reversed_at,
    reversedBy: row.reversed_by,
    reversalReason: row.reversal_reason
  };
}

class TransactionRepository {
  async findById(id) {
    const result = await query(
      'SELECT * FROM account_ledger WHERE id = $1',
      [id]
    );
    return toCamel(result.rows[0] || null);
  }

  async findAll(filters = {}, options = {}) {
    const { sql, params } = this._buildWhere(filters);
    let fullSql = `SELECT * FROM account_ledger WHERE ${sql} ORDER BY created_at ASC`;
    let paramCount = params.length + 1;
    if (options.limit) { fullSql += ` LIMIT $${paramCount++}`; params.push(options.limit); }
    if (options.offset) { fullSql += ` OFFSET $${paramCount++}`; params.push(options.offset); }
    const result = await query(fullSql, params);
    return result.rows.map(toCamel);
  }

  _buildWhere(filter) {
    const conditions = ['1=1', 'reversed_at IS NULL']; // Exclude reversed entries from display (e.g. when receipt/payment was edited)
    const params = [];
    let paramCount = 1;

    if (filter._id && filter._id.$in && filter._id.$in.length === 0) {
      conditions[0] = '1=0';
      return { sql: conditions.join(' AND '), params };
    }

    if (filter.accountCode) {
      if (filter.accountCode.$in && Array.isArray(filter.accountCode.$in)) {
        conditions.push(`account_code = ANY($${paramCount++})`);
        params.push(filter.accountCode.$in);
      } else {
        conditions.push(`account_code = $${paramCount++}`);
        params.push(filter.accountCode);
      }
    }

    if (filter.createdAt) {
      if (filter.createdAt.$gte) {
        conditions.push(`transaction_date >= $${paramCount++}`);
        params.push(filter.createdAt.$gte);
      }
      if (filter.createdAt.$lte) {
        conditions.push(`transaction_date <= $${paramCount++}`);
        params.push(filter.createdAt.$lte);
      }
    }

    if (filter.status) {
      conditions.push(`status = $${paramCount++}`);
      params.push(filter.status);
    }

    if (filter.creditAmount && filter.creditAmount.$gt !== undefined) {
      conditions.push(`credit_amount > $${paramCount++}`);
      params.push(filter.creditAmount.$gt);
    }

    if (filter.customerId) {
      conditions.push(`customer_id = $${paramCount++}`);
      params.push(filter.customerId);
    }

    if (filter.supplierId) {
      conditions.push(`supplier_id = $${paramCount++}`);
      params.push(filter.supplierId);
    }

    if (filter.transactionDate) {
      if (filter.transactionDate.$gte) {
        conditions.push(`transaction_date >= $${paramCount++}`);
        params.push(filter.transactionDate.$gte);
      }
      if (filter.transactionDate.$lte) {
        conditions.push(`transaction_date <= $${paramCount++}`);
        params.push(filter.transactionDate.$lte);
      }
      if (filter.transactionDate.$lt) {
        conditions.push(`transaction_date < $${paramCount++}`);
        params.push(filter.transactionDate.$lt);
      }
      if (filter.transactionDate.$gt) {
        conditions.push(`transaction_date > $${paramCount++}`);
        params.push(filter.transactionDate.$gt);
      }
    }

    if (filter.$or && Array.isArray(filter.$or)) {
      const orParts = [];
      for (const orClause of filter.$or) {
        const key = Object.keys(orClause)[0];
        const val = orClause[key];
        if (val && typeof val === 'object' && val.$regex) {
          const pattern = typeof val.$regex === 'string' ? val.$regex : val.$regex.source;
          const like = `%${pattern.replace(/^\^|\$$/g, '')}%`;
          if (key === 'description') {
            orParts.push(`description ILIKE $${paramCount++}`);
            params.push(like);
          } else if (key === 'reference') {
            orParts.push(`reference_number ILIKE $${paramCount++}`);
            params.push(like);
          } else if (key === 'transactionId') {
            orParts.push(`transaction_id ILIKE $${paramCount++}`);
            params.push(like);
          }
        } else if (key === 'accountCode' && val != null) {
          orParts.push(`account_code = $${paramCount++}`);
          params.push(val);
        } else if (key === 'referenceType' && val != null) {
          orParts.push(`reference_type = $${paramCount++}`);
          params.push(val);
        }
      }
      if (orParts.length) conditions.push(`(${orParts.join(' OR ')})`);
    }

    return { sql: conditions.join(' AND '), params };
  }

  async findWithPagination(filter, options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 100;
    const offset = (page - 1) * limit;
    const sort = options.sort || { createdAt: 1 };
    const sortField = Object.keys(sort)[0] || 'created_at';
    const sortDir = sort[sortField] === 1 ? 'ASC' : 'DESC';
    const dbField = sortField === 'createdAt' ? 'created_at' : sortField === 'transactionDate' ? 'transaction_date' : sortField;

    const { sql: whereSql, params: whereParams } = this._buildWhere(filter);

    const countResult = await query(
      `SELECT COUNT(*) FROM account_ledger WHERE ${whereSql}`,
      whereParams
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const params = [...whereParams];
    let paramCount = params.length + 1;
    const dataResult = await query(
      `SELECT * FROM account_ledger WHERE ${whereSql} ORDER BY ${dbField} ${sortDir} LIMIT $${paramCount++} OFFSET $${paramCount++}`,
      [...params, limit, offset]
    );
    const transactions = dataResult.rows.map(toCamel);

    const pages = Math.ceil(total / limit) || 1;
    return {
      transactions,
      total,
      pagination: {
        page,
        limit,
        pages,
        hasNext: page < pages,
        hasPrev: page > 1
      }
    };
  }

  async create(data) {
    const result = await query(
      `INSERT INTO account_ledger (transaction_id, transaction_date, account_code, debit_amount, credit_amount, description, reference_type, reference_id, reference_number, customer_id, supplier_id, product_id, currency, status, payment_method, order_id, payment_id, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *`,
      [
        data.transactionId || data.transaction_id,
        data.transactionDate || data.transaction_date || new Date(),
        data.accountCode || data.account_code,
        data.debitAmount ?? 0,
        data.creditAmount ?? 0,
        data.description,
        data.referenceType || data.reference_type || null,
        data.referenceId || data.reference_id || null,
        data.referenceNumber || data.reference_number || null,
        data.customerId || data.customer_id || null,
        data.supplierId || data.supplier_id || null,
        data.productId || data.product_id || null,
        data.currency || 'PKR',
        data.status || 'completed',
        data.paymentMethod || data.payment_method || null,
        data.orderId || data.order_id || null,
        data.paymentId || data.payment_id || null,
        data.createdBy || data.created_by || null
      ]
    );
    return toCamel(result.rows[0]);
  }
}

module.exports = new TransactionRepository();
