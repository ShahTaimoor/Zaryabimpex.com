const BankRepository = require('../repositories/BankRepository');
const BankPaymentRepository = require('../repositories/BankPaymentRepository');
const BankReceiptRepository = require('../repositories/BankReceiptRepository');

/**
 * Map DB bank row (snake_case) to API response format (camelCase)
 */
function mapBankForResponse(row) {
  if (!row) return row;
  return {
    id: row.id,
    _id: row.id,
    bankName: row.bank_name ?? row.bankName,
    accountName: row.account_name ?? row.accountName,
    accountNumber: row.account_number ?? row.accountNumber,
    branchName: row.branch_name ?? row.branchName,
    branchAddress: row.branch_address ?? row.branchAddress,
    accountType: row.account_type ?? row.accountType,
    routingNumber: row.routing_number ?? row.routingNumber,
    swiftCode: row.swift_code ?? row.swiftCode,
    iban: row.iban,
    openingBalance: row.opening_balance != null ? parseFloat(row.opening_balance) : (row.openingBalance ?? 0),
    currentBalance: row.current_balance != null ? parseFloat(row.current_balance) : (row.currentBalance ?? 0),
    isActive: row.is_active !== undefined ? row.is_active : (row.isActive !== false),
    notes: row.notes,
    createdBy: row.created_by ?? row.createdBy,
    updatedBy: row.updated_by ?? row.updatedBy,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt
  };
}

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

    const rows = await BankRepository.findWithFilters(filter, {
      sort: { bankName: 1, accountNumber: 1 }
    });
    return rows.map(mapBankForResponse);
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
    return mapBankForResponse(bank);
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

    const created = await BankRepository.create(processedData);
    return mapBankForResponse(created);
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

    const updated = await BankRepository.updateById(id, processedData);
    return mapBankForResponse(updated);
  }

  /**
   * Check if bank is used in transactions
   * @param {string} bankId - Bank ID
   * @returns {Promise<object>}
   */
  async checkBankUsage(bankId) {
    const [paymentCount, receiptCount] = await Promise.all([
      BankPaymentRepository.countByBankId(bankId),
      BankReceiptRepository.countByBankId(bankId)
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

