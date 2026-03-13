const { query } = require('../../config/postgres');

// Extract address from stored supplier_info (JSONB) when supplier table address is empty
function getAddressFromSupplierInfo(supplierInfo) {
  if (!supplierInfo) return '';
  const si = typeof supplierInfo === 'string' ? (() => { try { return JSON.parse(supplierInfo); } catch (e) { return null; } })() : supplierInfo;
  if (!si || typeof si !== 'object') return '';
  if (typeof si.address === 'string' && si.address.trim()) return si.address.trim();
  if (Array.isArray(si.address) && si.address.length > 0) {
    const a = si.address.find(x => x.isDefault) || si.address.find(x => x.type === 'billing' || x.type === 'both') || si.address[0];
    const parts = [a.street || a.address_line1 || a.addressLine1 || a.line1, a.address_line2 || a.addressLine2 || a.line2, a.city, a.state || a.province, a.country, a.zipCode || a.zip || a.postalCode || a.postal_code].filter(Boolean);
    return parts.join(', ');
  }
  if (si.address && typeof si.address === 'object') {
    const parts = [
      si.address.street || si.address.address_line1 || si.address.addressLine1 || si.address.line1,
      si.address.address_line2 || si.address.addressLine2 || si.address.line2,
      si.address.city,
      si.address.state || si.address.province,
      si.address.country,
      si.address.zipCode || si.address.zip || si.address.postalCode || si.address.postal_code
    ].filter(Boolean);
    return parts.join(', ');
  }
  // Handle addresses array (e.g. from suppliers with multiple addresses)
  if (si.addresses && Array.isArray(si.addresses) && si.addresses.length > 0) {
    const addr = si.addresses.find(a => a.isDefault) || si.addresses.find(a => a.type === 'billing' || a.type === 'both') || si.addresses[0];
    const parts = [
      addr.street || addr.address_line1 || addr.addressLine1 || addr.line1,
      addr.address_line2 || addr.addressLine2 || addr.line2,
      addr.city,
      addr.state || addr.province,
      addr.country,
      addr.zipCode || addr.zip || addr.postalCode || addr.postal_code
    ].filter(Boolean);
    return parts.join(', ');
  }
  return '';
}

// Format supplier address from DB (can be string or JSON)
function formatSupplierAddressFromDb(rawAddress) {
  if (!rawAddress) return '';
  if (typeof rawAddress === 'string') {
    const trimmed = rawAddress.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const a = parsed.find(x => x.isDefault) || parsed.find(x => x.type === 'billing' || x.type === 'both') || parsed[0];
          const parts = [a.street || a.address_line1 || a.addressLine1 || a.line1, a.address_line2 || a.addressLine2 || a.line2, a.city, a.state || a.province, a.country, a.zipCode || a.zip || a.postalCode || a.postal_code].filter(Boolean);
          return parts.join(', ');
        }
        if (parsed && typeof parsed === 'object') {
          const parts = [parsed.street || parsed.address_line1 || parsed.addressLine1 || parsed.line1, parsed.address_line2 || parsed.addressLine2 || parsed.line2, parsed.city, parsed.state || parsed.province, parsed.country, parsed.zipCode || parsed.zip || parsed.postalCode || parsed.postal_code].filter(Boolean);
          return parts.join(', ');
        }
      } catch (e) {
        return trimmed;
      }
    }
    return trimmed;
  }
  if (Array.isArray(rawAddress) && rawAddress.length > 0) {
    const a = rawAddress.find(x => x.isDefault) || rawAddress.find(x => x.type === 'billing' || x.type === 'both') || rawAddress[0];
    const parts = [
      a.street || a.address_line1 || a.addressLine1 || a.line1,
      a.address_line2 || a.addressLine2 || a.line2,
      a.city,
      a.state || a.province,
      a.country,
      a.zipCode || a.zip || a.postalCode || a.postal_code
    ].filter(Boolean);
    return parts.join(', ');
  }
  if (typeof rawAddress === 'object') {
    const parts = [
      rawAddress.street || rawAddress.address_line1 || rawAddress.addressLine1 || rawAddress.line1,
      rawAddress.address_line2 || rawAddress.addressLine2 || rawAddress.line2,
      rawAddress.city,
      rawAddress.state || rawAddress.province,
      rawAddress.country,
      rawAddress.zipCode || rawAddress.zip || rawAddress.postalCode || rawAddress.postal_code
    ].filter(Boolean);
    return parts.join(', ');
  }
  return '';
}

