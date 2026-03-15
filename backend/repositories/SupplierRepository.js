const BaseRepository = require('./BaseRepository');
const Supplier = require('../models/Supplier');

class SupplierRepository extends BaseRepository {
  constructor() {
    super(Supplier);
  }

  /**
   * Find supplier by email
   * @param {string} email - Supplier email
   * @param {object} options - Query options
   * @returns {Promise<Supplier|null>}
   */
  async findByEmail(email, options = {}) {
    if (!email) return null;
    return await this.findOne({ email: email.toLowerCase().trim() }, options);
  }

  /**
   * Find supplier by company name
   * @param {string} companyName - Company name
   * @param {object} options - Query options
   * @returns {Promise<Supplier|null>}
   */
  async findByCompanyName(companyName, options = {}) {
    if (!companyName) return null;
    return await this.findOne({ companyName: { $regex: `^${companyName}$`, $options: 'i' } }, options);
  }

  /**
   * Find suppliers with advanced filtering and pagination
   * @param {object} filter - Filter query
   * @param {object} options - Pagination and sorting options
   * @returns {Promise<{suppliers: Array, total: number, pagination: object}>}
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
    
    if (select) {
      queryBuilder = queryBuilder.select(select);
    }
    
    // Validate and apply sort - only if sort is a valid value
    if (sort) {
      // Ensure sort is a valid type (string, object, array, or map)
      // Empty objects {} are invalid for MongoDB sort
      const isValidSort = 
        typeof sort === 'string' ||
        (typeof sort === 'object' && sort !== null && Object.keys(sort).length > 0) ||
        Array.isArray(sort);
      
      if (isValidSort) {
        queryBuilder = queryBuilder.sort(sort);
      } else {
        console.warn('Invalid sort parameter provided, skipping sort:', sort);
      }
    }
    
    if (skip !== undefined) {
      queryBuilder = queryBuilder.skip(skip);
    }
    
    if (finalLimit > 0) {
      queryBuilder = queryBuilder.limit(finalLimit);
    }

    const [suppliers, total] = await Promise.all([
      queryBuilder,
      this.Model.countDocuments(finalQuery)
    ]);

    return {
      suppliers,
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
   * Search suppliers by multiple fields
   * @param {string} searchTerm - Search term
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async search(searchTerm, options = {}) {
    const filter = {
      $or: [
        { companyName: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
        { 'contactPerson.name': { $regex: searchTerm, $options: 'i' } },
        { phone: { $regex: searchTerm, $options: 'i' } }
      ]
    };
    return await this.findAll(filter, options);
  }

  /**
   * Check if email exists
   * @param {string} email - Email to check
   * @param {string} excludeId - Supplier ID to exclude from check
   * @returns {Promise<boolean>}
   */
  async emailExists(email, excludeId = null) {
    if (!email) return false;
    const query = { email: email.toLowerCase().trim() };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    const count = await this.Model.countDocuments(query);
    return count > 0;
  }

  /**
   * Check if company name exists
   * @param {string} companyName - Company name to check
   * @param {string} excludeId - Supplier ID to exclude from check
   * @returns {Promise<boolean>}
   */
  async companyNameExists(companyName, excludeId = null) {
    if (!companyName) return false;
    const query = { companyName: { $regex: `^${companyName}$`, $options: 'i' } };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    const count = await this.Model.countDocuments(query);
    return count > 0;
  }

  /**
   * Update supplier balance
   * @param {string} id - Supplier ID
   * @param {object} balanceData - Balance data
   * @returns {Promise<Supplier>}
   */
  async updateBalance(id, balanceData) {
    const supplier = await this.findById(id);
    if (!supplier) {
      throw new Error('Supplier not found');
    }

    if (balanceData.openingBalance !== undefined) {
      supplier.openingBalance = balanceData.openingBalance;
    }
    if (balanceData.pendingBalance !== undefined) {
      supplier.pendingBalance = balanceData.pendingBalance;
    }
    if (balanceData.advanceBalance !== undefined) {
      supplier.advanceBalance = balanceData.advanceBalance;
    }
    if (balanceData.currentBalance !== undefined) {
      supplier.currentBalance = balanceData.currentBalance;
    }

    return await supplier.save();
  }
}

module.exports = new SupplierRepository();

