const salesRepository = require('../repositories/SalesRepository');
const productRepository = require('../repositories/ProductRepository');
const customerRepository = require('../repositories/CustomerRepository');
const salesService = require('./salesService');
const ReturnRepository = require('../repositories/postgres/ReturnRepository');
const AccountingService = require('./accountingService');
const { getCached } = require('../utils/ttlCache');
const { stableQueryKey } = require('../utils/stableQueryKey');

const REPORT_CACHE_TTL_MS = Math.max(5000, parseInt(process.env.REPORT_CACHE_TTL_MS || '90000', 10));

function reportsCache(methodName, filters, factory) {
  if (filters && (String(filters.nocache || '') === '1' || String(filters.nocache || '').toLowerCase() === 'true')) {
    return factory();
  }
  return getCached(`reports:${methodName}:${stableQueryKey(filters)}`, REPORT_CACHE_TTL_MS, factory);
}

class ReportsService {
  /**
   * Format date based on grouping type
   * @param {Date} date - Date to format
   * @param {string} groupBy - Grouping type (day, week, month, year)
   * @returns {string} - Formatted date string
   */
  formatDate(date, groupBy) {
    switch (groupBy) {
      case 'day':
        return date.toISOString().split('T')[0];
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().split('T')[0];
      case 'month':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      case 'year':
        return date.getFullYear().toString();
      default:
        return date.toISOString().split('T')[0];
    }
  }

