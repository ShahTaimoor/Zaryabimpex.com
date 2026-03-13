const customerRepository = require('../repositories/postgres/CustomerRepository');
const CustomerBalanceService = require('./customerBalanceService');
const AccountingService = require('./accountingService');
const SalesRepository = require('../repositories/postgres/SalesRepository');
const customerAuditLogService = require('./customerAuditLogService');

// Helper function to parse opening balance
const parseOpeningBalance = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Apply opening balance to customer (Note: Balances are now mostly ledger-derived)
 * We still keep openingBalance field for the calculation start point.
 */
const applyOpeningBalance = (customer, openingBalance) => {
  if (openingBalance === null) return;
  customer.openingBalance = openingBalance;
};

class CustomerService {
  /**
   * Build filter for Postgres repository
   * @param {object} queryParams - Request query parameters
   * @returns {object} - Repository filter (search, isActive)
   */
  buildFilter(queryParams) {
    const filter = {};
    if (queryParams.search) filter.search = queryParams.search;
    if (queryParams.isActive !== undefined) filter.isActive = queryParams.isActive === 'true';
    return filter;
  }

  /**
   * Transform customer names to uppercase
   * @param {Customer|object} customer - Customer to transform
   * @returns {object} - Transformed customer
   */
  transformCustomerToUppercase(customer) {
    if (!customer) return customer;
    const c = customer.toObject ? customer.toObject() : { ...customer };
    if (c.name) c.name = c.name.toUpperCase();
    if (c.businessName) c.businessName = c.businessName.toUpperCase();
    if (c.firstName) c.firstName = c.firstName.toUpperCase();
    if (c.lastName) c.lastName = c.lastName.toUpperCase();
    return c;
  }

  /**
   * Get customers with filtering and pagination
   * @param {object} queryParams - Query parameters
   * @returns {Promise<object>}
   */
  async getCustomers(queryParams) {
    const getAllCustomers = queryParams.all === 'true' || queryParams.all === true ||
      (queryParams.limit && parseInt(queryParams.limit) >= 999999);

    const page = getAllCustomers ? 1 : (parseInt(queryParams.page) || 1);
    const limit = getAllCustomers ? 999999 : (parseInt(queryParams.limit) || 20);

    const filter = {};
    if (queryParams.isActive !== undefined) filter.isActive = queryParams.isActive === 'true';
    if (queryParams.search) filter.search = queryParams.search;

    const result = await customerRepository.findWithPagination(filter, {
      page,
      limit,
      sort: 'created_at DESC'
    });

    // Fetch balances from AccountingService for all customers (use string id for Map lookup)
    const customerIds = result.customers.map(c => c.id);
    const balanceMap = await AccountingService.getBulkCustomerBalances(customerIds);

    // Transform customer names to uppercase and attach balances
    result.customers = result.customers.map(c => {
      const transformed = this.transformCustomerToUppercase(c);
      const balance = balanceMap.get(String(c.id)) ?? balanceMap.get(c.id) ?? 0;

      return {
        ...transformed,
        currentBalance: balance,
        pendingBalance: balance > 0 ? balance : 0,
        advanceBalance: balance < 0 ? Math.abs(balance) : 0
      };
    });

    return result;
  }

  /**
   * Get single customer by ID
   * @param {string} id - Customer ID
   * @returns {Promise<Customer>}
   */
  async getCustomerById(id) {
    const customer = await customerRepository.findById(id);
    if (!customer) {
      throw new Error('Customer not found');
    }

    const transformed = this.transformCustomerToUppercase(customer);
    const balance = await AccountingService.getCustomerBalance(id);

    return {
      ...transformed,
      currentBalance: balance,
      pendingBalance: balance > 0 ? balance : 0,
      advanceBalance: balance < 0 ? Math.abs(balance) : 0
    };
  }

  /**
   * Search customers
   * @param {string} searchTerm - Search term
   * @param {number} limit - Maximum results
   * @returns {Promise<Array>}
   */
  async searchCustomers(searchTerm, limit = 10) {
    const customers = await customerRepository.search(searchTerm, {
      limit,
      sort: 'business_name ASC'
    });

    const customerIds = customers.map(c => c.id);
    const balanceMap = await AccountingService.getBulkCustomerBalances(customerIds);

    return customers.map(customer => {
      const transformed = this.transformCustomerToUppercase(customer);
      const balance = balanceMap.get(customer.id) || 0;
      const netBalance = (customer.opening_balance ?? customer.openingBalance ?? 0) + balance;

      return {
        ...transformed,
        currentBalance: netBalance,
        pendingBalance: netBalance > 0 ? netBalance : 0,
        advanceBalance: netBalance < 0 ? Math.abs(netBalance) : 0,
        displayName: (transformed.businessName || transformed.name || '').toUpperCase()
      };
    });
  }

