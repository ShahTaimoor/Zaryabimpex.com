const AuditLog = require('../models/AuditLog');

class AuditLogService {
  /**
   * Create an audit log entry
   * @param {Object} auditData - Audit log data
   * @returns {Promise<AuditLog>}
   */
  async createAuditLog(auditData) {
    const {
      entityType,
      entityId,
      action,
      changes,
      user,
      ipAddress,
      userAgent,
      reason,
      metadata = {}
    } = auditData;

    const auditLog = new AuditLog({
      entityType,
      entityId,
      action,
      changes,
      user,
      ipAddress,
      userAgent,
      reason,
      metadata,
      timestamp: new Date()
    });

    return await auditLog.save();
  }

  /**
   * Log product creation
   * @param {Object} product - Created product
   * @param {Object} user - User creating the product
   * @param {Object} req - Express request object
   * @returns {Promise<AuditLog>}
   */
  async logProductCreation(product, user, req) {
    return await this.createAuditLog({
      entityType: 'Product',
      entityId: product._id,
      action: 'CREATE',
      changes: {
        after: this.sanitizeProduct(product)
      },
      user: user._id,
      ipAddress: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.headers['user-agent'],
      reason: 'Product created',
      metadata: {
        productName: product.name,
        sku: product.sku
      }
    });
  }

  /**
   * Log product update
   * @param {Object} oldProduct - Product before update
   * @param {Object} newProduct - Product after update
   * @param {Object} user - User updating the product
   * @param {Object} req - Express request object
   * @param {string} reason - Reason for update
   * @returns {Promise<AuditLog>}
   */
  async logProductUpdate(oldProduct, newProduct, user, req, reason = 'Product updated') {
    const fieldsChanged = this.getChangedFields(oldProduct, newProduct);
    
    return await this.createAuditLog({
      entityType: 'Product',
      entityId: newProduct._id,
      action: 'UPDATE',
      changes: {
        before: this.sanitizeProduct(oldProduct),
        after: this.sanitizeProduct(newProduct),
        fieldsChanged
      },
      user: user._id,
      ipAddress: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.headers['user-agent'],
      reason,
      metadata: {
        productName: newProduct.name,
        sku: newProduct.sku,
        fieldsChangedCount: fieldsChanged.length
      }
    });
  }

  /**
   * Log product deletion
   * @param {Object} product - Deleted product
   * @param {Object} user - User deleting the product
   * @param {Object} req - Express request object
   * @returns {Promise<AuditLog>}
   */
  async logProductDeletion(product, user, req) {
    return await this.createAuditLog({
      entityType: 'Product',
      entityId: product._id,
      action: 'DELETE',
      changes: {
        before: this.sanitizeProduct(product)
      },
      user: user._id,
      ipAddress: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.headers['user-agent'],
      reason: 'Product deleted',
      metadata: {
        productName: product.name,
        sku: product.sku
      }
    });
  }

  /**
   * Log stock adjustment
   * @param {string} productId - Product ID
   * @param {number} oldStock - Old stock level
   * @param {number} newStock - New stock level
   * @param {Object} user - User making adjustment
   * @param {Object} req - Express request object
   * @param {string} reason - Reason for adjustment
   * @returns {Promise<AuditLog>}
   */
  async logStockAdjustment(productId, oldStock, newStock, user, req, reason) {
    return await this.createAuditLog({
      entityType: 'Product',
      entityId: productId,
      action: 'STOCK_ADJUSTMENT',
      changes: {
        before: { currentStock: oldStock },
        after: { currentStock: newStock },
        fieldsChanged: ['inventory.currentStock']
      },
      user: user._id,
      ipAddress: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.headers['user-agent'],
      reason,
      metadata: {
        stockChange: newStock - oldStock,
        stockChangeType: newStock > oldStock ? 'increase' : 'decrease'
      }
    });
  }

  /**
   * Get audit logs for a product
   * @param {string} productId - Product ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async getProductAuditLogs(productId, options = {}) {
    const { limit = 50, skip = 0, action, startDate, endDate } = options;
    
    const filter = {
      entityType: 'Product',
      entityId: productId
    };

    if (action) {
      filter.action = action;
    }

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    return await AuditLog.find(filter)
      .populate('user', 'firstName lastName email')
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip(skip);
  }

  /**
   * Get changed fields between two product objects
   * @param {Object} oldProduct - Old product
   * @param {Object} newProduct - New product
   * @returns {Array<string>}
   */
  getChangedFields(oldProduct, newProduct) {
    const fieldsChanged = [];
    const fieldsToCheck = [
      'name',
      'description',
      'pricing.cost',
      'pricing.retail',
      'pricing.wholesale',
      'pricing.distributor',
      'inventory.currentStock',
      'inventory.reorderPoint',
      'status',
      'category',
      'brand',
      'sku',
      'barcode'
    ];

    fieldsToCheck.forEach(field => {
      const oldValue = this.getNestedValue(oldProduct, field);
      const newValue = this.getNestedValue(newProduct, field);
      
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        fieldsChanged.push(field);
      }
    });

    return fieldsChanged;
  }

  /**
   * Get nested value from object
   * @param {Object} obj - Object
   * @param {string} path - Dot-separated path
   * @returns {*}
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, prop) => {
      return current && current[prop] !== undefined ? current[prop] : undefined;
    }, obj);
  }

  /**
   * Sanitize product for audit log (remove sensitive/unnecessary data)
   * @param {Object} product - Product object
   * @returns {Object}
   */
  sanitizeProduct(product) {
    if (!product) return null;
    
    const productObj = product.toObject ? product.toObject() : product;
    
    return {
      _id: productObj._id,
      name: productObj.name,
      sku: productObj.sku,
      barcode: productObj.barcode,
      pricing: productObj.pricing,
      inventory: productObj.inventory,
      status: productObj.status,
      category: productObj.category,
      brand: productObj.brand,
      costingMethod: productObj.costingMethod,
      version: productObj.__v || productObj.version
    };
  }
}

module.exports = new AuditLogService();

