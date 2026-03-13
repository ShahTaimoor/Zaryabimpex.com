const { query } = require('../../config/postgres');

class BankPaymentRepository {
  async findById(id) {
    const result = await query(
      `SELECT 
        bp.*,
        s.id as joined_supplier_id,
        s.company_name as supplier_company_name,
        s.business_name as supplier_business_name,
        c.id as joined_customer_id,
        c.name as customer_name,
        c.business_name as customer_business_name
      FROM bank_payments bp
      LEFT JOIN suppliers s ON bp.supplier_id = s.id AND s.deleted_at IS NULL
      LEFT JOIN customers c ON bp.customer_id = c.id AND c.deleted_at IS NULL
      WHERE bp.id = $1 AND bp.deleted_at IS NULL`,
      [id]
    );
    
    if (!result.rows[0]) {
      return null;
    }
    
    const row = result.rows[0];
    const payment = { ...row };
    
    // Map payment_number to voucherCode for frontend compatibility
    payment.voucherCode = payment.payment_number || payment.paymentNumber;
    
    // Build supplier object if supplier_id exists in bank_payments
    if (row.supplier_id != null) {
      if (row.joined_supplier_id != null && (row.supplier_company_name != null || row.supplier_business_name != null)) {
        // Supplier exists and is not deleted
        payment.supplier = {
          id: row.supplier_id,
          _id: row.supplier_id,
          companyName: row.supplier_company_name,
          businessName: row.supplier_business_name,
          displayName: row.supplier_business_name || row.supplier_company_name || 'Unknown Supplier'
        };
      } else {
        // Supplier ID exists but supplier was deleted
        payment.supplier = {
          id: row.supplier_id,
          _id: row.supplier_id,
          companyName: null,
          businessName: null,
          displayName: 'Deleted Supplier'
        };
      }
    }
    
    // Build customer object if customer_id exists in bank_payments
    if (row.customer_id != null) {
      if (row.joined_customer_id != null && (row.customer_name != null || row.customer_business_name != null)) {
        // Customer exists and is not deleted
        payment.customer = {
          id: row.customer_id,
          _id: row.customer_id,
          name: row.customer_name,
          businessName: row.customer_business_name,
          displayName: row.customer_business_name || row.customer_name || 'Unknown Customer'
        };
      } else {
        // Customer ID exists but customer was deleted
        payment.customer = {
          id: row.customer_id,
          _id: row.customer_id,
          name: null,
          businessName: null,
          displayName: 'Deleted Customer'
        };
      }
    }
    
    // Remove duplicate/helper fields
    if (payment.joined_supplier_id !== undefined) delete payment.joined_supplier_id;
    if (payment.supplier_company_name !== undefined) delete payment.supplier_company_name;
    if (payment.supplier_business_name !== undefined) delete payment.supplier_business_name;
    if (payment.joined_customer_id !== undefined) delete payment.joined_customer_id;
    if (payment.customer_name !== undefined) delete payment.customer_name;
    if (payment.customer_business_name !== undefined) delete payment.customer_business_name;
    
    return payment;
  }

