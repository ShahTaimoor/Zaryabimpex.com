const ProductRepository = require('../repositories/ProductRepository');
const PurchaseOrderRepository = require('../repositories/PurchaseOrderRepository');
const SupplierRepository = require('../repositories/SupplierRepository');
const SalesRepository = require('../repositories/SalesRepository');
const InventoryAlertService = require('./inventoryAlertService');
const PurchaseOrder = require('../models/PurchaseOrder'); // Keep for static methods and instance creation

class AutoPurchaseOrderService {
  /**
   * Generate purchase orders automatically based on low stock alerts
   * @param {Object} options - Generation options
   * @param {Object} user - User creating the orders
   * @returns {Promise<Object>} Generated purchase orders
   */
  static async generatePurchaseOrders(options = {}, user) {
    try {
      const {
        autoConfirm = false,
        supplierPreference = 'primary', // 'primary', 'cheapest', 'fastest'
        groupBySupplier = true,
        minOrderValue = 0
      } = options;

      // Get low stock alerts
      const alerts = await InventoryAlertService.getLowStockAlerts({
        includeOutOfStock: true,
        includeCritical: true,
        includeWarning: false // Only generate POs for critical/out of stock
      });

      if (alerts.length === 0) {
        return {
          success: true,
          message: 'No products need reordering',
          purchaseOrders: [],
          count: 0
        };
      }

      // Get product details
      const productIds = alerts.map(a => a.product._id);
      const products = await ProductRepository.findAll(
        { _id: { $in: productIds } },
        {
          populate: [{ path: 'category', select: 'name' }],
          lean: true
        }
      );

      // Group products by supplier
      const supplierGroups = {};
      const unassignedProducts = [];

      for (const alert of alerts) {
        const product = products.find(p => p._id.toString() === alert.product._id.toString());

        if (!product) continue;

        // Get preferred supplier from purchase history
        const supplier = await this.findSupplierForProduct(product._id, supplierPreference);

        if (!supplier) {
          unassignedProducts.push({
            product: alert.product,
            alert,
            reason: 'No supplier found in purchase history'
          });
          continue;
        }

        const supplierId = supplier._id.toString();

        if (!supplierGroups[supplierId]) {
          supplierGroups[supplierId] = {
            supplier,
            items: []
          };
        }

        // Calculate order quantity based on demand forecast
        const forecastedQuantity = await this.forecastDemand(
          product._id,
          alert.inventory.reorderQuantity,
          alert.daysUntilOutOfStock
        );

        supplierGroups[supplierId].items.push({
          product: alert.product,
          alert,
          quantity: forecastedQuantity,
          costPerUnit: product.pricing?.cost || 0,
          totalCost: forecastedQuantity * (product.pricing?.cost || 0)
        });
      }

      // Generate purchase orders
      const generatedPOs = [];
      const errors = [];

      console.log(`Processing ${Object.keys(supplierGroups).length} supplier groups`);

      for (const [supplierId, group] of Object.entries(supplierGroups)) {
        try {
          // Filter items that meet minimum order value
          const validItems = group.items.filter(item => {
            if (minOrderValue > 0) {
              const groupTotal = group.items.reduce((sum, i) => sum + i.totalCost, 0);
              return groupTotal >= minOrderValue;
            }
            return true;
          });

          console.log(`Supplier ${group.supplier.companyName}: ${validItems.length} valid items out of ${group.items.length} total`);

          if (validItems.length === 0) {
            console.log(`Skipping supplier ${group.supplier.companyName}: No valid items after filtering`);
            continue;
          }

          // Calculate totals
          const subtotal = validItems.reduce((sum, item) => sum + item.totalCost, 0);
          const tax = 0; // Can be calculated based on supplier settings
          const total = subtotal + tax;

          // Generate PO number
          const poNumber = PurchaseOrder.generatePONumber();

          // Create purchase order
          const poData = {
            poNumber,
            supplier: supplierId,
            items: validItems.map(item => ({
              product: item.product._id,
              quantity: item.quantity,
              costPerUnit: item.costPerUnit,
              totalCost: item.totalCost
            })),
            subtotal,
            tax,
            total,
            status: autoConfirm ? 'confirmed' : 'draft',
            orderDate: new Date(),
            expectedDelivery: this.calculateExpectedDelivery(group.supplier),
            notes: `Auto-generated based on low stock alerts. Generated on ${new Date().toISOString()}`,
            createdBy: user._id,
            isAutoGenerated: true,
            autoGeneratedAt: new Date()
          };

          const purchaseOrder = await PurchaseOrderRepository.create(poData);

          // Populate the purchase order for response
          await purchaseOrder.populate([
            { path: 'supplier', select: 'companyName email phone' },
            { path: 'items.product', select: 'name description' },
            { path: 'createdBy', select: 'firstName lastName' }
          ]);

          // Note: Supplier balances are now dynamically derived from Account Ledger
          // No manual increment of pendingBalance required.

          console.log(`Successfully created PO ${purchaseOrder.poNumber} for supplier ${group.supplier.companyName}`);
          generatedPOs.push(purchaseOrder);
        } catch (error) {
          console.error(`Error generating PO for supplier ${supplierId}:`, error);
          errors.push({
            supplier: group.supplier.companyName,
            error: error.message
          });
        }
      }

      const message = generatedPOs.length > 0
        ? `Generated ${generatedPOs.length} purchase order(s)`
        : unassignedProducts.length > 0
          ? `No purchase orders generated. ${unassignedProducts.length} product(s) could not be assigned to suppliers.`
          : 'No purchase orders generated. No products need reordering or all products are already assigned.';

      return {
        success: true,
        message,
        purchaseOrders: generatedPOs,
        count: generatedPOs.length,
        unassignedProducts: unassignedProducts.length > 0 ? unassignedProducts : undefined,
        errors: errors.length > 0 ? errors : undefined,
        summary: {
          totalAlerts: alerts.length,
          productsWithSuppliers: alerts.length - unassignedProducts.length,
          productsWithoutSuppliers: unassignedProducts.length,
          suppliersProcessed: Object.keys(supplierGroups).length,
          purchaseOrdersCreated: generatedPOs.length
        }
      };
    } catch (error) {
      console.error('Error generating purchase orders:', error);
      throw error;
    }
  }

