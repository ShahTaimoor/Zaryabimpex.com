const express = require('express');
const router = express.Router();
const { auth, requireAnyPermission } = require('../middleware/auth');
const accountLedgerService = require('../services/accountLedgerService');
const chartOfAccountsRepository = require('../repositories/ChartOfAccountsRepository');

const ledgerView = requireAnyPermission(['view_reports', 'view_chart_of_accounts']);

// GET /api/account-ledger - ledger entries (same as getAccountLedger)
router.get('/', auth, ledgerView, async (req, res) => {
  try {
    const result = await accountLedgerService.getAccountLedger(req.query);
    res.json(result?.data ? result : { success: true, data: result });
  } catch (error) {
    console.error('Account ledger entries error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch ledger entries', error: error.message });
  }
});

// GET /api/account-ledger/accounts - list of accounts for dropdown
router.get('/accounts', auth, ledgerView, async (req, res) => {
  try {
    const accounts = await chartOfAccountsRepository.findAll({ isActive: true }, { limit: 5000 });
    res.json(accounts);
  } catch (error) {
    console.error('Account ledger accounts list error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch accounts', error: error.message });
  }
});

// GET /api/account-ledger/all-entries
router.get('/all-entries', auth, ledgerView, async (req, res) => {
  try {
    const result = await accountLedgerService.getAccountLedger({ ...req.query, limit: req.query.limit || 1000 });
    res.json(result?.data ? result : { success: true, data: result });
  } catch (error) {
    console.error('Account ledger all entries error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch entries', error: error.message });
  }
});

// GET /api/account-ledger/summary - customers/suppliers summary
router.get('/summary', auth, ledgerView, async (req, res) => {
  try {
    const result = await accountLedgerService.getLedgerSummary(req.query);
    res.json(result);
  } catch (error) {
    console.error('Account ledger summary error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch ledger summary', error: error.message });
  }
});

// GET /api/account-ledger/customer/:customerId/transactions
router.get('/customer/:customerId/transactions', auth, ledgerView, async (req, res) => {
  try {
    const result = await accountLedgerService.getLedgerSummary({ ...req.query, customerId: req.params.customerId });
    res.json(result);
  } catch (error) {
    console.error('Customer transactions error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch customer transactions', error: error.message });
  }
});

// GET /api/account-ledger/supplier/:supplierId/transactions
router.get('/supplier/:supplierId/transactions', auth, ledgerView, async (req, res) => {
  try {
    const result = await accountLedgerService.getLedgerSummary({ ...req.query, supplierId: req.params.supplierId });
    res.json(result);
  } catch (error) {
    console.error('Supplier transactions error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch supplier transactions', error: error.message });
  }
});

module.exports = router;
