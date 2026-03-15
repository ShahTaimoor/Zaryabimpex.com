const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const ChartOfAccounts = require('../models/ChartOfAccounts');
const CustomerTransaction = require('../models/CustomerTransaction');
const Customer = require('../models/Customer');
const Sales = require('../models/Sales');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');

/**
 * Data Integrity Service
 * Validates data consistency and integrity across the system
 */
class DataIntegrityService {
  /**
   * Validate double-entry bookkeeping
   * Ensures all accounts have correct balances based on transactions
   */
  async validateDoubleEntry() {
    const accounts = await ChartOfAccounts.find({ isActive: true });
    const discrepancies = [];
    
    for (const account of accounts) {
      const transactions = await Transaction.find({ 
        accountCode: account.accountCode,
        status: 'completed'
      });
      
      const totalDebits = transactions.reduce((sum, t) => sum + (t.debitAmount || 0), 0);
      const totalCredits = transactions.reduce((sum, t) => sum + (t.creditAmount || 0), 0);
      
      // Calculate balance based on account type
      let calculatedBalance;
      if (account.accountType === 'asset' || account.accountType === 'expense') {
        calculatedBalance = totalDebits - totalCredits;
      } else {
        calculatedBalance = totalCredits - totalDebits;
      }
      
      const storedBalance = account.currentBalance || 0;
      const difference = Math.abs(calculatedBalance - storedBalance);
      
      if (difference > 0.01) {
        discrepancies.push({
          accountCode: account.accountCode,
          accountName: account.accountName,
          accountType: account.accountType,
          calculatedBalance,
          storedBalance,
          difference,
          totalDebits,
          totalCredits,
          transactionCount: transactions.length
        });
      }
    }
    
    return discrepancies;
  }
  
  /**
   * Validate referential integrity
   * Checks for orphaned records and broken references
   */
  async validateReferentialIntegrity() {
    const issues = [];
    
    // Check orphaned transactions (transactions without orders)
    const transactions = await Transaction.find({
      orderId: { $exists: true, $ne: null }
    }).limit(1000); // Limit to avoid memory issues
    
    for (const txn of transactions) {
      try {
        const order = await Sales.findById(txn.orderId);
        if (!order) {
          issues.push({
            type: 'orphaned_transaction',
            transactionId: txn.transactionId,
            orderId: txn.orderId,
            accountCode: txn.accountCode,
            severity: 'high'
          });
        }
      } catch (error) {
        issues.push({
          type: 'orphaned_transaction_error',
          transactionId: txn.transactionId,
          orderId: txn.orderId,
          error: error.message,
          severity: 'high'
        });
      }
    }
    
    // Check orphaned customer transactions
    const customerTransactions = await CustomerTransaction.find().limit(1000);
    for (const ct of customerTransactions) {
      try {
        const customer = await Customer.findById(ct.customer);
        if (!customer || customer.isDeleted) {
          issues.push({
            type: 'orphaned_customer_transaction',
            transactionId: ct.transactionNumber,
            transactionType: ct.transactionType,
            customerId: ct.customer,
            severity: 'high'
          });
        }
      } catch (error) {
        issues.push({
          type: 'orphaned_customer_transaction_error',
          transactionId: ct.transactionNumber,
          customerId: ct.customer,
          error: error.message,
          severity: 'high'
        });
      }
    }
    
    // Check transactions with invalid account codes
    const transactionsWithAccounts = await Transaction.find({
      accountCode: { $exists: true, $ne: null }
    }).limit(1000);
    
    for (const txn of transactionsWithAccounts) {
      try {
        const account = await ChartOfAccounts.findOne({
          accountCode: txn.accountCode,
          isActive: true
        });
        if (!account) {
          issues.push({
            type: 'invalid_account_code',
            transactionId: txn.transactionId,
            accountCode: txn.accountCode,
            severity: 'medium'
          });
        }
      } catch (error) {
        // Skip if error
      }
    }
    
    return issues;
  }
  
