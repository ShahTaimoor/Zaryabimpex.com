const customerRepository = require('../repositories/postgres/CustomerRepository');
const AccountingService = require('./accountingService');
const chartOfAccountsRepository = require('../repositories/postgres/ChartOfAccountsRepository');

/** Normalize customer row: add camelCase aliases for businessType, customerTier (frontend expects these) */
function normalizeCustomer(c) {
  if (!c) return c;
  return {
    ...c,
    businessType: c.business_type ?? c.businessType ?? 'wholesale',
    customerTier: c.customer_tier ?? c.customerTier ?? 'bronze'
  };
}

/**
 * Customer Service - PostgreSQL Implementation
 */
class CustomerService {
  /**
   * Get customers with filtering and pagination
   */
  async getCustomers(queryParams) {
    const filters = {};
    if (queryParams.isActive !== undefined) {
      filters.isActive = queryParams.isActive === 'true';
    }
    if (queryParams.search) {
      filters.search = queryParams.search;
    }
    if (queryParams.status) {
      filters.status = queryParams.status;
    }
    if (queryParams.businessType) {
      filters.businessType = queryParams.businessType;
    }
    if (queryParams.customerTier) {
      filters.customerTier = queryParams.customerTier;
    }

    // Handle city filtering in the main getCustomers query
    let result;
    if (queryParams.cities) {
      const citiesArray = queryParams.cities.split(',').map(c => c.trim()).filter(c => c);
      const showZeroBalance = queryParams.showZeroBalance !== 'false';
      const customers = await this.getCustomersByCities(citiesArray, showZeroBalance);
      result = {
        customers,
        pagination: {
          page: 1,
          limit: customers.length,
          total: customers.length,
          pages: 1
        }
      };
    } else {
      result = await customerRepository.findWithPagination(filters, {
        page: parseInt(queryParams.page) || 1,
        limit: parseInt(queryParams.limit) || 20,
        sort: 'created_at DESC'
      });
    }

    // Get balances for all customers
    const customerIds = result.customers.map(c => c.id);
    const balanceMap = await AccountingService.getBulkCustomerBalances(customerIds);

    // Attach balances and normalize for frontend
    result.customers = result.customers.map(customer => {
      const customerId = String(customer.id);
      const balance = balanceMap.get(customerId) || balanceMap.get(customer.id) || 0;
      return normalizeCustomer({
        ...customer,
        id: customer.id,
        currentBalance: balance,
        pendingBalance: balance > 0 ? balance : 0,
        advanceBalance: balance < 0 ? Math.abs(balance) : 0
      });
    });

    return result;
  }

  /**
   * Get single customer by ID
   */
  async getCustomerById(id) {
    const customer = await customerRepository.findById(id);
    if (!customer) {
      throw new Error('Customer not found');
    }

    const balance = await AccountingService.getCustomerBalance(id);

    return normalizeCustomer({
      ...customer,
      id: customer.id,
      currentBalance: balance,
      pendingBalance: balance > 0 ? balance : 0,
      advanceBalance: balance < 0 ? Math.abs(balance) : 0
    });
  }

  async createCustomer(customerData, userId, options = {}) {
    const data = { ...customerData, createdBy: userId };
    if (options.openingBalance != null) data.openingBalance = options.openingBalance;
    const customer = await customerRepository.create(data);
    
    // Auto-create Chart of Accounts entry for this customer
    try {
      const accountCode = `CUST-${customer.id}`;
      const accountName = customer.business_name || customer.name || 'Unknown Customer';
      
      // Check if account already exists
      const existingAccount = await chartOfAccountsRepository.findByAccountCode(accountCode);
      if (!existingAccount) {
        await chartOfAccountsRepository.create({
          accountCode: accountCode,
          accountName: accountName,
          accountType: 'asset',
          accountCategory: 'Trade Receivables',
          normalBalance: 'debit',
          openingBalance: 0,
          currentBalance: 0,
          allowDirectPosting: false,
          isSystemAccount: false,
          isActive: true,
          description: `Customer Account: ${accountName}`,
          customerId: customer.id,
          createdBy: userId
        });
      }
    } catch (chartError) {
      console.error('Failed to create Chart of Accounts entry for customer:', chartError);
      // Don't fail the customer creation if chart account creation fails
    }
    
    const withBalance = await this.getCustomerById(customer.id);
    return { customer: withBalance, message: 'Customer created successfully' };
  }

  async updateCustomer(id, customerData, userId, options = {}) {
    const data = { ...customerData, updatedBy: userId };
    if (options.openingBalance != null) data.openingBalance = options.openingBalance;
    const customer = await customerRepository.update(id, data);
    if (!customer) throw new Error('Customer not found');
    const updated = await this.getCustomerById(id);
    return { customer: updated, message: 'Customer updated successfully' };
  }

  async deleteCustomer(id, userId, reason = 'Customer deleted') {
    const customer = await customerRepository.findById(id);
    if (!customer) throw new Error('Customer not found');
    const balance = await AccountingService.getCustomerBalance(id);
    if (Math.abs(balance) > 0.01) {
      throw new Error('Cannot delete customer with outstanding balance. Please settle all balances first.');
    }
    const salesRepository = require('../repositories/postgres/SalesRepository');
    const sales = await salesRepository.findByCustomer(id, { limit: 1000 });
    const pending = sales.filter(s => ['pending', 'confirmed', 'processing'].includes(s.status || s.payment_status));
    if (pending.length > 0) {
      throw new Error('Cannot delete customer with pending orders. Please cancel or complete orders first.');
    }
    await customerRepository.delete(id);
    return { message: 'Customer deleted successfully' };
  }

