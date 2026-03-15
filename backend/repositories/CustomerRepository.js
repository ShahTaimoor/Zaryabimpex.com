const BaseRepository = require('./BaseRepository');
const Customer = require('../models/Customer');

class CustomerRepository extends BaseRepository {
  constructor() {
    super(Customer);
  }

  /**
   * Find customer by email
   * @param {string} email - Customer email
   * @param {object} options - Query options
   * @returns {Promise<Customer|null>}
   */
  async findByEmail(email, options = {}) {
    if (!email) return null;
    return await this.findOne({ email: email.toLowerCase().trim() }, options);
  }

  /**
   * Find customer by phone
   * @param {string} phone - Customer phone
   * @param {object} options - Query options
   * @returns {Promise<Customer|null>}
   */
  async findByPhone(phone, options = {}) {
    if (!phone) return null;
    return await this.findOne({ phone: phone.trim() }, options);
  }

  /**
   * Find customer by business name
   * @param {string} businessName - Business name
   * @param {object} options - Query options
   * @returns {Promise<Customer|null>}
   */
  async findByBusinessName(businessName, options = {}) {
    if (!businessName) return null;
    return await this.findOne({ businessName: { $regex: `^${businessName}$`, $options: 'i' } }, options);
  }

  /**
   * Find customers with advanced filtering and pagination
   * @param {object} filter - Filter query
   * @param {object} options - Pagination and sorting options
   * @returns {Promise<{customers: Array, total: number, pagination: object}>}
   */
  async findWithPagination(filter = {}, options = {}) {
    const {
      page = 1,
      limit = 20,
      sort = { createdAt: -1 },
      populate,
      select,
      getAll = false
    } = options;

    const skip = getAll ? 0 : (page - 1) * limit;
    const finalLimit = getAll ? 999999 : limit;

    const [customers, total] = await Promise.all([
      this.findAll(filter, { skip, limit: finalLimit, sort, populate, select }),
      this.count(filter)
    ]);

    return {
      customers,
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
   * Search customers by multiple fields
   * @param {string} searchTerm - Search term
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async search(searchTerm, options = {}) {
    const filter = {
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
        { businessName: { $regex: searchTerm, $options: 'i' } },
        { phone: { $regex: searchTerm, $options: 'i' } }
      ]
    };
    return await this.findAll(filter, options);
  }

  /**
   * Find customers by business type
   * @param {string} businessType - Business type
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByBusinessType(businessType, options = {}) {
    return await this.findAll({ businessType }, options);
  }

  /**
   * Find customers by status
   * @param {string} status - Customer status
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByStatus(status, options = {}) {
    return await this.findAll({ status }, options);
  }

  /**
   * Find customers by tier
   * @param {string} tier - Customer tier
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByTier(tier, options = {}) {
    return await this.findAll({ customerTier: tier }, options);
  }

  /**
   * Find customers by IDs
   * @param {Array} customerIds - Array of customer IDs
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByIds(customerIds, options = {}) {
    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return [];
    }
    // Ensure options is a valid object and clean up any invalid sort values
    const cleanOptions = { ...options };
    if (cleanOptions.sort !== undefined) {
      // Validate sort before passing
      const sort = cleanOptions.sort;
      const isValidSort =
        (typeof sort === 'string' && sort.trim().length > 0) ||
        (typeof sort === 'object' && sort !== null && !Array.isArray(sort) && Object.keys(sort).length > 0) ||
        (Array.isArray(sort) && sort.length > 0);

      if (!isValidSort) {
        // Remove invalid sort
        delete cleanOptions.sort;
      }
    }
    return await this.findAll({ _id: { $in: customerIds } }, cleanOptions);
  }

  /**
   * Update customer balance
   * @param {string} id - Customer ID
   * @param {object} balanceData - Balance data
   * @returns {Promise<Customer>}
   */
  async updateBalance(id, balanceData) {
    const customer = await this.findById(id);
    if (!customer) {
      throw new Error('Customer not found');
    }

    if (balanceData.openingBalance !== undefined) {
      customer.openingBalance = balanceData.openingBalance;
    }
    if (balanceData.pendingBalance !== undefined) {
      customer.pendingBalance = balanceData.pendingBalance;
    }
    if (balanceData.advanceBalance !== undefined) {
      customer.advanceBalance = balanceData.advanceBalance;
    }
    if (balanceData.currentBalance !== undefined) {
      customer.currentBalance = balanceData.currentBalance;
    }

    return await customer.save();
  }

  /**
   * Check if email exists
   * @param {string} email - Email to check
   * @param {string} excludeId - Customer ID to exclude from check
   * @returns {Promise<boolean>}
   */
  async emailExists(email, excludeId = null) {
    if (!email || !email.trim()) return false;
    const query = { email: email.toLowerCase().trim() };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    return await this.exists(query);
  }

  /**
   * Check if phone exists
   * @param {string} phone - Phone to check
   * @param {string} excludeId - Customer ID to exclude from check
   * @returns {Promise<boolean>}
   */
  async phoneExists(phone, excludeId = null) {
    if (!phone || !phone.trim()) return false;
    const query = { phone: phone.trim() };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    return await this.exists(query);
  }

  /**
   * Check if business name exists
   * @param {string} businessName - Business name to check
   * @param {string} excludeId - Customer ID to exclude from check
   * @returns {Promise<boolean>}
   */
  async businessNameExists(businessName, excludeId = null) {
    if (!businessName) return false;
    const query = { businessName: { $regex: `^${businessName}$`, $options: 'i' } };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    return await this.exists(query);
  }
}

module.exports = new CustomerRepository();

