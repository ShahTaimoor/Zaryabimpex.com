const { query } = require('../../config/postgres');

class SupplierRepository {
  async findById(id) {
    const result = await query(
      'SELECT * FROM suppliers WHERE id = $1 AND is_deleted = FALSE',
      [id]
    );
    return result.rows[0] || null;
  }

  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM suppliers WHERE is_deleted = FALSE';
    const params = [];
    let paramCount = 1;

    // Handle id filter (support both id and _id for compatibility)
    if (filters.id || filters._id) {
      const idValue = filters.id || filters._id;
      sql += ` AND id = $${paramCount++}`;
      params.push(idValue);
    }
    if (filters.ids || filters.supplierIds) {
      sql += ` AND id = ANY($${paramCount++}::uuid[])`;
      params.push(filters.ids || filters.supplierIds);
    }

    if (filters.isActive !== undefined) {
      sql += ` AND is_active = $${paramCount++}`;
      params.push(filters.isActive);
    }

    if (filters.search) {
      sql += ` AND (company_name ILIKE $${paramCount} OR business_name ILIKE $${paramCount} OR name ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
      paramCount++;
    }

    const { toSortString } = require('../../utils/sortParam');
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

  async findWithPagination(filters = {}, options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    let countSql = 'SELECT COUNT(*) FROM suppliers WHERE is_deleted = FALSE';
    const countParams = [];
    let paramCount = 1;
    if (filters.isActive !== undefined) { countSql += ` AND is_active = $${paramCount++}`; countParams.push(filters.isActive); }
    if (filters.search) { countSql += ` AND (company_name ILIKE $${paramCount} OR business_name ILIKE $${paramCount} OR name ILIKE $${paramCount} OR email ILIKE $${paramCount})`; countParams.push(`%${filters.search}%`); paramCount++; }
    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count, 10);

    const suppliers = await this.findAll(filters, { ...options, limit, offset });

    return {
      suppliers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async create(supplierData) {
    const openingBalance = supplierData.openingBalance ?? 0;
    const pendingBalance = openingBalance >= 0 ? openingBalance : 0;
    const advanceBalance = openingBalance < 0 ? Math.abs(openingBalance) : 0;
    const contactPerson = supplierData.contactPerson != null
      ? (typeof supplierData.contactPerson === 'string' ? supplierData.contactPerson : (supplierData.contactPerson?.name || null))
      : null;
    const isActive = supplierData.isActive !== undefined
      ? !!supplierData.isActive
      : (supplierData.status !== 'inactive' && supplierData.status !== 'suspended');
    const supplierType = (supplierData.businessType || supplierData.supplier_type || 'other');
    const rating = Math.min(5, Math.max(0, parseInt(supplierData.rating, 10) || 3));
    const result = await query(
      `INSERT INTO suppliers (
        name, company_name, contact_person, email, phone, address,
        opening_balance, pending_balance, advance_balance, current_balance, credit_limit, payment_terms, tax_id, notes,
        is_active, supplier_type, rating, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        supplierData.name || null,
        supplierData.companyName || supplierData.company_name || null,
        contactPerson,
        supplierData.email || null,
        supplierData.phone || null,
        supplierData.address ? (typeof supplierData.address === 'object' ? JSON.stringify(supplierData.address) : supplierData.address) : (supplierData.addresses ? JSON.stringify(supplierData.addresses) : null),
        openingBalance,
        supplierData.pendingBalance ?? pendingBalance,
        supplierData.advanceBalance ?? advanceBalance,
        (supplierData.pendingBalance ?? pendingBalance) - (supplierData.advanceBalance ?? advanceBalance),
        supplierData.creditLimit || 0,
        supplierData.paymentTerms || supplierData.payment_terms || null,
        supplierData.taxId || supplierData.tax_id || null,
        supplierData.notes || null,
        isActive,
        supplierType,
        rating,
        supplierData.createdBy || supplierData.created_by || null
      ]
    );
    return result.rows[0];
  }

  async update(id, supplierData) {
    const updates = [];
    const params = [];
    let paramCount = 1;

    if (supplierData.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      params.push(supplierData.name);
    }
    if (supplierData.companyName !== undefined) {
      updates.push(`company_name = $${paramCount++}`);
      params.push(supplierData.companyName);
    }
    if (supplierData.contactPerson !== undefined) {
      const cp = typeof supplierData.contactPerson === 'string'
        ? supplierData.contactPerson
        : (supplierData.contactPerson?.name ?? null);
      updates.push(`contact_person = $${paramCount++}`);
      params.push(cp);
    }
    if (supplierData.phone !== undefined) {
      updates.push(`phone = $${paramCount++}`);
      params.push(supplierData.phone);
    }
    if (supplierData.address !== undefined) {
      updates.push(`address = $${paramCount++}`);
      params.push(typeof supplierData.address === 'object' ? JSON.stringify(supplierData.address) : supplierData.address);
    }
    if (supplierData.paymentTerms !== undefined) {
      updates.push(`payment_terms = $${paramCount++}`);
      params.push(supplierData.paymentTerms);
    }
    if (supplierData.taxId !== undefined) {
      updates.push(`tax_id = $${paramCount++}`);
      params.push(supplierData.taxId);
    }
    if (supplierData.notes !== undefined) {
      updates.push(`notes = $${paramCount++}`);
      params.push(supplierData.notes);
    }
    if (supplierData.isActive !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      params.push(supplierData.isActive);
    }
    if (supplierData.status !== undefined && supplierData.isActive === undefined) {
      updates.push(`is_active = $${paramCount++}`);
      params.push(supplierData.status !== 'inactive');
    }
    if (supplierData.businessType !== undefined || supplierData.supplier_type !== undefined) {
      updates.push(`supplier_type = $${paramCount++}`);
      params.push(supplierData.businessType || supplierData.supplier_type || 'other');
    }
    if (supplierData.rating !== undefined) {
      updates.push(`rating = $${paramCount++}`);
      params.push(Math.min(5, Math.max(0, parseInt(supplierData.rating, 10) || 3)));
    }
    if (supplierData.creditLimit !== undefined) {
      updates.push(`credit_limit = $${paramCount++}`);
      params.push(parseFloat(supplierData.creditLimit) || 0);
    }
    if (supplierData.updatedBy !== undefined) {
      updates.push(`updated_by = $${paramCount++}`);
      params.push(supplierData.updatedBy);
    }
    if (supplierData.pendingBalance !== undefined) {
      updates.push(`pending_balance = $${paramCount++}`);
      params.push(supplierData.pendingBalance);
    }
    if (supplierData.advanceBalance !== undefined) {
      updates.push(`advance_balance = $${paramCount++}`);
      params.push(supplierData.advanceBalance);
    }
    if (supplierData.currentBalance !== undefined) {
      updates.push(`current_balance = $${paramCount++}`);
      params.push(supplierData.currentBalance);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const result = await query(
      `UPDATE suppliers SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  async delete(id) {
    const result = await query(
      'UPDATE suppliers SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND is_deleted = FALSE RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }

  async findDeletedById(id) {
    const result = await query(
      'SELECT * FROM suppliers WHERE id = $1 AND is_deleted = TRUE',
      [id]
    );
    return result.rows[0] || null;
  }

  async findDeleted(filters = {}, options = {}) {
    let sql = 'SELECT * FROM suppliers WHERE is_deleted = TRUE';
    const params = [];
    let paramCount = 1;
    if (options.limit) { sql += ` LIMIT $${paramCount++}`; params.push(options.limit); }
    if (options.offset) { sql += ` OFFSET $${paramCount++}`; params.push(options.offset); }
    sql += ' ORDER BY deleted_at DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  async restore(id) {
    const result = await query(
      'UPDATE suppliers SET is_deleted = FALSE, deleted_at = NULL WHERE id = $1 AND is_deleted = TRUE RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }

  async findByEmail(email, excludeId = null) {
    if (!email) return null;
    let sql = 'SELECT * FROM suppliers WHERE LOWER(email) = LOWER($1) AND is_deleted = FALSE';
    const params = [email.trim()];
    if (excludeId) { sql += ' AND id != $2'; params.push(excludeId); }
    const result = await query(sql + ' LIMIT 1', params);
    return result.rows[0] || null;
  }

  async findByCompanyName(companyName, excludeId = null) {
    if (!companyName || !String(companyName).trim()) return null;
    let sql = 'SELECT * FROM suppliers WHERE TRIM(LOWER(company_name)) = TRIM(LOWER($1)) AND is_deleted = FALSE';
    const params = [String(companyName).trim()];
    if (excludeId) { sql += ' AND id != $2'; params.push(excludeId); }
    const result = await query(sql + ' LIMIT 1', params);
    return result.rows[0] || null;
  }
}

module.exports = new SupplierRepository();
