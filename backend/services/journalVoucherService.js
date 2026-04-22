const journalVoucherRepository = require('../repositories/JournalVoucherRepository');
const chartOfAccountsRepository = require('../repositories/ChartOfAccountsRepository');
const AccountingService = require('./accountingService');
const { transaction } = require('../config/postgres');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isValidUuid(v) {
  if (!v) return false;
  return UUID_REGEX.test(String(v));
}

class JournalVoucherService {
  /**
   * Validate journal voucher data
   */
  validateJournalVoucher(data) {
    const errors = [];

    // Check entries exist and have minimum 2
    if (!Array.isArray(data.entries) || data.entries.length < 2) {
      errors.push('Journal voucher must have at least 2 line items');
    }

    // Calculate totals and validate entries
    let totalDebit = 0;
    let totalCredit = 0;
    const uniqueAccountKeys = new Set();

    for (let i = 0; i < (data.entries || []).length; i++) {
      const entry = data.entries[i];
      const debit = parseFloat(entry.debitAmount || entry.debit_amount || 0);
      const credit = parseFloat(entry.creditAmount || entry.credit_amount || 0);

      // Check account code
      if (!entry.accountCode && !entry.account_code) {
        errors.push(`Entry ${i + 1}: Account code is required`);
        continue;
      }
      
      const accountCode = (entry.accountCode || entry.account_code).toUpperCase();
      const bankId = entry.bankId || entry.bank_id || '';
      const customerId = entry.customerId || entry.customer_id || '';
      const supplierId = entry.supplierId || entry.supplier_id || '';
      
      // Use a composite key to distinguish between different entities (banks, customers, suppliers)
      // that share the same General Ledger account code (e.g., 1001 for all banks).
      const compositeKey = `${accountCode}|${bankId}|${customerId}|${supplierId}`;
      uniqueAccountKeys.add(compositeKey);

      // Check debit/credit values
      if (debit < 0) {
        errors.push(`Entry ${i + 1}: Debit amount cannot be negative`);
      }
      if (credit < 0) {
        errors.push(`Entry ${i + 1}: Credit amount cannot be negative`);
      }

      // Check only one side is non-zero
      if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
        errors.push(`Entry ${i + 1}: Entry must have either debit OR credit (not both, not neither)`);
      }

      totalDebit += debit;
      totalCredit += credit;
    }

