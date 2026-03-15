const BaseRepository = require('./BaseRepository');
const PurchaseInvoice = require('../models/PurchaseInvoice');

class PurchaseInvoiceRepository extends BaseRepository {
  constructor() {
    super(PurchaseInvoice);
  }

  /**
   * Find purchase invoice by invoice number
   * @param {string} invoiceNumber - Invoice number
   * @param {object} options - Query options
   * @returns {Promise<PurchaseInvoice|null>}
   */
  async findByInvoiceNumber(invoiceNumber, options = {}) {
    return await this.findOne({ invoiceNumber }, options);
  }

  /**
   * Find purchase invoices by supplier ID
   * @param {string} supplierId - Supplier ID
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findBySupplier(supplierId, options = {}) {
    return await this.findAll({ supplier: supplierId }, options);
  }

  /**
   * Find purchase invoices with advanced filtering and pagination
   * @param {object} filter - Filter query
   * @param {object} options - Pagination and sorting options
   * @returns {Promise<{invoices: Array, total: number, pagination: object}>}
   */
  async findWithPagination(filter = {}, options = {}) {
    const {
      page = 1,
      limit = 20,
      sort = { createdAt: -1 },
      populate = [
        { path: 'supplier', select: 'name companyName email phone' },
        { path: 'items.product', select: 'name description pricing' }
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

    const [invoices, total] = await Promise.all([
      queryBuilder,
      this.Model.countDocuments(finalQuery)
    ]);

    return {
      invoices,
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
   * Find purchase invoices by status
   * @param {string} status - Invoice status
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByStatus(status, options = {}) {
    return await this.findAll({ status }, options);
  }

  /**
   * Find purchase invoices by payment status
   * @param {string} paymentStatus - Payment status
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByPaymentStatus(paymentStatus, options = {}) {
    return await this.findAll({ 'payment.status': paymentStatus }, options);
  }

  /**
   * Find purchase invoices by invoice type
   * @param {string} invoiceType - Invoice type
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByInvoiceType(invoiceType, options = {}) {
    return await this.findAll({ invoiceType }, options);
  }

  /**
   * Find purchase invoices by date range
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
   * Find the most recent purchase invoice containing a specific product
   * @param {string} productId - Product ID
   * @param {object} options - Query options (select, lean, etc.)
   * @returns {Promise<PurchaseInvoice|null>}
   */
  async findLastPurchaseForProduct(productId, options = {}) {
    const query = this.Model.findOne({
      'items.product': productId,
      invoiceType: 'purchase'
    })
      .sort({ createdAt: -1 });

    if (options.select) {
      query.select(options.select);
    }

    if (options.lean) {
      query.lean();
    }

    return await query.exec();
  }
}

module.exports = new PurchaseInvoiceRepository();

