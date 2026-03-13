/**
 * Expense Account Mapping Configuration
 * 
 * This configuration maps account codes to expense categories for P&L reporting.
 * It allows for flexible categorization of expenses into selling vs administrative,
 * and further categorization into specific expense types.
 * 
 * Structure:
 * - accountCode: The account code from Chart of Accounts
 * - expenseType: 'selling' or 'administrative'
 * - category: Specific expense category (e.g., 'advertising', 'rent', 'utilities')
 * - priority: Higher priority mappings override lower priority ones (default: 0)
 */

const expenseAccountMapping = {
  // Selling & Marketing Expenses (5220 series)
  '5220': {
    expenseType: 'selling',
    category: 'marketing',
    description: 'Selling & Marketing Expenses',
    priority: 10
  },
  
  // General & Administrative Expenses (5210 series)
  '5210': {
    expenseType: 'administrative',
    category: 'general_administrative',
    description: 'General & Administrative Expenses',
    priority: 10
  },
  
  // Specific account code mappings (can be extended)
  // Selling Expenses
  '5221': { expenseType: 'selling', category: 'advertising', description: 'Advertising Expenses', priority: 5 },
  '5222': { expenseType: 'selling', category: 'marketing', description: 'Marketing Expenses', priority: 5 },
  '5223': { expenseType: 'selling', category: 'sales_commissions', description: 'Sales Commissions', priority: 5 },
  '5224': { expenseType: 'selling', category: 'sales_salaries', description: 'Sales Salaries', priority: 5 },
  '5225': { expenseType: 'selling', category: 'travel_entertainment', description: 'Travel & Entertainment', priority: 5 },
  '5226': { expenseType: 'selling', category: 'promotional', description: 'Promotional Expenses', priority: 5 },
  '5227': { expenseType: 'selling', category: 'customer_service', description: 'Customer Service', priority: 5 },
  '5228': { expenseType: 'selling', category: 'delivery', description: 'Delivery Expenses', priority: 5 },
  '5229': { expenseType: 'selling', category: 'warehouse', description: 'Warehouse Expenses', priority: 5 },
  
  // Administrative Expenses
  '5211': { expenseType: 'administrative', category: 'office_supplies', description: 'Office Supplies', priority: 5 },
  '5212': { expenseType: 'administrative', category: 'rent', description: 'Rent Expenses', priority: 5 },
  '5213': { expenseType: 'administrative', category: 'utilities', description: 'Utilities', priority: 5 },
  '5214': { expenseType: 'administrative', category: 'insurance', description: 'Insurance', priority: 5 },
  '5215': { expenseType: 'administrative', category: 'legal', description: 'Legal Expenses', priority: 5 },
  '5216': { expenseType: 'administrative', category: 'accounting', description: 'Accounting Expenses', priority: 5 },
  '5217': { expenseType: 'administrative', category: 'management_salaries', description: 'Management Salaries', priority: 5 },
  '5218': { expenseType: 'administrative', category: 'training', description: 'Training Expenses', priority: 5 },
  '5219': { expenseType: 'administrative', category: 'software', description: 'Software Expenses', priority: 5 },
  '521A': { expenseType: 'administrative', category: 'equipment', description: 'Equipment Expenses', priority: 5 },
  '521B': { expenseType: 'administrative', category: 'maintenance', description: 'Maintenance Expenses', priority: 5 },
  '521C': { expenseType: 'administrative', category: 'professional_services', description: 'Professional Services', priority: 5 },
  '521D': { expenseType: 'administrative', category: 'depreciation', description: 'Depreciation', priority: 5 },
  '521E': { expenseType: 'administrative', category: 'telecommunications', description: 'Telecommunications', priority: 5 },
  '521F': { expenseType: 'administrative', category: 'bank_charges', description: 'Bank Charges', priority: 5 },
};

/**
 * Name pattern mappings for accounts not in the explicit mapping
 * These patterns are used to categorize expenses based on account names
 */
