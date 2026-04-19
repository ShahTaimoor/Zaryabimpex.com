const { query } = require('../../config/postgres');
const inventoryBalanceRepository = require('./InventoryBalanceRepository');
const { decodeCursor, encodeCursor } = require('../../utils/keysetCursor');


function rowToProduct(row) {
  if (!row) return null;
  return {
    ...row,
    _id: row.id,
    costPrice: parseFloat(row.cost_price) || 0,
    sellingPrice: parseFloat(row.selling_price) || 0,
    wholesalePrice: row.wholesale_price != null ? parseFloat(row.wholesale_price) : parseFloat(row.selling_price) || 0,
    stockQuantity: parseFloat(row.stock_quantity) || 0,
    minStockLevel: parseFloat(row.min_stock_level) || 0,
    categoryId: row.category_id,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    imageUrl: row.image_url,
    hsCode: row.hs_code ?? null,
    countryOfOrigin: row.country_of_origin ?? null,
    netWeightKg: row.net_weight_kg != null ? parseFloat(row.net_weight_kg) : null,
    grossWeightKg: row.gross_weight_kg != null ? parseFloat(row.gross_weight_kg) : null,
    importRefNo: row.import_ref_no ?? null,
    gdNumber: row.gd_number ?? null,
    invoiceRef: row.invoice_ref ?? null
  };
}

/**
 * PostgreSQL Product repository - use for product data when migrating off MongoDB.
 */
class ProductRepository {
  async findById(id, includeDeleted = false) {
    if (!id || typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return null;
    }
    const sql = includeDeleted
      ? 'SELECT * FROM products WHERE id = $1'
      : 'SELECT * FROM products WHERE id = $1 AND (is_deleted = FALSE OR is_deleted IS NULL)';
    const result = await query(sql, [id]);
    return rowToProduct(result.rows[0]);
  }

  async findAll(filters = {}, options = {}) {
    const listMode = options.listMode === 'minimal' ? 'minimal' : 'full';
    const cursorDecoded =
      options.cursor && typeof options.cursor === 'object' && options.cursor.t && options.cursor.id
        ? options.cursor
        : null;
    const useKeyset = Boolean(cursorDecoded);

    const selectList =
      listMode === 'minimal'
        ? `id, name, sku, barcode, hs_code, category_id, cost_price, selling_price, wholesale_price,
           stock_quantity, min_stock_level, unit, pieces_per_box, is_active, image_url,
           country_of_origin, net_weight_kg, gross_weight_kg, import_ref_no, gd_number, invoice_ref,
           created_at, updated_at, is_deleted`
        : '*';

    let sql = `SELECT ${selectList} FROM products WHERE 1=1`;
    if (!filters.includeDeleted) {
      sql += ' AND (is_deleted = FALSE OR is_deleted IS NULL)';
    }
    const params = [];
    let paramCount = 1;

    if (filters.isActive !== undefined) {
      sql += ` AND is_active = $${paramCount++}`;
      params.push(filters.isActive);
    }
    if (filters.ids || filters.productIds) {
      const ids = filters.ids || filters.productIds;
      const validUuids = Array.isArray(ids) ? ids.filter(id => 
        typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
      ) : [];
      
      if (validUuids.length > 0) {
        sql += ` AND id = ANY($${paramCount++}::uuid[])`;
        params.push(validUuids);
      } else if (Array.isArray(ids) && ids.length > 0) {
        // If they provided IDs but none are valid UUIDs, force empty result
        sql += ' AND 1=0';
      }
    }
    if (filters.categoryId) {
      sql += ` AND category_id = $${paramCount++}`;
      params.push(filters.categoryId);
    }
    if (filters.exactCode) {
      const code = String(filters.exactCode).trim();
      if (code) {
        sql += ` AND (
          LOWER(TRIM(COALESCE(barcode, ''))) = LOWER($${paramCount})
          OR LOWER(TRIM(COALESCE(sku, ''))) = LOWER($${paramCount})
        )`;
        params.push(code);
        paramCount++;
      }
    } else if (filters.search) {
      sql += ` AND (
        name ILIKE $${paramCount}
        OR sku ILIKE $${paramCount}
        OR barcode ILIKE $${paramCount}
        OR hs_code ILIKE $${paramCount}
        OR import_ref_no ILIKE $${paramCount}
        OR gd_number ILIKE $${paramCount}
        OR invoice_ref ILIKE $${paramCount}
      )`;
      params.push(`%${filters.search}%`);
      paramCount++;
    }
    if (filters.lowStock) {
      sql += ' AND stock_quantity <= min_stock_level';
    }
    if (filters.stockStatus === 'outOfStock') {
      sql += ' AND stock_quantity = 0';
    }
    if (filters.stockStatus === 'inStock') {
      sql += ' AND stock_quantity > 0';
    }

    if (useKeyset) {
      sql += ` AND (created_at, id) < ($${paramCount++}::timestamptz, $${paramCount++}::uuid)`;
      params.push(cursorDecoded.t, cursorDecoded.id);
    }

    if (useKeyset) {
      sql += ' ORDER BY created_at DESC, id DESC';
    } else {
      sql += ' ORDER BY created_at DESC, name ASC';
    }
    if (options.limit) {
      sql += ` LIMIT $${paramCount++}`;
      params.push(options.limit);
    }
    if (!useKeyset && options.offset) {
      sql += ` OFFSET $${paramCount++}`;
      params.push(options.offset);
    }

    const result = await query(sql, params);
    return result.rows.map(rowToProduct);
  }

