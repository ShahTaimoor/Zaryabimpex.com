const express = require('express');
const router = express.Router();
const { auth, requirePermission, requireAnyPermission } = require('../middleware/auth');
const chartOfAccountsRepository = require('../repositories/ChartOfAccountsRepository');
const accountCategoryRepository = require('../repositories/AccountCategoryRepository');

const chartView = requireAnyPermission(['view_chart_of_accounts', 'view_reports']);
const chartManage = requireAnyPermission(['manage_chart_of_accounts', 'view_reports']);

// GET /api/chart-of-accounts - list accounts (query: accountType, accountCategory, isActive, includeBalances)
router.get('/', auth, chartView, async (req, res) => {
  try {
    const { accountType, accountCategory, includePartyAccounts, isActive, includeBalances } = req.query;
    const filters = {};
    if (accountType) filters.accountType = accountType;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (accountCategory) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(accountCategory)) {
        const cat = await accountCategoryRepository.findById(accountCategory);
        filters.accountCategory = cat ? (cat.name || cat.account_name) : accountCategory;
      } else {
        filters.accountCategory = accountCategory;
      }
    }
    let accounts = await chartOfAccountsRepository.findAll(filters, { limit: 5000 });
    
    // If includeBalances is true, calculate real-time balances for customer/supplier accounts
    if (includeBalances === 'true' || includeBalances === true) {
      const { query } = require('../config/postgres');
      const AccountingService = require('../services/accountingService');
      
      // For each account, if it's a customer or supplier account (CUST- or SUPP- prefix), 
      // calculate balance from ledger
      const accountsWithBalances = await Promise.all(accounts.map(async (account) => {
        try {
          // Check if this is a customer-specific account (starts with CUST-)
          if (account.accountCode && account.accountCode.startsWith('CUST-')) {
            // Extract customer ID from account code (format: CUST-{customerId})
            const customerId = account.accountCode.substring(5);
            try {
              const balance = await AccountingService.getCustomerBalance(customerId);
              return { ...account, currentBalance: balance };
            } catch (err) {
              console.warn(`Could not calculate balance for customer account ${account.accountCode}:`, err.message);
              return account;
            }
          }
          
          // Check if this is a supplier-specific account (starts with SUPP-)
          if (account.accountCode && account.accountCode.startsWith('SUPP-')) {
            const supplierId = account.accountCode.substring(5);
            try {
              const balance = await AccountingService.getSupplierBalance(supplierId);
              return { ...account, currentBalance: balance };
            } catch (err) {
              console.warn(`Could not calculate balance for supplier account ${account.accountCode}:`, err.message);
              return account;
            }
          }
          
          // For regular accounts, use the stored balance or recalculate
          return account;
        } catch (err) {
          console.error(`Error processing account ${account.accountCode}:`, err);
          return account;
        }
      }));
      
      const data = accountsWithBalances;
      return res.json(Array.isArray(data) ? data : { success: true, data: data || accounts });
    }
    
    const data = accounts.map(a => ({ ...a, currentBalance: undefined, openingBalance: undefined }));
    res.json(Array.isArray(data) ? data : { success: true, data: data || accounts });
  } catch (error) {
    console.error('Chart of accounts list error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch chart of accounts', error: error.message });
  }
});

// GET /api/chart-of-accounts/hierarchy
router.get('/hierarchy', auth, chartView, async (req, res) => {
  try {
    const accounts = await chartOfAccountsRepository.findAll({ isActive: true }, { limit: 5000 });
    const byId = new Map(accounts.map(a => [a.id, { ...a, children: [] }]));
    const roots = [];
    for (const a of byId.values()) {
      if (a.parentAccountId && byId.has(a.parentAccountId)) {
        byId.get(a.parentAccountId).children.push(a);
      } else {
        roots.push(a);
      }
    }
    roots.sort((a, b) => (a.accountCode || '').localeCompare(b.accountCode || ''));
    res.json(roots);
  } catch (error) {
    console.error('Chart of accounts hierarchy error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch hierarchy', error: error.message });
  }
});

// GET /api/chart-of-accounts/stats/summary
router.get('/stats/summary', auth, chartView, async (req, res) => {
  try {
    const accounts = await chartOfAccountsRepository.findAll({ isActive: true }, { limit: 5000 });
    const total = accounts.length;
    const withBalance = accounts.filter(a => (a.currentBalance || 0) !== 0).length;
    res.json({ success: true, data: { totalAccounts: total, accountsWithBalance: withBalance } });
  } catch (error) {
    console.error('Chart of accounts stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats', error: error.message });
  }
});

// GET /api/chart-of-accounts/:id
router.get('/:id', auth, chartView, async (req, res) => {
  try {
    const account = await chartOfAccountsRepository.findById(req.params.id);
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });
    res.json(account);
  } catch (error) {
    console.error('Chart of accounts get error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch account', error: error.message });
  }
});

