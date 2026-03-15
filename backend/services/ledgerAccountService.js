const mongoose = require('mongoose');
const ChartOfAccountsRepository = require('../repositories/ChartOfAccountsRepository');
const CustomerRepository = require('../repositories/CustomerRepository');
const SupplierRepository = require('../repositories/SupplierRepository');
const AccountingService = require('./accountingService');
const Counter = require('../models/Counter'); // Keep for findOneAndUpdate with upsert
const ChartOfAccounts = require('../models/ChartOfAccounts'); // Keep for instance creation

const isStatusActive = (status) => {
  if (!status) return true;
  return status === 'active';
};

const generateSequentialCode = async (counterKey, prefix, session) => {
  const counter = await Counter.findOneAndUpdate(
    { _id: counterKey },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, session }
  );

  return `${prefix}${String(counter.seq).padStart(4, '0')}`;
};

const createLedgerAccount = async ({
  prefix,
  counterKey,
  accountName,
  accountType,
  accountCategory,
  normalBalance,
  tags = [],
  status,
  userId,
  session
}) => {
  const accountCode = await generateSequentialCode(counterKey, prefix, session);
  const accountData = {
    accountCode,
    accountName,
    accountType,
    accountCategory,
    normalBalance,
    allowDirectPosting: true,
    isActive: isStatusActive(status),
    tags,
    description: 'Auto-generated party ledger account',
    createdBy: userId || undefined,
    updatedBy: userId || undefined
  };

  try {
    const account = new ChartOfAccounts(accountData);
    await account.save({ session });
    return account;
  } catch (err) {
    if (err.code === 11000) {
      // Duplicate key error - account already exists, fetch and return it
      console.log('Duplicate accountCode, fetching existing account:', accountCode);
      const existingAccount = await ChartOfAccountsRepository.findOne(
        { accountCode },
        { session }
      );
      if (existingAccount) {
        return existingAccount;
      }
      // If not found, try upsert approach (using model directly for upsert)
      const updateOptions = session ? { session } : {};
      await ChartOfAccounts.updateOne(
        { accountCode },
        { $setOnInsert: accountData },
        { upsert: true, ...updateOptions }
      );
      return await ChartOfAccountsRepository.findOne(
        { accountCode },
        { session }
      );
    }
    throw err;
  }
};