  /**
   * Check if email exists
   * @param {string} email - Email to check
   * @param {string} excludeId - Customer ID to exclude
   * @returns {Promise<boolean>}
   */
  async checkEmailExists(email, excludeId = null) {
    return await customerRepository.emailExists(email, excludeId);
  }

  /**
   * Check if business name exists
   * @param {string} businessName - Business name to check
   * @param {string} excludeId - Customer ID to exclude
   * @returns {Promise<boolean>}
   */
  async checkBusinessNameExists(businessName, excludeId = null) {
    return await customerRepository.businessNameExists(businessName, excludeId);
  }

  /**
   * Create new customer
   * @param {object} customerData - Customer data
   * @param {string} userId - User ID creating the customer
   * @returns {Promise<{customer: Customer, message: string}>}
   */
  async createCustomer(customerData, userId, options = {}) {
    const { openingBalance, useTransaction = true } = options;

    if (customerData.email && customerData.email.trim()) {
      const emailExists = await customerRepository.emailExists(customerData.email);
      if (emailExists) {
        throw new Error('A customer with this email already exists');
      }
    }

    if (customerData.phone && customerData.phone.trim()) {
      const phoneExists = await customerRepository.phoneExists(customerData.phone);
      if (phoneExists) {
        throw new Error('A customer with this phone number already exists');
      }
    }

    if (customerData.businessName) {
      const businessNameExists = await customerRepository.businessNameExists(customerData.businessName);
      if (businessNameExists) {
        throw new Error('A customer with this business name already exists');
      }
    }

    const parsedOpeningBalance = parseOpeningBalance(openingBalance);
    const dataWithUser = {
      ...customerData,
      createdBy: userId,
      lastModifiedBy: userId
    };

    if (dataWithUser.email === '' || (typeof dataWithUser.email === 'string' && !dataWithUser.email.trim())) {
      dataWithUser.email = undefined;
    } else if (dataWithUser.email) {
      dataWithUser.email = dataWithUser.email.trim().toLowerCase();
    }

    if (dataWithUser.phone === '' || (typeof dataWithUser.phone === 'string' && !dataWithUser.phone.trim())) {
      dataWithUser.phone = undefined;
    } else if (dataWithUser.phone) {
      dataWithUser.phone = dataWithUser.phone.trim();
    }

    if (dataWithUser.businessName) {
      dataWithUser.businessName = dataWithUser.businessName.trim();
    }

    if (parsedOpeningBalance != null) {
      dataWithUser.openingBalance = parsedOpeningBalance;
    }

    const created = await customerRepository.create(dataWithUser);
    const customer = await this.getCustomerById(created.id);

    return {
      customer,
      message: 'Customer created successfully'
    };
  }

  /**
   * Update customer
   * @param {string} id - Customer ID
   * @param {object} updateData - Data to update
   * @param {string} userId - User ID updating the customer
   * @returns {Promise<{customer: Customer, message: string}>}
   */
  async updateCustomer(id, updateData, userId, options = {}) {
    const { openingBalance } = options;

    if (updateData.email && updateData.email.trim()) {
      const emailExists = await customerRepository.emailExists(updateData.email, id);
      if (emailExists) {
        throw new Error('A customer with this email already exists');
      }
    }

    if (updateData.phone && updateData.phone.trim()) {
      const phoneExists = await customerRepository.phoneExists(updateData.phone, id);
      if (phoneExists) {
        throw new Error('A customer with this phone number already exists');
      }
    }

    if (updateData.businessName) {
      const businessNameExists = await customerRepository.businessNameExists(updateData.businessName, id);
      if (businessNameExists) {
        throw new Error('A customer with this business name already exists');
      }
    }

    const existing = await customerRepository.findById(id);
    if (!existing) {
      throw new Error('Customer not found');
    }

    const parsedOpeningBalance = parseOpeningBalance(openingBalance);
    const payload = {
      ...updateData,
      updatedBy: userId
    };

    if (payload.email === '' || (typeof payload.email === 'string' && !payload.email.trim())) {
      payload.email = undefined;
    } else if (payload.email) {
      payload.email = payload.email.trim().toLowerCase();
    }

    if (payload.phone === '' || (typeof payload.phone === 'string' && !payload.phone.trim())) {
      payload.phone = undefined;
    } else if (payload.phone) {
      payload.phone = payload.phone.trim();
    }

    if (parsedOpeningBalance != null) {
      payload.openingBalance = parsedOpeningBalance;
    }

    const updated = await customerRepository.update(id, payload);
    if (!updated) {
      throw new Error('Customer not found');
    }

    const finalCustomer = await this.getCustomerById(id);

    customerAuditLogService.logCustomerUpdate(existing, finalCustomer, { _id: userId }, null)
      .catch(err => console.error('Audit log error:', err));

    return {
      customer: finalCustomer,
      message: 'Customer updated successfully'
    };
  }

