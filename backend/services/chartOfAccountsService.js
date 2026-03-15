const chartOfAccountsRepository = require('../repositories/ChartOfAccountsRepository');

class ChartOfAccountsService {
  /**
   * Get all accounts with optional filters
   * @param {object} queryParams - Query parameters
   * @returns {Promise<Array>}
   */
  async getAccounts(queryParams) {
    const { accountType, accountCategory, isActive, search, allowDirectPosting } = queryParams;

    const filter = {};
    if (accountType) filter.accountType = accountType;
    if (accountCategory) filter.accountCategory = accountCategory;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (allowDirectPosting !== undefined) filter.allowDirectPosting = allowDirectPosting === 'true';
    if (search) {
      filter.$or = [
        { accountCode: { $regex: search, $options: 'i' } },
        { accountName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const accounts = await chartOfAccountsRepository.findAll(filter, {
      populate: [{ path: 'parentAccount', select: 'accountCode accountName' }],
      sort: { accountCode: 1 }
    });

    return accounts;
  }

  /**
   * Get account hierarchy tree
   * @returns {Promise<Array>}
   */
  async getAccountHierarchy() {
    return await chartOfAccountsRepository.getAccountHierarchy();
  }

  /**
   * Get account by ID
   * @param {string} id - Account ID
   * @returns {Promise<object>}
   */
  async getAccountById(id) {
    const account = await chartOfAccountsRepository.findById(id, [{ path: 'parentAccount', select: 'accountCode accountName' }]);
    if (!account) {
      throw new Error('Account not found');
    }
    return account;
  }

  /**
   * Create new account
   * @param {object} accountData - Account data
   * @param {string} userId - User ID creating the account
   * @returns {Promise<object>}
   */
  async createAccount(accountData, userId) {
    const { accountCode, accountName, accountType, accountCategory, normalBalance } = accountData;

    // Validation
    if (!accountCode || !accountName || !accountType || !accountCategory || !normalBalance) {
      throw new Error('Account code, name, type, category, and normal balance are required');
    }

    // Check if account code already exists
    const existingAccount = await chartOfAccountsRepository.findByAccountCode(accountCode);
    if (existingAccount) {
      throw new Error('Account code already exists');
    }

    const newAccountData = {
      ...accountData,
      parentAccount: accountData.parentAccount || null,
      level: accountData.level || 0,
      openingBalance: accountData.openingBalance || 0,
      currentBalance: 0, // Initial balance is 0, will be updated by transaction if openingBalance > 0
      allowDirectPosting: accountData.allowDirectPosting !== undefined ? accountData.allowDirectPosting : true,
      isTaxable: accountData.isTaxable || false,
      taxRate: accountData.taxRate || 0,
      requiresReconciliation: accountData.requiresReconciliation || false,
      createdBy: userId
    };

    try {
      const account = await chartOfAccountsRepository.create(newAccountData);

      // If opening balance is provided, record it as a transaction
      if (accountData.openingBalance && accountData.openingBalance > 0) {
        try {
          await AccountingService.recordOpeningBalance(
            account.accountCode,
            accountData.openingBalance,
            `Initial opening balance for ${account.accountName}`,
            userId
          );
        } catch (error) {
          console.error(`Failed to record opening balance transaction for ${account.accountCode}:`, error);
          // We don't fail account creation, but log the error
        }
      }

      return account;
    } catch (err) {
      if (err.code === 11000) {
        throw new Error('Account code already exists');
      }
      throw err;
    }
  }

  /**
   * Update account
   * @param {string} id - Account ID
   * @param {object} updateData - Update data
   * @param {string} userId - User ID updating the account
   * @returns {Promise<object>}
   */
  async updateAccount(id, updateData, userId) {
    const account = await chartOfAccountsRepository.findById(id);

    if (!account) {
      throw new Error('Account not found');
    }

    // Prevent updating system accounts
    if (account.isSystemAccount) {
      throw new Error('Cannot modify system accounts');
    }

    const allowedFields = [
      'accountName',
      'accountCategory',
      'parentAccount',
      'description',
      'allowDirectPosting',
      'isTaxable',
      'taxRate',
      'requiresReconciliation',
      'isActive'
    ];

    const updateFields = {};
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updateFields[field] = updateData[field];
      }
    });

    updateFields.updatedBy = userId;

    const updatedAccount = await chartOfAccountsRepository.update(id, updateFields);
    return updatedAccount;
  }

  /**
   * Delete account
   * @param {string} id - Account ID
   * @returns {Promise<object>}
   */
  async deleteAccount(id) {
    const account = await chartOfAccountsRepository.findById(id);

    if (!account) {
      throw new Error('Account not found');
    }

    // Prevent deleting system accounts
    if (account.isSystemAccount) {
      throw new Error('Cannot delete system accounts');
    }

    // Check if account has children
    const childAccounts = await chartOfAccountsRepository.findChildAccounts(account._id);
    if (childAccounts.length > 0) {
      throw new Error('Cannot delete account with sub-accounts. Delete sub-accounts first.');
    }

    // Check if account has balance
    if (account.currentBalance !== 0) {
      throw new Error('Cannot delete account with non-zero balance');
    }

    await chartOfAccountsRepository.softDelete(id);
    return { message: 'Account deleted successfully' };
  }

  /**
   * Get account statistics summary
   * @returns {Promise<object>}
   */
  async getStats() {
    return await chartOfAccountsRepository.getStats();
  }
}

module.exports = new ChartOfAccountsService();

