const BaseRepository = require('./BaseRepository');
const PurchaseOrder = require('../models/PurchaseOrder');

class PurchaseOrderRepository extends BaseRepository {
  constructor() {
    super(PurchaseOrder);
  }

  /**
   * Find purchase order by PO number
   * @param {string} poNumber - PO number
   * @param {object} options - Query options
   * @returns {Promise<PurchaseOrder|null>}
   */
  async findByPONumber(poNumber, options = {}) {
    return await this.findOne({ poNumber: poNumber.toUpperCase() }, options);
  }

  /**
   * Find purchase orders by supplier ID
   * @param {string} supplierId - Supplier ID
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findBySupplier(supplierId, options = {}) {
    return await this.findAll({ supplier: supplierId }, options);
  }

  /**
   * Find purchase orders with advanced filtering and pagination
   * @param {object} filter - Filter query
   * @param {object} options - Pagination and sorting options
   * @returns {Promise<{purchaseOrders: Array, total: number, pagination: object}>}
   */
  async findWithPagination(filter = {}, options = {}) {
    const {
      page = 1,
      limit = 20,
      sort = { createdAt: -1 },
      populate = [
        { path: 'supplier', select: 'companyName contactPerson email phone businessType currentBalance pendingBalance' },
        { path: 'items.product', select: 'name description pricing inventory' },
        { path: 'createdBy', select: 'firstName lastName email' },
        { path: 'lastModifiedBy', select: 'firstName lastName email' }
      ],
      getAll = false
    } = options;

    const skip = getAll ? 0 : (page - 1) * limit;
    const finalLimit = getAll ? 999999 : limit;

    const finalQuery = this.Model.schema.paths.isDeleted 
      ? { ...filter, isDeleted: { $ne: true } } 
      : filter;

    let queryBuilder = this.Model.find(finalQuery);
    
    if (populate) {
      if (Array.isArray(populate)) {
        populate.forEach(pop => queryBuilder = queryBuilder.populate(pop));
      } else {
        queryBuilder = queryBuilder.populate(populate);
      }
    }
    
    if (sort) {
      queryBuilder = queryBuilder.sort(sort);
    }
    
    if (skip !== undefined) {
      queryBuilder = queryBuilder.skip(skip);
    }
    
    if (finalLimit > 0) {
      queryBuilder = queryBuilder.limit(finalLimit);
    }

    const [purchaseOrders, total] = await Promise.all([
      queryBuilder,
      this.Model.countDocuments(finalQuery)
    ]);

    return {
      purchaseOrders,
      total,
      pagination: getAll ? {
        current: 1,
        pages: 1,
        total,
        hasNext: false,
        hasPrev: false
      } : {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };
  }

  /**
   * Find purchase orders by status
   * @param {string} status - Order status
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByStatus(status, options = {}) {
    return await this.findAll({ status }, options);
  }

  /**
   * Find purchase orders by date range
   * @param {Date} dateFrom - Start date
   * @param {Date} dateTo - End date
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByDateRange(dateFrom, dateTo, options = {}) {
    const filter = {
      createdAt: {
        $gte: dateFrom,
        $lt: dateTo
      }
    };
    return await this.findAll(filter, options);
  }

  /**
   * Find purchase orders by product IDs
   * @param {Array} productIds - Array of product IDs
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByProducts(productIds, options = {}) {
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return [];
    }
    return await this.findAll({ 'items.product': { $in: productIds } }, options);
  }
}

module.exports = new PurchaseOrderRepository();

