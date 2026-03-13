const basicAccounts = [
  // Asset hierarchy
  {
    accountCode: '1000',
    accountName: 'Assets',
    accountType: 'asset',
    accountCategory: 'current_assets',
    normalBalance: 'debit',
    level: 0,
    allowDirectPosting: false,
    isSystemAccount: true
  },
  {
    accountCode: '1100',
    accountName: 'Current Assets',
    accountType: 'asset',
    accountCategory: 'current_assets',
    normalBalance: 'debit',
    level: 1,
    allowDirectPosting: false,
    parentCode: '1000'
  },
  {
    accountCode: '1110',
    accountName: 'Cash on Hand',
    accountType: 'asset',
    accountCategory: 'current_assets',
    normalBalance: 'debit',
    level: 2,
    parentCode: '1100'
  },
  {
    accountCode: '1120',
    accountName: 'Bank Accounts',
    accountType: 'asset',
    accountCategory: 'current_assets',
    normalBalance: 'debit',
    level: 2,
    parentCode: '1100'
  },
  {
    accountCode: '1130',
    accountName: 'Accounts Receivable',
    accountType: 'asset',
    accountCategory: 'current_assets',
    normalBalance: 'debit',
    level: 2,
    parentCode: '1100'
  },
  {
    accountCode: '1200',
    accountName: 'Inventory',
    accountType: 'asset',
    accountCategory: 'inventory',
    normalBalance: 'debit',
    level: 1,
    parentCode: '1000'
  },

  // Liability hierarchy
  {
    accountCode: '2000',
    accountName: 'Liabilities',
    accountType: 'liability',
    accountCategory: 'current_liabilities',
    normalBalance: 'credit',
    level: 0,
    allowDirectPosting: false,
    isSystemAccount: true
  },
  {
    accountCode: '2100',
    accountName: 'Current Liabilities',
    accountType: 'liability',
    accountCategory: 'current_liabilities',
    normalBalance: 'credit',
    level: 1,
    allowDirectPosting: false,
    parentCode: '2000'
  },
  {
    accountCode: '2110',
    accountName: 'Accounts Payable',
    accountType: 'liability',
    accountCategory: 'current_liabilities',
    normalBalance: 'credit',
    level: 2,
    parentCode: '2100'
  },
  {
    accountCode: '2120',
    accountName: 'Sales Tax Payable',
    accountType: 'liability',
    accountCategory: 'current_liabilities',
    normalBalance: 'credit',
    level: 2,
    parentCode: '2100'
  },
  {
    accountCode: '2200',
    accountName: 'Customer Deposits',
    accountType: 'liability',
    accountCategory: 'deferred_revenue',
    normalBalance: 'credit',
    level: 2,
    parentCode: '2100'
  },

  // Equity hierarchy
  {
    accountCode: '3000',
    accountName: 'Equity',
    accountType: 'equity',
    accountCategory: 'owner_equity',
    normalBalance: 'credit',
    level: 0,
    allowDirectPosting: false,
    isSystemAccount: true
  },
  {
    accountCode: '3100',
    accountName: 'Owner Capital',
    accountType: 'equity',
    accountCategory: 'owner_equity',
    normalBalance: 'credit',
    level: 1,
    parentCode: '3000'
  },
  {
    accountCode: '3200',
    accountName: 'Retained Earnings',
    accountType: 'equity',
    accountCategory: 'retained_earnings',
    normalBalance: 'credit',
    level: 1,
    parentCode: '3000'
  },

  // Revenue hierarchy
  {
    accountCode: '4000',
    accountName: 'Revenue',
    accountType: 'revenue',
    accountCategory: 'sales_revenue',
    normalBalance: 'credit',
    level: 0,
    allowDirectPosting: false,
    isSystemAccount: true
  },
  {
    accountCode: '4001',
    accountName: 'Sales Revenue',
    accountType: 'revenue',
    accountCategory: 'sales_revenue',
    normalBalance: 'credit',
    level: 1,
    parentCode: '4000'
  },
  {
    accountCode: '4200',
    accountName: 'Other Revenue',
    accountType: 'revenue',
    accountCategory: 'other_revenue',
    normalBalance: 'credit',
    level: 1,
    parentCode: '4000'
  },

  // Expense hierarchy
  {
    accountCode: '5000',
    accountName: 'Expenses',
    accountType: 'expense',
    accountCategory: 'operating_expenses',
    normalBalance: 'debit',
    level: 0,
    allowDirectPosting: false,
    isSystemAccount: true
  },
  {
    accountCode: '5001',
    accountName: 'Cost of Goods Sold',
    accountType: 'expense',
    accountCategory: 'cost_of_goods_sold',
    normalBalance: 'debit',
    level: 1,
    parentCode: '5000'
  },
  {
    accountCode: '5200',
    accountName: 'Operating Expenses',
    accountType: 'expense',
    accountCategory: 'operating_expenses',
    normalBalance: 'debit',
    level: 1,
    parentCode: '5000'
  },
  {
    accountCode: '5210',
    accountName: 'General & Administrative Expenses',
    accountType: 'expense',
    accountCategory: 'operating_expenses',
    normalBalance: 'debit',
    level: 2,
    parentCode: '5200'
  },
  {
    accountCode: '5220',
    accountName: 'Selling & Marketing Expenses',
    accountType: 'expense',
    accountCategory: 'operating_expenses',
    normalBalance: 'debit',
    level: 2,
    parentCode: '5200'
  },
  {
    accountCode: '5430',
    accountName: 'Other Expenses',
    accountType: 'expense',
    accountCategory: 'other_expenses',
    normalBalance: 'debit',
    level: 1,
    parentCode: '5000'
  }
];

module.exports = { basicAccounts };

