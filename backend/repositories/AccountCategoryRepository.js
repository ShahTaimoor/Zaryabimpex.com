const BaseRepository = require('./BaseRepository');
const AccountCategory = require('../models/AccountCategory');

class AccountCategoryRepository extends BaseRepository {
  constructor() {
    super(AccountCategory);
  }

  /**
   * Find active account categories
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findActive(options = {}) {
    return await this.findAll({ isActive: true }, {
      sort: { accountType: 1, displayOrder: 1, name: 1 },
      ...options
    });
  }

  /**
   * Get all categories grouped by type (uses static method)
   * @returns {Promise<Array>}
   */
  async getAllCategoriesGrouped() {
    return await this.Model.getAllCategoriesGrouped();
  }

  /**
   * Get categories by type (uses static method)
   * @param {string} accountType - Account type
   * @returns {Promise<Array>}
   */
  async getCategoriesByType(accountType) {
    return await this.Model.getCategoriesByType(accountType);
  }
}

module.exports = new AccountCategoryRepository();