  /**
   * Find supplier for a product based on purchase history
   * @param {String} productId - Product ID
   * @param {String} preference - 'primary', 'cheapest', 'fastest'
   * @returns {Promise<Object|null>} Selected supplier
   */
  static async findSupplierForProduct(productId, preference = 'primary') {
    try {
      // Find most recent purchase orders for this product
      const recentPOs = await PurchaseOrderRepository.findAll(
        {
          'items.product': productId,
          status: { $in: ['confirmed', 'partially_received', 'fully_received'] }
        },
        {
          populate: [{ path: 'supplier', select: 'companyName email phone paymentTerms' }],
          sort: { orderDate: -1 },
          limit: 10,
          lean: true
        }
      );

      if (!recentPOs || recentPOs.length === 0) {
        // No purchase history, try to find suppliers by category
        const product = await ProductRepository.findById(productId, {
          populate: [{ path: 'category' }],
          lean: true
        });
        if (product?.category) {
          const suppliers = await SupplierRepository.findAll(
            {
              categories: product.category._id,
              status: 'active'
            },
            {
              limit: 1,
              lean: true
            }
          );
          return suppliers.length > 0 ? suppliers[0] : null;
        }
        return null;
      }

      // Group by supplier and count frequency
      const supplierCounts = {};
      for (const po of recentPOs) {
        if (!po.supplier) continue;
        const supplierId = po.supplier._id.toString();
        if (!supplierCounts[supplierId]) {
          supplierCounts[supplierId] = {
            supplier: po.supplier,
            count: 0,
            totalValue: 0,
            avgCost: 0
          };
        }
        supplierCounts[supplierId].count++;
        supplierCounts[supplierId].totalValue += po.total || 0;

        // Calculate average cost for this product from this supplier
        const item = po.items.find(i => i.product.toString() === productId.toString());
        if (item) {
          const currentAvg = supplierCounts[supplierId].avgCost;
          const newCost = item.costPerUnit || 0;
          supplierCounts[supplierId].avgCost = (currentAvg + newCost) / 2;
        }
      }

      // Select supplier based on preference
      const supplierEntries = Object.values(supplierCounts);

      if (supplierEntries.length === 0) return null;
      if (supplierEntries.length === 1) return supplierEntries[0].supplier;

      switch (preference) {
        case 'cheapest':
          // Return supplier with lowest average cost
          return supplierEntries.sort((a, b) => a.avgCost - b.avgCost)[0].supplier;

        case 'fastest':
          // Return most frequently used supplier (assumed to be faster)
          return supplierEntries.sort((a, b) => b.count - a.count)[0].supplier;

        case 'primary':
        default:
          // Return most frequently used supplier
          return supplierEntries.sort((a, b) => b.count - a.count)[0].supplier;
      }
    } catch (error) {
      console.error('Error finding supplier for product:', error);
      return null;
    }
  }

