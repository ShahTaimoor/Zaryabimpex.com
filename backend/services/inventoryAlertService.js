const ProductRepository = require('../repositories/ProductRepository');
const InventoryRepository = require('../repositories/InventoryRepository');
const SalesRepository = require('../repositories/SalesRepository');

class InventoryAlertService {
  /**
   * Get all products with low stock
   * @param {Object} options - Alert options
   * @returns {Promise<Array>} Array of low stock alerts
   */
  static async getLowStockAlerts(options = {}) {
    try {
      const {
        includeOutOfStock = true,
        includeCritical = true,
        includeWarning = true,
        warehouse = null
      } = options;

      // Get all active products (Postgres uses isActive, not status)
      const products = await ProductRepository.findAll(
        { isActive: true },
        { limit: 10000 }
      );

      const alerts = [];

      for (const product of products) {
        const productId = product.id || product._id;
        const inventory = await InventoryRepository.findOne({ product: productId, productId });

        // Use inventory table when available; fallback to products table (stock_quantity, min_stock_level)
        const currentStock = parseFloat(
          inventory
            ? (inventory.current_stock ?? inventory.currentStock ?? 0)
            : (product.stock_quantity ?? product.stockQuantity ?? 0)
        ) || 0;
        const defaultReorder = 10;
        const reorderPoint = parseFloat(
          inventory
            ? (inventory.reorder_point ?? inventory.reorderPoint ?? defaultReorder)
            : (product.min_stock_level ?? product.minStockLevel ?? product.inventory?.reorderPoint ?? defaultReorder)
        ) || defaultReorder;
        const minStock = parseFloat(
          inventory
            ? (inventory.reorder_point ?? inventory.reorderPoint ?? 0)
            : (product.min_stock_level ?? product.minStockLevel ?? product.inventory?.minStock ?? 0)
        ) || 0;

        // Determine alert level
        let alertLevel = null;
        let stockStatus = 'in_stock';

        if (currentStock === 0 && includeOutOfStock) {
          alertLevel = 'critical';
          stockStatus = 'out_of_stock';
        } else if (currentStock <= minStock && includeCritical) {
          alertLevel = 'critical';
          stockStatus = 'critical';
        } else if (currentStock <= reorderPoint && includeWarning) {
          alertLevel = 'warning';
          stockStatus = 'low_stock';
        }

        if (alertLevel) {
          const reorderQty = inventory
            ? (inventory.reorder_quantity ?? inventory.reorderQuantity ?? 50)
            : 50;
          const maxStockVal = inventory
            ? (inventory.max_stock ?? inventory.maxStock ?? null)
            : (product.inventory?.maxStock ?? null);

          const daysUntilOutOfStock = await this.calculateDaysUntilOutOfStock(
            productId,
            currentStock
          );

          alerts.push({
            product: {
              _id: productId,
              id: productId,
              name: product.name,
              sku: product.sku,
              category: product.category || product.category_id
            },
            inventory: {
              currentStock,
              reorderPoint,
              minStock,
              reorderQuantity: reorderQty,
              maxStock: maxStockVal
            },
            alertLevel,
            stockStatus,
            daysUntilOutOfStock,
            suggestedReorderQuantity: this.calculateSuggestedReorderQuantity(
              currentStock,
              reorderPoint,
              reorderQty,
              maxStockVal
            ),
            urgency: this.calculateUrgency(currentStock, reorderPoint, daysUntilOutOfStock)
          });
        }
      }

      // Sort by urgency (critical first, then by days until out of stock)
      alerts.sort((a, b) => {
        if (a.alertLevel !== b.alertLevel) {
          if (a.alertLevel === 'critical') return -1;
          if (b.alertLevel === 'critical') return 1;
        }
        return a.daysUntilOutOfStock - b.daysUntilOutOfStock;
      });

      return alerts;
    } catch (error) {
      console.error('Error getting low stock alerts:', error);
      throw error;
    }
  }

  /**
   * Calculate days until product runs out of stock
   * @param {String} productId - Product ID
   * @param {Number} currentStock - Current stock level
   * @returns {Promise<Number>} Days until out of stock
   */
  static async calculateDaysUntilOutOfStock(productId, currentStock) {
    try {
      // Get sales data for last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const salesStats = await SalesRepository.getProductSalesStats(productId, thirtyDaysAgo);

      if (!salesStats || parseFloat(salesStats.totalQuantity) === 0) {
        // No sales data, return a high number (90 days)
        return 90;
      }

      const totalQuantity = parseFloat(salesStats.totalQuantity);
      const averageDailySales = totalQuantity / 30;
      
      if (averageDailySales === 0) {
        return 90; // No sales, won't run out soon
      }

      const daysUntilOut = Math.floor(currentStock / averageDailySales);
      return Math.max(0, daysUntilOut);
    } catch (error) {
      console.error('Error calculating days until out of stock:', error);
      return 30; // Default to 30 days if calculation fails
    }
  }

  /**
   * Calculate suggested reorder quantity
   * @param {Number} currentStock - Current stock
   * @param {Number} reorderPoint - Reorder point
   * @param {Number} defaultReorderQuantity - Default reorder quantity
   * @param {Number} maxStock - Maximum stock level
   * @returns {Number} Suggested reorder quantity
   */
  static calculateSuggestedReorderQuantity(
    currentStock,
    reorderPoint,
    defaultReorderQuantity,
    maxStock
  ) {
    if (maxStock) {
      // If max stock is set, order enough to reach max stock
      return Math.max(defaultReorderQuantity, maxStock - currentStock);
    }
    
    // Order enough to get back above reorder point with buffer
    const quantityNeeded = reorderPoint - currentStock + defaultReorderQuantity;
    return Math.max(defaultReorderQuantity, quantityNeeded);
  }

  /**
   * Calculate urgency score (0-100, higher is more urgent)
   * @param {Number} currentStock - Current stock
   * @param {Number} reorderPoint - Reorder point
   * @param {Number} daysUntilOut - Days until out of stock
   * @returns {Number} Urgency score
   */
  static calculateUrgency(currentStock, reorderPoint, daysUntilOut) {
    if (currentStock === 0) return 100;
    if (daysUntilOut <= 3) return 90;
    if (daysUntilOut <= 7) return 75;
    if (daysUntilOut <= 14) return 60;
    if (currentStock <= reorderPoint * 0.5) return 50;
    return 30;
  }

  /**
   * Get alert summary statistics
   * @returns {Promise<Object>} Alert summary
   */
  static async getAlertSummary() {
    try {
      const alerts = await this.getLowStockAlerts();
      
      return {
        total: alerts.length,
        critical: alerts.filter(a => a.alertLevel === 'critical').length,
        warning: alerts.filter(a => a.alertLevel === 'warning').length,
        outOfStock: alerts.filter(a => a.stockStatus === 'out_of_stock').length,
        lowStock: alerts.filter(a => a.stockStatus === 'low_stock').length
      };
    } catch (error) {
      console.error('Error getting alert summary:', error);
      throw error;
    }
  }
}

module.exports = InventoryAlertService;

