const supplierRepository = require('../repositories/SupplierRepository');
// ledgerAccountService removed - using PostgreSQL Chart of Accounts directly
const SupplierBalanceService = require('./supplierBalanceService');

class SupplierService {
  /**
   * Transform supplier names to uppercase
   * @param {Supplier|object} supplier - Supplier to transform
   * @returns {object} - Transformed supplier
   */
  transformSupplierToUppercase(supplier) {
    if (!supplier) return supplier;
    if (supplier.toObject) supplier = supplier.toObject();
    if (supplier.companyName) supplier.companyName = supplier.companyName.toUpperCase();
    if (supplier.contactPerson && supplier.contactPerson.name) {
      if (typeof supplier.contactPerson.name === 'string') {
        supplier.contactPerson.name = supplier.contactPerson.name.toUpperCase();
      }
    }
    return supplier;
  }

  /**
   * Parse opening balance
   * @param {any} value - Value to parse
   * @returns {number|null}
   */
  parseOpeningBalance(value) {
    if (value === undefined || value === null || value === '') return null;
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  /**
   * Apply opening balance to supplier (Note: Balances are now mostly ledger-derived)
   */
  applyOpeningBalance(supplier, openingBalance) {
    if (openingBalance === null || openingBalance === undefined) return;
    supplier.openingBalance = openingBalance;
    // Note: pendingBalance, advanceBalance, and currentBalance are deprecated in favour of ledger aggregation
  }

  /**
   * Build filter query from request parameters
   * @param {object} queryParams - Request query parameters
   * @returns {object} - MongoDB filter object
   */
  buildFilter(queryParams) {
    const filter = {};

    // Search filter
    if (queryParams.search) {
      filter.$or = [
        { companyName: { $regex: queryParams.search, $options: 'i' } },
        { email: { $regex: queryParams.search, $options: 'i' } },
        { 'contactPerson.name': { $regex: queryParams.search, $options: 'i' } },
        { phone: { $regex: queryParams.search, $options: 'i' } }
      ];
    }

    // Business type filter
    if (queryParams.businessType && queryParams.businessType !== '') {
      filter.businessType = queryParams.businessType;
    }

    // Status filter
    if (queryParams.status && queryParams.status !== '') {
      filter.status = queryParams.status;
    }

    // Reliability filter
    if (queryParams.reliability && queryParams.reliability !== '') {
      filter.reliability = queryParams.reliability;
    }

    // Email status filter
    if (queryParams.emailStatus) {
      switch (queryParams.emailStatus) {
        case 'verified':
          filter.emailVerified = true;
          break;
        case 'unverified':
          filter.emailVerified = false;
          filter.email = { $exists: true, $ne: '' };
          break;
        case 'no-email':
          filter.$or = [
            { email: { $exists: false } },
            { email: '' },
            { email: null }
          ];
          break;
      }
    }

    // Phone status filter
    if (queryParams.phoneStatus) {
      switch (queryParams.phoneStatus) {
        case 'verified':
          filter.phoneVerified = true;
          break;
        case 'unverified':
          filter.phoneVerified = false;
          filter.phone = { $exists: true, $ne: '' };
          break;
        case 'no-phone':
          filter.$or = [
            { phone: { $exists: false } },
            { phone: '' },
            { phone: null }
          ];
          break;
      }
    }

    return filter;
  }

  /**
   * Get suppliers with filtering and pagination
   * @param {object} queryParams - Query parameters
   * @returns {Promise<object>}
   */
  async getSuppliers(queryParams) {
    const getAllSuppliers = queryParams.all === 'true' || queryParams.all === true ||
      (queryParams.limit && parseInt(queryParams.limit) >= 999999);

    const page = getAllSuppliers ? 1 : (parseInt(queryParams.page) || 1);
    const limit = getAllSuppliers ? 999999 : (parseInt(queryParams.limit) || 20);

    const filter = this.buildFilter(queryParams);

    const result = await supplierRepository.findWithPagination(filter, {
      page,
      limit,
      getAll: getAllSuppliers,
      sort: { createdAt: -1 }
    });

    const supplierIds = result.suppliers.map(s => s.id);
    const balanceMap = await AccountingService.getBulkSupplierBalances(supplierIds);

    // Transform supplier names to uppercase and attach balances
    result.suppliers = result.suppliers.map(s => {
      const transformed = this.transformSupplierToUppercase(s);
      const balance = balanceMap.get(s.id) || 0;
      const netBalance = (s.opening_balance || 0) + balance;

      return {
        ...transformed,
        currentBalance: netBalance,
        pendingBalance: netBalance > 0 ? netBalance : 0,
        advanceBalance: netBalance < 0 ? Math.abs(netBalance) : 0
      };
    });

    return result;
  }

  /**
   * Get single supplier by ID
   * @param {string} id - Supplier ID
   * @returns {Promise<Supplier>}
   */
  async getSupplierById(id) {
    const supplier = await supplierRepository.findById(id);

    if (!supplier) {
      throw new Error('Supplier not found');
    }

    const transformed = this.transformSupplierToUppercase(supplier);
    const summary = await SupplierBalanceService.getBalanceSummary(id);
    const balance = summary.currentBalance || 0;

    return {
      ...transformed,
      currentBalance: balance,
      pendingBalance: balance > 0 ? balance : 0,
      advanceBalance: balance < 0 ? Math.abs(balance) : 0
    };
  }

  /**
   * Search suppliers
   * @param {string} searchTerm - Search term
   * @param {number} limit - Maximum results
   * @returns {Promise<Array>}
   */
  async searchSuppliers(searchTerm, limit = 10) {
    const suppliers = await supplierRepository.search(searchTerm, {
      limit,
      sort: { companyName: 1 },
      lean: true
    });

    const supplierIds = suppliers.map(s => s.id);
    const balanceMap = await AccountingService.getBulkSupplierBalances(supplierIds);

    return suppliers.map(supplier => {
      const transformed = this.transformSupplierToUppercase(supplier);
      const balance = balanceMap.get(supplier.id) || 0;
      const netBalance = (supplier.opening_balance || 0) + balance;

      return {
        ...transformed,
        currentBalance: netBalance,
        pendingBalance: netBalance > 0 ? netBalance : 0,
        advanceBalance: netBalance < 0 ? Math.abs(netBalance) : 0
      };
    });
  }

  /**
   * Check if email exists
   * @param {string} email - Email to check
   * @param {string} excludeId - Supplier ID to exclude
   * @returns {Promise<boolean>}
   */
  async checkEmailExists(email, excludeId = null) {
    return await supplierRepository.emailExists(email, excludeId);
  }

  /**
   * Check if company name exists
   * @param {string} companyName - Company name to check
   * @param {string} excludeId - Supplier ID to exclude
   * @returns {Promise<boolean>}
   */
  async checkCompanyNameExists(companyName, excludeId = null) {
    return await supplierRepository.companyNameExists(companyName, excludeId);
  }

  /**
   * Get suppliers for export
   * @param {object} filters - Filter criteria
   * @returns {Promise<Array>}
   */
  async getSuppliersForExport(filters = {}) {
    const filter = this.buildFilter(filters);
    return await supplierRepository.findAll(filter, {
      lean: true
    });
  }

  /**
   * Check if supplier exists by query
   * @param {object} query - Query object
   * @returns {Promise<boolean>}
   */
  async supplierExists(query) {
    const supplier = await supplierRepository.findOne(query);
    return !!supplier;
  }

  /**
   * Get supplier by ID with populated ledger account
   * @param {string} supplierId - Supplier ID
   * @param {object} options - Query options (e.g., session)
   * @returns {Promise<Supplier>}
   */
  async getSupplierByIdWithLedger(supplierId, options = {}) {
    const populate = [{ path: 'ledgerAccount', select: 'accountCode accountName' }];
    const supplier = await supplierRepository.findById(supplierId, { ...options, populate });

    if (!supplier) {
      throw new Error('Supplier not found');
    }

    return supplier;
  }

  /**
   * Get all suppliers (for dropdowns/lists)
   * @param {object} filter - Filter query
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async getAllSuppliers(filter = {}, options = {}) {
    const { select = 'companyName contactPerson email phone businessType paymentTerms rating pendingBalance advanceBalance openingBalance', sort = { companyName: 1 } } = options;

    const suppliers = await supplierRepository.findAll(filter, { select, sort });
    const supplierIds = suppliers.map(s => s._id.toString());
    const balanceMap = await AccountingService.getBulkSupplierBalances(supplierIds);

    return suppliers.map(s => {
      const transformed = this.transformSupplierToUppercase(s);
      const ledgerBalance = balanceMap.get(s._id.toString()) || 0;
      const netBalance = (s.openingBalance || 0) + ledgerBalance;

      return {
        ...transformed,
        currentBalance: netBalance,
        pendingBalance: netBalance > 0 ? netBalance : 0,
        advanceBalance: netBalance < 0 ? Math.abs(netBalance) : 0
      };
    });
  }
}

module.exports = new SupplierService();