const syncCustomerLedgerAccount = async (customer, { session, userId } = {}) => {
  if (!customer) return null;

  let accountsReceivableAccount = null;

  // Find or get the general "Accounts Receivable" account
  // Try multiple possible account codes/names that might exist (dynamic lookup)
  // 1. Try to get from AccountingService default codes
  try {
    const defaultCodes = await AccountingService.getDefaultAccountCodes();
    if (defaultCodes.accountsReceivable) {
      accountsReceivableAccount = await ChartOfAccountsRepository.findOne({
        accountCode: defaultCodes.accountsReceivable,
        isActive: true
      }, { session });
    }
  } catch (err) {
    console.warn('Failed to get default codes from AccountingService:', err.message);
  }

  // 2. If not found, try dynamic search by name/type
  if (!accountsReceivableAccount) {
    try {
      // Use getAccountCode logic from AccountingService to find valid AR account
      // We don't use the service directly here to avoid potential circular dep issues during init, 
      // but we use the same logic pattern: find by name & type
      accountsReceivableAccount = await ChartOfAccountsRepository.findOne({
        $or: [
          { accountName: { $regex: /^Accounts Receivable$/i } },
          { accountName: { $regex: /^Account Receivable$/i } },
          { accountName: { $regex: /^AR$/i } },
          { accountName: { $regex: /Receivables/i } }
        ],
        accountType: 'asset',
        isActive: true
      }, { session });
    } catch (err) {
      console.warn('Error during dynamic AR account search:', err.message);
    }
  }

  // If still not found, try broader search (any asset account with receivable in name)
  if (!accountsReceivableAccount) {
    accountsReceivableAccount = await ChartOfAccountsRepository.findOne(
      {
        accountName: { $regex: /receivable/i },
        accountType: 'asset',
        isActive: true
      }
    );

    // Try with session if not found
    if (!accountsReceivableAccount && session) {
      accountsReceivableAccount = await ChartOfAccountsRepository.findOne(
        {
          accountName: { $regex: /receivable/i },
          accountType: 'asset',
          isActive: true
        },
        { session }
      );
    }
  }

  // If Accounts Receivable doesn't exist, create it dynamically
  if (!accountsReceivableAccount) {
    // Find a free code in the 1200 range (standard for Receivables)
    let accountCode = '1200';

    // Find the highest existing code in the 12xx range
    const highestAccount = await ChartOfAccountsRepository.findOne(
      { accountCode: { $regex: /^12\d{2}$/ } },
      { sort: { accountCode: -1 } }
    );

    if (highestAccount) {
      const nextNum = parseInt(highestAccount.accountCode) + 1;
      accountCode = String(nextNum);
    } else {
      // Fallback: check 11xx range if 12xx is empty? No, stick to 1200 as base.
      // Check if 1200 itself exists (might be a non-regex match?)
      const startAccount = await ChartOfAccountsRepository.findOne({ accountCode: '1200' });
      if (startAccount) accountCode = '1201';
    }

    const accountData = {
      accountCode: accountCode,
      accountName: 'Accounts Receivable',
      accountType: 'asset',
      accountCategory: 'current_assets',
      normalBalance: 'debit',
      allowDirectPosting: true,
      isActive: true,
      isSystemAccount: true,
      description: 'Money owed by customers - General Accounts Receivable account',
      createdBy: userId || undefined,
      currentBalance: 0,
      openingBalance: 0
    };

    try {
      // First, try to create directly using the model (most reliable)
      try {
        const newAccount = new ChartOfAccounts(accountData);
        const saveOptions = session ? { session } : {};
        await newAccount.save(saveOptions);
        accountsReceivableAccount = newAccount;
        console.log('Successfully created Accounts Receivable account:', accountCode);
      } catch (createError) {
        // If creation fails due to duplicate, try fetching
        if (createError.code === 11000 || createError.name === 'MongoServerError') {
          console.log('Account already exists, fetching:', accountCode);
          // Try with session first
          accountsReceivableAccount = await ChartOfAccountsRepository.findOne(
            { accountCode: accountCode },
            { session }
          );
          // If not found with session, try without session
          if (!accountsReceivableAccount) {
            accountsReceivableAccount = await ChartOfAccountsRepository.findOne(
              { accountCode: accountCode }
            );
          }

          // If still not found, try finding by name
          if (!accountsReceivableAccount) {
            accountsReceivableAccount = await ChartOfAccountsRepository.findOne(
              {
                accountName: { $regex: /^Accounts Receivable$/i },
                accountType: 'asset',
                isActive: true
              },
              { session }
            );
            if (!accountsReceivableAccount) {
              accountsReceivableAccount = await ChartOfAccountsRepository.findOne(
                {
                  accountName: { $regex: /^Accounts Receivable$/i },
                  accountType: 'asset',
                  isActive: true
                }
              );
            }
          }
        } else {
          // For other errors, try upsert as fallback
          console.log('Trying upsert as fallback:', createError.message);
          const updateOptions = session ? { session } : {};
          const result = await ChartOfAccounts.updateOne(
            { accountCode: accountCode },
            { $setOnInsert: accountData },
            { upsert: true, ...updateOptions }
          );

          // Fetch after upsert
          accountsReceivableAccount = await ChartOfAccountsRepository.findOne(
            { accountCode: accountCode },
            { session }
          );

          // If still null, try without session
          if (!accountsReceivableAccount) {
            accountsReceivableAccount = await ChartOfAccountsRepository.findOne(
              { accountCode: accountCode }
            );
          }
        }
      }
    } catch (error) {
      console.error('Error creating/finding Accounts Receivable account:', {
        message: error.message,
        code: error.code,
        name: error.name,
        stack: error.stack
      });

      // Last resort: try to find any active Accounts Receivable account (without session)
      accountsReceivableAccount = await ChartOfAccountsRepository.findOne(
        {
          accountName: { $regex: /receivable/i },
          accountType: 'asset',
          isActive: true
        }
      );

      // If still not found, try with session
      if (!accountsReceivableAccount) {
        accountsReceivableAccount = await ChartOfAccountsRepository.findOne(
          {
            accountName: { $regex: /receivable/i },
            accountType: 'asset',
            isActive: true
          },
          { session }
        );
      }
    }
  }



  // Final validation
  if (!accountsReceivableAccount || !accountsReceivableAccount._id) {
    throw new Error(
      'Failed to find or create Accounts Receivable account. ' +
      'Please ensure the chart of accounts is properly configured and try again.'
    );
  }


  // If customer has an individual account (like "Customer - NAME"), migrate to general account
  if (customer.ledgerAccount) {
    const existingAccount = await ChartOfAccountsRepository.findById(
      customer.ledgerAccount,
      { session }
    );
    if (existingAccount && existingAccount.accountName?.startsWith('Customer -')) {
      // This is an individual customer account - we should migrate to the general account
      // Deactivate the individual account
      await ChartOfAccountsRepository.updateById(
        customer.ledgerAccount,
        {
          isActive: false,
          updatedBy: userId || undefined
        },
        { session }
      );
    }
  }

  // Link customer to the general Accounts Receivable account
  customer.ledgerAccount = accountsReceivableAccount._id;
  await customer.save({ session, validateBeforeSave: false });

  return accountsReceivableAccount;
};