  async findAll(filters = {}, options = {}) {
    // Build base SQL with LEFT JOINs for supplier and customer
    let sql = `
      SELECT 
        bp.*,
        s.id as joined_supplier_id,
        s.company_name as supplier_company_name,
        s.business_name as supplier_business_name,
        c.id as joined_customer_id,
        c.name as customer_name,
        c.business_name as customer_business_name
      FROM bank_payments bp
      LEFT JOIN suppliers s ON bp.supplier_id = s.id AND s.deleted_at IS NULL
      LEFT JOIN customers c ON bp.customer_id = c.id AND c.deleted_at IS NULL
      WHERE bp.deleted_at IS NULL
    `;
    const params = [];
    let paramCount = 1;

    if (filters.supplierId) {
      sql += ` AND bp.supplier_id = $${paramCount++}`;
      params.push(filters.supplierId);
    }

    if (filters.customerId) {
      sql += ` AND bp.customer_id = $${paramCount++}`;
      params.push(filters.customerId);
    }
    if (filters.startDate) {
      sql += ` AND bp.date >= $${paramCount++}`;
      // Ensure date is a proper Date object for PostgreSQL
      const startDate = filters.startDate instanceof Date ? filters.startDate : new Date(filters.startDate);
      params.push(startDate);
    }
    if (filters.endDate) {
      sql += ` AND bp.date <= $${paramCount++}`;
      // Ensure date is a proper Date object for PostgreSQL
      const endDate = filters.endDate instanceof Date ? filters.endDate : new Date(filters.endDate);
      params.push(endDate);
    }
    if (filters.voucherCode) {
      sql += ` AND bp.payment_number ILIKE $${paramCount++}`;
      params.push(`%${filters.voucherCode}%`);
    }
    if (filters.amount != null && filters.amount !== '') {
      sql += ` AND bp.amount = $${paramCount++}`;
      params.push(parseFloat(filters.amount));
    }
    if (filters.particular) {
      sql += ` AND bp.particular ILIKE $${paramCount++}`;
      params.push(`%${filters.particular}%`);
    }

    sql += ' ORDER BY bp.date DESC';

    if (options.limit) {
      sql += ` LIMIT $${paramCount++}`;
      params.push(options.limit);
    }

    const result = await query(sql, params);
    
    // Transform results to include supplier/customer objects and map payment_number to voucherCode
    const payments = result.rows.map(row => {
      const payment = { ...row };
      // Map payment_number to voucherCode for frontend compatibility
      payment.voucherCode = payment.payment_number || payment.paymentNumber;
      
      // Build supplier object if supplier_id exists in bank_payments
      if (row.supplier_id != null) {
        if (row.joined_supplier_id != null && (row.supplier_company_name != null || row.supplier_business_name != null)) {
          // Supplier exists and is not deleted
          payment.supplier = {
            id: row.supplier_id,
            _id: row.supplier_id,
            companyName: row.supplier_company_name,
            businessName: row.supplier_business_name,
            displayName: row.supplier_business_name || row.supplier_company_name || 'Unknown Supplier'
          };
        } else {
          // Supplier ID exists but supplier was deleted
          payment.supplier = {
            id: row.supplier_id,
            _id: row.supplier_id,
            companyName: null,
            businessName: null,
            displayName: 'Deleted Supplier'
          };
        }
      }
      
      // Build customer object if customer_id exists in bank_payments
      if (row.customer_id != null) {
        if (row.joined_customer_id != null && (row.customer_name != null || row.customer_business_name != null)) {
          // Customer exists and is not deleted
          payment.customer = {
            id: row.customer_id,
            _id: row.customer_id,
            name: row.customer_name,
            businessName: row.customer_business_name,
            displayName: row.customer_business_name || row.customer_name || 'Unknown Customer'
          };
        } else {
          // Customer ID exists but customer was deleted
          payment.customer = {
            id: row.customer_id,
            _id: row.customer_id,
            name: null,
            businessName: null,
            displayName: 'Deleted Customer'
          };
        }
      }
      
      // Remove duplicate/helper fields
      if (payment.joined_supplier_id !== undefined) delete payment.joined_supplier_id;
      if (payment.supplier_company_name !== undefined) delete payment.supplier_company_name;
      if (payment.supplier_business_name !== undefined) delete payment.supplier_business_name;
      if (payment.joined_customer_id !== undefined) delete payment.joined_customer_id;
      if (payment.customer_name !== undefined) delete payment.customer_name;
      if (payment.customer_business_name !== undefined) delete payment.customer_business_name;
      
      return payment;
    });
    
    return payments;
  }

