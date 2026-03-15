const BaseRepository = require('./BaseRepository');
const Employee = require('../models/Employee');

class EmployeeRepository extends BaseRepository {
  constructor() {
    super(Employee);
  }

  /**
   * Find employee by employee ID
   * @param {string} employeeId - Employee ID
   * @param {object} options - Query options
   * @returns {Promise<Employee|null>}
   */
  async findByEmployeeId(employeeId, options = {}) {
    if (!employeeId) return null;
    return await this.findOne({ employeeId: employeeId.toUpperCase() }, options);
  }

  /**
   * Find employee by email
   * @param {string} email - Employee email
   * @param {object} options - Query options
   * @returns {Promise<Employee|null>}
   */
  async findByEmail(email, options = {}) {
    if (!email) return null;
    return await this.findOne({ email: email.toLowerCase().trim() }, options);
  }

  /**
   * Find employees with advanced filtering and pagination
   * @param {object} filter - Filter query
   * @param {object} options - Pagination and sorting options
   * @returns {Promise<{employees: Array, total: number, pagination: object}>}
   */
  async findWithPagination(filter = {}, options = {}) {
    const {
      page = 1,
      limit = 20,
      sort = { createdAt: -1 },
      populate = [{
        path: 'userAccount',
        select: 'firstName lastName email role',
        options: { strictPopulate: false }
      }],
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

    const [employees, total] = await Promise.all([
      queryBuilder,
      this.Model.countDocuments(finalQuery)
    ]);

    return {
      employees,
      total,
      pagination: getAll ? {
        page: 1,
        limit: total,
        total,
        pages: 1
      } : {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Search employees by multiple fields
   * @param {string} searchTerm - Search term
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async search(searchTerm, options = {}) {
    if (!searchTerm) return [];
    const filter = {
      $or: [
        { firstName: { $regex: searchTerm, $options: 'i' } },
        { lastName: { $regex: searchTerm, $options: 'i' } },
        { employeeId: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
        { phone: { $regex: searchTerm, $options: 'i' } },
        { position: { $regex: searchTerm, $options: 'i' } },
        { department: { $regex: searchTerm, $options: 'i' } }
      ]
    };
    return await this.findAll(filter, options);
  }

  /**
   * Find employees by status
   * @param {string} status - Employee status
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByStatus(status, options = {}) {
    return await this.findAll({ status }, options);
  }

  /**
   * Find employees by department
   * @param {string} department - Department name
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByDepartment(department, options = {}) {
    return await this.findAll({ department }, options);
  }

  /**
   * Find employees by position
   * @param {string} position - Position name
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByPosition(position, options = {}) {
    return await this.findAll({ position }, options);
  }

  /**
   * Check if employee ID exists
   * @param {string} employeeId - Employee ID to check
   * @param {string} excludeId - Employee ID to exclude from check
   * @returns {Promise<boolean>}
   */
  async employeeIdExists(employeeId, excludeId = null) {
    if (!employeeId) return false;
    const query = { employeeId: employeeId.toUpperCase() };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    const count = await this.Model.countDocuments(query);
    return count > 0;
  }

  /**
   * Check if email exists
   * @param {string} email - Email to check
   * @param {string} excludeId - Employee ID to exclude from check
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
   * Find employee by user account ID
   * @param {string} userAccountId - User account ID
   * @param {object} options - Query options
   * @returns {Promise<Employee|null>}
   */
  async findByUserAccount(userAccountId, options = {}) {
    if (!userAccountId) return null;
    return await this.findOne({ userAccount: userAccountId }, options);
  }

  /**
   * Find the latest employee (for generating next employee ID)
   * @returns {Promise<Employee|null>}
   */
  async findLatest() {
    return await this.Model.findOne().sort({ createdAt: -1 }).lean();
  }
}

module.exports = new EmployeeRepository();

