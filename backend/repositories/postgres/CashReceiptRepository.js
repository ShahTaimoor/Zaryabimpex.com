const { query } = require('../../config/postgres');

class CashReceiptRepository {
  async findById(id) {
    const result = await query(
      `SELECT 
        cr.*,
        s.id as joined_supplier_id,
        s.company_name as supplier_company_name,
        s.business_name as supplier_business_name,
        s.name as supplier_name,
        c.id as joined_customer_id,
        c.name as customer_name,
        c.business_name as customer_business_name
      FROM cash_receipts cr
      LEFT JOIN suppliers s ON cr.supplier_id = s.id AND s.deleted_at IS NULL
      LEFT JOIN customers c ON cr.customer_id = c.id AND c.deleted_at IS NULL
      WHERE cr.id = $1 AND cr.deleted_at IS NULL`,
      [id]
    );
    
    if (!result.rows[0]) {
      return null;
    }
    
    const row = result.rows[0];
    const receipt = { ...row };
    
    // Map receipt_number to voucherCode for frontend compatibility
    receipt.voucherCode = receipt.receipt_number || receipt.receiptNumber;
    
    // Build supplier object if supplier_id exists in cash_receipts
    if (row.supplier_id != null) {
      if (row.joined_supplier_id != null && (row.supplier_company_name != null || row.supplier_business_name != null || row.supplier_name != null)) {
        // Supplier exists and is not deleted
        const supDisplayName = row.supplier_business_name || row.supplier_company_name || row.supplier_name || 'Unknown Supplier';
        receipt.supplier = {
          id: row.supplier_id,
          _id: row.supplier_id,
          companyName: row.supplier_company_name,
          businessName: row.supplier_business_name,
          name: row.supplier_name,
          displayName: supDisplayName
        };
      } else {
        // Supplier ID exists but supplier was deleted
        receipt.supplier = {
          id: row.supplier_id,
          _id: row.supplier_id,
          companyName: null,
          businessName: null,
          name: null,
          displayName: 'Deleted Supplier'
        };
      }
    }
    
    // Build customer object if customer_id exists in cash_receipts
    if (row.customer_id != null) {
      if (row.joined_customer_id != null && (row.customer_name != null || row.customer_business_name != null)) {
        // Customer exists and is not deleted
        receipt.customer = {
          id: row.customer_id,
          _id: row.customer_id,
          name: row.customer_name,
          businessName: row.customer_business_name,
          displayName: row.customer_business_name || row.customer_name || 'Unknown Customer'
        };
      } else {
        // Customer ID exists but customer was deleted
        receipt.customer = {
          id: row.customer_id,
          _id: row.customer_id,
          name: null,
          businessName: null,
          displayName: 'Deleted Customer'
        };
      }
    }
    
    // Remove duplicate/helper fields
    if (receipt.joined_supplier_id !== undefined) delete receipt.joined_supplier_id;
    if (receipt.supplier_company_name !== undefined) delete receipt.supplier_company_name;
    if (receipt.supplier_business_name !== undefined) delete receipt.supplier_business_name;
    if (receipt.supplier_name !== undefined) delete receipt.supplier_name;
    if (receipt.joined_customer_id !== undefined) delete receipt.joined_customer_id;
    if (receipt.customer_name !== undefined) delete receipt.customer_name;
    if (receipt.customer_business_name !== undefined) delete receipt.customer_business_name;
    
    return receipt;
  }

