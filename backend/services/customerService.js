const customerRepository = require('../repositories/CustomerRepository');
const ledgerAccountService = require('./ledgerAccountService');
const mongoose = require('mongoose');
const { retryMongoTransaction, isDuplicateKeyError } = require('../utils/retry');
const Customer = require('../models/Customer');
const AccountingService = require('./accountingService');
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
  // Note: pendingBalance, advanceBalance, and currentBalance are deprecated in favour of ledger aggregation
};

// Helper function to check if transaction is not supported
const isTransactionNotSupportedError = (error) => {
  if (!error) return false;
  const message = error.message || '';
  return error.code === 20 ||
    error.codeName === 'IllegalOperation' ||
    message.includes('Transaction numbers are only allowed on a replica set member or mongos') ||
    message.includes('transactions are not supported');
};

// Helper function to run operation with optional transaction
const runWithOptionalTransaction = async (operation, context = 'operation') => {
  let session = null;
  let transactionStarted = false;

  try {
    session = await mongoose.startSession();
    session.startTransaction();
    transactionStarted = true;

    const result = await operation(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    if (transactionStarted && session) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        console.error(`Failed to abort transaction for ${context}:`, abortError);
      }
    }

    if (!transactionStarted && isTransactionNotSupportedError(error)) {
      console.warn(`Transactions not supported for MongoDB deployment. Retrying ${context} without session.`);
      return await operation(null);
    }

    throw error;
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

class CustomerService {
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
        { name: { $regex: queryParams.search, $options: 'i' } },
        { email: { $regex: queryParams.search, $options: 'i' } },
        { businessName: { $regex: queryParams.search, $options: 'i' } },
        { phone: { $regex: queryParams.search, $options: 'i' } }
      ];
    }

    // Business type filter
    if (queryParams.businessType) {
      filter.businessType = queryParams.businessType;
    }

    // Status filter
    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    // Customer tier filter
    if (queryParams.customerTier) {
      filter.customerTier = queryParams.customerTier;
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
   * Transform customer names to uppercase
   * @param {Customer|object} customer - Customer to transform
   * @returns {object} - Transformed customer
   */
  transformCustomerToUppercase(customer) {
    if (!customer) return customer;
    if (customer.toObject) customer = customer.toObject();
    if (customer.name) customer.name = customer.name.toUpperCase();
    if (customer.businessName) customer.businessName = customer.businessName.toUpperCase();
    if (customer.firstName) customer.firstName = customer.firstName.toUpperCase();
    if (customer.lastName) customer.lastName = customer.lastName.toUpperCase();
    return customer;
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

    const filter = this.buildFilter(queryParams);

    const result = await customerRepository.findWithPagination(filter, {
      page,
      limit,
      getAll: getAllCustomers,
      sort: { createdAt: -1 }
    });

    // Fetch dynamic balances from ledger for all customers in this page
    const customerIds = result.customers.map(c => c._id.toString());
    const balanceMap = await AccountingService.getBulkCustomerBalances(customerIds);

    // Transform customer names to uppercase and attach dynamic balances
    result.customers = result.customers.map(c => {
      const transformed = this.transformCustomerToUppercase(c);
      const ledgerBalance = balanceMap.get(c._id.toString()) || 0;
      const netBalance = (c.openingBalance || 0) + ledgerBalance;

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
      sort: { businessName: 1 },
      lean: true
    });

    const customerIds = customers.map(c => c._id.toString());
    const balanceMap = await AccountingService.getBulkCustomerBalances(customerIds);

    return customers.map(customer => {
      const transformed = this.transformCustomerToUppercase(customer);
      const ledgerBalance = balanceMap.get(customer._id.toString()) || 0;
      const netBalance = (customer.openingBalance || 0) + ledgerBalance;

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

    const customerId = await retryMongoTransaction(async () => {
      return await runWithOptionalTransaction(async (session) => {
        let newCustomer = new Customer(dataWithUser);
        applyOpeningBalance(newCustomer, parsedOpeningBalance);

        await ledgerAccountService.syncCustomerLedgerAccount(newCustomer, session ? {
          session,
          userId: userId
        } : {
          userId: userId
        });

        if (newCustomer.isNew) {
          await newCustomer.save(session ? { session } : undefined);
        }

        return newCustomer._id;
      }, 'create customer');
    }, {
      maxRetries: 5,
      initialDelay: 100,
      maxDelay: 3000
    });

    const customer = await this.getCustomerById(customerId);

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
    const { openingBalance, useTransaction = true } = options;

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

    const parsedOpeningBalance = parseOpeningBalance(openingBalance);

    const updatedCustomer = await retryMongoTransaction(async () => {
      return await runWithOptionalTransaction(async (session) => {
        const customer = await customerRepository.findById(id, { session });

        if (!customer) {
          return null;
        }

        const oldCustomerData = customer.toObject();

        Object.assign(customer, {
          ...updateData,
          lastModifiedBy: userId
        });

        if (customer.email === '' || (typeof customer.email === 'string' && !customer.email.trim())) {
          customer.email = undefined;
        } else if (customer.email) {
          customer.email = customer.email.trim().toLowerCase();
        }

        if (customer.phone === '' || (typeof customer.phone === 'string' && !customer.phone.trim())) {
          customer.phone = undefined;
        } else if (customer.phone) {
          customer.phone = customer.phone.trim();
        }

        applyOpeningBalance(customer, parsedOpeningBalance);

        await customer.save(session ? { session } : undefined);
        await ledgerAccountService.syncCustomerLedgerAccount(customer, session ? {
          session,
          userId: userId
        } : {
          userId: userId
        });

        return { customer, oldCustomerData };
      }, 'update customer');
    }, {
      maxRetries: 5,
      initialDelay: 100,
      maxDelay: 3000
    });

    if (!updatedCustomer) {
      throw new Error('Customer not found');
    }

    const finalCustomer = await this.getCustomerById(id);

    // Log audit trail
    customerAuditLogService.logCustomerUpdate(updatedCustomer.oldCustomerData, finalCustomer, { _id: userId }, null)
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
    const deletionResult = await runWithOptionalTransaction(async (session) => {
      const customer = await customerRepository.findById(id, { session });

      if (!customer) {
        return null;
      }

      const balance = await AccountingService.getCustomerBalance(id);
      if (Math.abs(balance) > 0.01) {
        throw new Error('Cannot delete customer with outstanding balance. Please settle all balances first.');
      }

      const Sales = require('../models/Sales');
      const pendingOrders = await Sales.countDocuments({
        customer: id,
        status: { $in: ['pending', 'confirmed', 'processing'] }
      });

      if (pendingOrders > 0) {
        throw new Error('Cannot delete customer with pending orders. Please cancel or complete orders first.');
      }

      const customerData = customer.toObject();

      customer.isDeleted = true;
      customer.deletedAt = new Date();
      customer.deletedBy = userId;
      customer.deletionReason = reason;
      customer.status = 'inactive';

      await customer.save(session ? { session } : undefined);

      if (customer.ledgerAccount) {
        await ledgerAccountService.deactivateLedgerAccount(customer.ledgerAccount, session ? {
          session,
          userId: userId
        } : { userId: userId });
      }

      customerAuditLogService.logCustomerDeletion(customerData, { _id: userId }, null, reason)
        .catch(err => console.error('Audit log error:', err));

      return true;
    }, 'delete customer');

    if (!deletionResult) {
      throw new Error('Customer not found');
    }

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
    const customer = await customerRepository.Model.findOneAndUpdate(
      { _id: id, isDeleted: true },
      {
        $set: {
          isDeleted: false,
          status: 'active',
          lastModifiedBy: userId
        },
        $unset: {
          deletedAt: '',
          deletedBy: '',
          deletionReason: ''
        }
      },
      { new: true }
    );

    if (!customer) {
      throw new Error('Deleted customer not found');
    }

    if (customer.ledgerAccount) {
      await ledgerAccountService.activateLedgerAccount(customer.ledgerAccount, { userId });
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
    const filter = { isDeleted: true };

    if (queryParams.search) {
      filter.$or = [
        { name: { $regex: queryParams.search, $options: 'i' } },
        { businessName: { $regex: queryParams.search, $options: 'i' } }
      ];
    }

    const page = parseInt(queryParams.page) || 1;
    const limit = parseInt(queryParams.limit) || 20;

    const result = await customerRepository.findWithPagination(filter, {
      page,
      limit,
      sort: { deletedAt: -1 }
    });

    const customerIds = result.customers.map(c => c._id.toString());
    const balanceMap = await AccountingService.getBulkCustomerBalances(customerIds);

    result.customers = result.customers.map(c => {
      const transformed = this.transformCustomerToUppercase(c);
      const ledgerBalance = balanceMap.get(c._id.toString()) || 0;
      const netBalance = (c.openingBalance || 0) + ledgerBalance;

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
    const filter = {};
    if (cities.length > 0) {
      filter['addresses.city'] = { $in: cities };
    }

    const customers = await customerRepository.findAll(filter, {
      select: 'name businessName addresses currentBalance pendingBalance advanceBalance openingBalance',
      sort: { businessName: 1 },
      lean: true
    });

    const customerIds = customers.map(c => c._id.toString());
    const balanceMap = await AccountingService.getBulkCustomerBalances(customerIds);

    return customers.map(customer => {
      const defaultAddress = customer.addresses && customer.addresses.length > 0
        ? customer.addresses.find(addr => addr.isDefault) || customer.addresses[0]
        : null;

      const ledgerBalance = balanceMap.get(customer._id.toString()) || 0;
      const netBalance = (customer.openingBalance || 0) + ledgerBalance;

      return {
        _id: customer._id,
        accountName: customer.businessName || customer.name,
        name: customer.name,
        businessName: customer.businessName,
        city: defaultAddress?.city || '',
        balance: netBalance,
        currentBalance: netBalance,
        pendingBalance: netBalance > 0 ? netBalance : 0,
        advanceBalance: netBalance < 0 ? Math.abs(netBalance) : 0
      };
    });
  }

  /**
   * Update customer balance (Deprecated/Direct Ledger use preferred)
   */
  async updateCustomerBalance(id, balanceData) {
    console.warn('updateCustomerBalance is deprecated. Use ledger transactions.');
    const customer = await customerRepository.updateBalance(id, balanceData);
    return {
      customer,
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
    const customer = await customerRepository.findOne(query);
    return !!customer;
  }

  async addCustomerAddress(customerId, addressData) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) throw new Error('Customer not found');
    if (addressData.isDefault) {
      customer.addresses.forEach(addr => {
        if (addr.type === addressData.type || addr.type === 'both') {
          addr.isDefault = false;
        }
      });
    }
    customer.addresses.push(addressData);
    await customer.save();
    return customer;
  }

  async updateCustomerCreditLimit(customerId, creditLimit, userId) {
    const customer = await customerRepository.update(customerId, {
      creditLimit,
      lastModifiedBy: userId
    });
    if (!customer) throw new Error('Customer not found');
    return customer;
  }

  async getCustomerByIdWithLedger(customerId) {
    const customer = await customerRepository.findById(customerId, {
      populate: [{ path: 'ledgerAccount', select: 'accountCode accountName' }]
    });
    if (!customer) throw new Error('Customer not found');

    const balance = await AccountingService.getCustomerBalance(customerId);
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
