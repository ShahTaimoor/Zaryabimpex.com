/**
 * Essential system accounts for POS operations.
 * Flat structure — no hierarchy/group accounts. Codes align with ledger posting in accountingService.
 */
const basicAccounts = [
  {
    accountCode: '1000',
    accountName: 'Cash on Hand',
    accountType: 'asset',
    accountCategory: 'current_assets',
    normalBalance: 'debit',
    level: 0,
    allowDirectPosting: true,
    isSystemAccount: true
  },
  {
    accountCode: '1001',
    accountName: 'Bank Accounts',
    accountType: 'asset',
    accountCategory: 'current_assets',
    normalBalance: 'debit',
    level: 0,
    allowDirectPosting: true,
    isSystemAccount: true
  },
  {
    accountCode: '1100',
    accountName: 'Accounts Receivable',
    accountType: 'asset',
    accountCategory: 'current_assets',
    normalBalance: 'debit',
    level: 0,
    allowDirectPosting: true,
    isSystemAccount: true
  },
  {
    accountCode: '1200',
    accountName: 'Inventory',
    accountType: 'asset',
    accountCategory: 'inventory',
    normalBalance: 'debit',
    level: 0,
    allowDirectPosting: true,
    isSystemAccount: true
  },
  {
    accountCode: '2000',
    accountName: 'Accounts Payable',
    accountType: 'liability',
    accountCategory: 'current_liabilities',
    normalBalance: 'credit',
    level: 0,
    allowDirectPosting: true,
    isSystemAccount: true
  },
  {
    accountCode: '3100',
    accountName: 'Owner Capital',
    accountType: 'equity',
    accountCategory: 'owner_equity',
    normalBalance: 'credit',
    level: 0,
    allowDirectPosting: true,
    isSystemAccount: true
  },
  {
    accountCode: '4000',
    accountName: 'Sales Revenue',
    accountType: 'revenue',
    accountCategory: 'sales_revenue',
    normalBalance: 'credit',
    level: 0,
    allowDirectPosting: true,
    isSystemAccount: true
  },
  {
    accountCode: '5000',
    accountName: 'Cost of Goods Sold',
    accountType: 'expense',
    accountCategory: 'cost_of_goods_sold',
    normalBalance: 'debit',
    level: 0,
    allowDirectPosting: true,
    isSystemAccount: true
  }
];

/** Account codes used by sales, purchase, inventory, and opening-balance posting. */
function getSystemAccountCodes() {
  return {
    cash: '1000',
    bank: '1001',
    accountsReceivable: '1100',
    inventory: '1200',
    accountsPayable: '2000',
    ownerCapital: '3100',
    salesRevenue: '4000',
    costOfGoodsSold: '5000',
    // Optional contra accounts removed from defaults; fall back to core revenue/COGS
    salesReturns: '4000',
    purchaseReturns: '5000'
  };
}

const ESSENTIAL_ACCOUNT_CODES = basicAccounts.map((a) => a.accountCode);

module.exports = { basicAccounts, getSystemAccountCodes, ESSENTIAL_ACCOUNT_CODES };