  async findAll(filters = {}, options = {}) {
    // Build base SQL with LEFT JOINs for supplier and customer
    let sql = `
      SELECT 
        cr.*,
        s.id as joined_supplier_id,
        s.company_name as supplier_company_name,
        s.business_name as supplier_business_name,
        s.name as supplier_name,
        c.id as joined_customer_id,
        c.name as customer_name,
        c.business_name as customer_business_name
      FROM cash_receipts cr
      LEFT JOIN suppliers s ON cr.supplier_id = s.id AND s.deleted_at IS NULL
      LEFT JOIN customers c ON cr.customer_id = c.id AND c.deleted_at IS NULL
      WHERE cr.deleted_at IS NULL
    `;
    const params = [];
    let paramCount = 1;

    if (filters.supplierId) {
      sql += ` AND cr.supplier_id = $${paramCount++}`;
      params.push(filters.supplierId);
    }
    if (filters.customerId) {
      sql += ` AND cr.customer_id = $${paramCount++}`;
      params.push(filters.customerId);
    }

    if (filters.startDate) {
      sql += ` AND cr.date >= $${paramCount++}`;
      // Ensure date is a proper Date object for PostgreSQL
      const startDate = filters.startDate instanceof Date ? filters.startDate : new Date(filters.startDate);
      params.push(startDate);
    }

    if (filters.endDate) {
      sql += ` AND cr.date <= $${paramCount++}`;
      // Ensure date is a proper Date object for PostgreSQL
      const endDate = filters.endDate instanceof Date ? filters.endDate : new Date(filters.endDate);
      params.push(endDate);
    }

    const { toSortString } = require('../../utils/sortParam');
    const sortStr = toSortString(options.sort, 'date DESC');
    const [field, direction] = sortStr.split(' ');
    sql += ` ORDER BY cr.${field} ${direction || 'DESC'}`;

    if (options.limit) {
      sql += ` LIMIT $${paramCount++}`;
      params.push(options.limit);
    }

    const result = await query(sql, params);
    
    // Transform results to include supplier/customer objects and map receipt_number to voucherCode
    const receipts = result.rows.map(row => {
      const receipt = { ...row };
      // Map receipt_number to voucherCode for frontend compatibility
      receipt.voucherCode = receipt.receipt_number || receipt.receiptNumber;
      
      // Build supplier object if supplier_id exists in cash_receipts
      if (row.supplier_id != null) {
        if (row.joined_supplier_id != null && (row.supplier_company_name != null || row.supplier_business_name != null || row.supplier_name != null)) {
          // Supplier exists and is not deleted
          const supDisplayName = row.supplier_business_name || row.supplier_company_name || row.supplier_name || 'Unknown Supplier';
          receipt.supplier = {
            id: row.supplier_id,
            _id: row.supplier_id,
            companyName: row.supplier_company_name,
            businessName: row.supplier_business_name,
            name: row.supplier_name,
            displayName: supDisplayName
          };
        } else {
          // Supplier ID exists but supplier was deleted
          receipt.supplier = {
            id: row.supplier_id,
            _id: row.supplier_id,
            companyName: null,
            businessName: null,
            name: null,
            displayName: 'Deleted Supplier'
          };
        }
      }
      
      // Build customer object if customer_id exists in cash_receipts
      if (row.customer_id != null) {
        if (row.joined_customer_id != null && (row.customer_name != null || row.customer_business_name != null)) {
          // Customer exists and is not deleted
          receipt.customer = {
            id: row.customer_id,
            _id: row.customer_id,
            name: row.customer_name,
            businessName: row.customer_business_name,
            displayName: row.customer_business_name || row.customer_name || 'Unknown Customer'
          };
        } else {
          // Customer ID exists but customer was deleted
          receipt.customer = {
            id: row.customer_id,
            _id: row.customer_id,
            name: null,
            businessName: null,
            displayName: 'Deleted Customer'
          };
        }
      }
      
      // Remove duplicate/helper fields
      if (receipt.joined_supplier_id !== undefined) delete receipt.joined_supplier_id;
      if (receipt.supplier_company_name !== undefined) delete receipt.supplier_company_name;
      if (receipt.supplier_business_name !== undefined) delete receipt.supplier_business_name;
      if (receipt.supplier_name !== undefined) delete receipt.supplier_name;
      if (receipt.joined_customer_id !== undefined) delete receipt.joined_customer_id;
      if (receipt.customer_name !== undefined) delete receipt.customer_name;
      if (receipt.customer_business_name !== undefined) delete receipt.customer_business_name;
      
      return receipt;
    });
    
    return receipts;
  }