// POST /api/chart-of-accounts
router.post('/', auth, chartManage, async (req, res) => {
  try {
    const data = { ...req.body, createdBy: req.user?.id || req.user?._id };
    
    // Validate required fields
    if (!data.accountCode || !data.accountName || !data.accountType) {
      return res.status(400).json({ 
        success: false, 
        message: 'Account code, name, and type are required' 
      });
    }

    // Check for duplicate account code
    const existing = await chartOfAccountsRepository.findByAccountCode(data.accountCode);
    if (existing) {
      return res.status(409).json({ 
        success: false, 
        message: `Account code ${data.accountCode} already exists. Please use a different code.` 
      });
    }

    // Validate account code is numeric and within valid range
    const code = parseInt(data.accountCode);
    if (isNaN(code) || code < 1000 || code > 5999) {
      return res.status(400).json({ 
        success: false, 
        message: 'Account code must be a number between 1000 and 5999' 
      });
    }

    // Validate normal balance matches account type
    const expectedNormalBalance = ['asset', 'expense'].includes(data.accountType) ? 'debit' : 'credit';
    if (data.normalBalance && data.normalBalance !== expectedNormalBalance) {
      console.warn(`Warning: Account ${data.accountCode} has normal balance ${data.normalBalance} but type ${data.accountType} typically uses ${expectedNormalBalance}`);
    }

    const account = await chartOfAccountsRepository.create(data);
    res.status(201).json(account);
  } catch (error) {
    console.error('Chart of accounts create error:', error);
    
    // Handle unique constraint violations
    if (error.code === '23505') {
      return res.status(409).json({ 
        success: false, 
        message: 'Account code already exists. Please use a different code.' 
      });
    }
    
    res.status(500).json({ success: false, message: 'Failed to create account', error: error.message });
  }
});

// PUT /api/chart-of-accounts/:id
router.put('/:id', auth, chartManage, async (req, res) => {
  try {
    const data = { ...req.body, updatedBy: req.user?.id || req.user?._id };
    const account = await chartOfAccountsRepository.updateById(req.params.id, data);
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });
    res.json(account);
  } catch (error) {
    console.error('Chart of accounts update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update account', error: error.message });
  }
});

// DELETE /api/chart-of-accounts/:id (soft delete if supported, else 501)
router.delete('/:id', auth, chartManage, async (req, res) => {
  try {
    const account = await chartOfAccountsRepository.findById(req.params.id);
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });
    if (account.isSystemAccount) return res.status(403).json({ success: false, message: 'Cannot delete system account' });
    if (chartOfAccountsRepository.softDelete) {
      await chartOfAccountsRepository.softDelete(req.params.id);
    } else {
      return res.status(501).json({ success: false, message: 'Delete not implemented' });
    }
    res.json({ success: true, message: 'Account deleted' });
  } catch (error) {
    console.error('Chart of accounts delete error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete account', error: error.message });
  }
});

// POST /api/chart-of-accounts/recalculate-balances - Recalculate all account balances
router.post('/recalculate-balances', auth, chartManage, async (req, res) => {
  try {
    const { query } = require('../config/postgres');
    const AccountingService = require('../services/accountingService');
    
    // Get all active accounts
    const accounts = await chartOfAccountsRepository.findAll({ isActive: true }, { limit: 5000 });
    
    const results = {
      total: accounts.length,
      updated: 0,
      errors: [],
      accountDetails: []
    };

    // Recalculate balance for each account
    for (const account of accounts) {
      try {
        const oldBalance = parseFloat(account.currentBalance || 0);
        
        // Get calculated balance from ledger
        const newBalance = await AccountingService.getAccountBalance(account.accountCode);
        
        // Update if different
        if (Math.abs(oldBalance - newBalance) > 0.01) {
          await query(
            'UPDATE chart_of_accounts SET current_balance = $1, updated_at = CURRENT_TIMESTAMP WHERE account_code = $2',
            [newBalance, account.accountCode]
          );
          results.updated++;
          results.accountDetails.push({
            code: account.accountCode,
            name: account.accountName,
            oldBalance,
            newBalance,
            difference: newBalance - oldBalance
          });
        }
      } catch (err) {
        results.errors.push({
          code: account.accountCode,
          name: account.accountName,
          error: err.message
        });
      }
    }

    res.json({
      success: true,
      message: `Recalculated ${results.updated} account balances`,
      data: results
    });
  } catch (error) {
    console.error('Recalculate balances error:', error);
    res.status(500).json({ success: false, message: 'Failed to recalculate balances', error: error.message });
  }
});