  async findWithPagination(filters = {}, options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;
    
    // Build base SQL with LEFT JOINs for supplier and customer
    let sql = `
      SELECT 
        bp.*,
        s.id as joined_supplier_id,
        s.company_name as supplier_company_name,
        s.business_name as supplier_business_name,
        c.id as joined_customer_id,
        c.name as customer_name,
        c.business_name as customer_business_name
      FROM bank_payments bp
      LEFT JOIN suppliers s ON bp.supplier_id = s.id AND s.deleted_at IS NULL
      LEFT JOIN customers c ON bp.customer_id = c.id AND c.deleted_at IS NULL
      WHERE bp.deleted_at IS NULL
    `;
    const params = [];
    let paramCount = 1;

    if (filters.supplierId) {
      sql += ` AND bp.supplier_id = $${paramCount++}`;
      params.push(filters.supplierId);
    }
    if (filters.customerId) {
      sql += ` AND bp.customer_id = $${paramCount++}`;
      params.push(filters.customerId);
    }
    if (filters.startDate) {
      sql += ` AND bp.date >= $${paramCount++}`;
      // Ensure date is a proper Date object for PostgreSQL
      const startDate = filters.startDate instanceof Date ? filters.startDate : new Date(filters.startDate);
      params.push(startDate);
    }
    if (filters.endDate) {
      sql += ` AND bp.date <= $${paramCount++}`;
      // Ensure date is a proper Date object for PostgreSQL
      const endDate = filters.endDate instanceof Date ? filters.endDate : new Date(filters.endDate);
      params.push(endDate);
    }
    if (filters.voucherCode) {
      sql += ` AND bp.payment_number ILIKE $${paramCount++}`;
      params.push(`%${filters.voucherCode}%`);
    }
    if (filters.amount != null && filters.amount !== '') {
      sql += ` AND bp.amount = $${paramCount++}`;
      params.push(parseFloat(filters.amount));
    }
    if (filters.particular) {
      sql += ` AND bp.particular ILIKE $${paramCount++}`;
      params.push(`%${filters.particular}%`);
    }

    // Count query (simplified, without JOINs for performance)
    let countSql = 'SELECT COUNT(*) FROM bank_payments bp WHERE bp.deleted_at IS NULL';
    const countParams = [];
    let countParamCount = 1;

    if (filters.supplierId) {
      countSql += ` AND bp.supplier_id = $${countParamCount++}`;
      countParams.push(filters.supplierId);
    }
    if (filters.customerId) {
      countSql += ` AND bp.customer_id = $${countParamCount++}`;
      countParams.push(filters.customerId);
    }
    if (filters.startDate) {
      countSql += ` AND bp.date >= $${countParamCount++}`;
      // Ensure date is a proper Date object for PostgreSQL
      const startDate = filters.startDate instanceof Date ? filters.startDate : new Date(filters.startDate);
      countParams.push(startDate);
    }
    if (filters.endDate) {
      countSql += ` AND bp.date <= $${countParamCount++}`;
      // Ensure date is a proper Date object for PostgreSQL
      const endDate = filters.endDate instanceof Date ? filters.endDate : new Date(filters.endDate);
      countParams.push(endDate);
    }
    if (filters.voucherCode) {
      countSql += ` AND bp.payment_number ILIKE $${countParamCount++}`;
      countParams.push(`%${filters.voucherCode}%`);
    }
    if (filters.amount != null && filters.amount !== '') {
      countSql += ` AND bp.amount = $${countParamCount++}`;
      countParams.push(parseFloat(filters.amount));
    }
    if (filters.particular) {
      countSql += ` AND bp.particular ILIKE $${countParamCount++}`;
      countParams.push(`%${filters.particular}%`);
    }
    
    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count, 10);