  /**
   * Get comprehensive sales report with various grouping options
   * @param {object} filters - Query filters (dateFrom, dateTo, city, groupBy)
   * @returns {Promise<object>}
   */
  async getSalesReport(filters) {
    return reportsCache('getSalesReport', filters, async () => {
      const { query } = require('../config/postgres');
      const { getStartOfDayPakistan, getEndOfDayPakistan } = require('../utils/dateFilter');

      const dateFrom = filters.dateFrom ? getStartOfDayPakistan(filters.dateFrom) : getStartOfDayPakistan(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
      const dateTo = filters.dateTo ? getEndOfDayPakistan(filters.dateTo) : getEndOfDayPakistan(new Date().toISOString().split('T')[0]);
      const city = filters.city && filters.city !== 'all' ? filters.city : null;
      const groupBy = filters.groupBy || 'daily'; // daily, monthly, product, category, city, invoice

      let sql = '';
      let params = [dateFrom, dateTo];
      let paramIdx = 3;

      const cityFilter = city ? `AND (
      (jsonb_typeof(c.address) = 'array' AND EXISTS (SELECT 1 FROM jsonb_array_elements(c.address) addr WHERE addr->>'city' = $${paramIdx}))
      OR (jsonb_typeof(c.address) = 'object' AND c.address->>'city' = $${paramIdx})
    )` : '';
      if (city) params.push(city);

      switch (groupBy) {
        case 'daily':
          sql = `
          SELECT 
            DATE(s.sale_date) as date,
            COUNT(s.id) as "totalOrders",
            SUM(s.subtotal) as subtotal,
            SUM(s.discount) as discount,
            SUM(s.total) as total,
            SUM(s.tax) as tax
          FROM sales s
          LEFT JOIN customers c ON s.customer_id = c.id
          WHERE s.sale_date BETWEEN $1 AND $2 AND s.status != 'cancelled'
          ${cityFilter}
          GROUP BY DATE(s.sale_date)
          ORDER BY date DESC
        `;
          break;

        case 'monthly':
          sql = `
          SELECT 
            TO_CHAR(s.sale_date, 'YYYY-MM') as month,
            COUNT(s.id) as "totalOrders",
            SUM(s.subtotal) as subtotal,
            SUM(s.discount) as discount,
            SUM(s.total) as total
          FROM sales s
          LEFT JOIN customers c ON s.customer_id = c.id
          WHERE s.sale_date BETWEEN $1 AND $2 AND s.status != 'cancelled'
          ${cityFilter}
          GROUP BY TO_CHAR(s.sale_date, 'YYYY-MM')
          ORDER BY month DESC
        `;
          break;

        case 'product':
          sql = `
          WITH sale_items AS (
            SELECT 
              COALESCE(elem->>'product', elem->>'product_id') as product_id,
              (elem->>'quantity')::numeric as quantity,
              (elem->>'total')::numeric as line_total,
              s.customer_id,
              s.status
            FROM sales s,
            jsonb_array_elements(CASE WHEN jsonb_typeof(COALESCE(s.items, '[]')::jsonb) = 'array' THEN s.items::jsonb ELSE '[]'::jsonb END) AS elem
            WHERE s.sale_date BETWEEN $1 AND $2 AND s.status != 'cancelled'
          )
          SELECT 
            p.name as "productName",
            p.sku,
            COALESCE(SUM(si.quantity), 0) as "totalQuantity",
            COALESCE(SUM(si.line_total), 0) as "totalRevenue",
            COUNT(*) as "saleCount"
          FROM sale_items si
          JOIN products p ON si.product_id = p.id::text
          LEFT JOIN customers c ON si.customer_id = c.id
          WHERE 1=1 ${cityFilter}
          GROUP BY p.id, p.name, p.sku
          ORDER BY "totalRevenue" DESC
        `;
          break;

        case 'category':
          sql = `
          WITH sale_items AS (
            SELECT 
              COALESCE(elem->>'product', elem->>'product_id') as product_id,
              (elem->>'total')::numeric as line_total,
              s.customer_id
            FROM sales s,
            jsonb_array_elements(CASE WHEN jsonb_typeof(COALESCE(s.items, '[]')::jsonb) = 'array' THEN s.items::jsonb ELSE '[]'::jsonb END) AS elem
            WHERE s.sale_date BETWEEN $1 AND $2 AND s.status != 'cancelled'
          )
          SELECT 
            cat.name as "categoryName",
            COALESCE(SUM(si.line_total), 0) as "totalRevenue",
            COUNT(*) as "itemCount"
          FROM sale_items si
          JOIN products p ON si.product_id = p.id::text
          JOIN categories cat ON p.category_id = cat.id
          LEFT JOIN customers c ON si.customer_id = c.id
          WHERE 1=1 ${cityFilter}
          GROUP BY cat.id, cat.name
          ORDER BY "totalRevenue" DESC
        `;
          break;

        case 'city':
          sql = `
          SELECT 
            COALESCE(
              CASE 
                WHEN jsonb_typeof(c.address) = 'array' THEN (SELECT addr->>'city' FROM jsonb_array_elements(c.address) addr WHERE addr->>'city' IS NOT NULL LIMIT 1)
                ELSE c.address->>'city'
              END,
              'Unassigned'
            ) as city,
            COUNT(s.id) as "totalOrders",
            COALESCE(SUM(s.total), 0) as "totalRevenue"
          FROM sales s
          JOIN customers c ON s.customer_id = c.id
          WHERE s.sale_date BETWEEN $1 AND $2 AND s.status != 'cancelled'
          GROUP BY city
          ORDER BY "totalRevenue" DESC
        `;
          break;

        case 'invoice':
          sql = `
          SELECT 
            s.order_number as "invoiceNo",
            s.sale_date as date,
            COALESCE(c.business_name, c.name) as "customerName",
            s.total,
            s.payment_status as status,
            s.payment_method as method
          FROM sales s
          LEFT JOIN customers c ON s.customer_id = c.id
          WHERE s.sale_date BETWEEN $1 AND $2 AND s.status != 'cancelled'
          ${cityFilter}
          ORDER BY s.sale_date DESC
        `;
          break;
      }

      const result = await query(sql, params);

      // Calculate summary for the period
      const summarySql = `
      SELECT 
        COUNT(s.id) as "totalOrders",
        SUM(s.total) as "totalRevenue",
        AVG(s.total) as "averageOrderValue"
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.sale_date BETWEEN $1 AND $2 AND s.status != 'cancelled'
      ${cityFilter}
    `;
      const summaryResult = await query(summarySql, params);
      const summary = summaryResult.rows[0];

      return {
        data: result.rows.map(row => {
          const newRow = { ...row };
          // Convert numeric strings to numbers
          ['total', 'subtotal', 'discount', 'tax', 'totalRevenue', 'totalQuantity', 'averageOrderValue'].forEach(key => {
            if (newRow[key] !== undefined) newRow[key] = parseFloat(newRow[key] || 0);
          });
          return newRow;
        }),
        summary: {
          totalOrders: parseInt(summary.totalOrders || 0),
          totalRevenue: parseFloat(summary.totalRevenue || 0),
          averageOrderValue: parseFloat(summary.averageOrderValue || 0)
        },
        groupBy,
        dateRange: { from: dateFrom, to: dateTo }
      };
    });
  }

  /**
   * Get product performance report
   * @param {object} queryParams - Query parameters
   * @returns {Promise<object>}
   */
  async getProductReport(queryParams) {
    return reportsCache('getProductReport', queryParams, async () => {
      const { getStartOfDayPakistan, getEndOfDayPakistan } = require('../utils/dateFilter');

      // Use Pakistan timezone for date filtering
      let dateFrom, dateTo;
      if (queryParams.dateFrom) {
        dateFrom = getStartOfDayPakistan(queryParams.dateFrom);
      } else {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        dateFrom = getStartOfDayPakistan(thirtyDaysAgo.toISOString().split('T')[0]);
      }

      if (queryParams.dateTo) {
        dateTo = getEndOfDayPakistan(queryParams.dateTo);
      } else {
        dateTo = getEndOfDayPakistan(new Date().toISOString().split('T')[0]);
      }

      const limit = parseInt(queryParams.limit) || 20;

      const orders = await salesRepository.findAll(
        {
          dateFrom,
          dateTo,
          excludeStatuses: ['cancelled']
        },
        { sort: { created_at: 1 } }
      );

      for (const order of orders) {
        order.items = await salesService.enrichItemsWithProductNames(order.items || []);
      }

      // Aggregate product sales
      const productSales = {};

      orders.forEach(order => {
        let items = order.items || [];
        if (typeof items === 'string') {
          try {
            items = JSON.parse(items);
          } catch {
            items = [];
          }
        }
        items.forEach(item => {
          if (!item.product) return;
          const productId = (item.product._id || item.product.id).toString();
          if (!productSales[productId]) {
            productSales[productId] = {
              product: item.product,
              totalQuantity: 0,
              totalRevenue: 0,
              totalOrders: 0,
              averagePrice: 0
            };
          }

          productSales[productId].totalQuantity += Number(item.quantity || 0);
          productSales[productId].totalRevenue += Number(item.total || 0);
          productSales[productId].totalOrders += 1;
        });
      });

      // Calculate averages and sort
      const productReport = Object.values(productSales)
        .map(item => ({
          ...item,
          averagePrice: item.totalQuantity > 0 ? item.totalRevenue / item.totalQuantity : 0
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, limit);

      return {
        products: productReport,
        dateRange: {
          from: dateFrom,
          to: dateTo
        },
        total: Object.keys(productSales).length
      };
    });
  }

  /**
   * Get customer performance report
   * @param {object} queryParams - Query parameters
   * @returns {Promise<object>}
   */
  async getCustomerReport(queryParams) {
    return reportsCache('getCustomerReport', queryParams, async () => {
      const { getStartOfDayPakistan, getEndOfDayPakistan } = require('../utils/dateFilter');

      // Use Pakistan timezone for date filtering
      let dateFrom, dateTo;
      if (queryParams.dateFrom) {
        dateFrom = getStartOfDayPakistan(queryParams.dateFrom);
      } else {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        dateFrom = getStartOfDayPakistan(thirtyDaysAgo.toISOString().split('T')[0]);
      }

      if (queryParams.dateTo) {
        dateTo = getEndOfDayPakistan(queryParams.dateTo);
      } else {
        dateTo = getEndOfDayPakistan(new Date().toISOString().split('T')[0]);
      }

      const limit = parseInt(queryParams.limit) || 20;
      const businessType = queryParams.businessType;

      const orders = await salesRepository.findAll(
        {
          dateFrom,
          dateTo,
          excludeStatuses: ['cancelled'],
          requireCustomerId: true
        },
        { sort: { created_at: 1 } }
      );

      const rawIds = [...new Set(orders.map(o => o.customer_id).filter(Boolean))];
      const customerMap = new Map();
      if (rawIds.length > 0) {
        const rows = await customerRepository.findAll({ customerIds: rawIds });
        rows.forEach((c) => {
          const id = String(c.id);
          customerMap.set(id, {
            _id: c.id,
            id: c.id,
            firstName: c.first_name ?? c.firstName,
            lastName: c.last_name ?? c.lastName,
            businessName: c.business_name ?? c.businessName,
            businessType: c.business_type ?? c.businessType,
            customerTier: c.customer_tier ?? c.customerTier
          });
        });
      }

      // Aggregate customer sales
      const customerSales = {};

      orders.forEach(order => {
        const cid = order.customer_id ? String(order.customer_id) : null;
        const customer = cid ? customerMap.get(cid) : null;
        if (!customer) return;

        const customerId = String(customer._id);
        if (!customerSales[customerId]) {
          customerSales[customerId] = {
            customer,
            totalOrders: 0,
            totalRevenue: 0,
            totalItems: 0,
            averageOrderValue: 0,
            lastOrderDate: null
          };
        }

        let items = order.items || [];
        if (typeof items === 'string') {
          try {
            items = JSON.parse(items);
          } catch {
            items = [];
          }
        }

        const orderDate = order.created_at || order.createdAt;
        const orderTotal = Number(order.total ?? order.pricing?.total ?? 0);

        customerSales[customerId].totalOrders += 1;
        customerSales[customerId].totalRevenue += orderTotal;
        customerSales[customerId].totalItems += items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

        if (!customerSales[customerId].lastOrderDate || (orderDate && orderDate > customerSales[customerId].lastOrderDate)) {
          customerSales[customerId].lastOrderDate = orderDate;
        }
      });

      // Filter by business type if specified
      let filteredCustomers = Object.values(customerSales);
      if (businessType) {
        filteredCustomers = filteredCustomers.filter(item =>
          item.customer.businessType === businessType
        );
      }

      // Calculate averages and sort
      const customerReport = filteredCustomers
        .map(item => ({
          ...item,
          averageOrderValue: item.totalOrders > 0 ? item.totalRevenue / item.totalOrders : 0
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, limit);

      return {
        customers: customerReport,
        dateRange: {
          from: dateFrom,
          to: dateTo
        },
        total: filteredCustomers.length,
        filters: {
          businessType
        }
      };
    });
  }

  /**
   * Get stock summary report (Opening Balance, Purchase, Sale, Returns, Damage, Closing Balance)
   * @param {object} filters - Query filters (category, dateFrom, dateTo)
   * @returns {Promise<object>}
   */
  async getStockSummaryReport(filters) {
    return reportsCache('getStockSummaryReport', filters, async () => {
      const { query } = require('../config/postgres');
      const { getStartOfDayPakistan, getEndOfDayPakistan } = require('../utils/dateFilter');

      const categoryId = filters.category && filters.category !== 'all' ? filters.category : null;
      const searchTerm = filters.search && String(filters.search).trim() ? String(filters.search).trim() : null;
      const dateFrom = filters.dateFrom ? getStartOfDayPakistan(filters.dateFrom) : getStartOfDayPakistan(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
      const dateTo = filters.dateTo ? getEndOfDayPakistan(filters.dateTo) : getEndOfDayPakistan(new Date().toISOString().split('T')[0]);

      const params = [dateFrom, dateTo];
      let paramIdx = 3;
      let prodFilter = '';
      if (categoryId) {
        prodFilter += ` AND p.category_id = $${paramIdx++}`;
        params.push(categoryId);
      }
      if (searchTerm) {
        prodFilter += ` AND (p.name ILIKE $${paramIdx} OR p.sku ILIKE $${paramIdx} OR p.barcode ILIKE $${paramIdx})`;
        params.push(`%${searchTerm}%`);
        paramIdx += 1;
      }

      const stockInTypes = "'purchase','return_in','adjustment_in','transfer_in','production','initial_stock'";
      const stockOutTypes = "'sale','return_out','adjustment_out','transfer_out','damage','expiry','theft','consumption'";

      const sql = `
      WITH ib_agg AS (
        SELECT product_id, SUM(COALESCE(quantity, 0))::decimal AS quantity
        FROM inventory_balance
        GROUP BY product_id
      ),
      inv_agg AS (
        SELECT product_id, SUM(COALESCE(current_stock, 0))::decimal AS current_stock
        FROM inventory
        WHERE deleted_at IS NULL
        GROUP BY product_id
      ),
      products_base AS (
        SELECT p.id, p.name, p.sku, p.unit, cat.name as "categoryName",
               COALESCE(p.cost_price, 0) as cost_price,
               COALESCE(p.selling_price, 0) as selling_price,
               COALESCE(p.wholesale_price, p.selling_price, 0) as wholesale_price,
               COALESCE(p.min_stock_level, 0) as min_stock_level,
               p.image_url,
               COALESCE(ib.quantity, i.current_stock, p.stock_quantity, 0)::decimal as "currentStock"
        FROM products p
        LEFT JOIN categories cat ON p.category_id = cat.id
        LEFT JOIN ib_agg ib ON ib.product_id = p.id
        LEFT JOIN inv_agg i ON i.product_id = p.id
        WHERE p.is_deleted = FALSE AND p.is_active = TRUE ${prodFilter}
      ),
      period_act AS (
        SELECT product_id,
          SUM(CASE WHEN movement_type = 'purchase' THEN quantity ELSE 0 END) as purchase_qty,
          SUM(CASE WHEN movement_type = 'purchase' THEN total_value ELSE 0 END) as purchase_amt,
          SUM(CASE WHEN movement_type = 'return_out' THEN quantity ELSE 0 END) as purchase_return_qty,
          SUM(CASE WHEN movement_type = 'return_out' THEN total_value ELSE 0 END) as purchase_return_amt,
          SUM(CASE WHEN movement_type = 'sale' THEN quantity ELSE 0 END) as sale_qty,
          SUM(CASE WHEN movement_type = 'sale' THEN total_value ELSE 0 END) as sale_amt,
          SUM(CASE WHEN movement_type = 'return_in' THEN quantity ELSE 0 END) as sale_return_qty,
          SUM(CASE WHEN movement_type = 'return_in' THEN total_value ELSE 0 END) as sale_return_amt,
          SUM(CASE WHEN movement_type = 'damage' THEN quantity ELSE 0 END) as damage_qty,
          SUM(CASE WHEN movement_type = 'damage' THEN total_value ELSE 0 END) as damage_amt,
          SUM(CASE WHEN movement_type IN (${stockInTypes}) THEN quantity ELSE -quantity END) as net_qty
        FROM stock_movements
        WHERE created_at >= $1 AND created_at <= $2 AND status = 'completed'
        GROUP BY product_id
      ),
      last_pur AS (
        SELECT DISTINCT ON (product_id) product_id, unit_cost as last_purchase_price
        FROM stock_movements
        WHERE movement_type = 'purchase' AND status = 'completed'
        ORDER BY product_id, created_at DESC
      ),
      avg_cost AS (
        SELECT product_id,
          CASE WHEN SUM(quantity) > 0 THEN SUM(total_value) / SUM(quantity) ELSE 0 END as avg_purchase_price
        FROM stock_movements
        WHERE movement_type = 'purchase' AND status = 'completed'
        GROUP BY product_id
      )
      SELECT
        pb.id, pb.name, pb.sku, pb.unit, pb."categoryName", pb.cost_price, pb.selling_price, pb.wholesale_price,
        pb."currentStock",
        pb.min_stock_level,
        pb.image_url as "imageUrl",
        (pb."currentStock" - COALESCE(pa.net_qty, 0))::decimal as "openingQty",
        COALESCE(pa.net_qty, 0)::decimal as "netQty",
        COALESCE(pa.purchase_qty, 0)::decimal as "purchaseQty",
        COALESCE(pa.purchase_amt, 0)::decimal as "purchaseAmount",
        COALESCE(pa.purchase_return_qty, 0)::decimal as "purchaseReturnQty",
        COALESCE(pa.purchase_return_amt, 0)::decimal as "purchaseReturnAmount",
        COALESCE(pa.sale_qty, 0)::decimal as "saleQty",
        COALESCE(pa.sale_amt, 0)::decimal as "saleAmount",
        COALESCE(pa.sale_return_qty, 0)::decimal as "saleReturnQty",
        COALESCE(pa.sale_return_amt, 0)::decimal as "saleReturnAmount",
        COALESCE(pa.damage_qty, 0)::decimal as "damageQty",
        COALESCE(pa.damage_amt, 0)::decimal as "damageAmount",
        COALESCE(lp.last_purchase_price, pb.cost_price, 0)::decimal as "lastPurchasePrice",
        COALESCE(ac.avg_purchase_price, pb.cost_price, 0)::decimal as "avgPurchasePrice"
      FROM products_base pb
      LEFT JOIN period_act pa ON pa.product_id = pb.id
      LEFT JOIN last_pur lp ON lp.product_id = pb.id
      LEFT JOIN avg_cost ac ON ac.product_id = pb.id
      ORDER BY pb.name ASC
    `;

      const result = await query(sql, params);
      const rows = result.rows.map(r => {
        const openingQty = parseFloat(r.openingQty || 0);
        const netQty = parseFloat(r.netQty || 0);
        const purchaseQty = parseFloat(r.purchaseQty || 0);
        const purchaseAmount = parseFloat(r.purchaseAmount || 0);
        const purchaseReturnQty = parseFloat(r.purchaseReturnQty || 0);
        const purchaseReturnAmount = parseFloat(r.purchaseReturnAmount || 0);
        const saleQty = parseFloat(r.saleQty || 0);
        const saleAmount = parseFloat(r.saleAmount || 0);
        const saleReturnQty = parseFloat(r.saleReturnQty || 0);
        const saleReturnAmount = parseFloat(r.saleReturnAmount || 0);
        const damageQty = parseFloat(r.damageQty || 0);
        const damageAmount = parseFloat(r.damageAmount || 0);
        const lastPurchasePrice = parseFloat(r.lastPurchasePrice || 0);
        const avgPurchasePrice = parseFloat(r.avgPurchasePrice || 0);
        const costPrice = avgPurchasePrice || lastPurchasePrice || parseFloat(r.cost_price || 0);
        const openingAmount = openingQty * costPrice;
        const closingQty = openingQty + netQty;
        const currentStock = parseFloat(r.currentStock || 0);
        const reconciliationDelta = closingQty - currentStock;
        const sellingPriceRaw = parseFloat(r.sellingPrice || r.selling_price || 0);
        const wholesalePriceRaw = parseFloat(r.wholesalePrice || r.wholesale_price || 0);
        const sellingPrice = sellingPriceRaw || costPrice;
        const wholesalePrice = wholesalePriceRaw || sellingPriceRaw || costPrice;
        const closingAmount = closingQty * costPrice;
        const wholesaleValuation = closingQty * wholesalePrice;
        const retailValuation = closingQty * sellingPrice;
        const minStockLevel = parseFloat(r.min_stock_level || 0);
        return {
          id: r.id,
          name: r.name,
          sku: r.sku,
          unit: r.unit,
          categoryName: r.categoryName,
          imageUrl: r.imageUrl,
          minStockLevel,
          lastPurchasePrice,
          currentStock,
          reconciliationDelta,
          openingQty,
          openingAmount,
          purchaseQty,
          purchaseAmount,
          purchaseReturnQty,
          purchaseReturnAmount,
          saleQty,
          saleAmount,
          saleReturnQty,
          saleReturnAmount,
          damageQty,
          damageAmount,
          closingQty,
          closingAmount,
          salePrice1: sellingPriceRaw,
          wholesaleValuation,
          retailValuation,
          avgPurchasePrice
        };
      });

      const totals = rows.reduce((acc, r) => ({
        openingQty: acc.openingQty + (parseFloat(r.openingQty) || 0),
        openingAmount: acc.openingAmount + (parseFloat(r.openingAmount) || 0),
        purchaseQty: acc.purchaseQty + (parseFloat(r.purchaseQty) || 0),
        purchaseAmount: acc.purchaseAmount + (parseFloat(r.purchaseAmount) || 0),
        purchaseReturnQty: acc.purchaseReturnQty + (parseFloat(r.purchaseReturnQty) || 0),
        purchaseReturnAmount: acc.purchaseReturnAmount + (parseFloat(r.purchaseReturnAmount) || 0),
        saleQty: acc.saleQty + (parseFloat(r.saleQty) || 0),
        saleAmount: acc.saleAmount + (parseFloat(r.saleAmount) || 0),
        saleReturnQty: acc.saleReturnQty + (parseFloat(r.saleReturnQty) || 0),
        saleReturnAmount: acc.saleReturnAmount + (parseFloat(r.saleReturnAmount) || 0),
        damageQty: acc.damageQty + (parseFloat(r.damageQty) || 0),
        damageAmount: acc.damageAmount + (parseFloat(r.damageAmount) || 0),
        closingQty: acc.closingQty + (parseFloat(r.closingQty) || 0),
        closingAmount: acc.closingAmount + (parseFloat(r.closingAmount) || 0),
        currentStock: acc.currentStock + (parseFloat(r.currentStock) || 0),
        reconciliationDelta: acc.reconciliationDelta + (parseFloat(r.reconciliationDelta) || 0),
        wholesaleValuation: acc.wholesaleValuation + (parseFloat(r.wholesaleValuation) || 0),
        retailValuation: acc.retailValuation + (parseFloat(r.retailValuation) || 0)
      }), { openingQty: 0, openingAmount: 0, purchaseQty: 0, purchaseAmount: 0, purchaseReturnQty: 0, purchaseReturnAmount: 0, saleQty: 0, saleAmount: 0, saleReturnQty: 0, saleReturnAmount: 0, damageQty: 0, damageAmount: 0, closingQty: 0, closingAmount: 0, currentStock: 0, reconciliationDelta: 0, wholesaleValuation: 0, retailValuation: 0 });

      const outOfStockCount = rows.filter(r => (r.closingQty || 0) === 0).length;
      const mismatchedCount = rows.filter(r => Math.abs(r.reconciliationDelta || 0) > 0.000001).length;
      const lowStockCount = rows.filter(r => {
        const qty = r.closingQty ?? 0;
        const minLevel = r.minStockLevel ?? 0;
        // Low stock: has stock but below or at minimum level (and minimum > 0)
        return qty > 0 && minLevel > 0 && qty <= minLevel;
      }).length;
      const inStockCount = rows.filter(r => {
        const qty = r.closingQty ?? 0;
        const minLevel = r.minStockLevel ?? 0;
        // In stock: has stock AND (above minimum level OR no minimum set)
        return qty > 0 && (minLevel === 0 || qty > minLevel);
      }).length;

      return {
        data: rows,
        summary: {
          ...totals,
          totalItems: rows.length,
          totalCost: totals.closingAmount,
          totalWholesaleValuation: totals.wholesaleValuation,
          totalRetailValuation: totals.retailValuation,
          totalCurrentStock: totals.currentStock,
          totalReconciliationDelta: totals.reconciliationDelta,
          mismatchedCount,
          totalStock: totals.closingQty,
          lowStockCount,
          outOfStockCount,
          inStockCount
        },
        reportType: 'stock-summary',
        filters: { categoryId, search: searchTerm || undefined, dateFrom: filters.dateFrom, dateTo: filters.dateTo }
      };
    });
  }

  /**
   * Enhanced Inventory Reconciliation Report (Your Requirements)
   * Shows: Opening Stock, Purchases, Sales, Sale Returns, Purchase Returns, Closing Stock, Valuation
   * Formula: Closing Stock = Opening + Purchases - Sales + Sale Returns - Purchase Returns
   * @param {object} filters - Query filters (dateFrom, dateTo, categoryId, productId)
   * @returns {Promise<object>}
   */
  async getInventoryReconciliationReport(filters) {
    return reportsCache('getInventoryReconciliationReport', filters, async () => {
      const { query } = require('../config/postgres');
      const { getStartOfDayPakistan, getEndOfDayPakistan } = require('../utils/dateFilter');

      const dateFrom = filters.dateFrom ? getStartOfDayPakistan(filters.dateFrom) : getStartOfDayPakistan(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
      const dateTo = filters.dateTo ? getEndOfDayPakistan(filters.dateTo) : getEndOfDayPakistan(new Date().toISOString().split('T')[0]);
      const categoryId = filters.categoryId && filters.categoryId !== 'all' ? filters.categoryId : null;
      const productId = filters.productId ? filters.productId : null;

      const params = [dateFrom, dateTo];
      let paramIdx = 3;
      let prodFilter = '';
      if (categoryId) {
        prodFilter += ` AND p.category_id = $${paramIdx++}`;
        params.push(categoryId);
      }
      if (productId) {
        prodFilter += ` AND p.id = $${paramIdx++}`;
        params.push(productId);
      }

      // Get opening stock as of dateFrom (from inventory_balance or calculate from movements)
      const openingStockSql = `
      WITH opening_movements AS (
        SELECT product_id,
          SUM(CASE
            WHEN movement_type IN ('purchase','return_in','adjustment_in','transfer_in','production','initial_stock') THEN quantity
            WHEN movement_type IN ('sale','return_out','adjustment_out','transfer_out','damage','expiry','theft','consumption') THEN -quantity
            ELSE 0
          END) as opening_qty
        FROM stock_movements
        WHERE created_at < $1 AND status = 'completed'
        GROUP BY product_id
      )
      SELECT p.id as product_id, p.name, p.sku, p.unit,
             COALESCE(om.opening_qty, 0) as opening_stock
      FROM products p
      LEFT JOIN opening_movements om ON om.product_id = p.id
      WHERE p.is_deleted = FALSE AND p.is_active = TRUE ${prodFilter}
    `;

      const openingResult = await query(openingStockSql, params.slice(0, paramIdx));
      const openingStockMap = new Map();
      openingResult.rows.forEach(row => {
        openingStockMap.set(row.product_id, {
          name: row.name,
          sku: row.sku,
          unit: row.unit,
          openingStock: parseFloat(row.opening_stock || 0)
        });
      });

      // Get period movements
      const movementsSql = `
      SELECT product_id,
        SUM(CASE WHEN movement_type = 'purchase' THEN quantity ELSE 0 END) as purchases,
        SUM(CASE WHEN movement_type = 'sale' THEN quantity ELSE 0 END) as sales,
        SUM(CASE WHEN movement_type = 'return_in' THEN quantity ELSE 0 END) as sale_returns,
        SUM(CASE WHEN movement_type = 'return_out' THEN quantity ELSE 0 END) as purchase_returns
      FROM stock_movements
      WHERE created_at >= $1 AND created_at <= $2 AND status = 'completed'
      GROUP BY product_id
    `;

      const movementsResult = await query(movementsSql, [dateFrom, dateTo]);
      const movementsMap = new Map();
      movementsResult.rows.forEach(row => {
        movementsMap.set(row.product_id, {
          purchases: parseFloat(row.purchases || 0),
          sales: parseFloat(row.sales || 0),
          saleReturns: parseFloat(row.sale_returns || 0),
          purchaseReturns: parseFloat(row.purchase_returns || 0)
        });
      });

      // Get current cost prices and closing stock
      const currentSql = `
      WITH ib_agg AS (
        SELECT product_id, SUM(COALESCE(quantity, 0))::decimal AS quantity
        FROM inventory_balance
        GROUP BY product_id
      ),
      inv_agg AS (
        SELECT product_id, SUM(COALESCE(current_stock, 0))::decimal AS current_stock
        FROM inventory
        WHERE deleted_at IS NULL
        GROUP BY product_id
      )
      SELECT p.id, p.name, p.sku, p.unit, cat.name as category_name,
             COALESCE(ib.quantity, i.current_stock, p.stock_quantity, 0) as closing_stock,
             p.cost_price
      FROM products p
      LEFT JOIN categories cat ON p.category_id = cat.id
      LEFT JOIN ib_agg ib ON ib.product_id = p.id
      LEFT JOIN inv_agg i ON i.product_id = p.id
      WHERE p.is_deleted = FALSE AND p.is_active = TRUE ${prodFilter}
      ORDER BY p.name ASC
    `;

      const currentResult = await query(currentSql, params.slice(2));
      const reportData = [];

      currentResult.rows.forEach(row => {
        const productId = row.id;
        const opening = openingStockMap.get(productId) || { openingStock: 0 };
        const movements = movementsMap.get(productId) || {
          purchases: 0, sales: 0, saleReturns: 0, purchaseReturns: 0
        };

        const openingStock = opening.openingStock;
        const purchases = movements.purchases;
        const sales = movements.sales;
        const saleReturns = movements.saleReturns;
        const purchaseReturns = movements.purchaseReturns;

        // Your formula: Closing Stock = Opening + Purchases - Sales + Sale Returns - Purchase Returns
        const calculatedClosing = openingStock + purchases - sales + saleReturns - purchaseReturns;
        const actualClosing = parseFloat(row.closing_stock || 0);
        const costPrice = parseFloat(row.cost_price || 0);

        reportData.push({
          productId,
          productName: row.name,
          sku: row.sku,
          unit: row.unit,
          categoryName: row.category_name,
          openingStock,
          purchases,
          sales,
          saleReturns,
          purchaseReturns,
          calculatedClosing,
          actualClosing,
          variance: calculatedClosing - actualClosing,
          costPrice,
          valuation: calculatedClosing * costPrice
        });
      });

      // Calculate totals
      const totals = reportData.reduce((acc, item) => ({
        openingStock: acc.openingStock + item.openingStock,
        purchases: acc.purchases + item.purchases,
        sales: acc.sales + item.sales,
        saleReturns: acc.saleReturns + item.saleReturns,
        purchaseReturns: acc.purchaseReturns + item.purchaseReturns,
        calculatedClosing: acc.calculatedClosing + item.calculatedClosing,
        actualClosing: acc.actualClosing + item.actualClosing,
        variance: acc.variance + item.variance,
        valuation: acc.valuation + item.valuation
      }), {
        openingStock: 0, purchases: 0, sales: 0, saleReturns: 0, purchaseReturns: 0,
        calculatedClosing: 0, actualClosing: 0, variance: 0, valuation: 0
      });

      return {
        data: reportData,
        summary: {
          ...totals,
          totalProducts: reportData.length,
          productsWithVariance: reportData.filter(p => Math.abs(p.variance) > 0.001).length
        },
        reportType: 'inventory-reconciliation',
        filters: { dateFrom, dateTo, categoryId, productId },
        formula: 'Closing Stock = Opening + Purchases - Sales + Sale Returns - Purchase Returns'
      };
    });
  }

  /**
   * Get comprehensive inventory report
   * @param {object} filters - Query filters (category, lowStock, type)
   * @returns {Promise<object>}
   */
  async getInventoryReport(filters) {
    return reportsCache('getInventoryReport', filters, async () => {
      const reportType = filters.type || 'summary';
      if (reportType === 'stock-summary') {
        return this.getStockSummaryReport(filters);
      }

      const { query } = require('../config/postgres');
      const categoryId = filters.category && filters.category !== 'all' ? filters.category : null;
      const searchTerm = filters.search && String(filters.search).trim() ? String(filters.search).trim() : null;

      let sql = '';
      let params = [];
      let paramIdx = 1;

      let whereClause = "WHERE p.is_deleted = FALSE AND p.is_active = TRUE";
      if (categoryId) {
        whereClause += ` AND p.category_id = $${paramIdx++}`;
        params.push(categoryId);
      }
      if (searchTerm) {
        whereClause += ` AND (p.name ILIKE $${paramIdx} OR p.sku ILIKE $${paramIdx} OR p.barcode ILIKE $${paramIdx})`;
        params.push(`%${searchTerm}%`);
        paramIdx += 1;
      }

      if (reportType === 'low-stock') {
        whereClause += " AND p.stock_quantity <= p.min_stock_level";
      }
      // Current Stock: only show products with available stock (quantity > 0)
      if (reportType === 'summary') {
        whereClause += " AND (COALESCE(ib.quantity, i.current_stock, p.stock_quantity, 0) > 0)";
      }

      sql = `
      WITH ib_agg AS (
        SELECT product_id, SUM(COALESCE(quantity, 0))::decimal AS quantity
        FROM inventory_balance
        GROUP BY product_id
      ),
      inv_agg AS (
        SELECT product_id, SUM(COALESCE(current_stock, 0))::decimal AS current_stock
        FROM inventory
        WHERE deleted_at IS NULL
        GROUP BY product_id
      )
      SELECT 
        p.id,
        p.name,
        p.sku,
        p.barcode,
        p.image_url as "imageUrl",
        cat.name as "categoryName",
        COALESCE(ib.quantity, i.current_stock, p.stock_quantity, 0) as "stockQuantity",
        p.min_stock_level as "minStockLevel",
        p.cost_price as "costPrice",
        p.selling_price as "sellingPrice",
        (COALESCE(ib.quantity, i.current_stock, p.stock_quantity, 0) * p.cost_price) as "valuation",
        (COALESCE(ib.quantity, i.current_stock, p.stock_quantity, 0) * p.selling_price) as "retailValuation",
        p.unit
      FROM products p
      LEFT JOIN categories cat ON p.category_id = cat.id
      LEFT JOIN ib_agg ib ON ib.product_id = p.id
      LEFT JOIN inv_agg i ON i.product_id = p.id
      ${whereClause}
      ORDER BY p.name ASC
    `;

      const result = await query(sql, params);

      // Calculate summary using correct stock source (inventory_balance > inventory > products.stock_quantity)
      const summarySql = `
      WITH ib_agg AS (
        SELECT product_id, SUM(COALESCE(quantity, 0))::decimal AS quantity
        FROM inventory_balance
        GROUP BY product_id
      ),
      inv_agg AS (
        SELECT product_id, SUM(COALESCE(current_stock, 0))::decimal AS current_stock
        FROM inventory
        WHERE deleted_at IS NULL
        GROUP BY product_id
      )
      SELECT 
        COUNT(*) as "totalItems",
        SUM(COALESCE(ib.quantity, i.current_stock, p.stock_quantity, 0) * COALESCE(p.cost_price, 0)) as "totalCost",
        SUM(COALESCE(ib.quantity, i.current_stock, p.stock_quantity, 0) * COALESCE(p.selling_price, 0)) as "totalRetailValuation",
        COUNT(*) FILTER (WHERE COALESCE(ib.quantity, i.current_stock, p.stock_quantity, 0) = 0) as "outOfStockCount",
        COUNT(*) FILTER (WHERE COALESCE(ib.quantity, i.current_stock, p.stock_quantity, 0) > 0 
                         AND COALESCE(p.min_stock_level, 0) > 0
                         AND COALESCE(ib.quantity, i.current_stock, p.stock_quantity, 0) <= p.min_stock_level) as "lowStockCount",
        COUNT(*) FILTER (WHERE COALESCE(ib.quantity, i.current_stock, p.stock_quantity, 0) > 0) as "inStockCount"
      FROM products p
      LEFT JOIN ib_agg ib ON ib.product_id = p.id
      LEFT JOIN inv_agg i ON i.product_id = p.id
      WHERE p.is_deleted = FALSE AND p.is_active = TRUE
      ${categoryId ? ` AND p.category_id = $1` : ''}
      ${searchTerm ? ` AND (p.name ILIKE $${categoryId ? 2 : 1} OR p.sku ILIKE $${categoryId ? 2 : 1} OR p.barcode ILIKE $${categoryId ? 2 : 1})` : ''}
      ${reportType === 'summary' ? ` AND (COALESCE(ib.quantity, i.current_stock, p.stock_quantity, 0) > 0)` : ''}
    `;
      const summaryParams = [];
      if (categoryId) summaryParams.push(categoryId);
      if (searchTerm) summaryParams.push(`%${searchTerm}%`);
      const summaryResult = await query(summarySql, summaryParams.length ? summaryParams : []);
      const summary = summaryResult.rows[0];

      return {
        data: result.rows.map(row => ({
          ...row,
          stockQuantity: parseFloat(row.stockQuantity || 0),
          minStockLevel: parseFloat(row.minStockLevel || 0),
          costPrice: parseFloat(row.costPrice || 0),
          sellingPrice: parseFloat(row.sellingPrice || 0),
          valuation: parseFloat(row.valuation || 0),
          retailValuation: parseFloat(row.retailValuation || 0)
        })),
        summary: {
          totalItems: parseInt(summary.totalItems || 0),
          totalCost: parseFloat(summary.totalCost || 0),
          totalRetailValuation: parseFloat(summary.totalRetailValuation || 0),
          lowStockCount: parseInt(summary.lowStockCount || 0),
          outOfStockCount: parseInt(summary.outOfStockCount || 0),
          inStockCount: parseInt(summary.inStockCount || 0)
        },
        reportType,
        filters: { categoryId }
      };
    });
  }

  /**
   * Get comprehensive financial reports
   * @param {object} filters - Query filters (dateFrom, dateTo, type)
   * @returns {Promise<object>}
   */
  async getFinancialReport(filters) {
    return reportsCache('getFinancialReport', filters, async () => {
      const { query } = require('../config/postgres');
      const { getStartOfDayPakistan, getEndOfDayPakistan } = require('../utils/dateFilter');

      const dateFrom = filters.dateFrom ? getStartOfDayPakistan(filters.dateFrom) : null;
      const dateTo = filters.dateTo ? getEndOfDayPakistan(filters.dateTo) : getEndOfDayPakistan(new Date().toISOString().split('T')[0]);
      const reportType = filters.type || 'trial-balance'; // trial-balance, pl-statement, balance-sheet

      let sql = '';
      let params = [];
      if (reportType === 'balance-sheet') {
        params = dateTo ? [dateTo] : [];
      } else {
        if (dateFrom && dateTo) params = [dateFrom, dateTo];
        else if (dateTo) params = [dateTo];
      }

      switch (reportType) {
        case 'trial-balance':
          sql = `
          SELECT 
            coa.account_code as "accountCode",
            coa.account_name as "accountName",
            coa.account_type as "accountType",
            COALESCE(SUM(l.debit_amount), 0) as "totalDebit",
            COALESCE(SUM(l.credit_amount), 0) as "totalCredit",
            CASE 
              WHEN coa.normal_balance = 'debit' THEN (coa.opening_balance + COALESCE(SUM(l.debit_amount - l.credit_amount), 0))
              ELSE 0
            END as "debitBalance",
            CASE 
              WHEN coa.normal_balance = 'credit' THEN (coa.opening_balance + COALESCE(SUM(l.credit_amount - l.debit_amount), 0))
              ELSE 0
            END as "creditBalance"
          FROM chart_of_accounts coa
          LEFT JOIN account_ledger l ON coa.account_code = l.account_code 
            AND l.status = 'completed' 
            AND l.reversed_at IS NULL
            ${dateFrom && dateTo ? 'AND l.transaction_date BETWEEN $1 AND $2' : dateTo ? 'AND l.transaction_date <= $1' : ''}
          WHERE coa.deleted_at IS NULL
          GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_type, coa.normal_balance, coa.opening_balance
          HAVING (coa.opening_balance != 0 OR SUM(l.debit_amount) != 0 OR SUM(l.credit_amount) != 0)
          ORDER BY coa.account_code ASC
        `;
          break;

        case 'pl-statement':
          sql = `
          SELECT 
            coa.account_category as category,
            coa.account_name as "accountName",
            coa.account_type as "accountType",
            CASE 
              WHEN coa.account_type = 'revenue' THEN COALESCE(SUM(l.credit_amount - l.debit_amount), 0)
              ELSE COALESCE(SUM(l.debit_amount - l.credit_amount), 0)
            END as amount
          FROM chart_of_accounts coa
          JOIN account_ledger l ON coa.account_code = l.account_code
          WHERE coa.account_type IN ('revenue', 'expense')
            AND l.status = 'completed'
            AND l.reversed_at IS NULL
            ${dateFrom && dateTo ? 'AND l.transaction_date BETWEEN $1 AND $2' : dateTo ? 'AND l.transaction_date <= $1' : ''}
          GROUP BY coa.account_category, coa.account_name, coa.account_type
          ORDER BY coa.account_type DESC, coa.account_category ASC
        `;
          break;

        case 'balance-sheet':
          sql = `
          SELECT 
            coa.account_type as "accountType",
            coa.account_category as category,
            coa.account_name as "accountName",
            (coa.opening_balance + COALESCE(SUM(
              CASE 
                WHEN coa.normal_balance = 'debit' THEN (l.debit_amount - l.credit_amount)
                ELSE (l.credit_amount - l.debit_amount)
              END
            ), 0)) as balance
          FROM chart_of_accounts coa
          LEFT JOIN account_ledger l ON coa.account_code = l.account_code 
            AND l.status = 'completed'
            AND l.reversed_at IS NULL
            ${dateTo ? 'AND l.transaction_date <= $1' : ''}
          WHERE coa.account_type IN ('asset', 'liability', 'equity')
            AND coa.deleted_at IS NULL
          GROUP BY coa.account_type, coa.account_category, coa.account_name, coa.normal_balance, coa.opening_balance
          ORDER BY coa.account_type ASC, coa.account_category ASC
        `;
          break;
      }

      const result = await query(sql, params);
      const data = result.rows.map(row => {
        const newRow = { ...row };
        ['totalDebit', 'totalCredit', 'debitBalance', 'creditBalance', 'amount', 'balance'].forEach(key => {
          if (newRow[key] !== undefined) newRow[key] = parseFloat(newRow[key] || 0);
        });
        return newRow;
      });

      // Calculate Summary
      let summary = {};
      if (reportType === 'trial-balance') {
        summary = {
          totalDebit: data.reduce((sum, r) => sum + r.debitBalance, 0),
          totalCredit: data.reduce((sum, r) => sum + r.creditBalance, 0)
        };
      } else if (reportType === 'pl-statement') {
        const revenue = data.filter(r => r.accountType === 'revenue').reduce((sum, r) => sum + r.amount, 0);
        const expenses = data.filter(r => r.accountType === 'expense').reduce((sum, r) => sum + r.amount, 0);
        summary = {
          totalRevenue: revenue,
          totalExpenses: expenses,
          netProfit: revenue - expenses
        };
      } else if (reportType === 'balance-sheet') {
        summary = {
          totalAssets: data.filter(r => r.accountType === 'asset').reduce((sum, r) => sum + r.balance, 0),
          totalLiabilities: data.filter(r => r.accountType === 'liability').reduce((sum, r) => sum + r.balance, 0),
          totalEquity: data.filter(r => r.accountType === 'equity').reduce((sum, r) => sum + r.balance, 0)
        };
      }

      return {
        data,
        summary,
        reportType,
        dateRange: { from: dateFrom, to: dateTo }
      };
    });
  }

  /**
   * Get summary cards for reporting dashboard
   * @param {object} filters - Query filters (dateFrom, dateTo, city)
   * @returns {Promise<object>}
   */
  async getSummaryCards(filters) {
    return reportsCache('getSummaryCards', filters, async () => {
      const { query } = require('../config/postgres');
      const { getStartOfDayPakistan, getEndOfDayPakistan } = require('../utils/dateFilter');

      const dateFrom = filters.dateFrom ? getStartOfDayPakistan(filters.dateFrom) : null;
      const dateTo = filters.dateTo ? getEndOfDayPakistan(filters.dateTo) : null;
      const city = filters.city && filters.city !== 'all' ? filters.city : null;

      // Base filters for city if provided
      let cityJoin = '';
      let cityWhere = '';
      if (city) {
        cityJoin = `
        LEFT JOIN customers c ON l.customer_id = c.id
        LEFT JOIN suppliers s ON l.supplier_id = s.id
      `;
        cityWhere = `AND (
        (jsonb_typeof(c.address) = 'array' AND EXISTS (SELECT 1 FROM jsonb_array_elements(c.address) addr WHERE addr->>'city' = $${filters.dateFrom && filters.dateTo ? 3 : 1}))
        OR (jsonb_typeof(c.address) = 'object' AND c.address->>'city' = $${filters.dateFrom && filters.dateTo ? 3 : 1})
        OR (jsonb_typeof(s.address) = 'array' AND EXISTS (SELECT 1 FROM jsonb_array_elements(s.address) addr WHERE addr->>'city' = $${filters.dateFrom && filters.dateTo ? 3 : 1}))
        OR (jsonb_typeof(s.address) = 'object' AND s.address->>'city' = $${filters.dateFrom && filters.dateTo ? 3 : 1})
      )`;
      }

      // 1. Total Customer Balance (Current)
      const customerBalanceQuery = `
      SELECT SUM(balance) as total FROM (
        SELECT c.opening_balance + COALESCE(SUM(l.debit_amount - l.credit_amount), 0) as balance
        FROM customers c
        LEFT JOIN account_ledger l ON c.id = l.customer_id
          AND l.status = 'completed'
          AND l.account_code = '1100'
          AND l.reversed_at IS NULL
          AND (l.reference_type IS NULL OR l.reference_type <> 'customer_opening_balance')
        WHERE c.deleted_at IS NULL AND c.is_deleted = FALSE
        ${city ? `AND (
          (jsonb_typeof(c.address) = 'array' AND EXISTS (SELECT 1 FROM jsonb_array_elements(c.address) addr WHERE addr->>'city' = $1))
          OR (jsonb_typeof(c.address) = 'object' AND c.address->>'city' = $1)
        )` : ''}
        GROUP BY c.id, c.opening_balance
      ) as sub
    `;
      const customerBalance = await query(customerBalanceQuery, city ? [city] : []);

      // 2. Total Supplier Balance (Current)
      const supplierBalanceQuery = `
      SELECT SUM(balance) as total FROM (
        SELECT s.opening_balance + COALESCE(SUM(l.credit_amount - l.debit_amount), 0) as balance
        FROM suppliers s
        LEFT JOIN account_ledger l ON s.id = l.supplier_id
          AND l.status = 'completed'
          AND l.account_code = '2000'
          AND l.reversed_at IS NULL
          AND (l.reference_type IS NULL OR l.reference_type <> 'supplier_opening_balance')
        WHERE s.deleted_at IS NULL AND s.is_deleted = FALSE
        ${city ? `AND (
          (jsonb_typeof(s.address) = 'array' AND EXISTS (SELECT 1 FROM jsonb_array_elements(s.address) addr WHERE addr->>'city' = $1))
          OR (jsonb_typeof(s.address) = 'object' AND s.address->>'city' = $1)
        )` : ''}
        GROUP BY s.id, s.opening_balance
      ) as sub
    `;
      const supplierBalance = await query(supplierBalanceQuery, city ? [city] : []);

      // 3. Period-specific metrics (Sales, Payments)
      let dateFilter = '';
      let params = [];
      if (dateFrom && dateTo) {
        dateFilter = 'AND l.transaction_date BETWEEN $1 AND $2';
        params = [dateFrom, dateTo];
        if (city) params.push(city);
      } else if (city) {
        params = [city];
      }

      // Total Customer Payments in period
      const customerPaymentsQuery = `
      SELECT SUM(l.credit_amount) as total
      FROM account_ledger l
      ${city ? cityJoin : ''}
      WHERE l.customer_id IS NOT NULL 
      AND l.account_code = '1100'
      AND l.status = 'completed'
      AND l.reversed_at IS NULL
      ${dateFilter}
      ${city ? cityWhere : ''}
    `;
      const customerPayments = await query(customerPaymentsQuery, params);

      // Total Supplier Payments in period
      const supplierPaymentsQuery = `
      SELECT SUM(l.debit_amount) as total
      FROM account_ledger l
      ${city ? cityJoin : ''}
      WHERE l.supplier_id IS NOT NULL
      AND l.account_code = '2000'
      AND l.status = 'completed'
      AND l.reversed_at IS NULL
      ${dateFilter}
      ${city ? cityWhere : ''}
    `;
      const supplierPayments = await query(supplierPaymentsQuery, params);

      return {
        totalCustomerBalance: parseFloat(customerBalance.rows[0].total || 0),
        totalSupplierBalance: parseFloat(supplierBalance.rows[0].total || 0),
        totalCustomerPayments: parseFloat(customerPayments.rows[0].total || 0),
        totalSupplierPayments: parseFloat(supplierPayments.rows[0].total || 0),
      };
    });
  }

  /**
   * Get bank and cash summary report
   * @param {object} filters - Query filters (dateFrom, dateTo)
   * @returns {Promise<object>}
   */
  async getBankCashSummary(filters) {
    return reportsCache('getBankCashSummary', filters, async () => {
      const { query } = require('../config/postgres');
      const { getStartOfDayPakistan, getEndOfDayPakistan } = require('../utils/dateFilter');

      let resolvedDateFrom = filters.dateFrom || null;
      let resolvedDateTo = filters.dateTo || null;
      if ((!resolvedDateFrom || !resolvedDateTo) && filters.month) {
        const monthMatch = String(filters.month).match(/^(\d{4})-(\d{2})$/);
        if (monthMatch) {
          const year = Number(monthMatch[1]);
          const month = Number(monthMatch[2]);
          if (Number.isFinite(year) && Number.isFinite(month) && month >= 1 && month <= 12) {
            const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
            const monthEndDate = new Date(Date.UTC(year, month, 0));
            const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(monthEndDate.getUTCDate()).padStart(2, '0')}`;
            resolvedDateFrom = resolvedDateFrom || monthStart;
            resolvedDateTo = resolvedDateTo || monthEnd;
          }
        }
      }

      const dateFrom = resolvedDateFrom ? getStartOfDayPakistan(resolvedDateFrom) : null;
      const dateTo = resolvedDateTo ? getEndOfDayPakistan(resolvedDateTo) : null;
      const bankIds = String(filters.bankIds || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);

      let dateClause = '';
      let params = [];
      if (dateFrom && dateTo) {
        dateClause = 'AND date BETWEEN $1 AND $2';
        params = [dateFrom, dateTo];
      } else if (dateFrom) {
        dateClause = 'AND date >= $1';
        params = [dateFrom];
      } else if (dateTo) {
        dateClause = 'AND date <= $1';
        params = [dateTo];
      }

      const dateParams = [...params];
      const defaultBankRes = await query(
        "SELECT id FROM banks WHERE deleted_at IS NULL ORDER BY bank_name ASC LIMIT 1"
      );
      const defaultBankId = defaultBankRes.rows[0]?.id || null;

      let bankParams = [...params];
      const defaultBankParamIndex = bankParams.length + 1;
      bankParams.push(defaultBankId);

      let bankIdFilterBankTable = '';
      if (bankIds.length > 0) {
        const bankParamIndex = bankParams.length + 1;
        bankParams.push(bankIds);
        bankIdFilterBankTable = `AND b.id = ANY($${bankParamIndex}::uuid[])`;
      }

      const bankSummarySql = `
      WITH bank_ledgers_resolved AS (
        -- Resolve bank_id for ALL ledger entries (handling historical NULLs)
        SELECT 
          al.debit_amount,
          al.credit_amount,
          al.transaction_date,
          COALESCE(al.bank_id, $${defaultBankParamIndex}) as resolved_bank_id
        FROM account_ledger al
        WHERE al.account_code = '1001'
          AND al.status = 'completed'
          AND al.reversed_at IS NULL
          AND al.reference_type != 'bank_opening_balance'
      ),
      bank_initial_balances AS (
        SELECT 
          b.id as bank_id,
          COALESCE(b.opening_balance, 0) as initial_opening
        FROM banks b
        WHERE b.deleted_at IS NULL
      ),
      bank_pre_period AS (
        -- Calculate the starting balance for the period (Initial + everything before dateFrom)
        SELECT 
          bib.bank_id,
          bib.initial_opening + COALESCE(SUM(al.debit_amount - al.credit_amount), 0) as period_opening
        FROM bank_initial_balances bib
        LEFT JOIN bank_ledgers_resolved al ON al.resolved_bank_id = bib.bank_id 
          ${dateFrom ? 'AND al.transaction_date < $1' : 'AND 1=0'} 
        GROUP BY bib.bank_id, bib.initial_opening
      ),
      bank_period_stats AS (
        -- Sum transactions occurring WITHIN the selected period
        SELECT 
          al.resolved_bank_id as bank_id,
          SUM(al.debit_amount) as total_receipts,
          SUM(al.credit_amount) as total_payments
        FROM bank_ledgers_resolved al
        WHERE 1=1
          ${dateClause.replace('date', 'al.transaction_date')}
        GROUP BY al.resolved_bank_id
      )
      SELECT 
        b.id,
        b.bank_name as "bankName",
        b.account_name as "accountName",
        b.account_number as "accountNumber",
        COALESCE(bp.period_opening, b.opening_balance, 0) as "openingBalance",
        COALESCE(ps.total_receipts, 0) as "totalReceipts",
        COALESCE(ps.total_payments, 0) as "totalPayments"
      FROM banks b
      LEFT JOIN bank_pre_period bp ON bp.bank_id = b.id
      LEFT JOIN bank_period_stats ps ON ps.bank_id = b.id
      WHERE b.deleted_at IS NULL
      ${bankIdFilterBankTable}
      ORDER BY b.bank_name ASC, b.account_number ASC
    `;

      const bankResult = await query(bankSummarySql, bankParams);

      // Process bank rows
      const banks = bankResult.rows.map(row => {
        const openingBalance = parseFloat(row.openingBalance || 0);
        const totalReceipts = parseFloat(row.totalReceipts || 0);
        const totalPayments = parseFloat(row.totalPayments || 0);

        return {
          ...row,
          openingBalance,
          totalReceipts,
          totalPayments,
          balance: openingBalance + totalReceipts - totalPayments
        };
      });

      // Cash Summary Refactoring (same logic)
      const cashOpeningSql = `
      SELECT 
        COALESCE(opening_balance, 0) + 
        COALESCE((SELECT SUM(debit_amount - credit_amount) FROM account_ledger WHERE account_code = '1000' AND status = 'completed' AND reversed_at IS NULL AND reference_type != 'cash_opening_balance' ${dateFrom ? 'AND transaction_date < $1' : 'AND 1=0'}), 0) as "periodOpening"
      FROM chart_of_accounts
      WHERE account_code = '1000' AND deleted_at IS NULL
    `;

      const cashStatsSql = `
      SELECT 
        COALESCE(SUM(debit_amount), 0) as "totalReceipts",
        COALESCE(SUM(credit_amount), 0) as "totalPayments"
      FROM account_ledger
      WHERE account_code = '1000'
        AND status = 'completed'
        AND reversed_at IS NULL
        AND reference_type != 'cash_opening_balance'
        ${dateClause.replace('date', 'transaction_date')}
    `;

      const [cashOpeningRes, cashStatsRes] = await Promise.all([
        query(cashOpeningSql, dateFrom ? [dateFrom] : []),
        query(cashStatsSql, dateParams)
      ]);

      const cashOpening = parseFloat(cashOpeningRes.rows[0]?.periodOpening || 0);
      const cashStats = cashStatsRes.rows[0] || {};

      const cash = {
        openingBalance: cashOpening,
        totalReceipts: parseFloat(cashStats.totalReceipts || 0),
        totalPayments: parseFloat(cashStats.totalPayments || 0),
      };
      cash.balance = cash.openingBalance + cash.totalReceipts - cash.totalPayments;

      const totals = {
        totalBankBalance: banks.reduce((sum, bank) => sum + (bank.balance || 0), 0),
        totalBankOpening: banks.reduce((sum, bank) => sum + (bank.openingBalance || 0), 0),
        totalBankReceipts: banks.reduce((sum, bank) => sum + (bank.totalReceipts || 0), 0),
        totalBankPayments: banks.reduce((sum, bank) => sum + (bank.totalPayments || 0), 0),
      };

      return {
        banks,
        cash,
        totals,
        receiptSummary: {
          totalBankReceipts: totals.totalBankReceipts,
          totalCashReceipts: cash.totalReceipts,
          totalReceipts: totals.totalBankReceipts + cash.totalReceipts
        },
        dateRange: { from: dateFrom, to: dateTo }
      };
    });
  }

  /**
   * Get party balance report (Customer/Supplier)
   * @param {object} filters - Query filters (partyType, city, dateFrom, dateTo)
   * @returns {Promise<object>}
   */
  async getPartyBalanceReport(filters) {
    return reportsCache('getPartyBalanceReport', filters, async () => {
      const { query } = require('../config/postgres');
      const partyType = filters.partyType || 'customer';
      const city = filters.city && filters.city !== 'all' ? filters.city : null;

      let sql = '';
      let params = [];

      if (partyType === 'customer') {
        sql = `
        SELECT 
          c.id,
          COALESCE(c.business_name, c.name) as "businessName",
          c.name as "contactPerson",
          COALESCE(
            CASE 
              WHEN jsonb_typeof(c.address) = 'array' THEN (SELECT addr->>'city' FROM jsonb_array_elements(c.address) addr WHERE addr->>'city' IS NOT NULL LIMIT 1)
              ELSE c.address->>'city'
            END,
            'N/A'
          ) as city,
          c.opening_balance as "openingBalance",
          (c.opening_balance + COALESCE(SUM(l.debit_amount - l.credit_amount), 0)) as balance,
          COALESCE(SUM(l.debit_amount), 0) as "totalDebit",
          COALESCE(SUM(l.credit_amount), 0) as "totalCredit"
        FROM customers c
        LEFT JOIN account_ledger l ON c.id = l.customer_id
          AND l.status = 'completed'
          AND l.account_code = '1100'
          AND l.reversed_at IS NULL
          AND (l.reference_type IS NULL OR l.reference_type <> 'customer_opening_balance')
        WHERE c.deleted_at IS NULL AND c.is_deleted = FALSE
      `;
        if (city) {
          sql += ` AND (
          (jsonb_typeof(c.address) = 'array' AND EXISTS (SELECT 1 FROM jsonb_array_elements(c.address) addr WHERE addr->>'city' = $1))
          OR (jsonb_typeof(c.address) = 'object' AND c.address->>'city' = $1)
        )`;
          params.push(city);
        }
        sql += ` GROUP BY c.id, c.business_name, c.name, c.address, c.opening_balance ORDER BY balance DESC`;
      } else {
        sql = `
        SELECT 
          s.id,
          COALESCE(s.company_name, s.business_name, s.name) as "businessName",
          COALESCE(s.contact_person, s.name) as "contactPerson",
          COALESCE(
            CASE 
              WHEN jsonb_typeof(s.address) = 'array' THEN (SELECT addr->>'city' FROM jsonb_array_elements(s.address) addr WHERE addr->>'city' IS NOT NULL LIMIT 1)
              ELSE s.address->>'city'
            END,
            'N/A'
          ) as city,
          s.opening_balance as "openingBalance",
          (s.opening_balance + COALESCE(SUM(l.credit_amount - l.debit_amount), 0)) as balance,
          COALESCE(SUM(l.debit_amount), 0) as "totalDebit",
          COALESCE(SUM(l.credit_amount), 0) as "totalCredit"
        FROM suppliers s
        LEFT JOIN account_ledger l ON s.id = l.supplier_id
          AND l.status = 'completed'
          AND l.account_code = '2000'
          AND l.reversed_at IS NULL
          AND (l.reference_type IS NULL OR l.reference_type <> 'supplier_opening_balance')
        WHERE s.deleted_at IS NULL AND s.is_deleted = FALSE
      `;
        if (city) {
          sql += ` AND (
          (jsonb_typeof(s.address) = 'array' AND EXISTS (SELECT 1 FROM jsonb_array_elements(s.address) addr WHERE addr->>'city' = $1))
          OR (jsonb_typeof(s.address) = 'object' AND s.address->>'city' = $1)
        )`;
          params.push(city);
        }
        sql += ` GROUP BY s.id, s.company_name, s.business_name, s.name, s.contact_person, s.address, s.opening_balance ORDER BY balance DESC`;
      }

      const result = await query(sql, params);
      return {
        data: result.rows.map(row => ({
          ...row,
          openingBalance: parseFloat(row.openingBalance || 0),
          balance: parseFloat(row.balance),
          totalDebit: parseFloat(row.totalDebit),
          totalCredit: parseFloat(row.totalCredit)
        })),
        partyType,
        city: city || 'All Cities'
      };
    });
  }

  /**
   * Get products purchased by supplier - quantity and amount per product per supplier.
   * Same product from different suppliers shown as separate rows.
   * @param {object} filters - supplier (optional), dateFrom, dateTo
   * @returns {Promise<{ data: Array, summary }>}
   */
  async getPurchaseBySupplierReport(filters) {
    return reportsCache('getPurchaseBySupplierReport', filters, async () => {
      const { query } = require('../config/postgres');
      const { getStartOfDayPakistan, getEndOfDayPakistan } = require('../utils/dateFilter');

      const dateFrom = filters.dateFrom ? getStartOfDayPakistan(filters.dateFrom) : null;
      const dateTo = filters.dateTo ? getEndOfDayPakistan(filters.dateTo) : null;
      const supplierId = filters.supplier || filters.supplierId || null;
      const includeCustomersSold = [true, 'true', '1', 1].includes(filters.includeCustomersSold);

      let sql = `
      WITH item_rows AS (
        SELECT
          pi.supplier_id,
          pi.invoice_date,
          pi.created_at,
          COALESCE(
            elem->'product'->>'id',
            elem->'product'->>'_id',
            elem->>'product',
            elem->>'product_id'
          ) AS product_id,
          (COALESCE((elem->>'quantity')::numeric, (elem->>'qty')::numeric, 0)) AS qty,
          (COALESCE((elem->>'unitCost')::numeric, (elem->>'unit_cost')::numeric, (elem->>'price')::numeric, 0)) AS unit_cost
        FROM purchase_invoices pi
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(pi.items, '[]'::jsonb)) AS elem
        WHERE pi.deleted_at IS NULL
          AND pi.status NOT IN ('cancelled')
          AND pi.invoice_type = 'purchase'
          AND (
            (elem->'product'->>'id') IS NOT NULL OR
            (elem->'product'->>'_id') IS NOT NULL OR
            elem->>'product' IS NOT NULL OR
            elem->>'product_id' IS NOT NULL
          )
    )
    SELECT
      ir.product_id AS "productId",
      COALESCE(p.name, pv.display_name, pv.variant_name, 'Unknown Product') AS "productName",
      ir.supplier_id AS "supplierId",
      COALESCE(s.company_name, s.name, 'Unknown Supplier') AS "supplierName",
      SUM(ir.qty) AS "totalQuantity",
      SUM(ir.qty * ir.unit_cost) AS "totalAmount"
    FROM item_rows ir
    LEFT JOIN products p ON p.id::text = ir.product_id AND (p.is_deleted = FALSE OR p.is_deleted IS NULL)
    LEFT JOIN product_variants pv ON pv.id::text = ir.product_id AND pv.deleted_at IS NULL
    LEFT JOIN suppliers s ON s.id = ir.supplier_id AND (s.is_deleted = FALSE OR s.is_deleted IS NULL)
    WHERE ir.product_id IS NOT NULL AND ir.supplier_id IS NOT NULL
  `;
      const params = [];
      let pn = 1;
      if (dateFrom) {
        sql += ` AND (ir.invoice_date >= $${pn} OR ir.created_at >= $${pn})`;
        params.push(dateFrom);
        pn++;
      }
      if (dateTo) {
        sql += ` AND (ir.invoice_date <= $${pn} OR ir.created_at <= $${pn})`;
        params.push(dateTo);
        pn++;
      }
      if (supplierId) {
        sql += ` AND ir.supplier_id = $${pn}`;
        params.push(supplierId);
        pn++;
      }
      sql += `
    GROUP BY ir.product_id, p.name, pv.display_name, pv.variant_name, ir.supplier_id, s.company_name, s.name
    ORDER BY "productName", "supplierName"
    `;

      const result = await query(sql, params);
      const rows = result.rows || [];
      const summary = {
        totalProducts: new Set(rows.map(r => r.productId)).size,
        totalSuppliers: new Set(rows.map(r => r.supplierId)).size,
        totalQuantity: rows.reduce((sum, r) => sum + parseFloat(r.totalQuantity || 0), 0),
        totalAmount: rows.reduce((sum, r) => sum + parseFloat(r.totalAmount || 0), 0)
      };

      let customersSoldByProduct = {};
      if (includeCustomersSold && rows.length > 0) {
        const productIds = [...new Set(rows.map(r => r.productId).filter(Boolean))];
        const placeholders = productIds.map((_, i) => `$${i + 1}`).join(', ');
        const salesSql = `
        SELECT
          COALESCE(
            elem->>'product',
            elem->>'product_id',
            elem->'product'->>'id',
            elem->'product'->>'_id'
          ) AS product_id,
          s.customer_id,
          TRIM(COALESCE(c.name, c.business_name, 'Unknown')) AS customer_name,
          SUM(COALESCE((elem->>'quantity')::numeric, (elem->>'qty')::numeric, 0)) AS qty_sold
        FROM sales s
        CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(COALESCE(s.items, '[]')::jsonb) = 'array' THEN COALESCE(s.items, '[]')::jsonb ELSE '[]'::jsonb END) AS elem
        LEFT JOIN customers c ON c.id = s.customer_id AND (c.is_deleted = FALSE OR c.is_deleted IS NULL)
        WHERE s.deleted_at IS NULL AND s.status != 'cancelled'
          AND COALESCE(elem->>'product', elem->>'product_id', elem->'product'->>'id', elem->'product'->>'_id') IN (${placeholders})
        GROUP BY 1, 2, 3
      `;
        const soSql = `
        SELECT
          COALESCE(
            elem->>'product',
            elem->>'product_id',
            elem->'product'->>'id',
            elem->'product'->>'_id'
          ) AS product_id,
          so.customer_id,
          TRIM(COALESCE(c.name, c.business_name, 'Unknown')) AS customer_name,
          SUM(COALESCE((elem->>'quantity')::numeric, (elem->>'qty')::numeric, 0)) AS qty_sold
        FROM sales_orders so
        CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(COALESCE(so.items, '[]'::jsonb)) = 'array' THEN COALESCE(so.items, '[]'::jsonb) ELSE '[]'::jsonb END) AS elem
        LEFT JOIN customers c ON c.id = so.customer_id AND (c.is_deleted = FALSE OR c.is_deleted IS NULL)
        WHERE so.deleted_at IS NULL AND so.status NOT IN ('cancelled', 'draft')
          AND COALESCE(elem->>'product', elem->>'product_id', elem->'product'->>'id', elem->'product'->>'_id') IN (${placeholders})
        GROUP BY 1, 2, 3
      `;
        try {
          const [salesRes, soRes] = await Promise.all([
            query(salesSql, productIds),
            query(soSql, productIds)
          ]);
          const combined = [...(salesRes.rows || []), ...(soRes.rows || [])];
          combined.forEach((row) => {
            const pid = row.product_id;
            if (!pid) return;
            if (!customersSoldByProduct[pid]) customersSoldByProduct[pid] = [];
            const name = (row.customer_name || '').trim() || 'Unknown';
            const qty = parseFloat(row.qty_sold || 0);
            const existing = customersSoldByProduct[pid].find((x) => x.customerName === name);
            if (existing) existing.quantity += qty;
            else customersSoldByProduct[pid].push({ customerName: name, quantity: qty });
          });
        } catch (err) {
          console.warn('getPurchaseBySupplierReport: could not load customers sold', err.message);
        }
      }

      return {
        data: rows.map(r => {
          const out = {
            productId: r.productId,
            productName: r.productName,
            supplierId: r.supplierId,
            supplierName: r.supplierName,
            totalQuantity: parseFloat(r.totalQuantity || 0),
            totalAmount: parseFloat(r.totalAmount || 0)
          };
          if (includeCustomersSold && r.productId && customersSoldByProduct[r.productId]) {
            out.customersSold = customersSoldByProduct[r.productId];
          }
          return out;
        }),
        summary
      };
    });
  }
}

module.exports = new ReportsService();

