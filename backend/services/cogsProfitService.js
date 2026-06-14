const salesRepository = require('../repositories/SalesRepository');
const customerRepository = require('../repositories/CustomerRepository');
const { getStartOfDayPakistan, getEndOfDayPakistan } = require('../utils/dateFilter');

/**
 * Calculates COGS for a list of sales invoice line items
 * @param {Array} items - Array of invoice items
 * @returns {number} - Total COGS
 */
function calculateItemsCOGS(items) {
  if (!items || !Array.isArray(items)) return 0;
  return items.reduce((total, item) => {
    const qty = Number(item.quantity || 0);
    const cost = Number(item.unitCost ?? item.cost_price ?? item.costPrice ?? item.cost ?? 0);
    return total + (qty * cost);
  }, 0);
}

/**
 * Calculates profit metrics for a given revenue and COGS
 * @param {number} revenue - Sales revenue (invoice total)
 * @param {number} cogs - Cost of goods sold
 * @returns {{grossProfit: number, profitMargin: number}}
 */
function calculateProfitMetrics(revenue, cogs) {
  const grossProfit = revenue - cogs;
  const profitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  return { grossProfit, profitMargin };
}

/**
 * Generate COGS & Profit report based on query filters
 * @param {object} filters - Request filters (dateFrom, dateTo, customerId, search)
 * @returns {Promise<object>}
 */