  async create(data, client = null) {
    const q = client ? client.query.bind(client) : query;
    const result = await q(
      `INSERT INTO products (name, sku, barcode, hs_code, description, category_id, cost_price, selling_price, wholesale_price,
       stock_quantity, min_stock_level, unit, pieces_per_box, is_active, created_by, image_url, country_of_origin, net_weight_kg, gross_weight_kg, import_ref_no, gd_number, invoice_ref)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
       RETURNING *`,
      [
        data.name,
        data.sku || null,
        data.barcode || null,
        (() => {
          const h = data.hsCode ?? data.hs_code;
          if (h === undefined || h === null || String(h).trim() === '') return null;
          return String(h).trim();
        })(),
        data.description || null,
        data.categoryId || data.category_id || null,
        data.costPrice ?? data.cost_price ?? 0,
        data.sellingPrice ?? data.selling_price ?? 0,
        data.wholesalePrice ?? data.wholesale_price ?? data.sellingPrice ?? data.selling_price ?? 0,
        data.stockQuantity ?? data.stock_quantity ?? 0,
        data.minStockLevel ?? data.min_stock_level ?? 0,
        data.unit || null,
        data.piecesPerBox ?? data.pieces_per_box ?? null,
        data.isActive !== false,
        data.createdBy || data.created_by || null,
        data.imageUrl || data.image_url || null,
        data.countryOfOrigin ?? data.country_of_origin ?? null,
        data.netWeightKg ?? data.net_weight_kg ?? null,
        data.grossWeightKg ?? data.gross_weight_kg ?? null,
        data.importRefNo ?? data.import_ref_no ?? null,
        data.gdNumber ?? data.gd_number ?? null,
        data.invoiceRef ?? data.invoice_ref ?? null
      ]
    );
    const created = rowToProduct(result.rows[0]);
    if (created && created.stockQuantity !== undefined) {
      try {
        await inventoryBalanceRepository.syncBalance(
          created.id,
          created.stockQuantity,
          0,
          0,
          client
        );
      } catch (err) {
        console.error('Error syncing inventory_balance in ProductRepository.create:', err);
      }
    }
    return created;
  }