    sql += ' ORDER BY bp.date DESC';
    sql += ` LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(limit, offset);
    const result = await query(sql, params);

    // Transform results to include supplier/customer objects and map payment_number to voucherCode
    const bankPayments = result.rows.map(row => {
      const payment = { ...row };
      // Map payment_number to voucherCode for frontend compatibility
      payment.voucherCode = payment.payment_number || payment.paymentNumber;
      
      // Build supplier object if supplier_id exists in bank_payments
      if (row.supplier_id != null) {
        if (row.joined_supplier_id != null && (row.supplier_company_name != null || row.supplier_business_name != null)) {
          // Supplier exists and is not deleted
          payment.supplier = {
            id: row.supplier_id,
            _id: row.supplier_id,
            companyName: row.supplier_company_name,
            businessName: row.supplier_business_name,
            displayName: row.supplier_business_name || row.supplier_company_name || 'Unknown Supplier'
          };
        } else {
          // Supplier ID exists but supplier was deleted
          payment.supplier = {
            id: row.supplier_id,
            _id: row.supplier_id,
            companyName: null,
            businessName: null,
            displayName: 'Deleted Supplier'
          };
        }
      }
      
      // Build customer object if customer_id exists in bank_payments
      if (row.customer_id != null) {
        if (row.joined_customer_id != null && (row.customer_name != null || row.customer_business_name != null)) {
          // Customer exists and is not deleted
          payment.customer = {
            id: row.customer_id,
            _id: row.customer_id,
            name: row.customer_name,
            businessName: row.customer_business_name,
            displayName: row.customer_business_name || row.customer_name || 'Unknown Customer'
          };
        } else {
          // Customer ID exists but customer was deleted
          payment.customer = {
            id: row.customer_id,
            _id: row.customer_id,
            name: null,
            businessName: null,
            displayName: 'Deleted Customer'
          };
        }
      }
      
      // Remove duplicate/helper fields
      if (payment.joined_supplier_id !== undefined) delete payment.joined_supplier_id;
      if (payment.supplier_company_name !== undefined) delete payment.supplier_company_name;
      if (payment.supplier_business_name !== undefined) delete payment.supplier_business_name;
      if (payment.joined_customer_id !== undefined) delete payment.joined_customer_id;
      if (payment.customer_name !== undefined) delete payment.customer_name;
      if (payment.customer_business_name !== undefined) delete payment.customer_business_name;
      
      return payment;
    });

    return {
      bankPayments,
      total,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async update(id, paymentData, client = null) {
    const updates = [];
    const params = [];
    let paramCount = 1;

    if (paymentData.date !== undefined) {
      updates.push(`date = $${paramCount++}`);
      params.push(paymentData.date);
    }
    if (paymentData.amount !== undefined) {
      updates.push(`amount = $${paramCount++}`);
      params.push(paymentData.amount);
    }
    if (paymentData.particular !== undefined) {
      updates.push(`particular = $${paramCount++}`);
      params.push(paymentData.particular);
    }
    if (paymentData.bankId !== undefined) {
      updates.push(`bank_id = $${paramCount++}`);
      params.push(paymentData.bankId);
    }
    if (paymentData.transactionReference !== undefined) {
      updates.push(`transaction_reference = $${paramCount++}`);
      params.push(paymentData.transactionReference);
    }
    if (paymentData.supplierId !== undefined) {
      updates.push(`supplier_id = $${paramCount++}`);
      params.push(paymentData.supplierId);
    }
    if (paymentData.customerId !== undefined) {
      updates.push(`customer_id = $${paramCount++}`);
      params.push(paymentData.customerId);
    }
    if (paymentData.notes !== undefined) {
      updates.push(`notes = $${paramCount++}`);
      params.push(paymentData.notes);
    }
    if (paymentData.updatedBy !== undefined) {
      updates.push(`updated_by = $${paramCount++}`);
      params.push(paymentData.updatedBy);
    }

    if (updates.length === 0) {
      return await this.findById(id);
    }
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    const q = client ? client.query.bind(client) : query;
    const result = await q(
      `UPDATE bank_payments SET ${updates.join(', ')} WHERE id = $${paramCount} AND deleted_at IS NULL RETURNING *`,
      params
    );
    
    if (!result.rows[0]) {
      return null;
    }
    
    if (client) return result.rows[0];
    // Return the updated payment with supplier/customer data using findById
    return await this.findById(id);
  }

  async delete(id) {
    const result = await query(
      'UPDATE bank_payments SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }

  async countByBankId(bankId) {
    const result = await query(
      'SELECT COUNT(*) AS count FROM bank_payments WHERE deleted_at IS NULL AND bank_id = $1',
      [bankId]
    );
    return parseInt(result.rows[0]?.count || 0, 10);
  }

  async getSummary(fromDate, toDate) {
    const result = await query(
      `SELECT
        COUNT(*) AS total_count,
        COALESCE(SUM(amount), 0) AS total_amount
       FROM bank_payments
       WHERE deleted_at IS NULL
         AND date >= $1
         AND date <= $2`,
      [fromDate, toDate]
    );
    const row = result.rows[0];
    const totalCount = parseInt(row.total_count, 10);
    const totalAmount = parseFloat(row.total_amount) || 0;
    return {
      totalCount,
      totalAmount,
      averageAmount: totalCount > 0 ? totalAmount / totalCount : 0
    };
  }

  async create(paymentData, client) {
    const q = client ? client.query.bind(client) : query;
    const result = await q(
      `INSERT INTO bank_payments (
        payment_number, date, amount, bank_id, supplier_id, customer_id,
        particular, transaction_reference, notes, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        paymentData.paymentNumber || `BP-${Date.now()}`,
        paymentData.date || new Date(),
        paymentData.amount,
        paymentData.bankId || paymentData.bank_id || null,
        paymentData.supplierId || paymentData.supplier_id || null,
        paymentData.customerId || paymentData.customer_id || null,
        paymentData.particular || null,
        paymentData.transactionReference || paymentData.transaction_reference || null,
        paymentData.notes || null,
        paymentData.createdBy || paymentData.created_by || null
      ]
    );
    return result.rows[0];
  }
}

module.exports = new BankPaymentRepository();
