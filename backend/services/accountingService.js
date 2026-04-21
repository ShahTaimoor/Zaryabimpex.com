const { query, transaction } = require('../config/postgres');
const { v4: uuidv4 } = require('uuid');
const { invalidateByPrefix } = require('../utils/ttlCache');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isValidUuid(v) {
  if (!v) return false;
  return UUID_REGEX.test(String(v).trim());
}


/**
 * Accounting Service - PostgreSQL Implementation
 * Handles all accounting operations with ACID compliance
 */
class AccountingService {
  /**
   * Validate account exists and is active
   * @param {string} accountCode - Account code to validate
   * @param {Function} queryFn - Optional query function (for transactions)
   */
  static async validateAccount(accountCode, queryFn = null) {
    const q = queryFn || query;
    const result = await q(
      'SELECT * FROM chart_of_accounts WHERE UPPER(account_code) = $1 AND is_active = TRUE AND deleted_at IS NULL',
      [accountCode.toUpperCase()]
    );

    if (result.rows.length === 0) {
      throw new Error(`Account code ${accountCode} not found or inactive`);
    }

    const account = result.rows[0];
    if (!account.allow_direct_posting) {
      throw new Error(`Account ${accountCode} does not allow direct posting`);
    }

    return account;
  }

  /**
   * Get default account codes for system operations
   */
  static async getDefaultAccountCodes() {
    return {
      cash: '1000',
      bank: '1001',
      accountsReceivable: '1100',
      inventory: '1200',
      accountsPayable: '2000',
      salesRevenue: '4000',
      salesReturns: '4100', // Assuming 4100 for Sales Returns
      costOfGoodsSold: '5000',
      purchaseReturns: '5050' // Purchase Returns (contra-COGS)
    };
  }

  /**
   * Get specific account code by criteria
   * @param {string} name - Account name
   * @param {string} type - Account type
   * @param {string} subtype - Account subtype
   */
  static async getAccountCode(name, type, subtype) {
    // strict lookup not implemented, return defaults based on subtype/name
    const codes = await this.getDefaultAccountCodes();
    if (name === 'Sales Returns' || subtype === 'sales_returns') return codes.salesReturns;
    if (name === 'Purchase Returns' || subtype === 'purchase_returns') return codes.purchaseReturns;
    if (subtype === 'revenue' || subtype === 'sales_revenue') return codes.salesRevenue;
    if (subtype === 'cost_of_goods_sold') return codes.costOfGoodsSold;

    // Fallback query: match by account_name or account_category (table has no account_subtype)
    const result = await query(
      `SELECT account_code FROM chart_of_accounts 
       WHERE (account_name ILIKE $1 OR account_category = $2) 
       AND (deleted_at IS NULL) AND is_active = TRUE LIMIT 1`,
      [name, subtype]
    );

    if (result.rows.length > 0) {
      return result.rows[0].account_code;
    }

    throw new Error(`Account code not found for ${name} (${subtype})`);
  }

  /**
   * Create a ledger transaction (double-entry)
   * @param {Object} entry1 - First entry {accountCode, debitAmount, creditAmount, description, ...}
   * @param {Object} entry2 - Second entry {accountCode, debitAmount, creditAmount, description, ...}
   * @param {Object} metadata - Additional metadata {referenceType, referenceId, customerId, supplierId, etc.}
   * @param {Object} client - Optional PostgreSQL client for existing transaction (if provided, won't create new transaction)
   */
  static async createTransaction(entry1, entry2, metadata = {}, client = null) {
    // Validate referenceId is required
    if (!metadata.referenceId) {
      throw new Error('referenceId is required for all ledger transactions');
    }

    // Validate double-entry: total debits = total credits
    const totalDebit = (entry1.debitAmount || 0) + (entry2.debitAmount || 0);
    const totalCredit = (entry1.creditAmount || 0) + (entry2.creditAmount || 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`Unbalanced transaction: Debits ${totalDebit} ≠ Credits ${totalCredit}`);
    }

    // Validate only one side is non-zero for each entry
    if ((entry1.debitAmount > 0 && entry1.creditAmount > 0) ||
      (entry2.debitAmount > 0 && entry2.creditAmount > 0)) {
      throw new Error('Each entry must have either debit OR credit, not both');
    }

    // Validate accounts (use client if provided, otherwise use global query)
    const validateQuery = client ? client.query.bind(client) : query;
    await this.validateAccount(entry1.accountCode, validateQuery);
    await this.validateAccount(entry2.accountCode, validateQuery);

    const transactionId = `TXN-${Date.now()}-${uuidv4().substring(0, 8)}`;

    // If client is provided, use it directly (part of existing transaction)
    // Otherwise, create a new transaction
    const executeTransaction = async (clientToUse) => {
      // Create first ledger entry
      const entry1Result = await clientToUse.query(
        `INSERT INTO account_ledger (
          transaction_id, transaction_date, account_code,
          debit_amount, credit_amount, description,
          reference_type, reference_id, reference_number,
          customer_id, supplier_id, currency, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          `${transactionId}-1`,
          metadata.transactionDate || new Date(),
          entry1.accountCode.toUpperCase(),
          entry1.debitAmount || 0,
          entry1.creditAmount || 0,
          entry1.description,
          metadata.referenceType,
          metadata.referenceId,
          metadata.referenceNumber,
          metadata.customerId,
          metadata.supplierId,
          metadata.currency || 'PKR',
          metadata.status || 'completed',
          isValidUuid(metadata.createdBy) ? metadata.createdBy : null
        ]
      );

      // Create second ledger entry
      const entry2Result = await clientToUse.query(
        `INSERT INTO account_ledger (
          transaction_id, transaction_date, account_code,
          debit_amount, credit_amount, description,
          reference_type, reference_id, reference_number,
          customer_id, supplier_id, currency, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          `${transactionId}-2`,
          metadata.transactionDate || new Date(),
          entry2.accountCode.toUpperCase(),
          entry2.debitAmount || 0,
          entry2.creditAmount || 0,
          entry2.description,
          metadata.referenceType,
          metadata.referenceId,
          metadata.referenceNumber,
          metadata.customerId,
          metadata.supplierId,
          metadata.currency || 'PKR',
          metadata.status || 'completed',
          metadata.createdBy
        ]
      );

      // Update account balances
      await this.updateAccountBalance(clientToUse, entry1.accountCode);
      await this.updateAccountBalance(clientToUse, entry2.accountCode);

      return {
        transactionId,
        entries: [entry1Result.rows[0], entry2Result.rows[0]]
      };
    };

