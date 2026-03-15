const BaseRepository = require('./BaseRepository');
const User = require('../models/User');

class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @param {object} options - Query options
   * @returns {Promise<User|null>}
   */
  async findByEmail(email, options = {}) {
    return await this.findOne({ email: email.toLowerCase().trim() }, options);
  }

  /**
   * Find user by email with password (for login)
   * @param {string} email - User email
   * @returns {Promise<User|null>}
   */
  async findByEmailWithPassword(email) {
    return await this.findOne({ email: email.toLowerCase().trim() }, {
      select: '+password' // Include password field
    });
  }

  /**
   * Find user by ID with password
   * @param {string} id - User ID
   * @returns {Promise<User|null>}
   */
  async findByIdWithPassword(id) {
    return await this.findOne({ _id: id }, {
      select: '+password' // Include password field
    });
  }

  /**
   * Find all users with pagination
   * @param {object} query - Filter query
   * @param {object} options - Pagination and sorting options
   * @returns {Promise<{users: Array, total: number}>}
   */
  async findWithPagination(query = {}, options = {}) {
    const {
      page = 1,
      limit = 20,
      sort = { createdAt: -1 },
      populate,
      select
    } = options;

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.findAll(query, { skip, limit, sort, populate, select }),
      this.count(query)
    ]);

    return {
      users,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    };
  }

  /**
   * Find users by role
   * @param {string} role - User role
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByRole(role, options = {}) {
    return await this.findAll({ role }, options);
  }

  /**
   * Find active users
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findActive(options = {}) {
    return await this.findAll({ isActive: true }, options);
  }

  /**
   * Update user profile
   * @param {string} id - User ID
   * @param {object} updateData - Data to update
   * @returns {Promise<User>}
   */
  async updateProfile(id, updateData) {
    return await this.updateById(id, updateData, {
      new: true,
      runValidators: true
    });
  }

  /**
   * Update user password
   * @param {string} id - User ID
   * @param {string} newPassword - New password (will be hashed by model)
   * @returns {Promise<User>}
   */
  async updatePassword(id, newPassword) {
    const user = await this.findByIdWithPassword(id);
    if (!user) {
      throw new Error('User not found');
    }
    user.password = newPassword;
    return await user.save();
  }

  /**
   * Increment login attempts
   * @param {string} id - User ID
   * @returns {Promise<User>}
   */
  async incrementLoginAttempts(id) {
    const user = await this.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    return await user.incLoginAttempts();
  }

  /**
   * Reset login attempts
   * @param {string} id - User ID
   * @returns {Promise<User>}
   */
  async resetLoginAttempts(id) {
    const user = await this.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    return await user.resetLoginAttempts();
  }

  /**
   * Track login activity
   * @param {string} id - User ID
   * @param {string} ipAddress - IP address
   * @param {string} userAgent - User agent string
   * @returns {Promise<User>}
   */
  async trackLogin(id, ipAddress, userAgent) {
    const user = await this.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    return await user.trackLogin(ipAddress, userAgent);
  }

  /**
   * Track permission change
   * @param {string} id - User ID
   * @param {User} changedBy - User making the change
   * @param {string} changeType - Type of change
   * @param {object} oldData - Old data
   * @param {object} newData - New data
   * @param {string} notes - Notes
   * @returns {Promise<User>}
   */
  async trackPermissionChange(id, changedBy, changeType, oldData, newData, notes) {
    const user = await this.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    return await user.trackPermissionChange(changedBy, changeType, oldData, newData, notes);
  }

  /**
   * Check if email exists
   * @param {string} email - Email to check
   * @param {string} excludeId - User ID to exclude from check
   * @returns {Promise<boolean>}
   */
  async emailExists(email, excludeId = null) {
    const query = { email: email.toLowerCase().trim() };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    return await this.exists(query);
  }
}

module.exports = new UserRepository();

