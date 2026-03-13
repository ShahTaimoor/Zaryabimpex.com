const { query, transaction } = require('../../config/postgres');
const { toSortString } = require('../../utils/sortParam');

function run(q, params, client) {
  return client ? client.query(q, params) : query(q, params);
}

class CustomerRepository {
  /**
   * Find customer by ID
   */
  async findById(id) {
    const result = await query(
      'SELECT * FROM customers WHERE id = $1 AND is_deleted = FALSE',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find all customers with filters
   */
  async findAll(filters = {}, options = {}) {
    const { sql: whereClause, params } = this._buildWhereClause(filters);
    let sql = `SELECT * FROM customers ${whereClause}`;
    let paramCount = params.length + 1;

    const sortStr = toSortString(options.sort, 'created_at DESC');
    const [field, direction] = sortStr.split(' ');
    sql += ` ORDER BY ${field} ${direction || 'ASC'}`;

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

  /**
   * Build WHERE clause and params for filtering (shared by findAll and count)
   */
  _buildWhereClause(filters) {
    let sql = 'WHERE is_deleted = FALSE';
    const params = [];
    let paramCount = 1;

    if (filters.id || filters._id) {
      sql += ` AND id = $${paramCount++}`;
      params.push(filters.id || filters._id);
    }
    if (filters.ids || filters.customerIds) {
      sql += ` AND id = ANY($${paramCount++}::uuid[])`;
      params.push(filters.ids || filters.customerIds);
    }
    if (filters.isActive !== undefined) {
      sql += ` AND is_active = $${paramCount++}`;
      params.push(filters.isActive);
    }
    if (filters.status) {
      sql += ` AND status = $${paramCount++}`;
      params.push(filters.status);
    }
    if (filters.businessType || filters.business_type) {
      sql += ` AND business_type = $${paramCount++}`;
      params.push(filters.businessType || filters.business_type);
    }
    if (filters.customerTier || filters.customer_tier) {
      sql += ` AND customer_tier = $${paramCount++}`;
      params.push(filters.customerTier || filters.customer_tier);
    }
    if (filters.search) {
      sql += ` AND (business_name ILIKE $${paramCount} OR name ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
      paramCount++;
    }
    return { sql, params };
  }

  /**
   * Find with pagination
   */
  async findWithPagination(filters = {}, options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    const { sql: whereClause, params: whereParams } = this._buildWhereClause(filters);

    // Get total count with same filters
    const countResult = await query(
      `SELECT COUNT(*) FROM customers ${whereClause}`,
      whereParams
    );
    const total = parseInt(countResult.rows[0].count);

    // Get customers
    const customers = await this.findAll(filters, { ...options, limit, offset });

    return {
      customers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Create customer
   */
  async create(customerData) {
    const addressData = customerData.addresses || (customerData.address ? [customerData.address] : null);
    const result = await query(
      `INSERT INTO customers (
        name, business_name, email, phone, address,
        opening_balance, credit_limit, payment_terms, tax_id, notes,
        business_type, customer_tier, is_active, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        customerData.name || null,
        customerData.businessName || customerData.business_name || null,
        customerData.email || null,
        customerData.phone || null,
        addressData ? JSON.stringify(addressData) : null,
        customerData.openingBalance || 0,
        customerData.creditLimit || 0,
        customerData.paymentTerms || null,
        customerData.taxId || null,
        customerData.notes || null,
        customerData.businessType || customerData.business_type || 'wholesale',
        customerData.customerTier || customerData.customer_tier || 'bronze',
        customerData.isActive !== false,
        customerData.createdBy || null
      ]
    );
    return result.rows[0];
  }

  /**
   * Update customer
   * @param {string} id
   * @param {object} customerData
   * @param {object} [client] - Optional pg client for transaction
   */
  async update(id, customerData, client = null) {
    const updates = [];
    const params = [];
    let paramCount = 1;

    if (customerData.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      params.push(customerData.name);
    }
    if (customerData.businessName !== undefined) {
      updates.push(`business_name = $${paramCount++}`);
      params.push(customerData.businessName);
    }
    if (customerData.email !== undefined) {
      updates.push(`email = $${paramCount++}`);
      params.push(customerData.email);
    }
    if (customerData.phone !== undefined) {
      updates.push(`phone = $${paramCount++}`);
      params.push(customerData.phone);
    }
    if (customerData.addresses !== undefined || customerData.address !== undefined) {
      const addressData = customerData.addresses || (customerData.address ? [customerData.address] : undefined);
      if (addressData !== undefined) {
        updates.push(`address = $${paramCount++}`);
        params.push(JSON.stringify(addressData));
      }
    }
    if (customerData.openingBalance !== undefined) {
      updates.push(`opening_balance = $${paramCount++}`);
      params.push(customerData.openingBalance);
    }
    if (customerData.creditLimit !== undefined) {
      updates.push(`credit_limit = $${paramCount++}`);
      params.push(customerData.creditLimit);
    }
    if (customerData.businessType !== undefined) {
      updates.push(`business_type = $${paramCount++}`);
      params.push(customerData.businessType);
    }
    if (customerData.customerTier !== undefined) {
      updates.push(`customer_tier = $${paramCount++}`);
      params.push(customerData.customerTier);
    }
    if (customerData.currentBalance !== undefined) {
      updates.push(`current_balance = $${paramCount++}`);
      params.push(customerData.currentBalance);
    }
    if (customerData.pendingBalance !== undefined) {
      updates.push(`pending_balance = $${paramCount++}`);
      params.push(customerData.pendingBalance);
    }
    if (customerData.advanceBalance !== undefined) {
      updates.push(`advance_balance = $${paramCount++}`);
      params.push(customerData.advanceBalance);
    }
    if (customerData.isActive !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      params.push(customerData.isActive);
    }
    if (customerData.status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      params.push(customerData.status);
    }
    if (customerData.suspendedAt !== undefined) {
      updates.push(`suspended_at = $${paramCount++}`);
      params.push(customerData.suspendedAt);
    }
    if (customerData.suspensionReason !== undefined) {
      updates.push(`suspension_reason = $${paramCount++}`);
      params.push(customerData.suspensionReason);
    }
    if (customerData.suspendedBy !== undefined) {
      updates.push(`suspended_by = $${paramCount++}`);
      params.push(customerData.suspendedBy);
    }
    if (customerData.creditPolicy !== undefined) {
      updates.push(`credit_policy = $${paramCount++}`);
      params.push(JSON.stringify(customerData.creditPolicy));
    }
    if (customerData.updatedBy !== undefined) {
      updates.push(`updated_by = $${paramCount++}`);
      params.push(customerData.updatedBy);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const result = await run(
      `UPDATE customers SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      params,
      client
    );
    return result.rows[0] || null;
  }

  /**
   * Delete customer (soft delete)
   * @param {string} id
   * @param {object} [client] - Optional pg client for transaction
   */
  async delete(id, client = null) {
    const result = await run(
      'UPDATE customers SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP, is_active = FALSE WHERE id = $1 RETURNING *',
      [id],
      client
    );
    return result.rows[0] || null;
  }

  async search(searchTerm, options = {}) {
    return await this.findAll(
      { search: searchTerm },
      { limit: options.limit || 10, sort: 'business_name ASC' }
    );
  }

  async findDeletedById(id) {
    const result = await query(
      'SELECT * FROM customers WHERE id = $1 AND is_deleted = TRUE',
      [id]
    );
    return result.rows[0] || null;
  }

  async findDeleted(filters = {}, options = {}) {
    let sql = 'SELECT * FROM customers WHERE is_deleted = TRUE';
    const params = [];
    let paramCount = 1;
    if (options.limit) { sql += ` LIMIT $${paramCount++}`; params.push(options.limit); }
    if (options.offset) { sql += ` OFFSET $${paramCount++}`; params.push(options.offset); }
    sql += ' ORDER BY deleted_at DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  async findDeletedCount() {
    const r = await query('SELECT COUNT(*) AS count FROM customers WHERE is_deleted = TRUE', []);
    return parseInt(r.rows[0].count, 10);
  }

  async restore(id) {
    const result = await query(
      'UPDATE customers SET is_deleted = FALSE, deleted_at = NULL, is_active = TRUE WHERE id = $1 AND is_deleted = TRUE RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find a single customer by business name (case-insensitive, trimmed)
   */
  async findByBusinessName(businessName) {
    if (!businessName || !String(businessName).trim()) return null;
    const result = await query(
      'SELECT * FROM customers WHERE TRIM(LOWER(business_name)) = TRIM(LOWER($1)) AND is_deleted = FALSE LIMIT 1',
      [String(businessName).trim()]
    );
    return result.rows[0] || null;
  }

  async emailExists(email, excludeId = null) {
    if (!email || !String(email).trim()) return false;
    let sql = 'SELECT 1 FROM customers WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) AND is_deleted = FALSE';
    const params = [email.trim()];
    if (excludeId) { sql += ' AND id != $2'; params.push(excludeId); }
    const r = await query(sql + ' LIMIT 1', params);
    return (r.rows.length > 0);
  }

  async businessNameExists(businessName, excludeId = null) {
    if (!businessName || !String(businessName).trim()) return false;
    let sql = 'SELECT 1 FROM customers WHERE TRIM(LOWER(business_name)) = TRIM(LOWER($1)) AND is_deleted = FALSE';
    const params = [String(businessName).trim()];
    if (excludeId) { sql += ' AND id != $2'; params.push(excludeId); }
    const r = await query(sql + ' LIMIT 1', params);
    return (r.rows.length > 0);
  }

  async phoneExists(phone, excludeId = null) {
    if (!phone || !String(phone).trim()) return false;
    let sql = 'SELECT 1 FROM customers WHERE TRIM(phone) = TRIM($1) AND is_deleted = FALSE';
    const params = [String(phone).trim()];
    if (excludeId) { sql += ' AND id != $2'; params.push(excludeId); }
    const r = await query(sql + ' LIMIT 1', params);
    return (r.rows.length > 0);
  }
}

module.exports = new CustomerRepository();