// POST /api/chart-of-accounts/sync-party-accounts - Sync all customer and supplier accounts
router.post('/sync-party-accounts', auth, chartManage, async (req, res) => {
  try {
    const { query } = require('../config/postgres');
    
    const results = {
      customersProcessed: 0,
      customersCreated: 0,
      suppliersProcessed: 0,
      suppliersCreated: 0,
      errors: []
    };

    // Get all customers
    const customersResult = await query(
      'SELECT id, business_name, name FROM customers WHERE deleted_at IS NULL ORDER BY business_name'
    );
    
    for (const customer of customersResult.rows) {
      results.customersProcessed++;
      const accountCode = `CUST-${customer.id}`;
      const accountName = customer.business_name || customer.name || 'Unknown Customer';
      
      try {
        // Check if account already exists
        const existing = await chartOfAccountsRepository.findByAccountCode(accountCode);
        if (!existing) {
          // Create customer account
          await chartOfAccountsRepository.create({
            accountCode: accountCode,
            accountName: accountName,
            accountType: 'asset',
            accountCategory: 'Trade Receivables',
            normalBalance: 'debit',
            openingBalance: 0,
            currentBalance: 0,
            allowDirectPosting: false,
            isSystemAccount: false,
            isActive: true,
            description: `Customer Account: ${accountName}`,
            createdBy: req.user?.id || req.user?._id
          });
          results.customersCreated++;
        }
      } catch (err) {
        results.errors.push({
          type: 'customer',
          id: customer.id,
          name: accountName,
          error: err.message
        });
      }
    }

    // Get all suppliers
    const suppliersResult = await query(
      'SELECT id, company_name, business_name, name FROM suppliers WHERE deleted_at IS NULL ORDER BY company_name'
    );
    
    for (const supplier of suppliersResult.rows) {
      results.suppliersProcessed++;
      const accountCode = `SUPP-${supplier.id}`;
      const accountName = supplier.company_name || supplier.business_name || supplier.name || 'Unknown Supplier';
      
      try {
        // Check if account already exists
        const existing = await chartOfAccountsRepository.findByAccountCode(accountCode);
        if (!existing) {
          // Create supplier account
          await chartOfAccountsRepository.create({
            accountCode: accountCode,
            accountName: accountName,
            accountType: 'liability',
            accountCategory: 'Trade Payables',
            normalBalance: 'credit',
            openingBalance: 0,
            currentBalance: 0,
            allowDirectPosting: false,
            isSystemAccount: false,
            isActive: true,
            description: `Supplier Account: ${accountName}`,
            createdBy: req.user?.id || req.user?._id
          });
          results.suppliersCreated++;
        }
      } catch (err) {
        results.errors.push({
          type: 'supplier',
          id: supplier.id,
          name: accountName,
          error: err.message
        });
      }
    }

    res.json({
      success: true,
      message: `Synced ${results.customersCreated} customer accounts and ${results.suppliersCreated} supplier accounts`,
      data: results
    });
  } catch (error) {
    console.error('Sync party accounts error:', error);
    res.status(500).json({ success: false, message: 'Failed to sync party accounts', error: error.message });
  }
});

// GET /api/chart-of-accounts/check/:accountCode - Check specific account balance
router.get('/check/:accountCode', auth, chartView, async (req, res) => {
  try {
    const { query } = require('../config/postgres');
    const AccountingService = require('../services/accountingService');
    const accountCode = req.params.accountCode.toUpperCase();
    
    // Get account details
    const account = await chartOfAccountsRepository.findByAccountCode(accountCode);
    if (!account) {
      return res.status(404).json({ 
        success: false, 
        message: `Account ${accountCode} not found. Please create it in Chart of Accounts.` 
      });
    }

    // Get calculated balance
    const calculatedBalance = await AccountingService.getAccountBalance(accountCode);
    
    // Get ledger entries count
    const ledgerCount = await query(
      `SELECT COUNT(*) as count FROM account_ledger 
       WHERE account_code = $1 AND status = 'completed' AND reversed_at IS NULL`,
      [accountCode]
    );

    res.json({
      success: true,
      data: {
        accountCode: account.accountCode,
        accountName: account.accountName,
        accountType: account.accountType,
        normalBalance: account.normalBalance,
        isActive: account.isActive,
        openingBalance: account.openingBalance,
        currentBalance: account.currentBalance,
        calculatedBalance: calculatedBalance,
        difference: calculatedBalance - (account.currentBalance || 0),
        ledgerEntriesCount: parseInt(ledgerCount.rows[0].count),
        needsUpdate: Math.abs(calculatedBalance - (account.currentBalance || 0)) > 0.01
      }
    });
  } catch (error) {
    console.error('Check account error:', error);
    res.status(500).json({ success: false, message: 'Failed to check account', error: error.message });
  }
});

module.exports = router;