  /**
   * Delete customer (soft delete)
   * @param {string} id - Customer ID
   * @param {string} userId - User ID deleting the customer
   * @param {string} reason - Reason for deletion
   * @returns {Promise<{message: string}>}
   */
  async deleteCustomer(id, userId, reason = 'Customer deleted') {
    const customer = await customerRepository.findById(id);
    if (!customer) {
      throw new Error('Customer not found');
    }

    const summary = await CustomerBalanceService.getBalanceSummary(id);
    const balance = summary.currentBalance || 0;
    if (Math.abs(balance) > 0.01) {
      throw new Error('Cannot delete customer with outstanding balance. Please settle all balances first.');
    }

    const sales = await SalesRepository.findByCustomer(id, { limit: 1000 });
    const pending = sales.filter(s => ['pending', 'confirmed', 'processing'].includes(s.status || s.payment_status));
    if (pending.length > 0) {
      throw new Error('Cannot delete customer with pending orders. Please cancel or complete orders first.');
    }

    await customerRepository.delete(id);

    customerAuditLogService.logCustomerDeletion(customer, { _id: userId }, null, reason)
      .catch(err => console.error('Audit log error:', err));

    return {
      message: 'Customer deleted successfully'
    };
  }

  /**
   * Restore soft-deleted customer
   * @param {string} id - Customer ID
   * @param {string} userId - User ID restoring the customer
   * @returns {Promise<{customer: Customer, message: string}>}
   */
  async restoreCustomer(id, userId) {
    const customer = await customerRepository.restore(id);
    if (!customer) {
      throw new Error('Deleted customer not found');
    }
    return {
      customer: await this.getCustomerById(id),
      message: 'Customer restored successfully'
    };
  }