  async findWithPagination(filters = {}, options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;
    
    // Build base SQL with LEFT JOINs for supplier and customer
    let sql = `
      SELECT 
        cr.*,
        s.id as joined_supplier_id,
        s.company_name as supplier_company_name,
        s.business_name as supplier_business_name,
        s.name as supplier_name,
        c.id as joined_customer_id,
        c.name as customer_name,
        c.business_name as customer_business_name
      FROM cash_receipts cr
      LEFT JOIN suppliers s ON cr.supplier_id = s.id AND s.deleted_at IS NULL
      LEFT JOIN customers c ON cr.customer_id = c.id AND c.deleted_at IS NULL
      WHERE cr.deleted_at IS NULL
    `;
    const params = [];
    let paramCount = 1;

    if (filters.supplierId) {
      sql += ` AND cr.supplier_id = $${paramCount++}`;
      params.push(filters.supplierId);
    }
    if (filters.customerId) {
      sql += ` AND cr.customer_id = $${paramCount++}`;
      params.push(filters.customerId);
    }
    if (filters.startDate) {
      sql += ` AND cr.date >= $${paramCount++}`;
      // Ensure date is a proper Date object for PostgreSQL
      const startDate = filters.startDate instanceof Date ? filters.startDate : new Date(filters.startDate);
      params.push(startDate);
    }
    if (filters.endDate) {
      sql += ` AND cr.date <= $${paramCount++}`;
      // Ensure date is a proper Date object for PostgreSQL
      const endDate = filters.endDate instanceof Date ? filters.endDate : new Date(filters.endDate);
      params.push(endDate);
    }
    if (filters.voucherCode) {
      sql += ` AND cr.receipt_number ILIKE $${paramCount++}`;
      params.push(`%${filters.voucherCode}%`);
    }
    if (filters.amount != null && filters.amount !== '') {
      sql += ` AND cr.amount = $${paramCount++}`;
      params.push(parseFloat(filters.amount));
    }
    if (filters.particular) {
      sql += ` AND cr.particular ILIKE $${paramCount++}`;
      params.push(`%${filters.particular}%`);
    }

    // Count query (simplified, without JOINs for performance)
    let countSql = 'SELECT COUNT(*) FROM cash_receipts cr WHERE cr.deleted_at IS NULL';
    const countParams = [];
    let countParamCount = 1;

    if (filters.supplierId) {
      countSql += ` AND cr.supplier_id = $${countParamCount++}`;
      countParams.push(filters.supplierId);
    }
    if (filters.customerId) {
      countSql += ` AND cr.customer_id = $${countParamCount++}`;
      countParams.push(filters.customerId);
    }
    if (filters.startDate) {
      countSql += ` AND cr.date >= $${countParamCount++}`;
      // Ensure date is a proper Date object or ISO string for PostgreSQL
      const startDate = filters.startDate instanceof Date ? filters.startDate : new Date(filters.startDate);
      countParams.push(startDate);
    }
    if (filters.endDate) {
      countSql += ` AND cr.date <= $${countParamCount++}`;
      // Ensure date is a proper Date object or ISO string for PostgreSQL
      const endDate = filters.endDate instanceof Date ? filters.endDate : new Date(filters.endDate);
      countParams.push(endDate);
    }
    if (filters.voucherCode) {
      countSql += ` AND cr.receipt_number ILIKE $${countParamCount++}`;
      countParams.push(`%${filters.voucherCode}%`);
    }
    if (filters.amount != null && filters.amount !== '') {
      countSql += ` AND cr.amount = $${countParamCount++}`;
      countParams.push(parseFloat(filters.amount));
    }
    if (filters.particular) {
      countSql += ` AND cr.particular ILIKE $${countParamCount++}`;
      countParams.push(`%${filters.particular}%`);
    }
    
    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count, 10);

