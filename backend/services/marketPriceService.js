const ExcelJS = require('exceljs');
const { transaction, query } = require('../config/postgres');
const marketPriceRepository = require('../repositories/postgres/MarketPriceRepository');

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = parseFloat(String(value).replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const toDate = (value) => {
  if (!value) return new Date();
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

class MarketPriceService {
  async getLatestPriceMap(productIds) {
    const rows = await marketPriceRepository.getLatestForProductIds(productIds);
    const map = new Map();
    for (const row of rows) {
      map.set(String(row.product_id), {
        purchasePrice: parseFloat(row.purchase_price) || 0,
        effectiveDate: row.effective_date
      });
    }
    return map;
  }

  async applyLatestMarketPricesToPurchaseItems(items) {
    const productIds = (items || []).map((item) => item.product).filter(Boolean);
    if (productIds.length === 0) return items || [];
    const latestMap = await this.getLatestPriceMap(productIds);
    return (items || []).map((item) => {
      const pid = String(item.product);
      const latest = latestMap.get(pid);
      if (!latest) return item;
      return {
        ...item,
        unitCost: latest.purchasePrice,
        totalCost: (parseFloat(item.quantity) || 0) * latest.purchasePrice,
        marketPriceApplied: true,
        marketPriceEffectiveDate: latest.effectiveDate
      };
    });
  }

  async setManualPrice({ productId, purchasePrice, effectiveDate, userId }) {
    if (!productId) throw new Error('Product is required');
    const price = toNumber(purchasePrice);
    if (price === null || price < 0) throw new Error('Purchase price must be a non-negative number');
    const effDate = toDate(effectiveDate);
    if (!effDate) throw new Error('Invalid effective date');

    return transaction(async (client) => {
      const latest = await marketPriceRepository.getLatestForProductIds([productId]);
      const oldPrice = latest[0] ? parseFloat(latest[0].purchase_price) : null;

      const created = await marketPriceRepository.insertMarketPrice(
        {
          productId,
          purchasePrice: price,
          effectiveDate: effDate,
          source: 'manual',
          changedBy: userId
        },
        client
      );

      await marketPriceRepository.insertChangeLog(
        {
          productId,
          oldPurchasePrice: oldPrice,
          newPurchasePrice: price,
          effectiveDate: effDate,
          source: 'manual',
          changedBy: userId
        },
        client
      );

      return created;
    });
  }

  async previewExcelImport({ buffer, mapping }) {
    if (!mapping || !mapping.purchasePrice || !mapping.productName) {
      throw new Error('Column mapping must include purchasePrice and productName');
    }
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error('No worksheet found in Excel file');

    const rows = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values = row.values || [];
      rows.push({
        rowNumber,
        productCode: mapping.productCode ? (values[mapping.productCode] || null) : null,
        productName: values[mapping.productName] || null,
        purchasePrice: values[mapping.purchasePrice],
        effectiveDate: values[mapping.effectiveDate] || new Date()
      });
    });

    const normalized = rows.map((r) => ({
      ...r,
      productCode: r.productCode ? String(r.productCode).trim() : null,
      productName: r.productName ? String(r.productName).trim() : null,
      purchasePrice: toNumber(r.purchasePrice),
      effectiveDate: toDate(r.effectiveDate)
    }));

    const codes = [...new Set(normalized.map((r) => r.productCode).filter(Boolean))];
    const names = [...new Set(normalized.map((r) => r.productName).filter(Boolean))];
    const matched = await this.lookupProductsByCodesOrNames(codes, names);

    const seenKeys = new Set();
    const errors = [];
    const validRows = [];

    for (const row of normalized) {
      const rowErrors = [];
      if (row.purchasePrice === null || row.purchasePrice < 0) rowErrors.push('Invalid purchase price');
      if (!row.effectiveDate) rowErrors.push('Invalid effective date');

      const product = this.resolveMatchedProduct(row, matched);
      if (!product) rowErrors.push('Product not found (invalid code/name)');

      const duplicateKey = `${product?.id || 'na'}|${row.effectiveDate ? row.effectiveDate.toISOString().slice(0, 10) : 'na'}`;
      if (seenKeys.has(duplicateKey)) {
        rowErrors.push('Duplicate row in import file');
      } else {
        seenKeys.add(duplicateKey);
      }

      if (rowErrors.length > 0) {
        errors.push({
          rowNumber: row.rowNumber,
          productCode: row.productCode,
          productName: row.productName,
          errors: rowErrors
        });
      } else {
        validRows.push({
          rowNumber: row.rowNumber,
          productId: product.id,
          productName: product.name,
          productCode: product.barcode || product.sku,
          purchasePrice: row.purchasePrice,
          effectiveDate: row.effectiveDate
        });
      }
    }

    return {
      rowsPreview: validRows.slice(0, 200),
      validRows,
      errorReport: errors,
      summary: {
        totalRows: normalized.length,
        validRows: validRows.length,
        invalidRows: errors.length,
        duplicateRows: errors.filter((e) => e.errors.includes('Duplicate row in import file')).length
      }
    };
  }

  async applyExcelImport({ buffer, mapping, userId, fileName }) {
    const preview = await this.previewExcelImport({ buffer, mapping });
    if (preview.validRows.length === 0) {
      return {
        imported: 0,
        historyBatchId: null,
        summary: preview.summary,
        errorReport: preview.errorReport
      };
    }

    return transaction(async (client) => {
      const batch = await marketPriceRepository.createImportBatch(
        {
          fileName,
          mapping,
          summary: preview.summary,
          errorReport: preview.errorReport,
          createdBy: userId
        },
        client
      );

      const latest = await marketPriceRepository.getLatestForProductIds(
        preview.validRows.map((r) => r.productId)
      );
      const latestMap = new Map(latest.map((r) => [String(r.product_id), parseFloat(r.purchase_price) || 0]));

      for (const row of preview.validRows) {
        const oldPrice = latestMap.has(String(row.productId)) ? latestMap.get(String(row.productId)) : null;
        await marketPriceRepository.insertMarketPrice(
          {
            productId: row.productId,
            purchasePrice: row.purchasePrice,
            effectiveDate: row.effectiveDate,
            source: 'import',
            importBatchId: batch.id,
            changedBy: userId
          },
          client
        );
        await marketPriceRepository.insertChangeLog(
          {
            productId: row.productId,
            oldPurchasePrice: oldPrice,
            newPurchasePrice: row.purchasePrice,
            effectiveDate: row.effectiveDate,
            source: 'import',
            importBatchId: batch.id,
            changedBy: userId
          },
          client
        );
      }

      await marketPriceRepository.markBatchApplied(batch.id, client);

      return {
        imported: preview.validRows.length,
        historyBatchId: batch.id,
        summary: preview.summary,
        errorReport: preview.errorReport
      };
    });
  }

  async getHistory({ page, limit }) {
    const result = await marketPriceRepository.getHistory({ page, limit });
    return {
      history: result.rows.map((r) => ({
        ...r,
        changedByName: [r.first_name, r.last_name].filter(Boolean).join(' ') || 'Unknown'
      })),
      pagination: {
        page,
        limit,
        total: result.total,
        pages: Math.ceil(result.total / limit) || 1
      }
    };
  }

  async lookupProductsByCodesOrNames(codes, names) {
    const result = await query(
      `SELECT id, name, sku, barcode
       FROM products
       WHERE (is_deleted = FALSE OR is_deleted IS NULL)
         AND (
          COALESCE(barcode, '') = ANY($1::text[])
          OR COALESCE(sku, '') = ANY($1::text[])
          OR LOWER(TRIM(name)) = ANY($2::text[])
         )`,
      [codes, names.map((n) => String(n).trim().toLowerCase())]
    );
    const byCode = new Map();
    const byName = new Map();
    for (const row of result.rows) {
      if (row.barcode) byCode.set(String(row.barcode).trim(), row);
      if (row.sku) byCode.set(String(row.sku).trim(), row);
      byName.set(String(row.name).trim().toLowerCase(), row);
    }
    return { byCode, byName };
  }

  resolveMatchedProduct(row, matched) {
    if (row.productCode && matched.byCode.has(row.productCode)) return matched.byCode.get(row.productCode);
    if (row.productName) {
      const key = String(row.productName).trim().toLowerCase();
      if (matched.byName.has(key)) return matched.byName.get(key);
    }
    return null;
  }

  async createTemplateWorkbook() {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Market Prices');
    sheet.addRow(['Product Name', 'Purchase Price', 'Effective Date']);
    sheet.addRow(['Sample Product', 120.5, new Date()]);
    return workbook;
  }
}

module.exports = new MarketPriceService();
