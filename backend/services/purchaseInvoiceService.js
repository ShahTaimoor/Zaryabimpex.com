const purchaseInvoiceRepository = require('../repositories/PurchaseInvoiceRepository');
const supplierRepository = require('../repositories/SupplierRepository');

class PurchaseInvoiceService {
  /**
   * Transform supplier names to uppercase
   * @param {object} supplier - Supplier to transform
   * @returns {object} - Transformed supplier
   */
  transformSupplierToUppercase(supplier) {
    if (!supplier) return supplier;
    if (supplier.toObject) supplier = supplier.toObject();
    if (supplier.companyName) supplier.companyName = supplier.companyName.toUpperCase();
    if (supplier.name) supplier.name = supplier.name.toUpperCase();
    if (supplier.contactPerson && supplier.contactPerson.name) {
      supplier.contactPerson.name = supplier.contactPerson.name.toUpperCase();
    }
    return supplier;
  }

  /**
   * Transform product names to uppercase
   * @param {object} product - Product to transform
   * @returns {object} - Transformed product
   */
  transformProductToUppercase(product) {
    if (!product) return product;
    if (product.toObject) product = product.toObject();
    // Handle both products and variants
    if (product.displayName) {
      product.displayName = product.displayName.toUpperCase();
    }
    if (product.variantName) {
      product.variantName = product.variantName.toUpperCase();
    }
    if (product.name) product.name = product.name.toUpperCase();
    if (product.description) product.description = product.description.toUpperCase();
    return product;
  }

  /**
   * Build filter query from request parameters
   * @param {object} queryParams - Request query parameters
   * @returns {Promise<object>} - MongoDB filter object
   */
  async buildFilter(queryParams) {
    const filter = {};

    // Search filter
    if (queryParams.search) {
      const searchTerm = queryParams.search.trim();
      const searchConditions = [
        { invoiceNumber: { $regex: searchTerm, $options: 'i' } },
        { notes: { $regex: searchTerm, $options: 'i' } },
        { 'supplierInfo.companyName': { $regex: searchTerm, $options: 'i' } },
        { 'supplierInfo.name': { $regex: searchTerm, $options: 'i' } }
      ];

      // Search in Supplier collection and match by supplier ID
      const supplierMatches = await supplierRepository.search(searchTerm, { limit: 1000 });
      
      if (supplierMatches.length > 0) {
        const supplierIds = supplierMatches.map(s => s._id);
        searchConditions.push({ supplier: { $in: supplierIds } });
      }

      // If search term is numeric, also search in pricing.total
      if (!isNaN(searchTerm)) {
        searchConditions.push({ 'pricing.total': parseFloat(searchTerm) });
      }

      filter.$or = searchConditions;
    }

    // Status filter
    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    // Payment status filter
    if (queryParams.paymentStatus) {
      filter['payment.status'] = queryParams.paymentStatus;
    }

    // Invoice type filter
    if (queryParams.invoiceType) {
      filter.invoiceType = queryParams.invoiceType;
    }

    // Date range filter - use dateFilter from middleware if available (Pakistan timezone)
    if (queryParams.dateFilter && Object.keys(queryParams.dateFilter).length > 0) {
      // dateFilter may contain $or condition for multiple fields
      if (queryParams.dateFilter.$or) {
        if (filter.$and) {
          filter.$and.push(queryParams.dateFilter);
        } else {
          filter.$and = [queryParams.dateFilter];
        }
      } else {
        Object.assign(filter, queryParams.dateFilter);
      }
    } else if (queryParams.dateFrom || queryParams.dateTo) {
      // Legacy date filtering (for backward compatibility)
      const { buildMultiFieldDateFilter } = require('../utils/dateFilter');
      const dateFilter = buildMultiFieldDateFilter(queryParams.dateFrom, queryParams.dateTo, ['invoiceDate', 'createdAt']);
      if (dateFilter.$or) {
        if (filter.$and) {
          filter.$and.push(dateFilter);
        } else {
          filter.$and = [dateFilter];
        }
      } else {
        Object.assign(filter, dateFilter);
      }
    }

    return filter;
  }

  /**
   * Get purchase invoices with filtering and pagination
   * @param {object} queryParams - Query parameters
   * @returns {Promise<object>}
   */
  async getPurchaseInvoices(queryParams) {
    const page = parseInt(queryParams.page) || 1;
    const limit = parseInt(queryParams.limit) || 20;

    const filter = await this.buildFilter(queryParams);

    const result = await purchaseInvoiceRepository.findWithPagination(filter, {
      page,
      limit,
      sort: { createdAt: -1 },
      populate: [
        { path: 'supplier', select: 'name companyName email phone' },
        { path: 'items.product', select: 'name description pricing' }
      ]
    });

    // Transform names to uppercase
    result.invoices.forEach(invoice => {
      if (invoice.supplier) {
        invoice.supplier = this.transformSupplierToUppercase(invoice.supplier);
      }
      if (invoice.items && Array.isArray(invoice.items)) {
        invoice.items.forEach(item => {
          if (item.product) {
            item.product = this.transformProductToUppercase(item.product);
          }
        });
      }
    });

    return result;
  }

  /**
   * Get single purchase invoice by ID
   * @param {string} id - Invoice ID
   * @returns {Promise<object>}
   */
  async getPurchaseInvoiceById(id) {
    const invoice = await purchaseInvoiceRepository.findById(id);
    
    if (!invoice) {
      throw new Error('Purchase invoice not found');
    }

    // Populate related fields
    await invoice.populate([
      { path: 'supplier', select: 'name companyName email phone address' },
      { path: 'items.product', select: 'name description pricing inventory' },
      { path: 'createdBy', select: 'name email' },
      { path: 'lastModifiedBy', select: 'name email' }
    ]);

    // Transform names to uppercase
    if (invoice.supplier) {
      invoice.supplier = this.transformSupplierToUppercase(invoice.supplier);
    }
    if (invoice.items && Array.isArray(invoice.items)) {
      invoice.items.forEach(item => {
        if (item.product) {
          item.product = this.transformProductToUppercase(item.product);
        }
      });
    }

    return invoice;
  }
}

module.exports = new PurchaseInvoiceService();

