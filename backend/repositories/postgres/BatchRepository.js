const { query } = require('../../config/postgres');

function toCamel(row) {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    product: row.product_id,
    productId: row.product_id,
    batchNumber: row.batch_number,
    lotNumber: row.lot_number,
    initialQuantity: parseFloat(row.initial_quantity) || 0,
    currentQuantity: parseFloat(row.current_quantity) || 0,
    unitCost: parseFloat(row.unit_cost) || 0,
    totalCost: parseFloat(row.total_cost) || 0,
    manufactureDate: row.manufacture_date,
    expiryDate: row.expiry_date,
    purchaseDate: row.purchase_date,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

class BatchRepository {
  async findById(id) {
    const result = await query('SELECT * FROM batches WHERE id = $1', [id]);
    return toCamel(result.rows[0] || null);
  }

  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM batches WHERE 1=1';
    const params = [];
    let n = 1;
    if (filters.productId != null || filters.product != null) {
      sql += ` AND product_id = $${n++}`;
      params.push(filters.productId ?? filters.product);
    }
    if (filters.status) {
      sql += ` AND status = $${n++}`;
      params.push(filters.status);
    }
    if (filters.statusIn && Array.isArray(filters.statusIn) && filters.statusIn.length) {
      sql += ` AND status = ANY($${n++}::text[])`;
      params.push(filters.statusIn);
    }
    if (filters.expiryLte != null) {
      sql += ` AND expiry_date <= $${n++}`;
      params.push(filters.expiryLte);
    }
    if (filters.expiryGte != null) {
      sql += ` AND expiry_date >= $${n++}`;
      params.push(filters.expiryGte);
    }
    if (filters.currentQuantityGt != null) {
      sql += ` AND current_quantity > $${n++}`;
      params.push(filters.currentQuantityGt);
    }
    sql += ' ORDER BY expiry_date ASC NULLS LAST, purchase_date ASC';
    if (options.limit) {
      sql += ` LIMIT $${n++}`;
      params.push(options.limit);
    }
    const result = await query(sql, params);
    return result.rows.map(toCamel);
  }

  /** FEFO: First Expired First Out */
  async findFEFOBatches(productId, quantity) {
    return this.findAll(
      { productId, status: 'active', currentQuantityGt: 0 },
      { limit: 100 }
    );
  }

  async create(data) {
    const result = await query(
      `INSERT INTO batches (
        product_id, batch_number, lot_number, initial_quantity, current_quantity,
        unit_cost, total_cost, manufacture_date, expiry_date, purchase_date,
        supplier_id, purchase_invoice_id, purchase_order_id, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        data.productId ?? data.product,
        data.batchNumber ?? data.batch_number,
        data.lotNumber ?? data.lot_number ?? null,
        data.initialQuantity ?? data.initial_quantity ?? 0,
        data.currentQuantity ?? data.current_quantity ?? data.initialQuantity ?? 0,
        data.unitCost ?? data.unit_cost ?? 0,
        data.totalCost ?? data.total_cost ?? 0,
        data.manufactureDate ?? data.manufacture_date ?? null,
        data.expiryDate ?? data.expiry_date ?? null,
        data.purchaseDate ?? data.purchase_date ?? new Date(),
        data.supplierId ?? data.supplier ?? null,
        data.purchaseInvoiceId ?? data.purchase_invoice ?? null,
        data.purchaseOrderId ?? data.purchase_order ?? null,
        data.status ?? 'active',
        data.createdBy ?? data.created_by ?? null
      ]
    );
    return toCamel(result.rows[0]);
  }

  async updateById(id, data) {
    const updates = [];
    const params = [];
    let n = 1;
    const map = {
      currentQuantity: 'current_quantity',
      status: 'status',
      updatedAt: 'updated_at'
    };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined && col !== 'updated_at') {
        updates.push(`${col} = $${n++}`);
        params.push(data[k]);
      }
    }
    if (updates.length === 0) return this.findById(id);
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    const result = await query(
      `UPDATE batches SET ${updates.join(', ')} WHERE id = $${n} RETURNING *`,
      params
    );
    return toCamel(result.rows[0] || null);
  }
}

module.exports = new BatchRepository();