const syncSupplierLedgerAccount = async (supplier, { session, userId } = {}) => {
  if (!supplier) return null;

  const displayName = supplier.companyName || supplier.contactPerson?.name || 'Unnamed Supplier';
  const accountName = `Supplier - ${displayName}`;

  let account;

  if (!supplier.ledgerAccount) {
    account = await createLedgerAccount({
      prefix: 'AP-SUP-',
      counterKey: 'supplierLedgerAccounts',
      accountName,
      accountType: 'liability',
      accountCategory: 'current_liabilities',
      normalBalance: 'credit',
      tags: ['supplier', supplier._id.toString()],
      status: supplier.status,
      userId,
      session
    });

    supplier.ledgerAccount = account._id;
  } else {
    account = await ChartOfAccountsRepository.updateById(
      supplier.ledgerAccount,
      {
        accountName,
        isActive: isStatusActive(supplier.status),
        updatedBy: userId || undefined
      },
      { new: true, session }
    );
    if (account) {
      const existingTags = Array.isArray(account.tags) ? account.tags : [];
      const mergedTags = Array.from(new Set([...existingTags, 'supplier', supplier._id.toString()]));
      if (mergedTags.length !== existingTags.length) {
        account.tags = mergedTags;
        await account.save({ session, validateBeforeSave: false });
      }
    }
  }

  await supplier.save({ session, validateBeforeSave: false });
  return account;
};

const deactivateLedgerAccount = async (accountId, { session, userId } = {}) => {
  if (!accountId) return;
  await ChartOfAccountsRepository.updateById(
    accountId,
    {
      isActive: false,
      updatedBy: userId || undefined
    },
    { session }
  );
};

const ensureCustomerLedgerAccounts = async ({ userId } = {}) => {
  // Find all customers that need ledger accounts or have individual accounts
  const customers = await CustomerRepository.findAll({
    $or: [
      { ledgerAccount: { $exists: false } },
      { ledgerAccount: null }
    ]
  });

  // Also find customers with individual accounts to migrate them
  const customersWithIndividualAccounts = await CustomerRepository.findAll(
    {
      ledgerAccount: { $exists: true, $ne: null }
    },
    {
      populate: [{ path: 'ledgerAccount' }]
    }
  );

  // Migrate customers with individual accounts
  for (const customer of customersWithIndividualAccounts) {
    if (customer.ledgerAccount && customer.ledgerAccount.accountName?.startsWith('Customer -')) {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        await syncCustomerLedgerAccount(customer, { session, userId });
        await session.commitTransaction();
      } catch (error) {
        await session.abortTransaction();
        console.error('Failed to migrate ledger account for customer', customer._id, error.message);
      } finally {
        session.endSession();
      }
    }
  }

  // Create ledger accounts for customers without them
  for (const customer of customers) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await syncCustomerLedgerAccount(customer, { session, userId });
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      console.error('Failed to create ledger account for customer', customer._id, error.message);
    } finally {
      session.endSession();
    }
  }
};

const ensureSupplierLedgerAccounts = async ({ userId } = {}) => {
  const suppliers = await SupplierRepository.findAll({
    $or: [{ ledgerAccount: { $exists: false } }, { ledgerAccount: null }]
  });

  for (const supplier of suppliers) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await syncSupplierLedgerAccount(supplier, { session, userId });
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      console.error('Failed to create ledger account for supplier', supplier._id, error.message);
    } finally {
      session.endSession();
    }
  }
};

module.exports = {
  syncCustomerLedgerAccount,
  syncSupplierLedgerAccount,
  deactivateLedgerAccount,
  ensureCustomerLedgerAccounts,
  ensureSupplierLedgerAccounts
};

