const { query } = require('../../config/postgres');

class MarketPriceRepository {
  async createImportBatch({ fileName, mapping, summary, errorReport, createdBy }, client) {
    const q = client ? client.query.bind(client) : query;
    const result = await q(
      `INSERT INTO market_price_import_batches
        (file_name, status, total_rows, valid_rows, invalid_rows, duplicate_rows, mapping, error_report, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)
       RETURNING *`,
      [
        fileName || null,
        'previewed',
        summary.totalRows || 0,
        summary.validRows || 0,
        summary.invalidRows || 0,
        summary.duplicateRows || 0,
        JSON.stringify(mapping || {}),
        JSON.stringify(errorReport || []),
        createdBy || null
      ]
    );
    return result.rows[0];
  }

  async markBatchApplied(batchId, client) {
    const q = client ? client.query.bind(client) : query;
    await q(
      `UPDATE market_price_import_batches
       SET status = 'applied', applied_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [batchId]
    );
  }

  async insertMarketPrice(entry, client) {
    const q = client ? client.query.bind(client) : query;
    const result = await q(
      `INSERT INTO market_purchase_prices
        (product_id, purchase_price, effective_date, source, import_batch_id, changed_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        entry.productId,
        entry.purchasePrice,
        entry.effectiveDate,
        entry.source || 'manual',
        entry.importBatchId || null,
        entry.changedBy || null
      ]
    );
    return result.rows[0];
  }

  async insertChangeLog(entry, client) {
    const q = client ? client.query.bind(client) : query;
    await q(
      `INSERT INTO market_price_change_log
        (product_id, old_purchase_price, new_purchase_price, effective_date, source, import_batch_id, changed_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.productId,
        entry.oldPurchasePrice,
        entry.newPurchasePrice,
        entry.effectiveDate,
        entry.source || 'manual',
        entry.importBatchId || null,
        entry.changedBy || null
      ]
    );
  }

  async getLatestForProductIds(productIds) {
    if (!Array.isArray(productIds) || productIds.length === 0) return [];
    const result = await query(
      `SELECT DISTINCT ON (mpp.product_id)
         mpp.product_id,
         mpp.purchase_price,
         mpp.effective_date,
         mpp.created_at
       FROM market_purchase_prices mpp
       WHERE mpp.product_id = ANY($1::uuid[])
      ORDER BY mpp.product_id, mpp.created_at DESC, mpp.id DESC`,
      [productIds]
    );
    return result.rows;
  }

  async getHistory({ page = 1, limit = 50 }) {
    const offset = (page - 1) * limit;
    const countRes = await query(`SELECT COUNT(*)::int AS total FROM market_price_change_log`);
    const result = await query(
      `SELECT
         mpcl.*,
         p.name AS product_name,
         p.sku AS product_sku,
         p.barcode AS product_barcode,
         u.first_name,
         u.last_name
       FROM market_price_change_log mpcl
       LEFT JOIN products p ON p.id = mpcl.product_id
       LEFT JOIN users u ON u.id = mpcl.changed_by
       ORDER BY mpcl.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return {
      rows: result.rows,
      total: countRes.rows[0]?.total || 0
    };
  }
}

module.exports = new MarketPriceRepository();
