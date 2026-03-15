const BaseRepository = require('./BaseRepository');
const ChartOfAccounts = require('../models/ChartOfAccounts');

class ChartOfAccountsRepository extends BaseRepository {
  constructor() {
    super(ChartOfAccounts);
  }

  /**
   * Find account by account code
   * @param {string} accountCode - Account code
   * @param {object} options - Query options
   * @returns {Promise<ChartOfAccounts|null>}
   */
  async findByAccountCode(accountCode, options = {}) {
    return await this.findOne({ accountCode }, options);
  }

  /**
   * Find accounts by account type
   * @param {string} accountType - Account type
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByAccountType(accountType, options = {}) {
    return await this.findAll({ accountType }, options);
  }

  /**
   * Find accounts by account name (case-insensitive search)
   * @param {string} accountName - Account name pattern
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByAccountName(accountName, options = {}) {
    return await this.findAll(
      { accountName: { $regex: accountName, $options: 'i' } },
      options
    );
  }

  /**
   * Find accounts matching a pattern in account name
   * @param {string} pattern - Pattern to match
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findMatchingAccountName(pattern, options = {}) {
    return await this.findAll(
      { accountName: { $regex: pattern, $options: 'i' } },
      options
    );
  }

  /**
   * Get account codes for matching account names
   * @param {string} accountName - Account name pattern
   * @returns {Promise<Array<string>>} - Array of account codes
   */
  async getAccountCodesByName(accountName) {
    const accounts = await this.Model.find({
      accountName: { $regex: accountName, $options: 'i' }
    }).select('accountCode').lean();
    return accounts.map(a => a.accountCode);
  }

  /**
   * Resolve cash and bank account codes
   * @returns {Promise<{cashCode: string, bankCode: string}>}
   */
  async resolveCashBankCodes() {
    try {
      const accounts = await this.Model.find({ accountType: 'asset' })
        .select('accountCode accountName')
        .lean();
      const cash = accounts.find(a => /cash/i.test(a.accountName))?.accountCode;
      const bank = accounts.find(a => /bank/i.test(a.accountName))?.accountCode;
      return { cashCode: cash || null, bankCode: bank || null };
    } catch (_) {
      return { cashCode: null, bankCode: null };
    }
  }

  /**
   * Find child accounts by parent account ID
   * @param {string} parentAccountId - Parent account ID
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findChildAccounts(parentAccountId, options = {}) {
    return await this.findAll({ parentAccount: parentAccountId }, options);
  }

  /**
   * Get account hierarchy (uses model static method)
   * @returns {Promise<Array>}
   */
  async getAccountHierarchy() {
    return await this.Model.getAccountHierarchy();
  }

  /**
   * Get account statistics
   * @returns {Promise<object>}
   */
  async getStats() {
    const [totalAccounts, accountsByType, totalAssets, totalLiabilities, totalEquity] = await Promise.all([
      this.Model.countDocuments({ isActive: true }),
      this.Model.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$accountType', count: { $sum: 1 } } }
      ]),
      this.Model.aggregate([
        { $match: { accountType: 'asset', isActive: true } },
        { $group: { _id: null, total: { $sum: '$currentBalance' } } }
      ]),
      this.Model.aggregate([
        { $match: { accountType: 'liability', isActive: true } },
        { $group: { _id: null, total: { $sum: '$currentBalance' } } }
      ]),
      this.Model.aggregate([
        { $match: { accountType: 'equity', isActive: true } },
        { $group: { _id: null, total: { $sum: '$currentBalance' } } }
      ])
    ]);

    return {
      totalAccounts,
      accountsByType,
      totalAssets: totalAssets[0]?.total || 0,
      totalLiabilities: totalLiabilities[0]?.total || 0,
      totalEquity: totalEquity[0]?.total || 0
    };
  }

  /**
   * Update account balance (for transactions with session support)
   * @param {string} accountId - Account ID
   * @param {object} updateData - Update data (e.g., { $inc: { currentBalance: delta } })
   * @param {object} options - Options including session
   * @returns {Promise}
   */
  async updateBalance(accountId, updateData, options = {}) {
    const { session } = options;
    return await this.Model.updateOne(
      { _id: accountId },
      updateData,
      { session, ...options }
    );
  }
}

module.exports = new ChartOfAccountsRepository();