  async restoreCustomer(id, userId) {
    const customer = await customerRepository.restore(id);
    if (!customer) throw new Error('Deleted customer not found');
    const restored = await this.getCustomerById(id);
    return { customer: restored, message: 'Customer restored successfully' };
  }

  async getDeletedCustomers(queryParams = {}) {
    const limit = Math.min(parseInt(queryParams.limit) || 100, 1000);
    const deleted = await customerRepository.findDeleted({}, { limit });
    return { customers: deleted, total: deleted.length };
  }

  async getUniqueCities() {
    const { query } = require('../config/postgres');
    const result = await query(
      `SELECT DISTINCT name AS city FROM cities WHERE is_active = TRUE 
       UNION
       SELECT DISTINCT (jsonb_array_elements(address)->>'city') AS city FROM customers WHERE address IS NOT NULL AND jsonb_typeof(address) = 'array'
       UNION
       SELECT DISTINCT (address->>'city') AS city FROM customers WHERE address IS NOT NULL AND jsonb_typeof(address) = 'object'
       ORDER BY city`
    );
    return result.rows.map(r => r.city).filter(c => c);
  }

  async getCustomersByCities(cities = [], showZeroBalance = true) {
    const all = await customerRepository.findAll({}, { limit: 10000 });
    const customerIds = all.map(c => c.id);
    const balanceMap = await AccountingService.getBulkCustomerBalances(customerIds);
    const withBalances = all.map(c => {
      const balance = balanceMap.get(c.id) || 0;
      return { ...c, currentBalance: balance, pendingBalance: balance > 0 ? balance : 0, advanceBalance: balance < 0 ? Math.abs(balance) : 0 };
    });
    let filtered = withBalances;
    if (cities.length > 0) {
      const cityList = cities.map(cc => String(cc).toLowerCase());
      filtered = withBalances.filter(c => {
        const rawAddr = c.address;
        let addr = rawAddr;
        if (typeof rawAddr === 'string') {
          try {
            addr = JSON.parse(rawAddr);
          } catch (e) {
            addr = null;
          }
        }
        
        // Handle both array and object formats for address
        let customerCity = null;
        if (Array.isArray(addr) && addr.length > 0) {
          const defaultAddr = addr.find(a => a.isDefault) || addr[0];
          customerCity = defaultAddr?.city;
        } else if (addr && typeof addr === 'object') {
          customerCity = addr.city;
        }

        return customerCity && cityList.includes(String(customerCity).toLowerCase());
      });
    }
    if (!showZeroBalance) filtered = filtered.filter(c => Math.abs(c.currentBalance || 0) > 0.01);
    return filtered;
  }

  async updateCustomerBalance(id, balanceData) {
    console.warn('updateCustomerBalance is deprecated. Use ledger transactions.');
    const customer = await this.getCustomerById(id);
    return { customer, message: 'Balance is derived from ledger' };
  }

  async addCustomerAddress(customerId, addressData) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) throw new Error('Customer not found');
    const address = customer.address || {};
    const merged = Array.isArray(addressData) ? addressData : { ...(typeof address === 'object' ? address : {}), ...addressData };
    await customerRepository.update(customerId, { address: merged });
    return this.getCustomerById(customerId);
  }

  async updateCustomerCreditLimit(customerId, creditLimit, userId) {
    const customer = await customerRepository.update(customerId, { creditLimit, updatedBy: userId });
    if (!customer) throw new Error('Customer not found');
    return this.getCustomerById(customerId);
  }

  async checkEmailExists(email, excludeId = null) {
    return await customerRepository.emailExists(email, excludeId);
  }

  async checkBusinessNameExists(businessName, excludeId = null) {
    return await customerRepository.businessNameExists(businessName, excludeId);
  }

  async getCustomersForExport(filters = {}) {
    const opts = { limit: 99999 };
    const customers = await customerRepository.findAll(filters, opts);
    const customerIds = customers.map(c => c.id);
    const balanceMap = await AccountingService.getBulkCustomerBalances(customerIds);
    return customers.map(c => {
      const customerId = String(c.id);
      const balance = balanceMap.get(customerId) || balanceMap.get(c.id) || 0;
      return normalizeCustomer({
        ...c,
        id: c.id,
        currentBalance: balance,
        pendingBalance: balance > 0 ? balance : 0,
        advanceBalance: balance < 0 ? Math.abs(balance) : 0
      });
    });
  }

  async customerExists(query) {
    if (query.email) return await customerRepository.emailExists(query.email, query.id || query._id);
    if (query.businessName) return await customerRepository.businessNameExists(query.businessName, query.id || query._id);
    return false;
  }

  async searchCustomers(searchTerm, limit = 10) {
    const customers = await customerRepository.search(searchTerm, { limit });
    
    const customerIds = customers.map(c => c.id);
    const balanceMap = await AccountingService.getBulkCustomerBalances(customerIds);

    return customers.map(customer => {
      const customerId = String(customer.id);
      const balance = balanceMap.get(customerId) || balanceMap.get(customer.id) || 0;
      return normalizeCustomer({
        ...customer,
        id: customer.id,
        currentBalance: balance,
        pendingBalance: balance > 0 ? balance : 0,
        advanceBalance: balance < 0 ? Math.abs(balance) : 0
      });
    });
  }
}

module.exports = new CustomerService();