// Enrich invoice items with product names (from products or product_variants table)
function applyProductNamesToItems(items, nameMap) {
  if (!items || !Array.isArray(items)) return;
  for (const item of items) {
    const pid = typeof item.product === 'object' ? item.product?._id || item.product?.id : item.product;
    const productName = pid ? nameMap[pid] : null;
    if (productName) {
      item.product = typeof item.product === 'object' ? { ...item.product, name: productName } : { _id: pid, name: productName };
    } else if (!item.name && !(typeof item.product === 'object' && item.product?.name)) {
      item.name = 'Unknown Product'; // Product may have been deleted
    }
  }
}

async function enrichItemsWithProductNames(invoiceOrInvoices) {
  try {
    const invoices = Array.isArray(invoiceOrInvoices) ? invoiceOrInvoices : [invoiceOrInvoices];
    const productIds = [];
    for (const inv of invoices) {
      if (!inv?.items || !Array.isArray(inv.items)) continue;
      for (const item of inv.items) {
        const pid = typeof item.product === 'object' ? item.product?._id || item.product?.id : item.product;
        if (pid && typeof pid === 'string' && !productIds.includes(pid)) productIds.push(pid);
      }
    }
    if (productIds.length === 0) return;

    const prodResult = await query(
      `SELECT id, name FROM products WHERE id = ANY($1::uuid[]) AND (is_deleted = FALSE OR is_deleted IS NULL)`,
      [productIds]
    );
    const varResult = await query(
      `SELECT id, COALESCE(display_name, variant_name) as name FROM product_variants WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
      [productIds]
    );
    const nameMap = {};
    for (const row of prodResult.rows) nameMap[row.id] = row.name;
    for (const row of varResult.rows) nameMap[row.id] = row.name;

    for (const inv of invoices) {
      if (inv?.items) applyProductNamesToItems(inv.items, nameMap);
    }
  } catch (err) {
    // Don't fail invoice fetch if product lookup fails (e.g. invalid UUIDs, deleted products)
  }
}

class PurchaseInvoiceRepository {
  async findById(id) {
    const result = await query(
      `SELECT 
        pi.*,
        s.id as joined_supplier_id,
        s.company_name as supplier_company_name,
        s.name as supplier_name,
        s.address as supplier_address,
        s.phone as supplier_phone,
        s.email as supplier_email
      FROM purchase_invoices pi
      LEFT JOIN suppliers s ON pi.supplier_id = s.id AND s.deleted_at IS NULL
      WHERE pi.id = $1 AND pi.deleted_at IS NULL`,
      [id]
    );
    
    if (!result.rows[0]) {
      return null;
    }
    
    const row = result.rows[0];
    const invoice = { ...row };
    
    // Map invoice_number to invoiceNumber for frontend compatibility
    invoice.invoiceNumber = invoice.invoice_number || invoice.invoiceNumber;
    
    // Map invoice_date to invoiceDate for frontend compatibility
    invoice.invoiceDate = invoice.invoice_date || invoice.invoiceDate || invoice.created_at || invoice.createdAt;
    
    // Parse JSONB fields
    if (invoice.items && typeof invoice.items === 'string') {
      try {
        invoice.items = JSON.parse(invoice.items);
      } catch (e) {
        invoice.items = [];
      }
    }
    if (invoice.pricing && typeof invoice.pricing === 'string') {
      try {
        invoice.pricing = JSON.parse(invoice.pricing);
      } catch (e) {
        invoice.pricing = {};
      }
    }
    if (invoice.payment && typeof invoice.payment === 'string') {
      try {
        invoice.payment = JSON.parse(invoice.payment);
      } catch (e) {
        invoice.payment = {};
      }
    }
    
    // Build supplierInfo object - prioritize joined supplier data over stored supplier_info JSONB
    if (row.supplier_id != null) {
        if (row.joined_supplier_id != null && (row.supplier_company_name != null || row.supplier_name != null)) {
          // Supplier exists and is not deleted - use joined data (include address, phone, email for print)
          let addr = formatSupplierAddressFromDb(row.supplier_address) || getAddressFromSupplierInfo(invoice.supplier_info);
          // Last resort: fetch supplier directly if address still empty (e.g. supplier updated address after invoice created)
          if (!addr && row.supplier_id) {
            try {
              const supResult = await query('SELECT address FROM suppliers WHERE id = $1 AND (is_deleted = FALSE OR is_deleted IS NULL)', [row.supplier_id]);
              if (supResult.rows[0]?.address) addr = formatSupplierAddressFromDb(supResult.rows[0].address);
            } catch (e) { /* ignore */ }
          }
          invoice.supplierInfo = {
            id: row.supplier_id,
            _id: row.supplier_id,
            companyName: row.supplier_company_name,
            name: row.supplier_name,
            displayName: row.supplier_company_name || row.supplier_name || 'Unknown Supplier',
            address: addr || undefined,
            phone: row.supplier_phone || undefined,
            email: row.supplier_email || undefined
          };
      } else {
        // Try to parse supplier_info JSONB if supplier was deleted
        if (invoice.supplier_info && typeof invoice.supplier_info === 'string') {
          try {
            invoice.supplierInfo = JSON.parse(invoice.supplier_info);
          } catch (e) {
            invoice.supplierInfo = {
              id: row.supplier_id,
              _id: row.supplier_id,
              companyName: null,
              businessName: null,
              name: null,
              displayName: 'Deleted Supplier'
            };
          }
        } else if (invoice.supplier_info && typeof invoice.supplier_info === 'object') {
          invoice.supplierInfo = invoice.supplier_info;
        } else {
          invoice.supplierInfo = {
            id: row.supplier_id,
            _id: row.supplier_id,
            companyName: null,
            businessName: null,
            name: null,
            displayName: 'Deleted Supplier'
          };
        }
      }
    }
    
    // Remove duplicate/helper fields
    if (invoice.joined_supplier_id !== undefined) delete invoice.joined_supplier_id;
    if (invoice.supplier_company_name !== undefined) delete invoice.supplier_company_name;
    if (invoice.supplier_name !== undefined) delete invoice.supplier_name;
    if (invoice.supplier_address !== undefined) delete invoice.supplier_address;
    if (invoice.supplier_phone !== undefined) delete invoice.supplier_phone;
    if (invoice.supplier_email !== undefined) delete invoice.supplier_email;
    
    await enrichItemsWithProductNames(invoice);
    return invoice;
  }

  async findAll(filters = {}, options = {}) {
    // Build base SQL with LEFT JOIN for supplier
    let sql = `
      SELECT 
        pi.*,
        s.id as joined_supplier_id,
        s.company_name as supplier_company_name,
        s.name as supplier_name,
        s.address as supplier_address,
        s.phone as supplier_phone,
        s.email as supplier_email
      FROM purchase_invoices pi
      LEFT JOIN suppliers s ON pi.supplier_id = s.id AND s.deleted_at IS NULL
      WHERE pi.deleted_at IS NULL
    `;
    const params = [];
    let paramCount = 1;

    if (filters.supplier || filters.supplierId) {
      sql += ` AND pi.supplier_id = $${paramCount++}`;
      params.push(filters.supplier || filters.supplierId);
    }
    if (filters.status) {
      sql += ` AND pi.status = $${paramCount++}`;
      params.push(filters.status);
    }
    if (filters.invoiceType) {
      sql += ` AND pi.invoice_type = $${paramCount++}`;
      params.push(filters.invoiceType);
    }
    if (filters.paymentStatus) {
      sql += ` AND (pi.payment->>'status')::text = $${paramCount++}`;
      params.push(filters.paymentStatus);
    }
    if (filters.search) {
      sql += ` AND (pi.invoice_number ILIKE $${paramCount++} OR pi.notes ILIKE $${paramCount++} OR s.company_name ILIKE $${paramCount++} OR (pi.supplier_info->>'companyName') ILIKE $${paramCount})`;
      const term = `%${filters.search}%`;
      params.push(term, term, term, term);
      paramCount += 4;
    }
    if (filters.dateFrom) {
      sql += ` AND (pi.invoice_date >= $${paramCount++} OR pi.created_at >= $${paramCount})`;
      params.push(filters.dateFrom, filters.dateFrom);
      paramCount++;
    }
    if (filters.dateTo) {
      sql += ` AND (pi.invoice_date <= $${paramCount++} OR pi.created_at <= $${paramCount})`;
      params.push(filters.dateTo, filters.dateTo);
      paramCount++;
    }

    sql += ' ORDER BY pi.created_at DESC';
    if (options.limit) {
      sql += ` LIMIT $${paramCount++}`;
      params.push(options.limit);
    }
    if (options.offset) {
      sql += ` OFFSET $${paramCount++}`;
      params.push(options.offset);
    }

    const result = await query(sql, params);
    
    // Transform results to include invoiceNumber and supplierInfo
    const invoices = result.rows.map(row => {
      const invoice = { ...row };
      
      // Map invoice_number to invoiceNumber for frontend compatibility
      invoice.invoiceNumber = invoice.invoice_number || invoice.invoiceNumber;
      
      // Map invoice_date to invoiceDate for frontend compatibility
      invoice.invoiceDate = invoice.invoice_date || invoice.invoiceDate || invoice.created_at || invoice.createdAt;
      
      // Parse JSONB fields
      if (invoice.items && typeof invoice.items === 'string') {
        try {
          invoice.items = JSON.parse(invoice.items);
        } catch (e) {
          invoice.items = [];
        }
      }
      if (invoice.pricing && typeof invoice.pricing === 'string') {
        try {
          invoice.pricing = JSON.parse(invoice.pricing);
        } catch (e) {
          invoice.pricing = {};
        }
      }
      if (invoice.payment && typeof invoice.payment === 'string') {
        try {
          invoice.payment = JSON.parse(invoice.payment);
        } catch (e) {
          invoice.payment = {};
        }
      }
      
      // Build supplierInfo object - prioritize joined supplier data over stored supplier_info JSONB
      if (row.supplier_id != null) {
        if (row.joined_supplier_id != null && (row.supplier_company_name != null || row.supplier_name != null)) {
          // Supplier exists and is not deleted - use joined data (include address, phone, email for print)
          const addrFromSupplier = formatSupplierAddressFromDb(row.supplier_address);
          const addrFromStored = getAddressFromSupplierInfo(invoice.supplier_info);
          invoice.supplierInfo = {
            id: row.supplier_id,
            _id: row.supplier_id,
            companyName: row.supplier_company_name,
            name: row.supplier_name,
            displayName: row.supplier_company_name || row.supplier_name || 'Unknown Supplier',
            address: addrFromSupplier || addrFromStored || undefined,
            phone: row.supplier_phone || undefined,
            email: row.supplier_email || undefined
          };
        } else {
          // Try to parse supplier_info JSONB if supplier was deleted
          if (invoice.supplier_info && typeof invoice.supplier_info === 'string') {
            try {
              invoice.supplierInfo = JSON.parse(invoice.supplier_info);
            } catch (e) {
              invoice.supplierInfo = {
                id: row.supplier_id,
                _id: row.supplier_id,
                companyName: null,
                businessName: null,
                name: null,
                displayName: 'Deleted Supplier'
              };
            }
          } else if (invoice.supplier_info && typeof invoice.supplier_info === 'object') {
            invoice.supplierInfo = invoice.supplier_info;
          } else {
            invoice.supplierInfo = {
              id: row.supplier_id,
              _id: row.supplier_id,
              companyName: null,
              businessName: null,
              name: null,
              displayName: 'Deleted Supplier'
            };
          }
        }
      }
      
      // Remove duplicate/helper fields
      if (invoice.joined_supplier_id !== undefined) delete invoice.joined_supplier_id;
      if (invoice.supplier_company_name !== undefined) delete invoice.supplier_company_name;
      if (invoice.supplier_name !== undefined) delete invoice.supplier_name;
      if (invoice.supplier_address !== undefined) delete invoice.supplier_address;
      if (invoice.supplier_phone !== undefined) delete invoice.supplier_phone;
      if (invoice.supplier_email !== undefined) delete invoice.supplier_email;
      
      return invoice;
    });

    await enrichItemsWithProductNames(invoices);
    return invoices;
  }

  async findOne(filters = {}) {
    if (filters.invoiceNumber) {
      const result = await query(
        'SELECT * FROM purchase_invoices WHERE invoice_number = $1 AND deleted_at IS NULL LIMIT 1',
        [filters.invoiceNumber]
      );
      return result.rows[0] || null;
    }
    if (filters._id || filters.id) return this.findById(filters._id || filters.id);
    return null;
  }

  async findByInvoiceNumber(invoiceNumber, options = {}) {
    return this.findOne({ invoiceNumber });
  }

  async findBySupplier(supplierId, options = {}) {
    return this.findAll({ supplier: supplierId, supplierId }, options);
  }

  async findWithPagination(filter = {}, options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;
    const getAll = options.getAll === true;

    let countSql = 'SELECT COUNT(*) FROM purchase_invoices pi WHERE pi.deleted_at IS NULL';
    const countParams = [];
    let paramCount = 1;
    if (filter.supplierId || filter.supplier) {
      countSql += ` AND pi.supplier_id = $${paramCount++}`;
      countParams.push(filter.supplierId || filter.supplier);
    }
    if (filter.status) {
      countSql += ` AND pi.status = $${paramCount++}`;
      countParams.push(filter.status);
    }
    if (filter.invoiceType) {
      countSql += ` AND pi.invoice_type = $${paramCount++}`;
      countParams.push(filter.invoiceType);
    }
    if (filter.paymentStatus) {
      countSql += ` AND (pi.payment->>'status')::text = $${paramCount++}`;
      countParams.push(filter.paymentStatus);
    }
    if (filter.search) {
      const term = `%${filter.search}%`;
      countSql += ` AND (pi.invoice_number ILIKE $${paramCount++} OR pi.notes ILIKE $${paramCount++} OR (pi.supplier_info->>'companyName') ILIKE $${paramCount++})`;
      countParams.push(term, term, term);
    }
    if (filter.dateFrom) {
      countSql += ` AND COALESCE(pi.invoice_date, pi.created_at) >= $${paramCount++}`;
      countParams.push(filter.dateFrom);
    }
    if (filter.dateTo) {
      countSql += ` AND COALESCE(pi.invoice_date, pi.created_at) <= $${paramCount++}`;
      countParams.push(filter.dateTo);
    }
    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count, 10);

    const invoices = await this.findAll(filter, {
      limit: getAll ? total : limit,
      offset: getAll ? 0 : offset
    });

    return {
      invoices,
      total,
      pagination: getAll
        ? { current: 1, pages: 1, total, hasNext: false, hasPrev: false }
        : { current: page, pages: Math.ceil(total / limit), total, hasNext: page < Math.ceil(total / limit), hasPrev: page > 1 }
    };
  }

  async create(data) {
    const items = data.items || [];
    const pricing = data.pricing || {};
    const subtotal = pricing.subtotal ?? items.reduce((s, i) => s + (i.quantity * (i.unitCost || i.unit_cost || 0)), 0);
    const total = pricing.total ?? subtotal - (pricing.discountAmount || 0) + (pricing.taxAmount || 0);
    const result = await query(
      `INSERT INTO purchase_invoices (
        invoice_number, invoice_type, supplier_id, supplier_info, items, pricing, payment,
        expected_delivery, actual_delivery, notes, terms, invoice_date, status,
        confirmed_date, received_date, ledger_posted, auto_posted, posted_at, ledger_reference_id,
        last_modified_by, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        data.invoiceNumber || data.invoice_number || null,
        data.invoiceType || data.invoice_type || 'purchase',
        data.supplier || data.supplierId || null,
        data.supplierInfo ? JSON.stringify(data.supplierInfo) : null,
        JSON.stringify(items),
        JSON.stringify({ ...pricing, subtotal, total }),
        data.payment ? JSON.stringify(data.payment) : '{}',
        data.expectedDelivery || data.expected_delivery || null,
        data.actualDelivery || data.actual_delivery || null,
        data.notes || null,
        data.terms || null,
        data.invoiceDate || data.invoice_date || new Date(),
        data.status || 'draft',
        data.confirmedDate || data.confirmed_date || null,
        data.receivedDate || data.received_date || null,
        data.ledgerPosted === true,
        data.autoPosted === true,
        data.postedAt || data.posted_at || null,
        data.ledgerReferenceId || data.ledger_reference_id || null,
        data.lastModifiedBy || data.last_modified_by || null,
        data.createdBy || data.created_by
      ]
    );
    return result.rows[0];
  }

  async updateById(id, data) {
    const updates = [];
    const params = [];
    let paramCount = 1;
    const map = {
      invoiceNumber: 'invoice_number', invoiceType: 'invoice_type', supplierId: 'supplier_id',
      supplierInfo: 'supplier_info', items: 'items', pricing: 'pricing', payment: 'payment',
      expectedDelivery: 'expected_delivery', actualDelivery: 'actual_delivery', notes: 'notes', terms: 'terms',
      invoiceDate: 'invoice_date', status: 'status', confirmedDate: 'confirmed_date', receivedDate: 'received_date',
      ledgerPosted: 'ledger_posted', autoPosted: 'auto_posted', postedAt: 'posted_at',
      ledgerReferenceId: 'ledger_reference_id', lastModifiedBy: 'last_modified_by'
    };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) {
        updates.push(`${col} = $${paramCount++}`);
        params.push(typeof data[k] === 'object' ? JSON.stringify(data[k]) : data[k]);
      }
    }
    if (updates.length === 0) return this.findById(id);
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    const result = await query(
      `UPDATE purchase_invoices SET ${updates.join(', ')} WHERE id = $${paramCount} AND deleted_at IS NULL RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  async softDelete(id) {
    const result = await query(
      'UPDATE purchase_invoices SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }

  async delete(id) {
    return this.softDelete(id);
  }
}

module.exports = new PurchaseInvoiceRepository();