    sql += ' ORDER BY cr.date DESC';
    sql += ` LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(limit, offset);
    const result = await query(sql, params);

    // Transform results to include supplier/customer objects and map receipt_number to voucherCode
    const receipts = result.rows.map(row => {
      const receipt = { ...row };
      // Map receipt_number to voucherCode for frontend compatibility
      receipt.voucherCode = receipt.receipt_number || receipt.receiptNumber;
      
      // Build supplier object if supplier_id exists in cash_receipts
      if (row.supplier_id != null) {
        if (row.joined_supplier_id != null && (row.supplier_company_name != null || row.supplier_business_name != null || row.supplier_name != null)) {
          // Supplier exists and is not deleted
          const supDisplayName = row.supplier_business_name || row.supplier_company_name || row.supplier_name || 'Unknown Supplier';
          receipt.supplier = {
            id: row.supplier_id,
            _id: row.supplier_id,
            companyName: row.supplier_company_name,
            businessName: row.supplier_business_name,
            name: row.supplier_name,
            displayName: supDisplayName
          };
        } else {
          // Supplier ID exists but supplier was deleted
          receipt.supplier = {
            id: row.supplier_id,
            _id: row.supplier_id,
            companyName: null,
            businessName: null,
            name: null,
            displayName: 'Deleted Supplier'
          };
        }
      }
      
      // Build customer object if customer_id exists in cash_receipts
      if (row.customer_id != null) {
        if (row.joined_customer_id != null && (row.customer_name != null || row.customer_business_name != null)) {
          // Customer exists and is not deleted
          receipt.customer = {
            id: row.customer_id,
            _id: row.customer_id,
            name: row.customer_name,
            businessName: row.customer_business_name,
            displayName: row.customer_business_name || row.customer_name || 'Unknown Customer'
          };
        } else {
          // Customer ID exists but customer was deleted
          receipt.customer = {
            id: row.customer_id,
            _id: row.customer_id,
            name: null,
            businessName: null,
            displayName: 'Deleted Customer'
          };
        }
      }
      
      // Remove duplicate/helper fields
      if (receipt.joined_supplier_id !== undefined) delete receipt.joined_supplier_id;
      if (receipt.supplier_company_name !== undefined) delete receipt.supplier_company_name;
      if (receipt.supplier_business_name !== undefined) delete receipt.supplier_business_name;
      if (receipt.supplier_name !== undefined) delete receipt.supplier_name;
      if (receipt.joined_customer_id !== undefined) delete receipt.joined_customer_id;
      if (receipt.customer_name !== undefined) delete receipt.customer_name;
      if (receipt.customer_business_name !== undefined) delete receipt.customer_business_name;
      
      return receipt;
    });

    return {
      cashReceipts: receipts,
      total,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async update(id, receiptData, client = null) {
    const updates = [];
    const params = [];
    let paramCount = 1;

    if (receiptData.date !== undefined) {
      updates.push(`date = $${paramCount++}`);
      params.push(receiptData.date);
    }
    if (receiptData.amount !== undefined) {
      updates.push(`amount = $${paramCount++}`);
      params.push(receiptData.amount);
    }
    if (receiptData.particular !== undefined) {
      updates.push(`particular = $${paramCount++}`);
      params.push(receiptData.particular);
    }
    if (receiptData.supplierId !== undefined) {
      updates.push(`supplier_id = $${paramCount++}`);
      params.push(receiptData.supplierId);
    }
    if (receiptData.customerId !== undefined) {
      updates.push(`customer_id = $${paramCount++}`);
      params.push(receiptData.customerId);
    }
    if (receiptData.paymentMethod !== undefined) {
      updates.push(`payment_method = $${paramCount++}`);
      params.push(receiptData.paymentMethod);
    }
    if (receiptData.notes !== undefined) {
      updates.push(`notes = $${paramCount++}`);
      params.push(receiptData.notes);
    }

    if (updates.length === 0) {
      return await this.findById(id);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const q = client ? client.query.bind(client) : query;
    const result = await q(
      `UPDATE cash_receipts SET ${updates.join(', ')} WHERE id = $${paramCount} AND deleted_at IS NULL RETURNING *`,
      params
    );
    
    if (!result.rows[0]) {
      return null;
    }
    
    // Return the updated receipt with customer data using findById
    return await this.findById(id);
  }

  async delete(id) {
    const result = await query(
      'UPDATE cash_receipts SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }

  async create(receiptData, client = null) {
    const q = client ? client.query.bind(client) : query;
    const result = await q(
      `INSERT INTO cash_receipts (
        receipt_number, date, amount, supplier_id, customer_id,
        particular, payment_method, notes, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        receiptData.receiptNumber || `CR-${Date.now()}`,
        receiptData.date || new Date(),
        receiptData.amount,
        receiptData.supplierId || receiptData.supplier_id || null,
        receiptData.customerId || receiptData.customer_id || null,
        receiptData.particular || null,
        receiptData.paymentMethod || 'cash',
        receiptData.notes || null,
        receiptData.createdBy || receiptData.created_by || null
      ]
    );
    return result.rows[0];
  }

}

module.exports = new CashReceiptRepository();