  /**
   * Detect duplicate transactions
   */
  async detectDuplicates() {
    const duplicates = [];
    
    // Check for duplicate transaction IDs
    const transactionIds = await Transaction.aggregate([
      { $group: { _id: '$transactionId', count: { $sum: 1 }, ids: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } }
    ]);
    
    for (const dup of transactionIds) {
      duplicates.push({
        type: 'duplicate_transaction_id',
        transactionId: dup._id,
        count: dup.count,
        documentIds: dup.ids,
        severity: 'high'
      });
    }
    
    // Check for duplicate customer transaction numbers
    const customerTransactionNumbers = await CustomerTransaction.aggregate([
      { $group: { _id: '$transactionNumber', count: { $sum: 1 }, ids: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 }, _id: { $ne: null } } }
    ]);
    
    for (const dup of customerTransactionNumbers) {
      duplicates.push({
        type: 'duplicate_customer_transaction_number',
        transactionNumber: dup._id,
        count: dup.count,
        documentIds: dup.ids,
        severity: 'high'
      });
    }
    
    return duplicates;
  }
  
  /**
   * Validate inventory consistency
   */
  async validateInventoryConsistency() {
    const issues = [];
    
    const products = await Product.find({ status: 'active' }).limit(1000);
    for (const product of products) {
      try {
        const inventory = await Inventory.findOne({ product: product._id });
        
        if (!inventory) {
          issues.push({
            type: 'missing_inventory_record',
            productId: product._id,
            productName: product.name,
            severity: 'medium'
          });
        } else {
          // Check if Product and Inventory stock are in sync
          const productStock = product.inventory?.currentStock || 0;
          const inventoryStock = inventory.currentStock || 0;
          const difference = Math.abs(productStock - inventoryStock);
          
          if (difference > 0.01) {
            issues.push({
              type: 'stock_sync_mismatch',
              productId: product._id,
              productName: product.name,
              productStock,
              inventoryStock,
              difference,
              severity: 'medium'
            });
          }
          
          // Check if availableStock is correct
          const calculatedAvailable = Math.max(0, inventory.currentStock - inventory.reservedStock);
          const storedAvailable = inventory.availableStock || 0;
          const availableDifference = Math.abs(calculatedAvailable - storedAvailable);
          
          if (availableDifference > 0.01) {
            issues.push({
              type: 'incorrect_available_stock',
              productId: product._id,
              productName: product.name,
              calculated: calculatedAvailable,
              stored: storedAvailable,
              difference: availableDifference,
              severity: 'low'
            });
          }
          
          // Check for negative stock
          if (inventory.currentStock < 0) {
            issues.push({
              type: 'negative_stock',
              productId: product._id,
              productName: product.name,
              currentStock: inventory.currentStock,
              severity: 'high'
            });
          }
          
          // Check for reserved stock exceeding current stock
          if (inventory.reservedStock > inventory.currentStock) {
            issues.push({
              type: 'reserved_exceeds_current',
              productId: product._id,
              productName: product.name,
              currentStock: inventory.currentStock,
              reservedStock: inventory.reservedStock,
              severity: 'high'
            });
          }
        }
      } catch (error) {
        issues.push({
          type: 'inventory_validation_error',
          productId: product._id,
          productName: product.name,
          error: error.message,
          severity: 'medium'
        });
      }
    }
    
    return issues;
  }
  
  /**
   * Validate customer balance consistency
   */
  async validateCustomerBalances() {
    const issues = [];
    
    const customers = await Customer.find({ isDeleted: false }).limit(1000);
    for (const customer of customers) {
      try {
        // Calculate balance from CustomerTransaction sub-ledger
        const transactions = await CustomerTransaction.find({
          customer: customer._id
        });
        
        let calculatedPendingBalance = 0;
        let calculatedAdvanceBalance = 0;
        
        transactions.forEach(txn => {
          if (txn.affectsPendingBalance) {
            calculatedPendingBalance += txn.balanceImpact || 0;
          }
          if (txn.affectsAdvanceBalance) {
            calculatedAdvanceBalance += txn.balanceImpact || 0;
          }
        });
        
        const storedPendingBalance = customer.pendingBalance || 0;
        const storedAdvanceBalance = customer.advanceBalance || 0;
        
        const pendingDifference = Math.abs(calculatedPendingBalance - storedPendingBalance);
        const advanceDifference = Math.abs(calculatedAdvanceBalance - storedAdvanceBalance);
        
        if (pendingDifference > 0.01) {
          issues.push({
            type: 'customer_pending_balance_mismatch',
            customerId: customer._id,
            customerName: customer.displayName || customer.firstName,
            calculated: calculatedPendingBalance,
            stored: storedPendingBalance,
            difference: pendingDifference,
            severity: 'high'
          });
        }
        
        if (advanceDifference > 0.01) {
          issues.push({
            type: 'customer_advance_balance_mismatch',
            customerId: customer._id,
            customerName: customer.displayName || customer.firstName,
            calculated: calculatedAdvanceBalance,
            stored: storedAdvanceBalance,
            difference: advanceDifference,
            severity: 'high'
          });
        }
      } catch (error) {
        issues.push({
          type: 'customer_balance_validation_error',
          customerId: customer._id,
          error: error.message,
          severity: 'medium'
        });
      }
    }
    
    return issues;
  }
  
  /**
   * Run all validations
   */
  async runAllValidations() {
    const startTime = Date.now();
    
    try {
      const [
        doubleEntryIssues,
        referentialIssues,
        duplicateIssues,
        inventoryIssues,
        customerBalanceIssues
      ] = await Promise.all([
        this.validateDoubleEntry(),
        this.validateReferentialIntegrity(),
        this.detectDuplicates(),
        this.validateInventoryConsistency(),
        this.validateCustomerBalances()
      ]);
      
      const results = {
        doubleEntry: doubleEntryIssues,
        referentialIntegrity: referentialIssues,
        duplicates: duplicateIssues,
        inventory: inventoryIssues,
        customerBalances: customerBalanceIssues,
        timestamp: new Date(),
        duration: Date.now() - startTime
      };
      
      const totalIssues = 
        doubleEntryIssues.length +
        referentialIssues.length +
        duplicateIssues.length +
        inventoryIssues.length +
        customerBalanceIssues.length;
      
      const hasIssues = totalIssues > 0;
      
      // Categorize by severity
      const criticalIssues = [
        ...doubleEntryIssues.filter(i => i.severity === 'high'),
        ...referentialIssues.filter(i => i.severity === 'high'),
        ...duplicateIssues.filter(i => i.severity === 'high'),
        ...inventoryIssues.filter(i => i.severity === 'high'),
        ...customerBalanceIssues.filter(i => i.severity === 'high')
      ];
      
      return {
        ...results,
        hasIssues,
        totalIssues,
        criticalIssues: criticalIssues.length,
        summary: {
          doubleEntryIssues: doubleEntryIssues.length,
          referentialIssues: referentialIssues.length,
          duplicateIssues: duplicateIssues.length,
          inventoryIssues: inventoryIssues.length,
          customerBalanceIssues: customerBalanceIssues.length,
          criticalIssues: criticalIssues.length
        }
      };
    } catch (error) {
      console.error('Error running data integrity validations:', error);
      throw error;
    }
  }
  
  /**
   * Fix detected issues (where possible)
   */
  async fixIssues(issues) {
    const fixes = [];
    
    for (const issue of issues) {
      try {
        switch (issue.type) {
          case 'incorrect_available_stock':
            // Fix available stock calculation
            const inventory = await Inventory.findOne({ product: issue.productId });
            if (inventory) {
              inventory.availableStock = Math.max(0, inventory.currentStock - inventory.reservedStock);
              await inventory.save();
              fixes.push({
                issue,
                fixed: true,
                action: 'Updated availableStock'
              });
            }
            break;
            
          case 'stock_sync_mismatch':
            // Sync inventory to match product (use higher value)
            const product = await Product.findById(issue.productId);
            const inv = await Inventory.findOne({ product: issue.productId });
            if (product && inv) {
              const higherStock = Math.max(issue.productStock, issue.inventoryStock);
              inv.currentStock = higherStock;
              inv.availableStock = Math.max(0, higherStock - inv.reservedStock);
              await inv.save();
              fixes.push({
                issue,
                fixed: true,
                action: `Synced inventory stock to ${higherStock}`
              });
            }
            break;
            
          // Add more fixable issues here
        }
      } catch (error) {
        fixes.push({
          issue,
          fixed: false,
          error: error.message
        });
      }
    }
    
    return fixes;
  }
}

module.exports = new DataIntegrityService();