    // If client is provided, use it directly (part of existing transaction)
    // Otherwise, create a new transaction
    if (client) {
      const result = await executeTransaction(client);
      invalidateByPrefix('reports:');
      return result;
    } else {
      return await transaction(async (newClient) => {
        const result = await executeTransaction(newClient);
        invalidateByPrefix('reports:');
        return result;
      });
    }
  }

  /**
   * Update account current_balance from ledger
   * Ensures balance is calculated correctly based on normal balance type
   */
  static async updateAccountBalance(client, accountCode) {
    if (!accountCode) {
      throw new Error('Account code is required for balance update');
    }

    const result = await client.query(
      `UPDATE chart_of_accounts 
       SET current_balance = (
         SELECT COALESCE(opening_balance, 0) + COALESCE(SUM(
           CASE 
             WHEN normal_balance = 'debit' THEN (COALESCE(ledger.debit_amount, 0) - COALESCE(ledger.credit_amount, 0))
             WHEN normal_balance = 'credit' THEN (COALESCE(ledger.credit_amount, 0) - COALESCE(ledger.debit_amount, 0))
             ELSE 0
           END
         ), 0)
         FROM account_ledger ledger
         WHERE ledger.account_code = chart_of_accounts.account_code
           AND ledger.status = 'completed'
           AND ledger.reversed_at IS NULL
       ),
       updated_at = CURRENT_TIMESTAMP
       WHERE account_code = $1 AND deleted_at IS NULL
       RETURNING current_balance, normal_balance, opening_balance`,
      [accountCode.toUpperCase()]
    );
    
    if (!result.rows[0]) {
      throw new Error(`Account ${accountCode} not found or inactive`);
    }
    
    return parseFloat(result.rows[0]?.current_balance || 0);
  }

  /**
   * Get account balance from ledger
   * Returns 0 if account doesn't exist (with warning)
   * @param {string} accountCode
   * @param {Date|null} asOfDate
   * @param {object} opts - { useDbFallback: boolean } - when true, use current_balance if it differs from calculated by >1 (handles legacy/migration data)
   */
  static async getAccountBalance(accountCode, asOfDate = null, opts = {}) {
    const dateFilter = asOfDate
      ? 'AND transaction_date <= $2'
      : '';

    const params = [accountCode.toUpperCase()];
    if (asOfDate) params.push(asOfDate);

    const result = await query(
      `SELECT 
        coa.account_code,
        coa.account_name,
        coa.opening_balance,
        coa.current_balance,
        coa.normal_balance,
        coa.is_active,
        COALESCE(SUM(
          CASE 
            WHEN coa.normal_balance = 'debit' THEN (ledger.debit_amount - ledger.credit_amount)
            WHEN coa.normal_balance = 'credit' THEN (ledger.credit_amount - ledger.debit_amount)
            ELSE 0
          END
        ), 0) AS ledger_balance
       FROM chart_of_accounts coa
       LEFT JOIN account_ledger ledger ON coa.account_code = ledger.account_code
         AND ledger.status = 'completed'
         AND ledger.reversed_at IS NULL
         ${dateFilter}
       WHERE coa.account_code = $1
         AND coa.is_active = TRUE
         AND coa.deleted_at IS NULL
       GROUP BY coa.id, coa.account_code, coa.account_name, coa.opening_balance, coa.current_balance, coa.normal_balance, coa.is_active`,
      params
    );

    if (result.rows.length === 0) {
      console.warn(`⚠️  Account ${accountCode} not found or inactive. Balance will show as 0.`);
      console.warn(`   Please ensure account ${accountCode} exists in Chart of Accounts.`);
      return 0;
    }

    const row = result.rows[0];
    const calculatedBalance = parseFloat(row.opening_balance || 0) + parseFloat(row.ledger_balance || 0);
    const dbBalance = parseFloat(row.current_balance || 0);
    const discrepancy = Math.abs(dbBalance - calculatedBalance);

    if (discrepancy > 0.01) {
      console.warn(`⚠️  Balance mismatch for account ${accountCode} (${row.account_name})`);
      console.warn(`   Current Balance in DB: ${row.current_balance}`);
      console.warn(`   Calculated Balance: ${calculatedBalance}`);
      if (opts.useDbFallback && discrepancy > 1) {
        console.warn(`   Using DB balance for balance sheet (ledger may be incomplete).`);
        return dbBalance;
      }
      console.warn(`   This may indicate the account balance needs to be recalculated.`);
    }

    return calculatedBalance;
  }

  /**
   * Get customer balance from ledger
   * Only includes AR account (1100) entries - single source of truth
   */
  static async getCustomerBalance(customerId, asOfDate = null) {
    console.log(`Calculating balance for customer: ${customerId}`);
    const dateFilter = asOfDate
      ? 'AND transaction_date <= $2'
      : '';

    const params = [customerId];
    if (asOfDate) params.push(asOfDate);

    // Get opening balance
    const customerResult = await query(
      'SELECT opening_balance FROM customers WHERE id = $1',
      [customerId]
    );
    const openingBalance = parseFloat(customerResult.rows[0]?.opening_balance || 0);
    console.log(`Opening balance for ${customerId}: ${openingBalance}`);

    // Get ledger balance from AR account only (1100)
    // AR accounts: debit increases balance, credit decreases balance
    const ledgerResult = await query(
      `SELECT COALESCE(SUM(debit_amount - credit_amount), 0) AS balance
       FROM account_ledger
       WHERE customer_id = $1
         AND account_code = '1100'
         AND status = 'completed'
         AND reversed_at IS NULL
         AND (reference_type IS NULL OR reference_type <> 'customer_opening_balance')
         ${dateFilter}`,
      params
    );

    const ledgerBalance = parseFloat(ledgerResult.rows[0]?.balance || 0);
    console.log(`Ledger balance for ${customerId}: ${ledgerBalance}`);
    const totalBalance = openingBalance + ledgerBalance;
    console.log(`Total balance for ${customerId}: ${totalBalance}`);
    return totalBalance;
  }

  /**
   * Get supplier balance from ledger
   * Only includes AP account (2000) entries - single source of truth.
   * Uses supplier opening_balance + ledger, but excludes ledger rows with reference_type = 'supplier_opening_balance'
   * so we don't double-count (that amount is already in suppliers.opening_balance).
   */
  static async getSupplierBalance(supplierId, asOfDate = null) {
    const dateFilter = asOfDate
      ? 'AND l.transaction_date <= $2'
      : '';

    const params = [supplierId];
    if (asOfDate) params.push(asOfDate);

    const result = await query(
      `SELECT 
        s.opening_balance,
        COALESCE(SUM(l.credit_amount - l.debit_amount), 0) AS ledger_balance
       FROM suppliers s
       LEFT JOIN account_ledger l ON s.id = l.supplier_id
         AND l.account_code = '2000'
         AND l.status = 'completed'
         AND l.reversed_at IS NULL
         AND (l.reference_type IS NULL OR l.reference_type <> 'supplier_opening_balance')
         ${dateFilter}
       WHERE s.id = $1
       GROUP BY s.id, s.opening_balance`,
      params
    );

    if (result.rows.length === 0) {
      return 0;
    }

    const row = result.rows[0];
    return parseFloat(row.opening_balance || 0) + parseFloat(row.ledger_balance || 0);
  }

  /**
   * Post or update supplier opening balance in account ledger
   * Reverses any existing opening balance entry, then posts new amount if non-zero
   * @param {string} supplierId - Supplier UUID
   * @param {number} amount - Opening balance (positive = we owe, negative = advance)
   * @param {Object} options - { createdBy, transactionDate, client }
   */
  static async postSupplierOpeningBalance(supplierId, amount, options = {}) {
    const { createdBy, transactionDate, client } = options;
    const amt = parseFloat(amount) || 0;

    const runInTransaction = async (clientToUse) => {
      const q = clientToUse.query.bind(clientToUse);

      // Reverse any existing supplier opening balance entries
      await this.reverseLedgerEntriesByReference('supplier_opening_balance', supplierId, clientToUse);

      if (Math.abs(amt) < 0.01) return; // Nothing to post

      const codes = await this.getDefaultAccountCodes();
      const refNum = `OB-${supplierId.substring(0, 8)}`;
      const txnDate = transactionDate || new Date();

      if (amt > 0) {
        // Positive: we owe supplier - Credit AP (2000), Debit Retained Earnings (3100)
        await this.createTransaction(
          { accountCode: codes.accountsPayable, creditAmount: amt, description: 'Supplier opening balance (payable)' },
          { accountCode: '3100', debitAmount: amt, description: 'Supplier opening balance (equity offset)' },
          {
            referenceType: 'supplier_opening_balance',
            referenceId: supplierId,
            referenceNumber: refNum,
            supplierId,
            transactionDate: txnDate,
            createdBy
          },
          clientToUse
        );
      } else {
        // Negative: advance to supplier - Debit AP (2000), Credit Retained Earnings (3100)
        await this.createTransaction(
          { accountCode: codes.accountsPayable, debitAmount: Math.abs(amt), description: 'Supplier opening balance (advance)' },
          { accountCode: '3100', creditAmount: Math.abs(amt), description: 'Supplier opening balance (equity offset)' },
          {
            referenceType: 'supplier_opening_balance',
            referenceId: supplierId,
            referenceNumber: refNum,
            supplierId,
            transactionDate: txnDate,
            createdBy
          },
          clientToUse
        );
      }
    };

    if (client) {
      await runInTransaction(client);
    } else {
      await transaction(async (clientToUse) => {
        await runInTransaction(clientToUse);
      });
    }
  }

  /**
   * Post or update bank opening balance in account ledger.
   * Reverses previous bank opening entries for the bank and posts current amount.
   *
   * Double-entry policy:
   * - Positive opening: Dr Bank (1001), Cr Retained Earnings (3100)
   * - Negative opening: Dr Retained Earnings (3100), Cr Bank (1001)
   *
   * @param {string} bankId - Bank UUID
   * @param {number} amount - Opening balance amount
   * @param {Object} options - { createdBy, transactionDate, client }
   */
  static async postBankOpeningBalance(bankId, amount, options = {}) {
    const { createdBy, transactionDate, client } = options;
    const amt = parseFloat(amount) || 0;

    const runInTransaction = async (clientToUse) => {
      // Reverse any existing bank opening entries for this bank
      await this.reverseLedgerEntriesByReference('bank_opening_balance', bankId, clientToUse);

      // If zero after reversal, refresh balances and exit
      if (Math.abs(amt) < 0.01) {
        await this.updateAccountBalance(clientToUse, '1001');
        await this.updateAccountBalance(clientToUse, '3100');
        return;
      }

      const absAmt = Math.abs(amt);
      const refNum = `BANK-OB-${String(bankId).replace(/-/g, '').slice(0, 10)}`;
      const txnDate = transactionDate || new Date();

      if (amt > 0) {
        await this.createTransaction(
          { accountCode: '1001', debitAmount: absAmt, description: 'Bank opening balance' },
          { accountCode: '3100', creditAmount: absAmt, description: 'Bank opening balance offset (equity)' },
          {
            referenceType: 'bank_opening_balance',
            referenceId: bankId,
            referenceNumber: refNum,
            transactionDate: txnDate,
            currency: 'PKR',
            createdBy
          },
          clientToUse
        );
      } else {
        await this.createTransaction(
          { accountCode: '3100', debitAmount: absAmt, description: 'Bank opening balance offset (equity)' },
          { accountCode: '1001', creditAmount: absAmt, description: 'Bank opening balance' },
          {
            referenceType: 'bank_opening_balance',
            referenceId: bankId,
            referenceNumber: refNum,
            transactionDate: txnDate,
            currency: 'PKR',
            createdBy
          },
          clientToUse
        );
      }
    };

    if (client) {
      await runInTransaction(client);
    } else {
      await transaction(async (clientToUse) => {
        await runInTransaction(clientToUse);
      });
    }
  }

  /**
   * Display opening cash: COA column (legacy) plus non-reversed ledger lines for cash_opening_balance.
   * After {@link postCashOpeningBalance}, COA opening for 1000 is zero and the amount lives on the ledger.
   */
  static async getCashOpeningBalanceForDisplay() {
    const coaRes = await query(
      `SELECT COALESCE(opening_balance, 0) AS ob
       FROM chart_of_accounts WHERE account_code = '1000' AND deleted_at IS NULL LIMIT 1`
    );
    const coaOpening = parseFloat(coaRes.rows[0]?.ob || 0);
    const legRes = await query(
      `SELECT COALESCE(SUM(debit_amount - credit_amount), 0) AS net
       FROM account_ledger
       WHERE account_code = '1000'
         AND reference_type = 'cash_opening_balance'
         AND status = 'completed'
         AND reversed_at IS NULL`
    );
    const ledgerOpening = parseFloat(legRes.rows[0]?.net || 0);
    return coaOpening + ledgerOpening;
  }

  /**
   * Post or update cash-on-hand opening balance in account ledger (single GL cash account 1000).
   * Reverses prior cash_opening_balance rows for the cash COA row, clears COA opening_balance on 1000
   * so totals stay consistent with {@link getAccountBalance} (opening is not double-counted).
   *
   * Double-entry policy (same pattern as bank, account 1001):
   * - Positive opening: Dr Cash (1000), Cr Retained Earnings (3100)
   * - Negative opening: Dr Retained Earnings (3100), Cr Cash (1000)
   *
   * @param {number} amount - Opening cash amount
   * @param {Object} options - { createdBy, transactionDate, client }
   */
  static async postCashOpeningBalance(amount, options = {}) {
    const { createdBy, transactionDate, client } = options;
    const amt = parseFloat(amount) || 0;

    const runInTransaction = async (clientToUse) => {
      const cashCoa = await clientToUse.query(
        `SELECT id FROM chart_of_accounts WHERE account_code = '1000' AND deleted_at IS NULL LIMIT 1`
      );
      if (!cashCoa.rows[0]) {
        throw new Error('Cash account (1000) not found in chart of accounts');
      }
      const cashAccountId = cashCoa.rows[0].id;

      await this.reverseLedgerEntriesByReference('cash_opening_balance', cashAccountId, clientToUse);

      await clientToUse.query(
        `UPDATE chart_of_accounts SET opening_balance = 0, updated_at = CURRENT_TIMESTAMP
         WHERE account_code = '1000' AND deleted_at IS NULL`
      );

      if (Math.abs(amt) < 0.01) {
        await this.updateAccountBalance(clientToUse, '1000');
        await this.updateAccountBalance(clientToUse, '3100');
        return;
      }

      const absAmt = Math.abs(amt);
      const refNum = `CASH-OB-${String(cashAccountId).replace(/-/g, '').slice(0, 10)}`;
      const txnDate = transactionDate || new Date();

      if (amt > 0) {
        await this.createTransaction(
          { accountCode: '1000', debitAmount: absAmt, description: 'Cash opening balance' },
          { accountCode: '3100', creditAmount: absAmt, description: 'Cash opening balance offset (equity)' },
          {
            referenceType: 'cash_opening_balance',
            referenceId: cashAccountId,
            referenceNumber: refNum,
            transactionDate: txnDate,
            currency: 'PKR',
            createdBy
          },
          clientToUse
        );
      } else {
        await this.createTransaction(
          { accountCode: '3100', debitAmount: absAmt, description: 'Cash opening balance offset (equity)' },
          { accountCode: '1000', creditAmount: absAmt, description: 'Cash opening balance' },
          {
            referenceType: 'cash_opening_balance',
            referenceId: cashAccountId,
            referenceNumber: refNum,
            transactionDate: txnDate,
            currency: 'PKR',
            createdBy
          },
          clientToUse
        );
      }
    };

    if (client) {
      await runInTransaction(client);
    } else {
      await transaction(async (clientToUse) => {
        await runInTransaction(clientToUse);
      });
    }
  }

  /**
   * Post or update customer opening balance in account ledger.
   * Reverses previous customer opening entries for the customer and posts current amount.
   *
   * Double-entry policy:
   * - Positive opening (customer owes us): Dr AR (1100), Cr Retained Earnings (3100)
   * - Negative opening (we owe customer/advance): Dr Retained Earnings (3100), Cr AR (1100)
   *
   * @param {string} customerId - Customer UUID
   * @param {number} amount - Opening balance amount
   * @param {Object} options - { createdBy, transactionDate, client }
   */
  static async postCustomerOpeningBalance(customerId, amount, options = {}) {
    const { createdBy, transactionDate, client } = options;
    const amt = parseFloat(amount) || 0;

    const runInTransaction = async (clientToUse) => {
      await this.reverseLedgerEntriesByReference('customer_opening_balance', customerId, clientToUse);

      if (Math.abs(amt) < 0.01) {
        await this.updateAccountBalance(clientToUse, '1100');
        await this.updateAccountBalance(clientToUse, '3100');
        return;
      }

      const absAmt = Math.abs(amt);
      const refNum = `CUST-OB-${String(customerId).replace(/-/g, '').slice(0, 10)}`;
      const txnDate = transactionDate || new Date();

      if (amt > 0) {
        await this.createTransaction(
          { accountCode: '1100', debitAmount: absAmt, description: 'Customer opening balance (receivable)' },
          { accountCode: '3100', creditAmount: absAmt, description: 'Customer opening balance offset (equity)' },
          {
            referenceType: 'customer_opening_balance',
            referenceId: customerId,
            referenceNumber: refNum,
            customerId,
            transactionDate: txnDate,
            currency: 'PKR',
            createdBy
          },
          clientToUse
        );
      } else {
        await this.createTransaction(
          { accountCode: '3100', debitAmount: absAmt, description: 'Customer opening balance offset (equity)' },
          { accountCode: '1100', creditAmount: absAmt, description: 'Customer opening balance (advance)' },
          {
            referenceType: 'customer_opening_balance',
            referenceId: customerId,
            referenceNumber: refNum,
            customerId,
            transactionDate: txnDate,
            currency: 'PKR',
            createdBy
          },
          clientToUse
        );
      }
    };

    if (client) {
      await runInTransaction(client);
    } else {
      await transaction(async (clientToUse) => {
        await runInTransaction(clientToUse);
      });
    }
  }

  /**
   * Post product opening stock to the ledger (new product registration with initial quantity).
   * Dr Inventory (1200), Cr Retained Earnings (3100) — same equity offset pattern as customer/bank opening balances.
   *
   * @param {string} productId - Product UUID
   * @param {number} quantity - Opening stock quantity (units)
   * @param {number} unitCost - Cost per unit (from product pricing.cost)
   * @param {Object} options - { createdBy, transactionDate, client }
   */
  static async postProductOpeningStock(productId, quantity, unitCost, options = {}) {
    const { createdBy, transactionDate, client } = options;
    const qty = Math.max(0, parseFloat(quantity) || 0);
    const cost = Math.max(0, parseFloat(unitCost) || 0);
    const amount = Math.round(qty * cost * 100) / 100;
    const refId = String(productId);

    const runInTransaction = async (clientToUse) => {
      await this.reverseLedgerEntriesByReference('product_opening_stock', refId, clientToUse);

      if (amount < 0.01) {
        await this.updateAccountBalance(clientToUse, '1200');
        await this.updateAccountBalance(clientToUse, '3100');
        return;
      }

      const refNum = `PROD-OB-${refId.replace(/-/g, '').slice(0, 10)}`;
      const txnDate = transactionDate || new Date();

      await this.createTransaction(
        { accountCode: '1200', debitAmount: amount, description: 'Product opening stock (inventory)' },
        { accountCode: '3100', creditAmount: amount, description: 'Product opening stock (equity offset)' },
        {
          referenceType: 'product_opening_stock',
          referenceId: refId,
          referenceNumber: refNum,
          transactionDate: txnDate,
          currency: 'PKR',
          createdBy: isValidUuid(createdBy) ? createdBy : null
        },
        clientToUse
      );
    };

    if (client) {
      await runInTransaction(client);
    } else {
      await transaction(async (clientToUse) => {
        await runInTransaction(clientToUse);
      });
    }
  }

  /**
   * Post manual stock adjustment to the ledger.
   * If qty delta > 0: Dr Inventory (1200), Cr Retained Earnings (3100)
   * If qty delta < 0: Dr Retained Earnings (3100), Cr Inventory (1200)
   *
   * @param {string} productId - Product UUID
   * @param {number} deltaQty - Change in quantity (positive for increase, negative for decrease)
   * @param {number} unitCost - Cost per unit
   * @param {Object} options - { createdBy, transactionDate, reason, client }
   */
  static async recordStockAdjustment(productId, deltaQty, unitCost, options = {}) {
    const { createdBy, transactionDate, reason, client } = options;
    const delta = parseFloat(deltaQty) || 0;
    if (Math.abs(delta) < 0.0001) return;

    const cost = Math.max(0, parseFloat(unitCost) || 0);
    const amount = Math.abs(Math.round(delta * cost * 100) / 100);
    const refId = String(productId);
    const txnDate = transactionDate || new Date();
    const desc = reason || (delta > 0 ? 'Manual Stock Increase' : 'Manual Stock Decrease');

    const runInTransaction = async (clientToUse) => {
      if (delta > 0) {
        // Increase: Debit Inventory, Credit Retained Earnings
        await this.createTransaction(
          { accountCode: '1200', debitAmount: amount, description: `${desc} (${delta} units)` },
          { accountCode: '3100', creditAmount: amount, description: 'Inventory Adjustment Offset' },
          {
            referenceType: 'inventory_adjustment',
            referenceId: refId,
            referenceNumber: `ADJ-${Date.now()}`,
            transactionDate: txnDate,
            currency: 'PKR',
            createdBy
          },
          clientToUse
        );
      } else {
        // Decrease: Debit Retained Earnings, Credit Inventory
        await this.createTransaction(
          { accountCode: '3100', debitAmount: amount, description: 'Inventory Adjustment Offset' },
          { accountCode: '1200', creditAmount: amount, description: `${desc} (${Math.abs(delta)} units)` },
          {
            referenceType: 'inventory_adjustment',
            referenceId: refId,
            referenceNumber: `ADJ-${Date.now()}`,
            transactionDate: txnDate,
            currency: 'PKR',
            createdBy
          },
          clientToUse
        );
      }
    };

    if (client) {
      await runInTransaction(client);
    } else {
      await transaction(async (clientToUse) => {
        await runInTransaction(clientToUse);
      });
    }
  }


  /**
   * Reverse product opening stock ledger entries (e.g. when product is deleted).
   * @param {string} productId - Product UUID
   * @param {Object} options - { client }
   */
  static async removeProductOpeningStockLedger(productId, options = {}) {
    const { client } = options;
    const refId = String(productId);

    const runInTransaction = async (clientToUse) => {
      await this.reverseLedgerEntriesByReference('product_opening_stock', refId, clientToUse);
      await this.updateAccountBalance(clientToUse, '1200');
      await this.updateAccountBalance(clientToUse, '3100');
    };

    if (client) {
      await runInTransaction(client);
    } else {
      await transaction(async (clientToUse) => {
        await runInTransaction(clientToUse);
      });
    }
  }

  /**
   * Reverse ledger entries by reference (for edits - mark old entries as reversed)
   * @param {string} referenceType - e.g. 'cash_receipt', 'cash_payment', 'bank_receipt', 'bank_payment'
   * @param {string} referenceId - UUID of the receipt/payment
   * @param {Object} client - Optional PostgreSQL client for transaction
   */
  static async reverseLedgerEntriesByReference(referenceType, referenceId, client = null) {
    const q = client ? client.query.bind(client) : query;
    await q(
      `UPDATE account_ledger 
       SET reversed_at = CURRENT_TIMESTAMP 
       WHERE reference_type = $1 AND reference_id::text = $2 AND reversed_at IS NULL`,
      [referenceType, String(referenceId)]
    );
  }

  /**
   * Re-assign ledger entries to a different customer for a sale edit.
   * Updates both sale and sale_payment entries for the sale reference.
   * @param {string} saleId
   * @param {string|null} customerId
   */
  static async updateLedgerCustomerForSale(saleId, customerId) {
    await query(
      `UPDATE account_ledger
       SET customer_id = $1
       WHERE reference_id::text = $2
         AND reference_type IN ('sale', 'sale_payment')`,
      [customerId || null, String(saleId)]
    );
  }

  /**
   * Check if a sale already has ledger entries (reference_type = 'sale').
   * @param {string} saleId
   * @returns {Promise<boolean>}
   */
  static async hasSaleLedgerEntries(saleId) {
    const result = await query(
      `SELECT 1 FROM account_ledger
       WHERE reference_type = 'sale'
         AND reference_id::text = $1
         AND reversed_at IS NULL
       LIMIT 1`,
      [String(saleId)]
    );
    return result.rows.length > 0;
  }

  /**
   * Update sale ledger entries (AR/Revenue amounts + common fields).
   * Keeps COGS/Inventory entries intact to avoid losing cost data.
   * @param {object} params
   * @param {string} params.saleId
   * @param {number} params.total
   * @param {Date|string} [params.transactionDate]
   * @param {string|null} [params.customerId]
   * @param {string} [params.referenceNumber]
   */
  static async updateSaleLedgerEntries(params) {
    const { saleId, total, transactionDate, customerId, referenceNumber } = params || {};
    const saleIdStr = String(saleId);
    const updates = [];
    const values = [saleIdStr];
    let idx = 2;

    if (transactionDate) {
      updates.push(`transaction_date = $${idx++}`);
      values.push(transactionDate);
    }
    if (customerId !== undefined) {
      updates.push(`customer_id = $${idx++}`);
      values.push(customerId || null);
    }
    if (referenceNumber) {
      updates.push(`reference_number = $${idx++}`);
      values.push(referenceNumber);
    }

    if (updates.length > 0) {
      await query(
        `UPDATE account_ledger
         SET ${updates.join(', ')}
         WHERE reference_type = 'sale'
           AND reference_id::text = $1
           AND reversed_at IS NULL`,
        values
      );
    }

    const totalAmount = parseFloat(total) || 0;
    const refNum = referenceNumber || saleIdStr;
    await query(
      `UPDATE account_ledger
       SET debit_amount = CASE WHEN account_code = '1100' THEN $2 ELSE debit_amount END,
           credit_amount = CASE WHEN account_code = '4000' THEN $2 ELSE credit_amount END,
           description = CASE
             WHEN account_code = '1100' THEN $3
             WHEN account_code = '4000' THEN $4
             ELSE description
           END
       WHERE reference_type = 'sale'
         AND reference_id::text = $1
         AND reversed_at IS NULL
         AND account_code IN ('1100', '4000')`,
      [saleIdStr, totalAmount, `Sale: ${refNum}`, `Sale Revenue: ${refNum}`]
    );
  }

  /**
   * Check if a purchase invoice already has ledger entries (reference_type = 'purchase_invoice').
   * @param {string} invoiceId
   * @returns {Promise<boolean>}
   */
  static async hasPurchaseInvoiceLedgerEntries(invoiceId) {
    const result = await query(
      `SELECT 1 FROM account_ledger
       WHERE reference_type = 'purchase_invoice'
         AND reference_id::text = $1
         AND reversed_at IS NULL
       LIMIT 1`,
      [String(invoiceId)]
    );
    return result.rows.length > 0;
  }

  /**
   * Check if a purchase invoice has payment ledger entries.
   * @param {string} invoiceId
   * @returns {Promise<boolean>}
   */
  static async hasPurchaseInvoicePaymentEntries(invoiceId) {
    const result = await query(
      `SELECT 1 FROM account_ledger
       WHERE reference_type = 'purchase_invoice_payment'
         AND reference_id::text = $1
         AND reversed_at IS NULL
       LIMIT 1`,
      [String(invoiceId)]
    );
    return result.rows.length > 0;
  }

  /**
   * Update purchase invoice ledger entries (Inventory/AP + optional payment).
   * @param {object} params
   * @param {string} params.invoiceId
   * @param {number} params.total
   * @param {Date|string} [params.transactionDate]
   * @param {string|null} [params.supplierId]
   * @param {string} [params.referenceNumber]
   * @param {number} [params.paidAmount]
   * @param {string} [params.paymentMethod]
   */
  static async updatePurchaseInvoiceLedgerEntries(params) {
    const {
      invoiceId,
      total,
      transactionDate,
      supplierId,
      referenceNumber,
      paidAmount,
      paymentMethod
    } = params || {};
    const invoiceIdStr = String(invoiceId);
    const updates = [];
    const values = [invoiceIdStr];
    let idx = 2;

    if (transactionDate) {
      updates.push(`transaction_date = $${idx++}`);
      values.push(transactionDate);
    }
    if (supplierId !== undefined) {
      updates.push(`supplier_id = $${idx++}`);
      values.push(supplierId || null);
    }
    if (referenceNumber) {
      updates.push(`reference_number = $${idx++}`);
      values.push(referenceNumber);
    }

    if (updates.length > 0) {
      await query(
        `UPDATE account_ledger
         SET ${updates.join(', ')}
         WHERE reference_type = 'purchase_invoice'
           AND reference_id::text = $1
           AND reversed_at IS NULL`,
        values
      );
    }

    const totalAmount = parseFloat(total) || 0;
    const refNum = referenceNumber || invoiceIdStr;
    await query(
      `UPDATE account_ledger
       SET debit_amount = CASE WHEN account_code = '1200' THEN $2 ELSE debit_amount END,
           credit_amount = CASE WHEN account_code = '2000' THEN $2 ELSE credit_amount END,
           description = CASE
             WHEN account_code = '1200' THEN $3
             WHEN account_code = '2000' THEN $4
             ELSE description
           END
       WHERE reference_type = 'purchase_invoice'
         AND reference_id::text = $1
         AND reversed_at IS NULL
         AND account_code IN ('1200', '2000')`,
      [invoiceIdStr, totalAmount, `Purchase Invoice: ${refNum}`, `Purchase Invoice on Credit: ${refNum}`]
    );

    if (paidAmount !== undefined && paidAmount !== null) {
      const paymentAccount = (paymentMethod === 'bank' || paymentMethod === 'bank_transfer') ? '1001' : '1000';
      const payAmt = parseFloat(paidAmount) || 0;
      const payUpdates = [];
      const payValues = [invoiceIdStr];
      let payIdx = 2;
      if (transactionDate) {
        payUpdates.push(`transaction_date = $${payIdx++}`);
        payValues.push(transactionDate);
      }
      if (supplierId !== undefined) {
        payUpdates.push(`supplier_id = $${payIdx++}`);
        payValues.push(supplierId || null);
      }
      if (referenceNumber) {
        payUpdates.push(`reference_number = $${payIdx++}`);
        payValues.push(referenceNumber);
      }
      if (payUpdates.length > 0) {
        await query(
          `UPDATE account_ledger
           SET ${payUpdates.join(', ')}
           WHERE reference_type = 'purchase_invoice_payment'
             AND reference_id::text = $1
             AND reversed_at IS NULL`,
          payValues
        );
      }
      await query(
        `UPDATE account_ledger
         SET debit_amount = CASE WHEN account_code = '2000' THEN $2 ELSE debit_amount END,
             credit_amount = CASE WHEN account_code IN ('1000','1001') THEN CASE WHEN account_code = $3 THEN $2 ELSE 0 END ELSE credit_amount END,
             description = CASE
               WHEN account_code = '2000' THEN $4
               WHEN account_code IN ('1000','1001') THEN $5
               ELSE description
             END
         WHERE reference_type = 'purchase_invoice_payment'
           AND reference_id::text = $1
           AND reversed_at IS NULL
           AND account_code IN ('2000','1000','1001')`,
        [invoiceIdStr, payAmt, paymentAccount, `Payment for Invoice: ${refNum}`, `Payment for Purchase Invoice: ${refNum}`]
      );
    }
  }

  /**
   * Record cash receipt transaction (Unified: Customer or Supplier)
   * Business Meaning: Money received INTO the business
   * 
   * If partyType = customer:
   *   Dr Cash (1000) [amount]
   *   Cr Accounts Receivable (1100) [amount]
   * 
   * If partyType = supplier:
   *   Dr Cash (1000) [amount]
   *   Cr Accounts Payable (2000) [amount]
   * 
   * @param {Object} cashReceipt - Cash receipt data
   * @param {Object} client - Optional PostgreSQL client for existing transaction
   */
  static async recordCashReceipt(cashReceipt, client = null) {
    const customerId = cashReceipt.customer_id || cashReceipt.customerId;
    const supplierId = cashReceipt.supplier_id || cashReceipt.supplierId;
    const amount = parseFloat(cashReceipt.amount);

    // Validation: Must have either customer or supplier, not both
    if (customerId && supplierId) {
      throw new Error('Cash receipt must be for either a customer OR a supplier, not both');
    }
    if (!customerId && !supplierId) {
      throw new Error('Cash receipt must specify either a customer or a supplier');
    }

    // Determine party type and account
    const partyType = customerId ? 'customer' : 'supplier';
    const partyId = customerId || supplierId;
    const creditAccount = customerId ? '1100' : '2000'; // AR for customer, AP for supplier

    // Entry 1: Debit Cash Account (1000)
    const entry1 = {
      accountCode: '1000', // Cash Account
      debitAmount: amount,
      creditAmount: 0,
      description: `Cash Receipt: ${cashReceipt.receipt_number || cashReceipt.receiptNumber || cashReceipt.id}`
    };

    // Entry 2: Credit AR (1100) for customer OR AP (2000) for supplier
    const entry2 = {
      accountCode: creditAccount,
      debitAmount: 0,
      creditAmount: amount,
      description: customerId
        ? `Payment from Customer: ${cashReceipt.receipt_number || cashReceipt.receiptNumber}`
        : `Refund/Advance from Supplier: ${cashReceipt.receipt_number || cashReceipt.receiptNumber}`
    };

    return await this.createTransaction(entry1, entry2, {
      referenceType: 'cash_receipt',
      referenceId: cashReceipt.id,
      referenceNumber: cashReceipt.receipt_number || cashReceipt.receiptNumber,
      customerId: customerId || null,
      supplierId: supplierId || null,
      partyType: partyType,
      partyId: partyId,
      transactionDate: cashReceipt.date || cashReceipt.transactionDate || new Date(),
      currency: 'PKR',
      createdBy: cashReceipt.created_by || cashReceipt.createdBy
    }, client);
  }

  /**
   * Record bank receipt transaction (Unified: Customer or Supplier)
   * Business Meaning: Money received INTO the business via bank
   * 
   * If partyType = customer:
   *   Dr Bank (1001) [amount]
   *   Cr Accounts Receivable (1100) [amount]
   * 
   * If partyType = supplier:
   *   Dr Bank (1001) [amount]
   *   Cr Accounts Payable (2000) [amount]
   * 
   * @param {Object} bankReceipt - Bank receipt data
   * @param {Object} client - Optional PostgreSQL client for existing transaction
   */
  static async recordBankReceipt(bankReceipt, client = null) {
    const customerId = bankReceipt.customer_id || bankReceipt.customerId;
    const supplierId = bankReceipt.supplier_id || bankReceipt.supplierId;
    const amount = parseFloat(bankReceipt.amount);

    // Validation: Must have either customer or supplier, not both
    if (customerId && supplierId) {
      throw new Error('Bank receipt must be for either a customer OR a supplier, not both');
    }
    if (!customerId && !supplierId) {
      throw new Error('Bank receipt must specify either a customer or a supplier');
    }

    // Determine party type and account
    const partyType = customerId ? 'customer' : 'supplier';
    const partyId = customerId || supplierId;
    const creditAccount = customerId ? '1100' : '2000'; // AR for customer, AP for supplier

    // Entry 1: Debit Bank Account (1001)
    const entry1 = {
      accountCode: '1001', // Bank Account
      debitAmount: amount,
      creditAmount: 0,
      description: `Bank Receipt: ${bankReceipt.receipt_number || bankReceipt.receiptNumber || bankReceipt.id}`
    };

    // Entry 2: Credit AR (1100) for customer OR AP (2000) for supplier
    const entry2 = {
      accountCode: creditAccount,
      debitAmount: 0,
      creditAmount: amount,
      description: customerId
        ? `Payment from Customer: ${bankReceipt.receipt_number || bankReceipt.receiptNumber}`
        : `Refund/Advance from Supplier: ${bankReceipt.receipt_number || bankReceipt.receiptNumber}`
    };

    return await this.createTransaction(entry1, entry2, {
      referenceType: 'bank_receipt',
      referenceId: bankReceipt.id,
      referenceNumber: bankReceipt.receipt_number || bankReceipt.receiptNumber,
      customerId: customerId || null,
      supplierId: supplierId || null,
      partyType: partyType,
      partyId: partyId,
      transactionDate: bankReceipt.date || bankReceipt.transactionDate || new Date(),
      currency: 'PKR',
      createdBy: bankReceipt.created_by || bankReceipt.createdBy
    }, client);
  }

  /**
   * Record expense cash payment (Record Expense: no customer/supplier)
   * Business Meaning: Money paid OUT for operating expense
   *   Dr Expense Account (from chart_of_accounts id) [amount]
   *   Cr Cash (1000) [amount]
   *
   * @param {Object} cashPayment - Cash payment data (id, amount, date, payment_number, etc.)
   * @param {string} expenseAccountId - UUID of expense account in chart_of_accounts
   * @param {Object} client - Optional PostgreSQL client for existing transaction
   */
  static async recordExpenseCashPayment(cashPayment, expenseAccountId, client = null) {
    const q = client ? client.query.bind(client) : query;
    const accountResult = await q(
      'SELECT account_code, allow_direct_posting FROM chart_of_accounts WHERE id = $1 AND is_active = TRUE AND deleted_at IS NULL',
      [expenseAccountId]
    );
    if (!accountResult.rows.length) {
      throw new Error('Expense account not found or inactive');
    }
    const expenseAccountCode = accountResult.rows[0].account_code;
    const amount = parseFloat(cashPayment.amount);
    const refNum = cashPayment.payment_number || cashPayment.paymentNumber || cashPayment.id;

    const entry1 = {
      accountCode: expenseAccountCode,
      debitAmount: amount,
      creditAmount: 0,
      description: `Expense: ${cashPayment.particular || refNum}`
    };
    const entry2 = {
      accountCode: '1000',
      debitAmount: 0,
      creditAmount: amount,
      description: `Cash Payment: ${refNum}`
    };

    return await this.createTransaction(entry1, entry2, {
      referenceType: 'cash_payment',
      referenceId: cashPayment.id,
      referenceNumber: refNum,
      customerId: null,
      supplierId: null,
      transactionDate: cashPayment.date || cashPayment.transactionDate || new Date(),
      currency: 'PKR',
      createdBy: cashPayment.created_by || cashPayment.createdBy
    }, client);
  }

  /**
   * Investor payout: reduce equity or liability (debit), reduce cash or bank (credit).
   * Default debit is Retained Earnings (3100); optional 2350 Due to Investors if you accrue payables on the ledger.
   * @param {object} ctx
   * @param {string} ctx.investorPayoutId - UUID of investor_payouts row (ledger reference_id)
   * @param {string} ctx.investorId
   * @param {string} ctx.investorName
   * @param {number} ctx.amount
   * @param {'cash'|'bank'} ctx.paymentMethod
   * @param {string} ctx.debitAccountCode - equity or liability account
   * @param {Date} [ctx.transactionDate]
   * @param {string} [ctx.createdBy]
   * @param {object} client - pg client when part of outer transaction
   */
  static async recordInvestorPayout(ctx, client = null) {
    const {
      investorPayoutId,
      investorId,
      investorName,
      amount,
      paymentMethod,
      debitAccountCode,
      transactionDate,
      createdBy
    } = ctx;

    if (!investorPayoutId) {
      throw new Error('investorPayoutId is required for investor payout ledger posting');
    }

    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      throw new Error('Invalid amount for investor payout ledger posting');
    }

    const method = paymentMethod === 'bank' ? 'bank' : 'cash';
    const creditAccount = method === 'bank' ? '1001' : '1000';
    const debit = String(debitAccountCode || '3100').toUpperCase();

    const qf = client ? client.query.bind(client) : query;
    const typeRes = await qf(
      `SELECT account_type FROM chart_of_accounts
       WHERE UPPER(account_code) = UPPER($1) AND deleted_at IS NULL AND is_active = TRUE`,
      [debit]
    );
    if (!typeRes.rows[0]) {
      throw new Error(`Debit account ${debit} not found or inactive`);
    }
    const accType = typeRes.rows[0].account_type;
    if (accType !== 'equity' && accType !== 'liability') {
      throw new Error(
        `Investor payout debit account must be equity or liability (e.g. 3100 Retained Earnings or 2350 Due to Investors), not ${accType}`
      );
    }

    const label = investorName || investorId || 'Investor';
    const entry1 = {
      accountCode: debit,
      debitAmount: amt,
      creditAmount: 0,
      description: `Investor payout — ${label}`
    };
    const entry2 = {
      accountCode: creditAccount,
      debitAmount: 0,
      creditAmount: amt,
      description: `Investor payout (${method}) — ${label}`
    };

    return await this.createTransaction(
      entry1,
      entry2,
      {
        referenceType: 'investor_payout',
        referenceId: investorPayoutId,
        referenceNumber: `INV-PAY-${String(investorPayoutId).replace(/-/g, '').slice(0, 12)}`,
        transactionDate: transactionDate || new Date(),
        currency: 'PKR',
        createdBy,
        status: 'completed'
      },
      client
    );
  }

  /**
   * Record cash payment transaction (Unified: Customer or Supplier)
   * Business Meaning: Money paid OUT of the business
   * 
   * If partyType = supplier:
   *   Dr Accounts Payable (2000) [amount]
   *   Cr Cash (1000) [amount]
   * 
   * If partyType = customer:
   *   Dr Accounts Receivable (1100) [amount]
   *   Cr Cash (1000) [amount]
   * 
   * @param {Object} cashPayment - Cash payment data
   * @param {Object} client - Optional PostgreSQL client for existing transaction
   */
  static async recordCashPayment(cashPayment, client = null) {
    const supplierId = cashPayment.supplier_id || cashPayment.supplierId;
    const customerId = cashPayment.customer_id || cashPayment.customerId;
    const amount = parseFloat(cashPayment.amount);

    // Validation: Must have either customer or supplier, not both (expense-only handled by recordExpenseCashPayment)
    if (customerId && supplierId) {
      throw new Error('Cash payment must be for either a customer OR a supplier, not both');
    }
    if (!customerId && !supplierId) {
      throw new Error('Cash payment must specify either a customer or a supplier');
    }

    // Determine party type and account
    const partyType = supplierId ? 'supplier' : 'customer';
    const partyId = supplierId || customerId;
    const debitAccount = supplierId ? '2000' : '1100'; // AP for supplier, AR for customer

    // Entry 1: Debit AP (2000) for supplier OR AR (1100) for customer
    const entry1 = {
      accountCode: debitAccount,
      debitAmount: amount,
      creditAmount: 0,
      description: supplierId
        ? `Payment to Supplier: ${cashPayment.payment_number || cashPayment.paymentNumber}`
        : `Refund to Customer: ${cashPayment.payment_number || cashPayment.paymentNumber}`
    };

    // Entry 2: Credit Cash Account (1000)
    const entry2 = {
      accountCode: '1000', // Cash Account
      debitAmount: 0,
      creditAmount: amount,
      description: `Cash Payment: ${cashPayment.payment_number || cashPayment.paymentNumber || cashPayment.id}`
    };

    return await this.createTransaction(entry1, entry2, {
      referenceType: 'cash_payment',
      referenceId: cashPayment.id,
      referenceNumber: cashPayment.payment_number || cashPayment.paymentNumber,
      customerId: customerId || null,
      supplierId: supplierId || null,
      partyType: partyType,
      partyId: partyId,
      transactionDate: cashPayment.date || cashPayment.transactionDate || new Date(),
      currency: 'PKR',
      createdBy: cashPayment.created_by || cashPayment.createdBy
    }, client);
  }

  /**
   * Record bank payment transaction (Unified: Customer or Supplier)
   * Business Meaning: Money paid OUT of the business via bank
   * 
   * If partyType = supplier:
   *   Dr Accounts Payable (2000) [amount]
   *   Cr Bank (1001) [amount]
   * 
   * If partyType = customer:
   *   Dr Accounts Receivable (1100) [amount]
   *   Cr Bank (1001) [amount]
   * 
   * @param {Object} bankPayment - Bank payment data
   * @param {Object} client - Optional PostgreSQL client for existing transaction
   */
  static async recordBankPayment(bankPayment, client = null) {
    const supplierId = bankPayment.supplier_id || bankPayment.supplierId;
    const customerId = bankPayment.customer_id || bankPayment.customerId;
    const amount = parseFloat(bankPayment.amount);

    // Validation: Must have either customer or supplier, not both
    if (customerId && supplierId) {
      throw new Error('Bank payment must be for either a customer OR a supplier, not both');
    }
    if (!customerId && !supplierId) {
      throw new Error('Bank payment must specify either a customer or a supplier');
    }

    // Determine party type and account
    const partyType = supplierId ? 'supplier' : 'customer';
    const partyId = supplierId || customerId;
    const debitAccount = supplierId ? '2000' : '1100'; // AP for supplier, AR for customer

    // Entry 1: Debit AP (2000) for supplier OR AR (1100) for customer
    const entry1 = {
      accountCode: debitAccount,
      debitAmount: amount,
      creditAmount: 0,
      description: supplierId
        ? `Payment to Supplier: ${bankPayment.payment_number || bankPayment.paymentNumber}`
        : `Refund to Customer: ${bankPayment.payment_number || bankPayment.paymentNumber}`
    };

    // Entry 2: Credit Bank Account (1001)
    const entry2 = {
      accountCode: '1001', // Bank Account
      debitAmount: 0,
      creditAmount: amount,
      description: `Bank Payment: ${bankPayment.payment_number || bankPayment.paymentNumber || bankPayment.id}`
    };

    return await this.createTransaction(entry1, entry2, {
      referenceType: 'bank_payment',
      referenceId: bankPayment.id,
      referenceNumber: bankPayment.payment_number || bankPayment.paymentNumber,
      customerId: customerId || null,
      supplierId: supplierId || null,
      partyType: partyType,
      partyId: partyId,
      transactionDate: bankPayment.date || bankPayment.transactionDate || new Date(),
      currency: 'PKR',
      createdBy: bankPayment.created_by || bankPayment.createdBy
    }, client);
  }

  /**
   * Record sale transaction (posts to account_ledger: AR, Revenue, and COGS/Inventory when applicable).
   * Sale object may use snake_case (from DB) or camelCase; items may have unitCost or cost_price.
   */
  static async recordSale(sale, options = {}) {
    const { client = null } = options;
    const customerId = sale.customer_id || sale.customerId;
    const total = Number(sale.total);
    if (total !== total || total < 0) {
      // NaN or negative: skip ledger posting to avoid invalid entries
      return null;
    }
    const items = Array.isArray(sale.items) ? sale.items : (sale.items ? (typeof sale.items === 'string' ? JSON.parse(sale.items) : []) : []);

    // COGS: support both unitCost (from createSale) and cost_price (from other sources)
    let totalCOGS = 0;
    for (const item of items) {
      const costPrice = parseFloat(item.unitCost ?? item.cost_price ?? 0);
      const quantity = parseFloat(item.quantity ?? 0);
      totalCOGS += costPrice * quantity;
    }

    const refNum = sale.order_number || sale.orderNumber || sale.id;
    const txnDate = sale.sale_date || sale.saleDate || sale.created_at || sale.createdAt || new Date();
    const createdBy = sale.created_by || sale.createdBy;

    const runInTransaction = async (clientToUse) => {
      // 1. Debit: Accounts Receivable, Credit: Sales Revenue (only if total > 0)
      if (total > 0) {
        await this.createTransaction(
          {
            accountCode: '1100', // AR
            debitAmount: total,
            creditAmount: 0,
            description: `Sale: ${refNum}`
          },
          {
            accountCode: '4000', // Sales Revenue
            debitAmount: 0,
            creditAmount: total,
            description: `Sale Revenue: ${refNum}`
          },
          {
            referenceType: 'sale',
            referenceId: sale.id,
            referenceNumber: refNum,
            customerId: customerId,
            currency: 'PKR',
            transactionDate: txnDate,
            createdBy: createdBy
          },
          clientToUse
        );
      }

      // 2. Debit: COGS, Credit: Inventory (if items have cost)
      if (totalCOGS > 0) {
        await this.createTransaction(
          {
            accountCode: '5000', // COGS
            debitAmount: totalCOGS,
            creditAmount: 0,
            description: `COGS for Sale: ${refNum}`
          },
          {
            accountCode: '1200', // Inventory
            debitAmount: 0,
            creditAmount: totalCOGS,
            description: `Inventory Reduction: ${refNum}`
          },
          {
            referenceType: 'sale',
            referenceId: sale.id,
            referenceNumber: refNum,
            currency: 'PKR',
            transactionDate: txnDate,
            createdBy: createdBy
          },
          clientToUse
        );
      }
      return { ok: true };
    };

    if (client) return await runInTransaction(client);
    return await transaction(async (newClient) => {
      return await runInTransaction(newClient);
    });
  }

  /**
   * Record sale payment adjustment when amount received is changed on edit.
   * Posts the delta to account_ledger so balance reflects the change.
   * - Delta > 0: Dr Cash/Bank, Cr AR (payment received)
   * - Delta < 0: Dr AR, Cr Cash/Bank (reversal)
   * @param {Object} params - { saleId, orderNumber, customerId, oldAmountPaid, newAmountPaid, paymentMethod, createdBy }
   */
  static async recordSalePaymentAdjustment(params, options = {}) {
    const { client = null } = options;
    const { saleId, orderNumber, customerId, oldAmountPaid, newAmountPaid, paymentMethod = 'cash', createdBy } = params;
    const oldAmt = parseFloat(oldAmountPaid) || 0;
    const newAmt = parseFloat(newAmountPaid) || 0;
    const delta = newAmt - oldAmt;
    if (Math.abs(delta) < 0.01) return { ok: true };

    const refNum = orderNumber || saleId;
    const debitAccount = (paymentMethod === 'bank' || paymentMethod === 'bank_transfer') ? '1001' : '1000';
    const creditAccount = '1100'; // AR

    if (delta > 0) {
      // Payment received: Dr Cash/Bank, Cr AR
      return await this.createTransaction(
        { accountCode: debitAccount, debitAmount: delta, creditAmount: 0, description: `Sale payment (edit): ${refNum}` },
        { accountCode: creditAccount, debitAmount: 0, creditAmount: delta, description: `Payment for sale: ${refNum}` },
        { referenceType: 'sale_payment', referenceId: saleId, referenceNumber: refNum, customerId: customerId || null, currency: 'PKR', createdBy },
        client
      );
    } else {
      // Reversal: Dr AR, Cr Cash/Bank
      const absDelta = Math.abs(delta);
      return await this.createTransaction(
        { accountCode: creditAccount, debitAmount: absDelta, creditAmount: 0, description: `Sale payment reversal (edit): ${refNum}` },
        { accountCode: debitAccount, debitAmount: 0, creditAmount: absDelta, description: `Reversal for sale: ${refNum}` },
        { referenceType: 'sale_payment', referenceId: saleId, referenceNumber: refNum, customerId: customerId || null, currency: 'PKR', createdBy },
        client
      );
    }
  }

  /**
   * Record purchase payment adjustment when amount paid is changed on edit.
   * Posts the delta to account_ledger so balance reflects the change.
   * - Delta > 0: Dr AP (2000), Cr Cash/Bank (payment made)
   * - Delta < 0: Dr Cash/Bank, Cr AP (reversal)
   * @param {Object} params - { invoiceId, invoiceNumber, supplierId, oldAmountPaid, newAmountPaid, paymentMethod, createdBy }
   */
  static async recordPurchasePaymentAdjustment(params) {
    const { invoiceId, invoiceNumber, supplierId, oldAmountPaid, newAmountPaid, paymentMethod = 'cash', createdBy } = params;
    const oldAmt = parseFloat(oldAmountPaid) || 0;
    const newAmt = parseFloat(newAmountPaid) || 0;
    const delta = newAmt - oldAmt;
    if (Math.abs(delta) < 0.01) return { ok: true };

    const refNum = invoiceNumber || invoiceId;
    const creditAccount = (paymentMethod === 'bank' || paymentMethod === 'bank_transfer') ? '1001' : '1000'; // Cash or Bank
    const debitAccount = '2000'; // AP

    if (delta > 0) {
      // Payment made: Dr AP, Cr Cash/Bank
      return await this.createTransaction(
        { accountCode: debitAccount, debitAmount: delta, creditAmount: 0, description: `Purchase payment (edit): ${refNum}` },
        { accountCode: creditAccount, debitAmount: 0, creditAmount: delta, description: `Payment for purchase: ${refNum}` },
        { referenceType: 'purchase_invoice_payment', referenceId: invoiceId, referenceNumber: refNum, supplierId: supplierId || null, currency: 'PKR', createdBy }
      );
    } else {
      // Reversal: Dr Cash/Bank, Cr AP
      const absDelta = Math.abs(delta);
      return await this.createTransaction(
        { accountCode: creditAccount, debitAmount: absDelta, creditAmount: 0, description: `Purchase payment reversal (edit): ${refNum}` },
        { accountCode: debitAccount, debitAmount: 0, creditAmount: absDelta, description: `Reversal for purchase: ${refNum}` },
        { referenceType: 'purchase_invoice_payment', referenceId: invoiceId, referenceNumber: refNum, supplierId: supplierId || null, currency: 'PKR', createdBy }
      );
    }
  }

  /**
   * Record purchase transaction
   */
  static async recordPurchase(purchase) {
    const supplierId = purchase.supplier_id || purchase.supplierId;
    const total = parseFloat(purchase.total);
    const items = Array.isArray(purchase.items) ? purchase.items : (purchase.items ? JSON.parse(purchase.items) : []);

    return await transaction(async (client) => {
      // 1. Debit: Inventory, Credit: Accounts Payable
      await this.createTransaction(
        {
          accountCode: '1200', // Inventory
          debitAmount: total,
          creditAmount: 0,
          description: `Purchase: ${purchase.purchase_order_number || purchase.purchaseOrderNumber || purchase.id}`
        },
        {
          accountCode: '2000', // AP
          debitAmount: 0,
          creditAmount: total,
          description: `Purchase on Credit: ${purchase.purchase_order_number || purchase.purchaseOrderNumber || purchase.id}`
        },
        {
          referenceType: 'purchase',
          referenceId: purchase.id,
          referenceNumber: purchase.purchase_order_number || purchase.purchaseOrderNumber,
          supplierId: supplierId,
          currency: 'PKR',
          createdBy: purchase.created_by || purchase.createdBy
        }
      );
    });
  }

  /**
   * Record purchase invoice transaction
   * Accounts Impacted:
   * - DEBIT: Inventory (1200) - increases inventory value
   * - CREDIT: Accounts Payable (2000) - increases what we owe to supplier
   * 
   * If payment is included at creation:
   * - DEBIT: Accounts Payable (2000) - decreases what we owe
   * - CREDIT: Cash (1000) or Bank (1001) - decreases cash/bank balance
   */
  static async recordPurchaseInvoice(purchaseInvoice) {
    const supplierId = purchaseInvoice.supplier_id || purchaseInvoice.supplierId;
    const pricing = purchaseInvoice.pricing || {};
    const total = parseFloat(pricing.total || purchaseInvoice.total || 0);
    const payment = purchaseInvoice.payment || {};
    const paidAmount = parseFloat(payment.paidAmount || payment.amount || 0);
    const paymentMethod = payment.method || 'cash';
    const invoiceNumber = purchaseInvoice.invoice_number || purchaseInvoice.invoiceNumber;

    return await transaction(async (client) => {
      // 1. Post purchase invoice: DEBIT Inventory, CREDIT Accounts Payable
      await this.createTransaction(
        {
          accountCode: '1200', // Inventory
          debitAmount: total,
          creditAmount: 0,
          description: `Purchase Invoice: ${invoiceNumber || purchaseInvoice.id}`
        },
        {
          accountCode: '2000', // Accounts Payable
          debitAmount: 0,
          creditAmount: total,
          description: `Purchase Invoice on Credit: ${invoiceNumber || purchaseInvoice.id}`
        },
        {
          referenceType: 'purchase_invoice',
          referenceId: purchaseInvoice.id,
          referenceNumber: invoiceNumber,
          supplierId: supplierId,
          transactionDate: purchaseInvoice.invoice_date || purchaseInvoice.invoiceDate || purchaseInvoice.created_at || new Date(),
          currency: 'PKR',
          createdBy: purchaseInvoice.created_by || purchaseInvoice.createdBy
        }
      );

      // 2. If payment was made at invoice creation, post payment entry
      if (paidAmount > 0) {
        const paymentAccountCode = paymentMethod === 'bank' || paymentMethod === 'bank_transfer' ? '1001' : '1000'; // Bank or Cash

        await this.createTransaction(
          {
            accountCode: '2000', // Accounts Payable
            debitAmount: paidAmount,
            creditAmount: 0,
            description: `Payment for Invoice: ${invoiceNumber || purchaseInvoice.id}`
          },
          {
            accountCode: paymentAccountCode, // Cash or Bank
            debitAmount: 0,
            creditAmount: paidAmount,
            description: `Payment for Purchase Invoice: ${invoiceNumber || purchaseInvoice.id}`
          },
          {
            referenceType: 'purchase_invoice_payment',
            referenceId: purchaseInvoice.id,
            referenceNumber: invoiceNumber,
            supplierId: supplierId,
            transactionDate: purchaseInvoice.invoice_date || purchaseInvoice.invoiceDate || purchaseInvoice.created_at || new Date(),
            currency: 'PKR',
            createdBy: purchaseInvoice.created_by || purchaseInvoice.createdBy
          }
        );
      }
    });
  }

  /**
   * Get bulk account balances
   */
  static async getBulkAccountBalances(accountCodes, asOfDate = null) {
    const dateFilter = asOfDate
      ? 'AND ledger.transaction_date <= $2'
      : '';

    const params = [accountCodes];
    if (asOfDate) params.push(asOfDate);

    const result = await query(
      `SELECT 
        coa.account_code,
        coa.opening_balance,
        coa.normal_balance,
        COALESCE(SUM(
          CASE 
            WHEN coa.normal_balance = 'debit' THEN (ledger.debit_amount - ledger.credit_amount)
            ELSE (ledger.credit_amount - ledger.debit_amount)
          END
        ), 0) AS ledger_balance
       FROM chart_of_accounts coa
       LEFT JOIN account_ledger ledger ON coa.account_code = ledger.account_code
         AND ledger.status = 'completed'
         AND ledger.reversed_at IS NULL
         ${dateFilter}
       WHERE coa.account_code = ANY($1)
         AND coa.is_active = TRUE
         AND coa.deleted_at IS NULL
       GROUP BY coa.account_code, coa.opening_balance, coa.normal_balance`,
      params
    );

    const balanceMap = new Map();
    result.rows.forEach(row => {
      const balance = parseFloat(row.opening_balance) + parseFloat(row.ledger_balance);
      balanceMap.set(row.account_code, balance);
    });

    return balanceMap;
  }

  /**
   * Get bulk customer balances
   * Only includes AR account (1100) entries - single source of truth
   */
  static async getBulkCustomerBalances(customerIds, asOfDate = null) {
    const dateFilter = asOfDate
      ? 'AND transaction_date <= $2'
      : '';

    const params = [customerIds];
    if (asOfDate) params.push(asOfDate);

    const result = await query(
      `SELECT 
        c.id,
        c.opening_balance,
        COALESCE(SUM(ledger.debit_amount - ledger.credit_amount), 0) AS ledger_balance
       FROM customers c
       LEFT JOIN account_ledger ledger ON c.id = ledger.customer_id
         AND ledger.account_code = '1100'
         AND ledger.status = 'completed'
         AND ledger.reversed_at IS NULL
         AND (ledger.reference_type IS NULL OR ledger.reference_type <> 'customer_opening_balance')
         ${dateFilter}
       WHERE c.id = ANY($1)
         AND c.is_deleted = FALSE
       GROUP BY c.id, c.opening_balance`,
      params
    );

    const balanceMap = new Map();
    result.rows.forEach(row => {
      const balance = parseFloat(row.opening_balance) + parseFloat(row.ledger_balance);
      const key = row.id != null ? String(row.id) : row.id;
      if (key != null) balanceMap.set(key, balance);
    });

    return balanceMap;
  }

  /**
   * Get bulk supplier balances
   * Only includes AP account (2000) entries - single source of truth.
   * Excludes ledger rows reference_type = 'supplier_opening_balance' to avoid double-count with suppliers.opening_balance.
   */
  static async getBulkSupplierBalances(supplierIds, asOfDate = null) {
    const dateFilter = asOfDate
      ? 'AND ledger.transaction_date <= $2'
      : '';

    const params = [supplierIds];
    if (asOfDate) params.push(asOfDate);

    const result = await query(
      `SELECT 
        s.id,
        s.opening_balance,
        COALESCE(SUM(ledger.credit_amount - ledger.debit_amount), 0) AS ledger_balance
       FROM suppliers s
       LEFT JOIN account_ledger ledger ON s.id = ledger.supplier_id
         AND ledger.account_code = '2000'
         AND ledger.status = 'completed'
         AND ledger.reversed_at IS NULL
         AND (ledger.reference_type IS NULL OR ledger.reference_type <> 'supplier_opening_balance')
         ${dateFilter}
       WHERE s.id = ANY($1::uuid[])
         AND s.is_deleted = FALSE
       GROUP BY s.id, s.opening_balance`,
      params
    );

    const balanceMap = new Map();
    result.rows.forEach(row => {
      const balance = parseFloat(row.opening_balance || 0) + parseFloat(row.ledger_balance || 0);
      balanceMap.set(row.id, balance);
    });

    return balanceMap;
  }

  /**
   * Get set of sale IDs that already have at least one account_ledger entry (reference_type = 'sale').
   * Used to avoid double-posting when backfilling historical sales.
   */
  static async getSaleIdsAlreadyPosted() {
    const result = await query(
      `SELECT DISTINCT reference_id AS id FROM account_ledger
       WHERE reference_type = 'sale' AND reference_id IS NOT NULL AND status = 'completed' AND reversed_at IS NULL`,
      []
    );
    return new Set((result.rows || []).map(r => r.id && r.id.toString()));
  }

  /**
   * Post journal voucher entries to the account ledger.
   * Creates individual ledger entries for each debit/credit in the voucher.
   * @param {Object} voucher - Journal voucher object with entries array
   * @param {string} createdBy - User ID who is posting the voucher
   */
  static async postJournalVoucherToLedger(voucher, createdBy) {
    if (!voucher || !voucher.entries || !Array.isArray(voucher.entries)) {
      throw new Error('Invalid journal voucher: missing entries');
    }

    const entries = voucher.entries;
    if (entries.length === 0) {
      throw new Error('Journal voucher must have at least one entry');
    }

    // Validate that debits equal credits
    let totalDebit = 0;
    let totalCredit = 0;
    for (const entry of entries) {
      totalDebit += parseFloat(entry.debitAmount ?? entry.debit ?? 0);
      totalCredit += parseFloat(entry.creditAmount ?? entry.credit ?? 0);
    }

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`Journal voucher is unbalanced: Debits ${totalDebit} ≠ Credits ${totalCredit}`);
    }

    const transactionId = `JV-${Date.now()}-${uuidv4().substring(0, 8)}`;
    const transactionDate = voucher.voucherDate || voucher.voucher_date || new Date();

    // Process each entry in the voucher
    const ledgerEntries = [];
    let entryIndex = 1;

    for (const entry of entries) {
      const accountCode = entry.accountCode || entry.account_code;
      // Support both camelCase from repository (debitAmount/creditAmount) and raw form fields (debit/credit)
      const debitAmount = parseFloat(entry.debitAmount ?? entry.debit ?? 0);
      const creditAmount = parseFloat(entry.creditAmount ?? entry.credit ?? 0);
      const description = entry.particulars || entry.description || voucher.description || 'Journal Voucher Entry';

      if (!accountCode) {
        throw new Error('Each journal voucher entry must specify an account code');
      }

      if ((debitAmount > 0 && creditAmount > 0) || (debitAmount === 0 && creditAmount === 0)) {
        throw new Error('Each entry must have either debit OR credit amount, not both or neither');
      }

      // Validate account exists and is active
      await this.validateAccount(accountCode);

      const ledgerEntry = {
        transaction_id: `${transactionId}-${entryIndex}`,
        transaction_date: transactionDate,
        account_code: accountCode.toUpperCase(),
        debit_amount: debitAmount,
        credit_amount: creditAmount,
        description: description,
        reference_type: 'journal_voucher',
        reference_id: voucher.id,
        reference_number: voucher.voucherNumber || voucher.voucher_number || `JV-${voucher.id?.substring(0, 8)}`,
        customer_id: entry.customerId || entry.customer_id || null,
        supplier_id: entry.supplierId || entry.supplier_id || null,
        currency: 'PKR',
        status: 'completed',
        created_by: isValidUuid(createdBy) ? createdBy : null
      };

      ledgerEntries.push(ledgerEntry);
      entryIndex++;
    }

    // Insert all entries in a transaction
    await transaction(async (client) => {
      for (const entry of ledgerEntries) {
        await client.query(
          `INSERT INTO account_ledger (
            transaction_id, transaction_date, account_code,
            debit_amount, credit_amount, description,
            reference_type, reference_id, reference_number,
            customer_id, supplier_id, currency, status, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            entry.transaction_id,
            entry.transaction_date,
            entry.account_code,
            entry.debit_amount,
            entry.credit_amount,
            entry.description,
            entry.reference_type,
            entry.reference_id,
            entry.reference_number,
            entry.customer_id,
            entry.supplier_id,
            entry.currency,
            entry.status,
            entry.created_by
          ]
        );
      }

      // Update account balances for all affected accounts
      const affectedAccounts = [...new Set(ledgerEntries.map(e => e.account_code))];
      for (const accountCode of affectedAccounts) {
        await this.updateAccountBalance(client, accountCode);
      }
      
      // Invalidate report cache to ensure real-time updates
      const { invalidateByPrefix } = require('../utils/ttlCache');
      invalidateByPrefix('reports:');
    });
  }
}

module.exports = AccountingService;