async function getCOGSProfitReport(filters = {}) {
  const dbFilters = {
    excludeStatuses: ['cancelled']
  };

  if (filters.dateFrom) {
    dbFilters.dateFrom = getStartOfDayPakistan(filters.dateFrom);
  }
  if (filters.dateTo) {
    dbFilters.dateTo = getEndOfDayPakistan(filters.dateTo);
  }
  if (filters.customerId) {
    dbFilters.customerId = filters.customerId;
  }
  if (filters.search) {
    dbFilters.search = filters.search;
  }

  // Fetch sales invoices matching filters (limit to 10000 to optimize performance)
  const invoices = await salesRepository.findAll(dbFilters, { limit: 10000 });

  // Fetch sale returns matching date filters and customer filters
  const { query } = require('../config/postgres');
  let returnsSql = `
    SELECT r.id, r.return_number, r.return_date, r.customer_id, r.total_amount, r.items
    FROM returns r
    WHERE r.return_type = 'sale_return'
      AND r.status NOT IN ('rejected', 'cancelled', 'pending')
      AND r.deleted_at IS NULL
  `;
  const returnsParams = [];
  let paramIndex = 1;
  if (dbFilters.dateFrom) {
    returnsSql += ` AND r.return_date >= $${paramIndex++}`;
    returnsParams.push(dbFilters.dateFrom);
  }
  if (dbFilters.dateTo) {
    returnsSql += ` AND r.return_date <= $${paramIndex++}`;
    returnsParams.push(dbFilters.dateTo);
  }
  if (dbFilters.customerId) {
    returnsSql += ` AND r.customer_id = $${paramIndex++}`;
    returnsParams.push(dbFilters.customerId);
  }

  let returnsResult;
  try {
    returnsResult = await query(returnsSql, returnsParams);
  } catch (err) {
    console.error('Failed to fetch returns for COGS report:', err.message);
    returnsResult = { rows: [] };
  }

  // Combine customer IDs to pre-fetch customer names in one query
  const customerIds = [...new Set([
    ...invoices.map(inv => inv.customer_id),
    ...returnsResult.rows.map(ret => ret.customer_id)
  ].filter(Boolean))];

  const customerMap = new Map();
  if (customerIds.length > 0) {
    try {
      const customers = await customerRepository.findAll({ customerIds });
      customers.forEach(c => {
        customerMap.set(String(c.id || c._id), c.business_name || c.businessName || c.name);
      });
    } catch (err) {
      console.error('Failed to pre-fetch customer list for COGS report:', err.message);
    }
  }

  let totalSalesRevenue = 0;
  let totalCOGS = 0;
  const data = [];

  // 1) Process Sales Invoices
  for (const inv of invoices) {
    const items = typeof inv.items === 'string' ? JSON.parse(inv.items || '[]') : (inv.items || []);
    const cogs = calculateItemsCOGS(items);
    const revenue = Number(inv.total ?? inv.pricing?.total ?? 0);
    const { grossProfit, profitMargin } = calculateProfitMetrics(revenue, cogs);

    totalSalesRevenue += revenue;
    totalCOGS += cogs;

    // Resolve customer name
    let customerName = 'Walk-in';
    if (inv.customer_id) {
      const mappedName = customerMap.get(String(inv.customer_id));
      if (mappedName) {
        customerName = mappedName;
      } else if (inv.customer) {
        customerName = inv.customer.businessName || inv.customer.business_name || inv.customer.name || 'Walk-in';
      } else if (inv.customerInfo) {
        customerName = inv.customerInfo.businessName || inv.customerInfo.business_name || inv.customerInfo.name || 'Walk-in';
      }
    }

    data.push({
      id: inv.id || inv._id,
      invoiceNumber: inv.order_number || inv.orderNumber || '—',
      invoiceDate: inv.sale_date || inv.createdAt,
      customerName,
      totalSaleAmount: revenue,
      totalProductCost: cogs, // FIFO-based inventory cost
      cogsAmount: cogs,
      grossProfit,
      profitMargin
    });
  }

  // 2) Process Sales Returns (Negative Revenue & Negative COGS)
  for (const ret of returnsResult.rows) {
    // Resolve customer name
    let customerName = 'Walk-in';
    if (ret.customer_id) {
      const mappedName = customerMap.get(String(ret.customer_id));
      if (mappedName) {
        customerName = mappedName;
      }
    }

    // Apply search filter in JS if search filter exists
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchSearch =
        (ret.return_number || '').toLowerCase().includes(searchLower) ||
        customerName.toLowerCase().includes(searchLower);
      if (!matchSearch) continue;
    }

    const items = typeof ret.items === 'string' ? JSON.parse(ret.items || '[]') : (ret.items || []);
    let returnCOGS = 0;

    for (const ri of items) {
      const qty = Number(ri.quantity || 0);
      let unitCost = Number(ri.unit_cost ?? ri.unitCost ?? ri.cost_price ?? ri.costPrice ?? 0);

      // Fallback: If unit_cost is not recorded on return item, look up product's current cost price
      if (unitCost === 0 && ri.product) {
        try {
          const ProductRepository = require('../repositories/postgres/ProductRepository');
          const productId = typeof ri.product === 'object' ? (ri.product.id || ri.product._id) : ri.product;
          const prod = await ProductRepository.findById(productId);
          if (prod) {
            unitCost = Number(prod.cost_price ?? prod.costPrice ?? 0);
          }
        } catch (err) {
          console.warn(`Failed to resolve fallback product cost for product ID ${ri.product}:`, err.message);
        }
      }

      returnCOGS += unitCost * qty;
    }

    const revenue = Number(ret.total_amount || 0);
    const negRevenue = -revenue;
    const negCOGS = -returnCOGS;
    const { grossProfit: negGrossProfit } = calculateProfitMetrics(negRevenue, negCOGS);

    totalSalesRevenue += negRevenue;
    totalCOGS += negCOGS;

    data.push({
      id: ret.id,
      invoiceNumber: ret.return_number || '—',
      invoiceDate: ret.return_date || ret.createdAt,
      customerName,
      totalSaleAmount: negRevenue,
      totalProductCost: negCOGS,
      cogsAmount: negCOGS,
      grossProfit: negGrossProfit,
      profitMargin: 0 // Not applicable for return items directly
    });
  }

  // Sort report entries by date in descending order so they are displayed chronologically
  data.sort((a, b) => new Date(b.invoiceDate) - new Date(a.invoiceDate));

  const { grossProfit: totalGrossProfit, profitMargin: overallProfitMargin } = calculateProfitMetrics(totalSalesRevenue, totalCOGS);
  const totalInvoices = invoices.length;
  const averageCOGS = totalInvoices > 0 ? totalCOGS / totalInvoices : 0;

  return {
    data,
    summary: {
      totalSalesRevenue,
      totalCOGS,
      totalGrossProfit,
      overallProfitMargin,
      totalInvoices,
      averageCOGS
    }
  };
}

module.exports = {
  calculateItemsCOGS,
  calculateProfitMetrics,
  getCOGSProfitReport
};