  async update(id, data, client = null) {

    const fields = [];
    const values = [];
    let n = 1;
    const map = {
      name: 'name',
      sku: 'sku',
      barcode: 'barcode',
      description: 'description',
      categoryId: 'category_id',
      costPrice: 'cost_price',
      sellingPrice: 'selling_price',
      wholesalePrice: 'wholesale_price',
      stockQuantity: 'stock_quantity',
      minStockLevel: 'min_stock_level',
      unit: 'unit',
      piecesPerBox: 'pieces_per_box',
      pieces_per_box: 'pieces_per_box',
      isActive: 'is_active',
      updatedBy: 'updated_by',
      imageUrl: 'image_url',
      image_url: 'image_url',
      countryOfOrigin: 'country_of_origin',
      country_of_origin: 'country_of_origin',
      netWeightKg: 'net_weight_kg',
      net_weight_kg: 'net_weight_kg',
      grossWeightKg: 'gross_weight_kg',
      gross_weight_kg: 'gross_weight_kg',
      importRefNo: 'import_ref_no',
      import_ref_no: 'import_ref_no',
      gdNumber: 'gd_number',
      gd_number: 'gd_number',
      invoiceRef: 'invoice_ref',
      invoice_ref: 'invoice_ref',
      hsCode: 'hs_code',
      hs_code: 'hs_code'
    };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) {
        let v = data[k];
        if ((col === 'category_id' || col === 'hs_code') && (v === '' || v == null)) {
          v = null;
        }
        fields.push(`${col} = $${n++}`);
        values.push(v);
      }
    }
    if (fields.length === 0) return this.findById(id);
    values.push(id);
    const q = client ? client.query.bind(client) : query;
    const result = await q(
      `UPDATE products SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${n} RETURNING *`,
      values
    );

    const updated = result.rows[0] || null;
    if (updated && (data.stockQuantity !== undefined || data.stock_quantity !== undefined)) {
      try {
        await inventoryBalanceRepository.syncBalance(
          updated.id,
          parseFloat(updated.stock_quantity || 0),
          0,
          0,
          client
        );
      } catch (err) {
        console.error('Error syncing inventory_balance in ProductRepository.update:', err);
      }
    }
    return updated;
  }

  async delete(id, client = null) {
    const q = client ? client.query.bind(client) : query;
    const result = await q(
      'UPDATE products SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }

  async findDeletedById(id) {
    const result = await query(
      'SELECT * FROM products WHERE id = $1 AND is_deleted = TRUE',
      [id]
    );
    return result.rows[0] || null;
  }

  async restore(id) {
    const result = await query(
      'UPDATE products SET is_deleted = FALSE, deleted_at = NULL WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }

  async findDeleted(filters = {}, options = {}) {
    let sql = 'SELECT * FROM products WHERE is_deleted = TRUE';
    const params = [];
    let n = 1;
    if (options.limit) {
      sql += ` LIMIT $${n++}`;
      params.push(options.limit);
    }
    if (options.offset) {
      sql += ` OFFSET $${n++}`;
      params.push(options.offset);
    }
    sql += ' ORDER BY deleted_at DESC NULLS LAST';
    const result = await query(sql, params);
    return result.rows;
  }

  async search(term, options = { limit: 50 }) {
    return this.findAll({ search: term }, options);
  }

  async findWithPagination(filters = {}, options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;
    const listMode = options.listMode === 'minimal' ? 'minimal' : 'full';
    const cursorStr = options.cursor || options.keysetCursor;
    const decoded = typeof cursorStr === 'string' ? decodeCursor(cursorStr) : null;

    let countSql = 'SELECT COUNT(*) FROM products WHERE (is_deleted = FALSE OR is_deleted IS NULL)';
    const countParams = [];
    let cn = 1;
    if (filters.isActive !== undefined) {
      countSql += ` AND is_active = $${cn++}`;
      countParams.push(filters.isActive);
    }
    if (filters.categoryId) {
      countSql += ` AND category_id = $${cn++}`;
      countParams.push(filters.categoryId);
    }
    if (filters.exactCode) {
      const code = String(filters.exactCode).trim();
      if (code) {
        countSql += ` AND (
          LOWER(TRIM(COALESCE(barcode, ''))) = LOWER($${cn})
          OR LOWER(TRIM(COALESCE(sku, ''))) = LOWER($${cn})
        )`;
        countParams.push(code);
        cn++;
      }
    } else if (filters.search) {
      countSql += ` AND (
        name ILIKE $${cn}
        OR sku ILIKE $${cn}
        OR barcode ILIKE $${cn}
        OR hs_code ILIKE $${cn}
        OR import_ref_no ILIKE $${cn}
        OR gd_number ILIKE $${cn}
        OR invoice_ref ILIKE $${cn}
      )`;
      countParams.push(`%${filters.search}%`);
      cn++;
    }
    if (filters.lowStock) {
      countSql += ' AND stock_quantity <= min_stock_level';
    }
    if (filters.stockStatus === 'outOfStock') {
      countSql += ' AND stock_quantity = 0';
    }
    if (filters.stockStatus === 'inStock') {
      countSql += ' AND stock_quantity > 0';
    }

    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count, 10);

    if (decoded) {
      const fetchLimit = limit + 1;
      const products = await this.findAll(filters, {
        listMode,
        cursor: decoded,
        limit: fetchLimit
      });
      const hasMore = products.length > limit;
      const pageRows = hasMore ? products.slice(0, limit) : products;
      let nextCursor = null;
      if (hasMore && pageRows.length > 0) {
        const last = pageRows[pageRows.length - 1];
        const ca = last.created_at || last.createdAt;
        nextCursor = encodeCursor(ca, last.id);
      }
      return {
        products: pageRows,
        pagination: {
          current: null,
          pages: null,
          total,
          limit,
          mode: 'keyset',
          nextCursor,
          hasMore
        }
      };
    }

    const products = await this.findAll(filters, { listMode, limit, offset });
    return {
      products,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit) || 1,
        total,
        limit,
        mode: 'offset',
        nextCursor: null,
        hasMore: page * limit < total
      }
    };
  }

  async nameExists(name, excludeId = null) {
    let sql = 'SELECT 1 FROM products WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND (is_deleted = FALSE OR is_deleted IS NULL)';
    const params = [name];
    if (excludeId) {
      sql += ' AND id != $2';
      params.push(excludeId);
    }
    const result = await query(sql, params);
    return result.rows.length > 0;
  }

  async findByName(name) {
    const result = await query(
      'SELECT * FROM products WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND (is_deleted = FALSE OR is_deleted IS NULL)',
      [name]
    );
    return result.rows[0] || null;
  }

  async skuExists(sku, excludeId = null) {
    if (!sku) return false;
    let sql = 'SELECT 1 FROM products WHERE LOWER(TRIM(sku)) = LOWER(TRIM($1)) AND (is_deleted = FALSE OR is_deleted IS NULL)';
    const params = [sku];
    if (excludeId) {
      sql += ' AND id != $2';
      params.push(excludeId);
    }
    const result = await query(sql, params);
    return result.rows.length > 0;
  }

  async barcodeExists(barcode, excludeId = null) {
    if (!barcode) return false;
    let sql = 'SELECT 1 FROM products WHERE LOWER(TRIM(barcode)) = LOWER(TRIM($1)) AND (is_deleted = FALSE OR is_deleted IS NULL)';
    const params = [barcode];
    if (excludeId) {
      sql += ' AND id != $2';
      params.push(excludeId);
    }
    const result = await query(sql, params);
    return result.rows.length > 0;
  }

  async count(filters = {}) {
    let sql = 'SELECT COUNT(*) FROM products WHERE (is_deleted = FALSE OR is_deleted IS NULL)';
    const params = [];
    let cn = 1;
    if (filters.isActive !== undefined) {
      sql += ` AND is_active = $${cn++}`;
      params.push(filters.isActive);
    }
    const result = await query(sql, params);
    return parseInt(result.rows[0].count, 10);
  }

  async countByCategory(categoryId) {
    const result = await query(
      'SELECT COUNT(*) FROM products WHERE category_id = $1 AND (is_deleted = FALSE OR is_deleted IS NULL)',
      [categoryId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * @returns {Map<string, Array>} product id -> rows with investor_name, investor_email, share_percentage, added_at
   */
  async findInvestorsByProductIds(productIds) {
    if (!productIds?.length) return new Map();
    
    const validUuids = productIds.filter(id => 
      typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    );
    
    if (validUuids.length === 0) return new Map();

    const result = await query(
      `SELECT pi.product_id, pi.investor_id, pi.share_percentage, pi.added_at,
              i.name AS investor_name, i.email AS investor_email
       FROM product_investors pi
       INNER JOIN investors i ON i.id = pi.investor_id AND i.deleted_at IS NULL
       WHERE pi.product_id = ANY($1::uuid[])`,
      [validUuids]
    );
    const map = new Map();
    for (const row of result.rows) {
      const pid = String(row.product_id);
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid).push(row);
    }
    return map;
  }

  mergeInvestorsIntoProductRow(p, rows) {
    if (!p) return null;
    if (!rows?.length) {
      return { ...p, hasInvestors: false, investors: [] };
    }
    return {
      ...p,
      hasInvestors: true,
      investors: rows.map((r) => ({
        investor: {
          _id: r.investor_id,
          id: r.investor_id,
          name: r.investor_name,
          email: r.investor_email
        },
        sharePercentage: parseFloat(r.share_percentage) || 30,
        addedAt: r.added_at
      }))
    };
  }

  async findByIdWithInvestors(id) {
    const p = await this.findById(id);
    if (!p) return null;
    const map = await this.findInvestorsByProductIds([p.id]);
    const rows = map.get(String(p.id)) || [];
    return this.mergeInvestorsIntoProductRow(p, rows);
  }

  async replaceProductInvestors(productId, investorLinks) {
    const { transaction } = require('../../config/postgres');
    const resolveInvestorId = (raw) => {
      if (raw == null) return null;
      if (typeof raw === 'object') return raw._id || raw.id || null;
      return raw;
    };
    return transaction(async (client) => {
      await client.query('DELETE FROM product_investors WHERE product_id = $1', [productId]);
      for (const link of investorLinks || []) {
        const investorId = resolveInvestorId(link.investor);
        if (!investorId) continue;
        const share = Math.min(
          100,
          Math.max(0, parseFloat(link.sharePercentage ?? link.share_percentage ?? 30))
        );
        await client.query(
          `INSERT INTO product_investors (product_id, investor_id, share_percentage, added_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
          [productId, investorId, share]
        );
      }
    });
  }

  async deleteProductInvestor(productId, investorId) {
    await query('DELETE FROM product_investors WHERE product_id = $1 AND investor_id = $2', [
      productId,
      investorId
    ]);
  }

  async countProductsByInvestor(investorId) {
    const result = await query('SELECT COUNT(*)::int AS c FROM product_investors WHERE investor_id = $1', [
      investorId
    ]);
    return result.rows[0]?.c || 0;
  }

  async findProductsByInvestorId(investorId) {
    const result = await query(
      `SELECT p.*, pi.share_percentage AS link_share_percentage, pi.added_at AS link_added_at
       FROM product_investors pi
       INNER JOIN products p ON p.id = pi.product_id AND (p.is_deleted = FALSE OR p.is_deleted IS NULL)
       WHERE pi.investor_id = $1
       ORDER BY p.name ASC`,
      [investorId]
    );
    return result.rows;
  }

  /**
   * Permanently removes every product and dependent rows (movements, variants, balances, etc.).
   * Used by seed scripts / dev reset; not a soft delete.
   */
  async deleteAllPermanently() {
    const { transaction } = require('../../config/postgres');
    const AccountingService = require('../../services/accountingService');
    
    return transaction(async (client) => {
      // Clear product-related tables
      await client.query('DELETE FROM product_transformations');
      await client.query('DELETE FROM inventory_balance');
      await client.query('DELETE FROM stock_movements');
      await client.query('DELETE FROM batches');
      await client.query('DELETE FROM profit_shares');
      await client.query('DELETE FROM inventory');
      await client.query('DELETE FROM product_investors');
      
      // Clear associated ledger entries for Inventory (1200) to keep Balance Sheet clean
      await client.query(
        "DELETE FROM account_ledger WHERE account_code = '1200' OR (reference_type IN ('product_opening_stock', 'inventory_adjustment', 'inventory_reconciliation'))"
      );
      
      const r = await client.query('DELETE FROM products');
      
      // Refresh balances so Balance Sheet shows 0
      await AccountingService.updateAccountBalance(client, '1200');
      await AccountingService.updateAccountBalance(client, '3100');
      
      return r.rowCount;
    });
  }
}

module.exports = new ProductRepository();