const namePatternMappings = {
  selling: {
    patterns: [
      /selling/i,
      /marketing/i,
      /sales/i,
      /advertising/i,
      /promotional/i,
      /commission/i,
      /customer.*service/i,
      /delivery/i,
      /warehouse/i,
      /distribution/i,
    ],
    categories: {
      'advertising': [/advertising/i, /advert/i, /promo/i],
      'marketing': [/marketing/i, /campaign/i],
      'sales_commissions': [/commission/i, /sales.*commission/i],
      'sales_salaries': [/sales.*salary/i, /sales.*wage/i],
      'travel_entertainment': [/travel/i, /entertainment/i, /t&e/i],
      'promotional': [/promotional/i, /promo/i],
      'customer_service': [/customer.*service/i, /support/i],
      'delivery': [/delivery/i, /shipping/i, /freight.*out/i],
      'warehouse': [/warehouse/i, /storage/i],
    }
  },
  administrative: {
    patterns: [
      /administrative/i,
      /general.*admin/i,
      /office/i,
      /rent/i,
      /utilities/i,
      /insurance/i,
      /legal/i,
      /accounting/i,
      /management/i,
      /training/i,
      /software/i,
      /equipment/i,
      /maintenance/i,
      /professional.*service/i,
      /depreciation/i,
      /telecom/i,
      /bank.*charge/i,
    ],
    categories: {
      'office_supplies': [/office.*suppl/i, /stationery/i],
      'rent': [/rent/i, /lease/i],
      'utilities': [/utilities/i, /electric/i, /water/i, /gas/i],
      'insurance': [/insurance/i],
      'legal': [/legal/i, /lawyer/i, /attorney/i],
      'accounting': [/accounting/i, /audit/i],
      'management_salaries': [/management.*salary/i, /executive.*salary/i],
      'training': [/training/i, /education/i],
      'software': [/software/i, /saas/i, /subscription/i],
      'equipment': [/equipment/i, /furniture/i],
      'maintenance': [/maintenance/i, /repair/i],
      'professional_services': [/professional.*service/i, /consulting/i],
      'depreciation': [/depreciation/i, /amortization/i],
      'telecommunications': [/telecom/i, /phone/i, /internet/i],
      'bank_charges': [/bank.*charge/i, /banking.*fee/i],
    }
  }
};

/**
 * Get expense mapping for an account code
 * @param {string} accountCode - The account code
 * @returns {Object|null} - The mapping configuration or null
 */
function getAccountMapping(accountCode) {
  if (!accountCode) return null;
  
  // Check exact match first
  if (expenseAccountMapping[accountCode]) {
    return expenseAccountMapping[accountCode];
  }
  
  // Check prefix match (e.g., 5221 matches 5220 series)
  const prefix = accountCode.substring(0, 3);
  if (expenseAccountMapping[prefix]) {
    return expenseAccountMapping[prefix];
  }
  
  return null;
}

/**
 * Get expense type and category from account name using patterns
 * @param {string} accountName - The account name
 * @param {string} accountCode - The account code (optional, for fallback)
 * @returns {Object} - { expenseType: 'selling'|'administrative', category: string }
 */
function getExpenseTypeFromName(accountName, accountCode = null) {
  if (!accountName) {
    // Fallback to account code mapping
    if (accountCode) {
      const mapping = getAccountMapping(accountCode);
      if (mapping) {
        return {
          expenseType: mapping.expenseType,
          category: mapping.category
        };
      }
    }
    return { expenseType: 'administrative', category: 'other' };
  }
  
  const name = accountName.toLowerCase();
  
  // Check selling patterns first
  for (const pattern of namePatternMappings.selling.patterns) {
    if (pattern.test(name)) {
      // Find specific category
      for (const [category, patterns] of Object.entries(namePatternMappings.selling.categories)) {
        for (const catPattern of patterns) {
          if (catPattern.test(name)) {
            return { expenseType: 'selling', category };
          }
        }
      }
      // Default selling category
      return { expenseType: 'selling', category: 'marketing' };
    }
  }
  
  // Check administrative patterns
  for (const pattern of namePatternMappings.administrative.patterns) {
    if (pattern.test(name)) {
      // Find specific category
      for (const [category, patterns] of Object.entries(namePatternMappings.administrative.categories)) {
        for (const catPattern of patterns) {
          if (catPattern.test(name)) {
            return { expenseType: 'administrative', category };
          }
        }
      }
      // Default administrative category
      return { expenseType: 'administrative', category: 'general_administrative' };
    }
  }
  
  // Default fallback
  return { expenseType: 'administrative', category: 'other' };
}

/**
 * Get expense category for an account
 * @param {string} accountCode - The account code
 * @param {string} accountName - The account name
 * @returns {Object} - { expenseType: string, category: string, description: string }
 */
function getExpenseCategory(accountCode, accountName) {
  // First, try account code mapping
  const mapping = getAccountMapping(accountCode);
  if (mapping) {
    return {
      expenseType: mapping.expenseType,
      category: mapping.category,
      description: mapping.description || accountName
    };
  }
  
  // Fallback to name pattern matching
  const nameBased = getExpenseTypeFromName(accountName, accountCode);
  return {
    expenseType: nameBased.expenseType,
    category: nameBased.category,
    description: accountName || 'Unknown Expense'
  };
}

/**
 * Add or update expense account mapping
 * @param {string} accountCode - The account code
 * @param {Object} mapping - The mapping configuration
 */
function setAccountMapping(accountCode, mapping) {
  expenseAccountMapping[accountCode] = {
    ...mapping,
    priority: mapping.priority || 0
  };
}

/**
 * Get all mappings
 * @returns {Object} - All expense account mappings
 */
function getAllMappings() {
  return expenseAccountMapping;
}

module.exports = {
  expenseAccountMapping,
  namePatternMappings,
  getAccountMapping,
  getExpenseTypeFromName,
  getExpenseCategory,
  setAccountMapping,
  getAllMappings,
};

