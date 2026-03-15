const SalesRepository = require('../repositories/SalesRepository');
const InventoryRepository = require('../repositories/InventoryRepository');
const ProductRepository = require('../repositories/ProductRepository');
const CashReceiptRepository = require('../repositories/CashReceiptRepository');
const CashPaymentRepository = require('../repositories/CashPaymentRepository');
const StockMovementRepository = require('../repositories/StockMovementRepository');

/**
 * Anomaly Detection Service
 * Detects unusual patterns, potential fraud, and suspicious activities
 */
class AnomalyDetectionService {
  /**
   * Detect anomalies in sales transactions
   * @param {Object} options - Detection options
   * @returns {Promise<Array>} Array of detected anomalies
   */
  static async detectSalesAnomalies(options = {}) {
    try {
      const { getStartOfDayPakistan, getEndOfDayPakistan, formatDatePakistan } = require('../utils/dateFilter');
      
      // Use Pakistan timezone for date filtering
      let startDate, endDate;
      if (options.startDate) {
        startDate = typeof options.startDate === 'string' 
          ? getStartOfDayPakistan(options.startDate)
          : getStartOfDayPakistan(formatDatePakistan(options.startDate));
      } else {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        startDate = getStartOfDayPakistan(formatDatePakistan(thirtyDaysAgo));
      }
      
      if (options.endDate) {
        endDate = typeof options.endDate === 'string'
          ? getEndOfDayPakistan(options.endDate)
          : getEndOfDayPakistan(formatDatePakistan(options.endDate));
      } else {
        endDate = getEndOfDayPakistan(formatDatePakistan(new Date()));
      }
      
      const minSeverity = options.minSeverity || 'low';

      const anomalies = [];

      // Get all sales in the period
      const sales = await SalesRepository.findAll({
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'completed'
      }, {
        populate: [
          { path: 'customer', select: 'name businessName email' },
          { path: 'items.product', select: 'name sku pricing' }
        ],
        lean: true
      });

      // 1. Detect unusually large transactions
      const largeTransactionAnomalies = await this.detectLargeTransactions(sales);
      anomalies.push(...largeTransactionAnomalies);

      // 2. Detect rapid successive transactions
      const rapidTransactionAnomalies = await this.detectRapidTransactions(sales);
      anomalies.push(...rapidTransactionAnomalies);

      // 3. Detect unusual discounts
      const discountAnomalies = await this.detectDiscountAnomalies(sales);
      anomalies.push(...discountAnomalies);

      // 4. Detect price anomalies
      const priceAnomalies = await this.detectPriceAnomalies(sales);
      anomalies.push(...priceAnomalies);

      // 5. Detect quantity anomalies
      const quantityAnomalies = await this.detectQuantityAnomalies(sales);
      anomalies.push(...quantityAnomalies);

      // 6. Detect unusual customer behavior
      const customerAnomalies = await this.detectCustomerAnomalies(sales);
      anomalies.push(...customerAnomalies);

      // Filter by severity
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const minSeverityLevel = severityOrder[minSeverity] || 1;

      return anomalies
        .filter(anomaly => severityOrder[anomaly.severity] >= minSeverityLevel)
        .sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);
    } catch (error) {
      console.error('Error detecting sales anomalies:', error);
      throw error;
    }
  }

  /**
   * Detect unusually large transactions
   */
  static async detectLargeTransactions(sales) {
    if (sales.length === 0) return [];

    const amounts = sales.map(s => s.total || 0);
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);

    // Transactions more than 3 standard deviations above mean are suspicious
    const threshold = mean + (3 * stdDev);
    const anomalies = [];

    for (const sale of sales) {
      if (sale.total > threshold && sale.total > mean * 2) {
        anomalies.push({
          type: 'large_transaction',
          severity: sale.total > mean * 5 ? 'critical' : sale.total > mean * 3 ? 'high' : 'medium',
          title: 'Unusually Large Transaction',
          description: `Transaction amount (${this.formatCurrency(sale.total)}) is significantly higher than average (${this.formatCurrency(mean)})`,
          transactionId: sale._id,
          transactionType: 'sales',
          amount: sale.total,
          averageAmount: mean,
          deviation: ((sale.total - mean) / mean * 100).toFixed(1),
          customer: sale.customer,
          date: sale.createdAt,
          metadata: {
            itemsCount: sale.items?.length || 0,
            voucherCode: sale.voucherCode
          }
        });
      }
    }

    return anomalies;
  }

  /**
   * Detect rapid successive transactions
   */
  static async detectRapidTransactions(sales) {
    if (sales.length < 2) return [];

    const anomalies = [];
    const customerTransactions = {};

    // Group transactions by customer
    for (const sale of sales) {
      const customerId = sale.customer?._id?.toString() || sale.customer?.toString() || 'unknown';
      if (!customerTransactions[customerId]) {
        customerTransactions[customerId] = [];
      }
      customerTransactions[customerId].push(sale);
    }

    // Check for rapid transactions
    for (const [customerId, transactions] of Object.entries(customerTransactions)) {
      if (transactions.length < 2) continue;

      // Sort by date
      transactions.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      for (let i = 1; i < transactions.length; i++) {
        const prev = transactions[i - 1];
        const curr = transactions[i];
        const timeDiff = new Date(curr.createdAt) - new Date(prev.createdAt);
        const minutesDiff = timeDiff / (1000 * 60);

        // Multiple transactions within 5 minutes is suspicious
        if (minutesDiff < 5) {
          const totalAmount = prev.total + curr.total;
          anomalies.push({
            type: 'rapid_transactions',
            severity: minutesDiff < 1 ? 'high' : 'medium',
            title: 'Rapid Successive Transactions',
            description: `Multiple transactions from same customer within ${minutesDiff.toFixed(1)} minutes`,
            transactionId: curr._id,
            transactionType: 'sales',
            customer: curr.customer,
            date: curr.createdAt,
            metadata: {
              timeDifference: minutesDiff.toFixed(1),
              previousTransactionId: prev._id,
              totalAmount: totalAmount,
              transactionCount: transactions.length
            }
          });
        }
      }
    }

    return anomalies;
  }

  /**
   * Detect unusual discounts
   */
  static async detectDiscountAnomalies(sales) {
    if (sales.length === 0) return [];

    const anomalies = [];

    for (const sale of sales) {
      const discount = sale.discount || 0;
      const subtotal = sale.subtotal || sale.total || 0;
      const discountPercentage = subtotal > 0 ? (discount / subtotal) * 100 : 0;

      // Discounts over 50% are suspicious
      if (discountPercentage > 50) {
        anomalies.push({
          type: 'unusual_discount',
          severity: discountPercentage > 80 ? 'critical' : discountPercentage > 70 ? 'high' : 'medium',
          title: 'Unusually High Discount',
          description: `Discount of ${discountPercentage.toFixed(1)}% (${this.formatCurrency(discount)}) applied`,
          transactionId: sale._id,
          transactionType: 'sales',
          amount: sale.total,
          discount: discount,
          discountPercentage: discountPercentage.toFixed(1),
          customer: sale.customer,
          date: sale.createdAt,
          metadata: {
            subtotal: subtotal,
            voucherCode: sale.voucherCode
          }
        });
      }
    }

    return anomalies;
  }

  /**
   * Detect price anomalies (selling below cost)
   */
  static async detectPriceAnomalies(sales) {
    if (sales.length === 0) return [];

    const anomalies = [];

    for (const sale of sales) {
      if (!sale.items || sale.items.length === 0) continue;

      for (const item of sale.items) {
        const product = item.product;
        if (!product) continue;

        const sellingPrice = item.price || item.unitPrice || 0;
        const costPrice = product.pricing?.cost || product.cost || 0;

        // Selling below cost is suspicious
        if (costPrice > 0 && sellingPrice < costPrice) {
          const loss = (costPrice - sellingPrice) * item.quantity;
          anomalies.push({
            type: 'price_anomaly',
            severity: loss > 1000 ? 'critical' : loss > 500 ? 'high' : 'medium',
            title: 'Product Sold Below Cost',
            description: `Product "${product.name || product.sku}" sold at ${this.formatCurrency(sellingPrice)} (cost: ${this.formatCurrency(costPrice)})`,
            transactionId: sale._id,
            transactionType: 'sales',
            product: {
              _id: product._id,
              name: product.name,
              sku: product.sku
            },
            sellingPrice: sellingPrice,
            costPrice: costPrice,
            quantity: item.quantity,
            estimatedLoss: loss,
            customer: sale.customer,
            date: sale.createdAt,
            metadata: {
              voucherCode: sale.voucherCode
            }
          });
        }
      }
    }

    return anomalies;
  }

  /**
   * Detect quantity anomalies (unusually large quantities)
   */
  static async detectQuantityAnomalies(sales) {
    if (sales.length === 0) return [];

    const anomalies = [];
    const productQuantities = {};

    // Calculate average quantities per product
    for (const sale of sales) {
      if (!sale.items) continue;
      for (const item of sale.items) {
        const productId = item.product?._id?.toString() || item.product?.toString();
        if (!productId) continue;

        if (!productQuantities[productId]) {
          productQuantities[productId] = {
            quantities: [],
            product: item.product
          };
        }
        productQuantities[productId].quantities.push(item.quantity || 0);
      }
    }

    // Check for anomalies
    for (const [productId, data] of Object.entries(productQuantities)) {
      if (data.quantities.length === 0) continue;

      const mean = data.quantities.reduce((a, b) => a + b, 0) / data.quantities.length;
      const max = Math.max(...data.quantities);

      // Quantity more than 5x average is suspicious
      if (max > mean * 5 && mean > 0) {
        const sale = sales.find(s => 
          s.items?.some(item => 
            (item.product?._id?.toString() || item.product?.toString()) === productId && 
            item.quantity === max
          )
        );

        if (sale) {
          anomalies.push({
            type: 'quantity_anomaly',
            severity: max > mean * 10 ? 'high' : 'medium',
            title: 'Unusually Large Quantity',
            description: `Quantity of ${max} is significantly higher than average (${mean.toFixed(1)})`,
            transactionId: sale._id,
            transactionType: 'sales',
            product: data.product,
            quantity: max,
            averageQuantity: mean.toFixed(1),
            customer: sale.customer,
            date: sale.createdAt,
            metadata: {
              voucherCode: sale.voucherCode
            }
          });
        }
      }
    }

    return anomalies;
  }

  /**
   * Detect unusual customer behavior
   */
  static async detectCustomerAnomalies(sales) {
    if (sales.length === 0) return [];

    const anomalies = [];
    const customerStats = {};

    // Calculate customer statistics
    for (const sale of sales) {
      const customerId = sale.customer?._id?.toString() || sale.customer?.toString();
      if (!customerId) continue;

      if (!customerStats[customerId]) {
        customerStats[customerId] = {
          customer: sale.customer,
          transactions: [],
          totalAmount: 0,
          transactionCount: 0
        };
      }

      customerStats[customerId].transactions.push(sale);
      customerStats[customerId].totalAmount += sale.total || 0;
      customerStats[customerId].transactionCount++;
    }

    // Check for new customers with large transactions
    for (const [customerId, stats] of Object.entries(customerStats)) {
      if (stats.transactionCount === 1 && stats.totalAmount > 10000) {
        anomalies.push({
          type: 'new_customer_large_transaction',
          severity: 'medium',
          title: 'New Customer Large Transaction',
          description: `New customer made a large transaction of ${this.formatCurrency(stats.totalAmount)}`,
          customer: stats.customer,
          transactionId: stats.transactions[0]._id,
          transactionType: 'sales',
          amount: stats.totalAmount,
          date: stats.transactions[0].createdAt,
          metadata: {
            isFirstTransaction: true
          }
        });
      }
    }

    return anomalies;
  }

  /**
   * Detect inventory discrepancies
   * @returns {Promise<Array>} Array of inventory anomalies
   */
  static async detectInventoryAnomalies() {
    try {
      const anomalies = [];

      // Get all products with inventory
      const products = await ProductRepository.findAll({ status: 'active' }, {
        populate: [{ path: 'category', select: 'name' }],
        lean: true
      });

      const inventories = await InventoryRepository.findAll({}, { lean: true });
      const inventoryMap = {};
      inventories.forEach(inv => {
        inventoryMap[inv.product.toString()] = inv;
      });

      // Check for negative stock
      for (const product of products) {
        const inventory = inventoryMap[product._id.toString()];
        if (!inventory) continue;

        const currentStock = inventory.currentStock || 0;

        if (currentStock < 0) {
          anomalies.push({
            type: 'negative_stock',
            severity: 'high',
            title: 'Negative Stock Detected',
            description: `Product "${product.name}" has negative stock: ${currentStock}`,
            product: {
              _id: product._id,
              name: product.name,
              sku: product.sku
            },
            currentStock: currentStock,
            date: new Date(),
            metadata: {
              category: product.category?.name
            }
          });
        }

        // Check for sudden stock drops
        const reorderPoint = inventory.reorderPoint || 10;
        if (currentStock < reorderPoint && currentStock > 0) {
          // This is handled by inventory alerts, but we can flag sudden drops
          const recentMovements = await this.getRecentStockMovements(product._id, { days: 7, limit: 5 });
          if (recentMovements.length > 0) {
            // Find the most recent stock-out movement
            const stockOutMovements = recentMovements.filter(m => m.quantityChange < 0);
            if (stockOutMovements.length > 0) {
              const lastMovement = stockOutMovements[0];
              const dropAmount = Math.abs(lastMovement.quantityChange || 0);
              
              // Flag if the drop is more than 2x the current stock level
              // This indicates a sudden significant reduction
              if (dropAmount > currentStock * 2) {
                anomalies.push({
                  type: 'sudden_stock_drop',
                  severity: 'medium',
                  title: 'Sudden Stock Drop',
                  description: `Product "${product.name}" stock dropped by ${dropAmount} units (from ${lastMovement.previousStock} to ${lastMovement.newStock})`,
                  product: {
                    _id: product._id,
                    name: product.name,
                    sku: product.sku
                  },
                  currentStock: currentStock,
                  previousStock: lastMovement.previousStock,
                  dropAmount: dropAmount,
                  date: lastMovement.date || new Date(),
                  metadata: {
                    movementType: lastMovement.type,
                    reason: lastMovement.reason,
                    reference: lastMovement.reference,
                    performedBy: lastMovement.performedBy
                  }
                });
              }
            }
          }
        }
      }

      return anomalies;
    } catch (error) {
      console.error('Error detecting inventory anomalies:', error);
      throw error;
    }
  }

  /**
   * Get recent stock movements for a product
   * @param {string} productId - Product ID
   * @param {Object} options - Options for filtering movements
   * @param {number} options.days - Number of days to look back (default: 7)
   * @param {number} options.limit - Maximum number of movements to return (default: 10)
   * @returns {Promise<Array>} Array of recent stock movements
   */
  static async getRecentStockMovements(productId, options = {}) {
    try {
      const { days = 7, limit = 10 } = options;
      
      // Calculate date threshold
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - days);
      
      // Query recent stock movements for the product
      const movements = await StockMovementRepository.findAll({
        product: productId,
        status: 'completed', // Only completed movements
        createdAt: { $gte: dateThreshold },
        isReversal: { $ne: true } // Exclude reversals
      }, {
        sort: { createdAt: -1 }, // Most recent first
        limit: limit,
        populate: [
          { path: 'user', select: 'firstName lastName' },
          { path: 'product', select: 'name sku' }
        ],
        lean: true
      });
      
      // Transform movements to match expected format
      return movements.map(movement => ({
        type: movement.movementType,
        quantityChange: this.getQuantityChangeForMovement(movement),
        date: movement.createdAt,
        previousStock: movement.previousStock || 0,
        newStock: movement.newStock || 0,
        reason: movement.reason || movement.notes || '',
        reference: movement.referenceNumber || movement.referenceType,
        performedBy: movement.user ? `${movement.user.firstName} ${movement.user.lastName}` : 'System'
      }));
    } catch (error) {
      console.error(`Error fetching recent stock movements for product ${productId}:`, error);
      // Return empty array on error to prevent breaking anomaly detection
      return [];
    }
  }

  /**
   * Calculate quantity change based on movement type
   * @param {Object} movement - Stock movement object
   * @returns {number} Quantity change (positive for stock in, negative for stock out)
   */
  static getQuantityChangeForMovement(movement) {
    // Use previousStock and newStock if available (more accurate)
    if (movement.previousStock !== undefined && movement.newStock !== undefined) {
      return movement.newStock - movement.previousStock;
    }
    
    // Fallback to movement type-based calculation
    const stockInTypes = ['purchase', 'return_in', 'adjustment_in', 'transfer_in', 'production', 'initial_stock'];
    const stockOutTypes = ['sale', 'return_out', 'adjustment_out', 'transfer_out', 'damage', 'expiry', 'theft', 'consumption'];
    
    if (stockInTypes.includes(movement.movementType)) {
      return movement.quantity || 0;
    } else if (stockOutTypes.includes(movement.movementType)) {
      return -(movement.quantity || 0);
    }
    
    return 0;
  }

  /**
   * Detect payment anomalies
   * @returns {Promise<Array>} Array of payment anomalies
   */
  static async detectPaymentAnomalies(options = {}) {
    try {
      const { getStartOfDayPakistan, getEndOfDayPakistan, formatDatePakistan } = require('../utils/dateFilter');
      
      // Use Pakistan timezone for date filtering
      let startDate, endDate;
      if (options.startDate) {
        startDate = typeof options.startDate === 'string' 
          ? getStartOfDayPakistan(options.startDate)
          : getStartOfDayPakistan(formatDatePakistan(options.startDate));
      } else {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        startDate = getStartOfDayPakistan(formatDatePakistan(thirtyDaysAgo));
      }
      
      if (options.endDate) {
        endDate = typeof options.endDate === 'string'
          ? getEndOfDayPakistan(options.endDate)
          : getEndOfDayPakistan(formatDatePakistan(options.endDate));
      } else {
        endDate = getEndOfDayPakistan(formatDatePakistan(new Date()));
      }

      const anomalies = [];

      // Check cash receipts
      const cashReceipts = await CashReceiptRepository.findAll({
        createdAt: { $gte: startDate, $lte: endDate }
      }, {
        populate: [{ path: 'customer', select: 'name businessName' }],
        lean: true
      });

      // Check for duplicate receipts
      const receiptMap = {};
      for (const receipt of cashReceipts) {
        const key = `${receipt.customer?._id || receipt.customer}-${receipt.amount}-${receipt.voucherDate}`;
        if (receiptMap[key]) {
          anomalies.push({
            type: 'duplicate_payment',
            severity: 'medium',
            title: 'Potential Duplicate Payment',
            description: `Duplicate cash receipt detected: ${this.formatCurrency(receipt.amount)}`,
            transactionId: receipt._id,
            transactionType: 'cash_receipt',
            amount: receipt.amount,
            customer: receipt.customer,
            date: receipt.createdAt,
            metadata: {
              voucherCode: receipt.voucherCode,
              duplicateOf: receiptMap[key]._id
            }
          });
        } else {
          receiptMap[key] = receipt;
        }
      }

      // Check cash payments
      const cashPayments = await CashPaymentRepository.findAll({
        createdAt: { $gte: startDate, $lte: endDate }
      }, {
        populate: [{ path: 'supplier', select: 'companyName' }],
        lean: true
      });

      // Check for unusually large payments
      const paymentAmounts = cashPayments.map(p => p.amount || 0);
      if (paymentAmounts.length > 0) {
        const mean = paymentAmounts.reduce((a, b) => a + b, 0) / paymentAmounts.length;
        const threshold = mean * 3;

        for (const payment of cashPayments) {
          if (payment.amount > threshold) {
            anomalies.push({
              type: 'large_payment',
              severity: payment.amount > mean * 5 ? 'high' : 'medium',
              title: 'Unusually Large Payment',
              description: `Payment of ${this.formatCurrency(payment.amount)} is significantly higher than average`,
              transactionId: payment._id,
              transactionType: 'cash_payment',
              amount: payment.amount,
              averageAmount: mean,
              supplier: payment.supplier,
              date: payment.createdAt,
              metadata: {
                voucherCode: payment.voucherCode
              }
            });
          }
        }
      }

      return anomalies;
    } catch (error) {
      console.error('Error detecting payment anomalies:', error);
      throw error;
    }
  }

  /**
   * Get all anomalies across all categories
   * @param {Object} options - Detection options
   * @returns {Promise<Object>} All detected anomalies
   */
  static async getAllAnomalies(options = {}) {
    try {
      const [salesAnomalies, inventoryAnomalies, paymentAnomalies] = await Promise.all([
        this.detectSalesAnomalies(options),
        this.detectInventoryAnomalies(),
        this.detectPaymentAnomalies(options)
      ]);

      const allAnomalies = [
        ...salesAnomalies,
        ...inventoryAnomalies,
        ...paymentAnomalies
      ];

      // Group by severity
      const bySeverity = {
        critical: allAnomalies.filter(a => a.severity === 'critical'),
        high: allAnomalies.filter(a => a.severity === 'high'),
        medium: allAnomalies.filter(a => a.severity === 'medium'),
        low: allAnomalies.filter(a => a.severity === 'low')
      };

      // Group by type
      const byType = {};
      allAnomalies.forEach(anomaly => {
        if (!byType[anomaly.type]) {
          byType[anomaly.type] = [];
        }
        byType[anomaly.type].push(anomaly);
      });

      return {
        total: allAnomalies.length,
        bySeverity,
        byType,
        anomalies: allAnomalies,
        summary: {
          critical: bySeverity.critical.length,
          high: bySeverity.high.length,
          medium: bySeverity.medium.length,
          low: bySeverity.low.length
        }
      };
    } catch (error) {
      console.error('Error getting all anomalies:', error);
      throw error;
    }
  }

  /**
   * Format currency
   */
  static formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  }
}

module.exports = AnomalyDetectionService;

