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

  // Get customer names for display
  const customerIds = [...new Set(invoices.map(inv => inv.customer_id).filter(Boolean))];
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