  /**
   * Get deleted customers
   * @param {object} queryParams - Query parameters
   * @returns {Promise<object>}
   */
  async getDeletedCustomers(queryParams = {}) {
    const page = parseInt(queryParams.page) || 1;
    const limit = parseInt(queryParams.limit) || 20;
    const offset = (page - 1) * limit;

    const total = await customerRepository.findDeletedCount();
    const customers = await customerRepository.findDeleted({}, { limit, offset });

    const customerIds = customers.map(c => c.id);
    const balanceMap = await AccountingService.getBulkCustomerBalances(customerIds);

    return {
      customers: customers.map(c => {
        const transformed = this.transformCustomerToUppercase(c);
        const ledgerBalance = balanceMap.get(c.id) || 0;
        const netBalance = (c.opening_balance ?? c.openingBalance ?? 0) + ledgerBalance;
        return {
          ...transformed,
          currentBalance: netBalance,
          pendingBalance: netBalance > 0 ? netBalance : 0,
          advanceBalance: netBalance < 0 ? Math.abs(netBalance) : 0
        };
      }),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1
      }
    };
  }

  /**
   * Get unique cities from customer addresses
   * @returns {Promise<Array>}
   */
  async getUniqueCities() {
    const customers = await customerRepository.findAll({}, {
      select: 'addresses',
      lean: true
    });

    const citiesSet = new Set();
    customers.forEach(customer => {
      if (customer.addresses && Array.isArray(customer.addresses)) {
        customer.addresses.forEach(address => {
          if (address.city && address.city.trim()) {
            citiesSet.add(address.city.trim());
          }
        });
      }
    });

    return Array.from(citiesSet).sort();
  }

  /**
   * Get customers by cities
   * @param {Array} cities - Array of city names
   * @param {boolean} showZeroBalance - Whether to show customers with zero balance
   * @returns {Promise<Array>}
   */
  async getCustomersByCities(cities = [], showZeroBalance = true) {
    const customers = await customerRepository.findAll({}, { sort: 'business_name ASC' });
    const byCity = cities.length > 0 ? new Set(cities.map(c => String(c).trim().toLowerCase())) : null;

    const filtered = byCity
      ? customers.filter(c => {
          const raw = c.address ?? c.addresses;
          const addresses = Array.isArray(raw) ? raw : (typeof raw === 'string' ? (JSON.parse(raw || '[]') || []) : []);
          return addresses.some(addr => byCity.has(String(addr?.city || addr?.City || '').trim().toLowerCase()));
        })
      : customers;

    const customerIds = filtered.map(c => c.id);
    const balanceMap = await AccountingService.getBulkCustomerBalances(customerIds);

    return filtered.map(customer => {
      const raw = customer.address ?? customer.addresses;
      const addresses = Array.isArray(raw) ? raw : (typeof raw === 'string' ? (JSON.parse(raw || '[]') || []) : []);
      const defaultAddress = addresses.length > 0 ? (addresses.find(addr => addr.isDefault) || addresses[0]) : null;
      const ledgerBalance = balanceMap.get(customer.id) || 0;
      const netBalance = (customer.opening_balance ?? customer.openingBalance ?? 0) + ledgerBalance;
      if (!showZeroBalance && Math.abs(netBalance) < 0.01) return null;
      return {
        id: customer.id,
        _id: customer.id,
        accountName: customer.business_name || customer.businessName || customer.name,
        name: customer.name,
        businessName: customer.business_name || customer.businessName,
        city: defaultAddress?.city || defaultAddress?.City || '',
        balance: netBalance,
        currentBalance: netBalance,
        pendingBalance: netBalance > 0 ? netBalance : 0,
        advanceBalance: netBalance < 0 ? Math.abs(netBalance) : 0
      };
    }).filter(Boolean);
  }

  /**
   * Update customer balance (Deprecated/Direct Ledger use preferred)
   */
  async updateCustomerBalance(id, balanceData) {
    console.warn('updateCustomerBalance is deprecated. Use ledger transactions.');
    const customer = await customerRepository.update(id, balanceData);
    return {
      customer: customer || (await customerRepository.findById(id)),
      message: 'Customer balance updated (Legacy/Cached)'
    };
  }

  /**
   * Get customers for export
   */
  async getCustomersForExport(filters = {}) {
    const filter = this.buildFilter(filters);
    const customers = await customerRepository.findAll(filter, { lean: true });

    const customerIds = customers.map(c => c._id.toString());
    const balanceMap = await AccountingService.getBulkCustomerBalances(customerIds);

    return customers.map(c => {
      const ledgerBalance = balanceMap.get(c._id.toString()) || 0;
      const netBalance = (c.openingBalance || 0) + ledgerBalance;
      return {
        ...c,
        currentBalance: netBalance,
        pendingBalance: netBalance > 0 ? netBalance : 0,
        advanceBalance: netBalance < 0 ? Math.abs(netBalance) : 0
      };
    });
  }

  async customerExists(query) {
    if (!query) return false;
    if (query.id || query._id) {
      const c = await customerRepository.findById(query.id || query._id);
      return !!c;
    }
    if (query.email) return customerRepository.emailExists(query.email);
    if (query.businessName) return customerRepository.businessNameExists(query.businessName);
    if (query.phone) return customerRepository.phoneExists(query.phone);
    return false;
  }

  async addCustomerAddress(customerId, addressData) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) throw new Error('Customer not found');
    const raw = customer.address ?? customer.addresses;
    const addresses = Array.isArray(raw) ? [...raw] : (typeof raw === 'string' ? (JSON.parse(raw || '[]') || []) : []);
    if (addressData.isDefault) {
      addresses.forEach(addr => {
        if (addr.type === addressData.type || addr.type === 'both') {
          addr.isDefault = false;
        }
      });
    }
    addresses.push(addressData);
    const updated = await customerRepository.update(customerId, { addresses });
    return updated || (await customerRepository.findById(customerId));
  }

  async updateCustomerCreditLimit(customerId, creditLimit, userId) {
    const customer = await customerRepository.update(customerId, {
      creditLimit,
      updatedBy: userId
    });
    if (!customer) throw new Error('Customer not found');
    return customer;
  }

  async getCustomerByIdWithLedger(customerId) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) throw new Error('Customer not found');

    const summary = await CustomerBalanceService.getBalanceSummary(customerId);
    const balance = summary.currentBalance || 0;
    const transformed = this.transformCustomerToUppercase(customer);

    return {
      ...transformed,
      currentBalance: balance,
      pendingBalance: balance > 0 ? balance : 0,
      advanceBalance: balance < 0 ? Math.abs(balance) : 0
    };
  }
}

module.exports = new CustomerService();
