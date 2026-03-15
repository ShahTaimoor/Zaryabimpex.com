const BaseRepository = require('./BaseRepository');
const Attendance = require('../models/Attendance');

class AttendanceRepository extends BaseRepository {
  constructor() {
    super(Attendance);
  }

  /**
   * Find attendance by employee ID
   * @param {string} employeeId - Employee ID
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByEmployee(employeeId, options = {}) {
    return await this.findAll({ employee: employeeId }, options);
  }

  /**
   * Find open attendance session for employee
   * @param {string} employeeId - Employee ID
   * @param {object} options - Query options
   * @returns {Promise<Attendance|null>}
   */
  async findOpenSession(employeeId, options = {}) {
    return await this.findOne({ employee: employeeId, status: 'open' }, options);
  }

  /**
   * Find attendance with filtering and pagination
   * @param {object} filter - Filter query
   * @param {object} options - Pagination and sorting options
   * @returns {Promise<{attendances: Array, total: number, pagination: object}>}
   */
  async findWithPagination(filter = {}, options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        sort = { createdAt: -1 },
        populate = [
          { path: 'employee', select: 'firstName lastName employeeId email' }
        ],
        getAll = false
      } = options;

      const skip = getAll ? 0 : (page - 1) * limit;
      const finalLimit = getAll ? 999999 : limit;

      // Attendance model doesn't have isDeleted field, so just use filter as-is
      const finalQuery = filter;

      let queryBuilder = this.Model.find(finalQuery);
      
      if (populate && populate.length > 0) {
        populate.forEach(pop => {
          // Handle populate with proper options
          if (typeof pop === 'string') {
            queryBuilder = queryBuilder.populate(pop);
          } else if (pop.path) {
            const populateOptions = {
              path: pop.path
            };
            if (pop.select) {
              populateOptions.select = pop.select;
            }
            // Allow null/undefined for missing references
            queryBuilder = queryBuilder.populate(populateOptions);
          } else {
            queryBuilder = queryBuilder.populate(pop);
          }
        });
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

      const [attendances, total] = await Promise.all([
        queryBuilder,
        this.Model.countDocuments(finalQuery)
      ]);

      return {
        attendances,
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
    } catch (error) {
      // Re-throw with more context
      error.message = `AttendanceRepository.findWithPagination error: ${error.message}`;
      throw error;
    }
  }
}

module.exports = new AttendanceRepository();

