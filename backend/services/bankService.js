const BankRepository = require('../repositories/BankRepository');

class BankService {
  /**
   * Get banks with filters
   * @param {object} queryParams - Query parameters
   * @returns {Promise<Array>}
   */
  async getBanks(queryParams) {
    const filter = {};

    if (queryParams.isActive !== undefined) {
      filter.isActive = queryParams.isActive === 'true';
    }

    return await BankRepository.findWithFilters(filter, {
      sort: { bankName: 1, accountNumber: 1 }
    });
  }

  /**
   * Get single bank by ID
   * @param {string} id - Bank ID
   * @returns {Promise<object>}
   */
  async getBankById(id) {
    const bank = await BankRepository.findById(id);
    if (!bank) {
      throw new Error('Bank not found');
    }
    return bank;
  }

  /**
   * Create bank
   * @param {object} bankData - Bank data
   * @param {string} userId - User ID
   * @returns {Promise<object>}
   */
  async createBank(bankData, userId) {
    const processedData = {
      accountName: bankData.accountName.trim(),
      accountNumber: bankData.accountNumber.trim(),
      bankName: bankData.bankName.trim(),
      branchName: bankData.branchName ? bankData.branchName.trim() : null,
      branchAddress: bankData.branchAddress || null,
      accountType: bankData.accountType || 'checking',
      routingNumber: bankData.routingNumber ? bankData.routingNumber.trim() : null,
      swiftCode: bankData.swiftCode ? bankData.swiftCode.trim() : null,
      iban: bankData.iban ? bankData.iban.trim() : null,
      openingBalance: parseFloat(bankData.openingBalance || 0),
      currentBalance: parseFloat(bankData.openingBalance || 0),
      isActive: bankData.isActive !== undefined ? bankData.isActive : true,
      notes: bankData.notes ? bankData.notes.trim() : null,
      createdBy: userId
    };

    return await BankRepository.create(processedData);
  }

  /**
   * Update bank
   * @param {string} id - Bank ID
   * @param {object} updateData - Update data
   * @param {string} userId - User ID
   * @returns {Promise<object>}
   */
  async updateBank(id, updateData, userId) {
    const bank = await BankRepository.findById(id);
    if (!bank) {
      throw new Error('Bank not found');
    }

    const processedData = {};
    if (updateData.accountName !== undefined) processedData.accountName = updateData.accountName.trim();
    if (updateData.accountNumber !== undefined) processedData.accountNumber = updateData.accountNumber.trim();
    if (updateData.bankName !== undefined) processedData.bankName = updateData.bankName.trim();
    if (updateData.branchName !== undefined) processedData.branchName = updateData.branchName ? updateData.branchName.trim() : null;
    if (updateData.branchAddress !== undefined) processedData.branchAddress = updateData.branchAddress || null;
    if (updateData.accountType !== undefined) processedData.accountType = updateData.accountType;
    if (updateData.routingNumber !== undefined) processedData.routingNumber = updateData.routingNumber ? updateData.routingNumber.trim() : null;
    if (updateData.swiftCode !== undefined) processedData.swiftCode = updateData.swiftCode ? updateData.swiftCode.trim() : null;
    if (updateData.iban !== undefined) processedData.iban = updateData.iban ? updateData.iban.trim() : null;
    if (updateData.openingBalance !== undefined) {
      const newOpeningBalance = parseFloat(updateData.openingBalance);
      const balanceDifference = newOpeningBalance - bank.openingBalance;
      processedData.openingBalance = newOpeningBalance;
      processedData.currentBalance = bank.currentBalance + balanceDifference;
    }
    if (updateData.isActive !== undefined) processedData.isActive = updateData.isActive;
    if (updateData.notes !== undefined) processedData.notes = updateData.notes ? updateData.notes.trim() : null;
    processedData.updatedBy = userId;

    return await BankRepository.updateById(id, processedData);
  }

  /**
   * Check if bank is used in transactions
   * @param {string} bankId - Bank ID
   * @returns {Promise<object>}
   */
  async checkBankUsage(bankId) {
    const BankPayment = require('../models/BankPayment');
    const BankReceipt = require('../models/BankReceipt');

    const [paymentCount, receiptCount] = await Promise.all([
      BankPayment.countDocuments({ bank: bankId }),
      BankReceipt.countDocuments({ bank: bankId })
    ]);

    return {
      paymentCount,
      receiptCount,
      totalCount: paymentCount + receiptCount,
      isUsed: (paymentCount + receiptCount) > 0
    };
  }

  /**
   * Delete bank
   * @param {string} id - Bank ID
   * @returns {Promise<object>}
   */
  async deleteBank(id) {
    const bank = await BankRepository.findById(id);
    if (!bank) {
      throw new Error('Bank not found');
    }

    // Check if bank is being used in any transactions
    const usage = await this.checkBankUsage(id);
    if (usage.isUsed) {
      throw new Error(`Cannot delete bank account. It is being used in ${usage.totalCount} transaction(s). Consider deactivating it instead.`);
    }

    await BankRepository.softDelete(id);
    return { message: 'Bank account deleted successfully' };
  }
}

module.exports = new BankService();