    // Check debit equals credit
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      errors.push(`Debits (${totalDebit}) must equal Credits (${totalCredit})`);
    }

    // Check at least 2 different accounts
    if (uniqueAccountKeys.size < 2) {
      errors.push('Journal voucher must involve at least 2 different accounts');
    }

    // Party validation: AR/AP accounts must have a customer/supplier link
    for (let i = 0; i < (data.entries || []).length; i++) {
      const entry = data.entries[i];
      const code = (entry.accountCode || entry.account_code || '').toUpperCase();
      let cid = entry.customerId || entry.customer_id;
      let sid = entry.supplierId || entry.supplier_id;

      // Auto-link if code starts with CUST- or SUPP- and ID is missing
      if (!cid && code.startsWith('CUST-')) {
        cid = code.replace('CUST-', '');
        entry.customerId = cid; // Update the entry object as well
      }
      if (!sid && code.startsWith('SUPP-')) {
        sid = code.replace('SUPP-', '');
        entry.supplierId = sid;
      }

      // AR Accounts: code 1100 or starts with CUST-
      if (code === '1100' || code.startsWith('CUST-')) {
        if (!cid) {
          errors.push(`Entry ${i + 1}: Accounts Receivable must be linked to a specific customer.`);
        }
      }
      // AP Accounts: code 2000 or starts with SUPP-
      if (code === '2000' || code.startsWith('SUPP-')) {
        if (!sid) {
          errors.push(`Entry ${i + 1}: Accounts Payable must be linked to a specific supplier.`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100
    };
  }

  /**
   * Get next sequential voucher number
   */
  async getNextVoucherNumber(prefix = 'JV') {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Create a new journal voucher
   */
  async createJournalVoucher(data, userId) {
    // Validate
    const validation = this.validateJournalVoucher(data);
    if (!validation.isValid) {
      throw new Error(`Invalid journal voucher: ${validation.errors.join(', ')}`);
    }

    // Verify all accounts exist and are active
    const accountCodes = new Set(
      (data.entries || []).map(e => e.accountCode || e.account_code)
    );
    for (const code of accountCodes) {
      const account = await chartOfAccountsRepository.findByAccountCode(code);
      if (!account) {
        throw new Error(`Account ${code} not found`);
      }
      if (!account.isActive) {
        throw new Error(`Account ${code} is inactive`);
      }
    }

    // Generate voucher number if not provided
    const voucherNumber = data.voucherNumber || await this.getNextVoucherNumber();

    // Create in transaction
    return await transaction(async (client) => {
      const jv = await journalVoucherRepository.create({
        voucherNumber,
        voucherDate: data.voucherDate || new Date().toISOString().split('T')[0],
        description: data.description || '',
        notes: data.notes || '',
        totalDebit: validation.totalDebit,
        totalCredit: validation.totalCredit,
        entries: data.entries,
        createdBy: userId
      }, client);

      // Log audit trail
      await journalVoucherRepository.logAuditTrail(jv.id, 'created', userId, {
        entries: jv.entries.length,
        totalDebit: validation.totalDebit,
        totalCredit: validation.totalCredit
      }, client);

      return jv;
    });
  }

  /**
   * Update journal voucher (only if draft)
   */
  async updateJournalVoucher(id, data, userId) {
    // Get current JV
    const jv = await journalVoucherRepository.findById(id);
    if (!jv) throw new Error('Journal Voucher not found');
    if (jv.status !== 'draft') {
      throw new Error('Can only update draft journal vouchers');
    }

    // Validate new data
    const validation = this.validateJournalVoucher(data);
    if (!validation.isValid) {
      throw new Error(`Invalid journal voucher: ${validation.errors.join(', ')}`);
    }

    // Verify all accounts exist
    const accountCodes = new Set(
      (data.entries || []).map(e => e.accountCode || e.account_code)
    );
    for (const code of accountCodes) {
      const account = await chartOfAccountsRepository.findByAccountCode(code);
      if (!account) {
        throw new Error(`Account ${code} not found`);
      }
      if (!account.isActive) {
        throw new Error(`Account ${code} is inactive`);
      }
    }

    return await transaction(async (client) => {
      const updated = await journalVoucherRepository.update(id, {
        description: data.description || jv.description,
        voucherDate: data.voucherDate || jv.voucherDate,
        notes: data.notes || jv.notes,
        totalDebit: validation.totalDebit,
        totalCredit: validation.totalCredit,
        entries: data.entries,
        updatedBy: userId
      }, client);

      // Log audit trail
      await journalVoucherRepository.logAuditTrail(id, 'updated', userId, {
        fieldsChanged: ['description', 'notes', 'entries'],
        newTotalDebit: validation.totalDebit,
        newTotalCredit: validation.totalCredit
      }, client);

      return updated;
    });
  }

  /**
   * Post journal voucher to ledger
   * Marks as 'posted' and creates ledger entries
   */
  async postJournalVoucher(id, userId) {
    const jv = await journalVoucherRepository.findById(id);
    if (!jv) throw new Error('Journal Voucher not found');
    if (jv.status === 'posted') throw new Error('Journal voucher is already posted');
    if (jv.status === 'reversed') throw new Error('Cannot post a reversed journal voucher');
    if (jv.status === 'cancelled') throw new Error('Cannot post a cancelled journal voucher');

    return await transaction(async (client) => {
      // Post to ledger using AccountingService
      await AccountingService.postJournalVoucherToLedger(jv, userId);

      // Update status to posted
      const updated = await journalVoucherRepository.updateStatus(id, 'posted', userId, client);

      // Log audit trail
      await journalVoucherRepository.logAuditTrail(id, 'posted', userId, {
        totalDebit: jv.totalDebit,
        totalCredit: jv.totalCredit,
        entriesCount: jv.entries.length
      }, client);

      return updated;
    });
  }

  /**
   * Reverse a journal voucher
   * Creates a new reversing JV with debit/credit swapped
   */
  async reverseJournalVoucher(id, reversalReason, userId) {
    const jv = await journalVoucherRepository.findById(id);
    if (!jv) throw new Error('Journal Voucher not found');
    if (jv.status !== 'posted') throw new Error('Can only reverse posted journal vouchers');

    return await transaction(async (client) => {
      // Create reversing entries (swap debit/credit)
      const reversingEntries = jv.entries.map(entry => ({
        accountCode: entry.accountCode,
        accountName: entry.accountName,
        particulars: `Reversal of ${jv.voucherNumber}`,
        debitAmount: entry.creditAmount,  // Swap
        creditAmount: entry.debitAmount,  // Swap
        description: entry.description
      }));

      // Create new reversal JV
      const reversalVoucher = await journalVoucherRepository.create({
        voucherNumber: `REV-${jv.voucherNumber}`,
        voucherDate: new Date().toISOString().split('T')[0],
        description: `Reversal of JV ${jv.voucherNumber}`,
        notes: reversalReason || `Reversing journal voucher ${jv.voucherNumber}`,
        totalDebit: jv.totalCredit,
        totalCredit: jv.totalDebit,
        entries: reversingEntries,
        createdBy: userId,
        status: 'draft'
      }, client);

      // Post the reversal JV
      await AccountingService.postJournalVoucherToLedger(reversalVoucher, userId);
      await journalVoucherRepository.updateStatus(reversalVoucher.id, 'posted', userId, client);

      // Mark original as reversed
      await journalVoucherRepository.updateStatus(id, 'reversed', userId, client);
      await client.query(
        `UPDATE journal_vouchers 
         SET is_reversed = true, 
             reversed_date = CURRENT_TIMESTAMP,
             reversed_by = $1,
             reversal_of_jv_id = (SELECT id FROM journal_vouchers WHERE voucher_number = $2 LIMIT 1)
         WHERE id = $3`,
        [userId, reversalVoucher.voucherNumber, id]
      );

      // Log audit trail
      await journalVoucherRepository.logAuditTrail(id, 'reversed', userId, {
        reversalReason,
        reversalVoucherId: reversalVoucher.id,
        reversalVoucherNumber: reversalVoucher.voucherNumber
      }, client);

      return {
        originalJv: { id: jv.id, voucherNumber: jv.voucherNumber, status: 'reversed' },
        reversalJv: reversalVoucher
      };
    });
  }

  /**
   * Delete journal voucher (only if draft)
   */
  async deleteJournalVoucher(id, userId) {
    const jv = await journalVoucherRepository.findById(id);
    if (!jv) throw new Error('Journal Voucher not found');
    if (jv.status !== 'draft') {
      throw new Error('Can only delete draft journal vouchers');
    }

    const deleted = await journalVoucherRepository.delete(id, userId);

    // Log audit trail
    await journalVoucherRepository.logAuditTrail(id, 'deleted', userId, {
      voucherNumber: jv.voucherNumber
    });

    return deleted;
  }

  /**
   * Get journal voucher with details
   */
  async getJournalVoucher(id) {
    const jv = await journalVoucherRepository.findById(id);
    if (!jv) throw new Error('Journal Voucher not found');

    // Get audit trail
    jv.auditTrail = await journalVoucherRepository.getAuditTrail(id);

    return jv;
  }

  /**
   * List journal vouchers with filtering and pagination
   */
  async listJournalVouchers(filters = {}, options = {}) {
    const page = parseInt(options.page) || 1;
    const limit = parseInt(options.limit) || 20;
    const skip = (page - 1) * limit;

    const total = await journalVoucherRepository.count(filters);
    const jvs = await journalVoucherRepository.findAll(filters, {
      limit,
      skip
    });

    return {
      data: jvs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get journal voucher statistics
   */
  async getJournalVoucherStats(filters = {}) {
    const allJvs = await journalVoucherRepository.findAll(filters, { limit: 99999 });

    const stats = {
      total: allJvs.length,
      byStatus: {
        draft: allJvs.filter(j => j.status === 'draft').length,
        posted: allJvs.filter(j => j.status === 'posted').length,
        reversed: allJvs.filter(j => j.status === 'reversed').length,
        cancelled: allJvs.filter(j => j.status === 'cancelled').length
      },
      totalDebit: allJvs.reduce((sum, j) => sum + (j.totalDebit || 0), 0),
      totalCredit: allJvs.reduce((sum, j) => sum + (j.totalCredit || 0), 0),
      postedCount: allJvs.filter(j => j.status === 'posted').length,
      reversedCount: allJvs.filter(j => j.status === 'reversed').length
    };

    return stats;
  }
}

module.exports = new JournalVoucherService();