  /**
   * Forecast demand for a product
   * @param {String} productId - Product ID
   * @param {Number} defaultQuantity - Default reorder quantity
   * @param {Number} daysUntilOut - Days until out of stock
   * @returns {Promise<Number>} Forecasted quantity to order
   */
  static async forecastDemand(productId, defaultQuantity, daysUntilOut) {
    try {
      // Get sales data for last 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const sales = await SalesRepository.aggregate([
        {
          $match: {
            createdAt: { $gte: ninetyDaysAgo },
            status: 'completed',
            'items.product': productId
          }
        },
        {
          $unwind: '$items'
        },
        {
          $match: {
            'items.product': productId
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            dailyQuantity: { $sum: '$items.quantity' }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]);

      if (!sales || sales.length === 0) {
        return defaultQuantity;
      }

      // Calculate average daily sales
      const totalQuantity = sales.reduce((sum, s) => sum + s.dailyQuantity, 0);
      const averageDailySales = totalQuantity / sales.length;

      // Calculate trend (simple linear regression)
      let trend = 0;
      if (sales.length > 1) {
        const firstHalf = sales.slice(0, Math.floor(sales.length / 2));
        const secondHalf = sales.slice(Math.floor(sales.length / 2));

        const firstAvg = firstHalf.reduce((sum, s) => sum + s.dailyQuantity, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, s) => sum + s.dailyQuantity, 0) / secondHalf.length;

        trend = (secondAvg - firstAvg) / firstHalf.length;
      }

      // Forecast for next 30 days with trend adjustment
      const forecastDays = 30;
      const forecastedDemand = (averageDailySales + trend) * forecastDays;

      // Add safety stock (20% buffer)
      const safetyStock = forecastedDemand * 0.2;

      // Return forecasted quantity (minimum default quantity)
      return Math.max(defaultQuantity, Math.ceil(forecastedDemand + safetyStock));
    } catch (error) {
      console.error('Error forecasting demand:', error);
      return defaultQuantity;
    }
  }

  /**
   * Calculate expected delivery date based on supplier
   * @param {Object} supplier - Supplier object
   * @returns {Date} Expected delivery date
   */
  static calculateExpectedDelivery(supplier) {
    // Default lead time: 7 days
    // Can be enhanced with supplier-specific lead times
    const leadTime = supplier.leadTime || 7;
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + leadTime);
    return deliveryDate;
  }

  /**
   * Get products that need reordering (for manual review)
   * @returns {Promise<Array>} Products needing reorder
   */
  static async getProductsNeedingReorder() {
    try {
      const alerts = await InventoryAlertService.getLowStockAlerts({
        includeOutOfStock: true,
        includeCritical: true,
        includeWarning: false
      });

      const productIds = alerts.map(a => a.product._id);
      const products = await ProductRepository.findAll(
        { _id: { $in: productIds } },
        {
          populate: [{ path: 'category', select: 'name' }],
          lean: true
        }
      );

      // Get suppliers for each product
      const productsWithSuppliers = await Promise.all(
        alerts.map(async (alert) => {
          const product = products.find(p => p._id.toString() === alert.product._id.toString());
          const supplier = await this.findSupplierForProduct(alert.product._id, 'primary');

          return {
            ...alert,
            product: {
              ...alert.product,
              supplier: supplier || null,
              pricing: product?.pricing
            },
            suggestedQuantity: alert.suggestedReorderQuantity
          };
        })
      );

      return productsWithSuppliers;
    } catch (error) {
      console.error('Error getting products needing reorder:', error);
      throw error;
    }
  }
}

module.exports = AutoPurchaseOrderService;

