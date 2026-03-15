const CustomerTransactionRepository = require('../repositories/postgres/CustomerTransactionRepository');
const CustomerRepository = require('../repositories/postgres/CustomerRepository');
const SalesRepository = require('../repositories/SalesRepository');
const ProductRepository = require('../repositories/postgres/ProductRepository');
const InventoryRepository = require('../repositories/postgres/InventoryRepository');

/**
 * Data Integrity Service
 * Validates data consistency using PostgreSQL repositories (no Mongoose).
 */
class DataIntegrityService {
  /**
   * Validate double-entry bookkeeping (Postgres: ledger validated elsewhere)
   */
  async validateDoubleEntry() {
    return [];
  }

  /**
   * Validate referential integrity (orphaned customer transactions, etc.)
   */
  async validateReferentialIntegrity() {
    const issues = [];

    const customerTransactions = await CustomerTransactionRepository.findAll({}, { limit: 1000 });
    for (const ct of customerTransactions) {
      try {
        const customerId = ct.customer_id || ct.customer;
        if (!customerId) continue;
        const customer = await CustomerRepository.findById(customerId);
        if (!customer || customer.is_deleted) {
          issues.push({
            type: 'orphaned_customer_transaction',
            transactionId: ct.transaction_number || ct.transactionNumber,
            transactionType: ct.transaction_type || ct.transactionType,
            customerId,
            severity: 'high'
          });
        }
      } catch (error) {
        issues.push({
          type: 'orphaned_customer_transaction_error',
          transactionId: ct.transaction_number || ct.transactionNumber,
          customerId: ct.customer_id || ct.customer,
          error: error.message,
          severity: 'high'
        });
      }
    }

    return issues;
  }

  /**
   * Detect duplicate transaction numbers in customer_transactions
   */
  async detectDuplicates() {
    const duplicates = [];
    const rows = await CustomerTransactionRepository.findAll({}, { limit: 10000 });
    const byNumber = {};
    for (const row of rows) {
      const num = row.transaction_number || row.transactionNumber;
      if (!num) continue;
      if (!byNumber[num]) byNumber[num] = [];
      byNumber[num].push(row.id);
    }
    for (const [transactionNumber, ids] of Object.entries(byNumber)) {
      if (ids.length > 1) {
        duplicates.push({
          type: 'duplicate_customer_transaction_number',
          transactionNumber,
          count: ids.length,
          documentIds: ids,
          severity: 'high'
        });
      }
    }
    return duplicates;
  }

  /**
   * Validate inventory consistency
   */
  async validateInventoryConsistency() {
    const issues = [];
    const products = await ProductRepository.findAll({ isActive: true }, { limit: 1000 });
    for (const product of products) {
      try {
        const productId = product.id || product._id;
        const inventory = await InventoryRepository.findOne({ product: productId, productId });
        const currentStock = Number(inventory?.current_stock ?? inventory?.currentStock ?? 0);
        const reservedStock = Number(inventory?.reserved_stock ?? inventory?.reservedStock ?? 0);
        const availableStock = Number(inventory?.available_stock ?? inventory?.availableStock ?? 0);

        if (!inventory) {
          issues.push({
            type: 'missing_inventory_record',
            productId,
            productName: product.name,
            severity: 'medium'
          });
        } else {
          const productStock = Number(product.stock_quantity ?? product.stockQuantity ?? 0);
          const inventoryStock = currentStock;
          const difference = Math.abs(productStock - inventoryStock);
          if (difference > 0.01) {
            issues.push({
              type: 'stock_sync_mismatch',
              productId,
              productName: product.name,
              productStock,
              inventoryStock,
              difference,
              severity: 'medium'
            });
          }

          const calculatedAvailable = Math.max(0, currentStock - reservedStock);
          const availableDifference = Math.abs(calculatedAvailable - availableStock);
          if (availableDifference > 0.01) {
            issues.push({
              type: 'incorrect_available_stock',
              productId,
              productName: product.name,
              calculated: calculatedAvailable,
              stored: availableStock,
              difference: availableDifference,
              severity: 'low'
            });
          }

          if (currentStock < 0) {
            issues.push({
              type: 'negative_stock',
              productId,
              productName: product.name,
              currentStock,
              severity: 'high'
            });
          }

          if (reservedStock > currentStock) {
            issues.push({
              type: 'reserved_exceeds_current',
              productId,
              productName: product.name,
              currentStock,
              reservedStock,
              severity: 'high'
            });
          }
        }
      } catch (error) {
        issues.push({
          type: 'inventory_validation_error',
          productId: product.id || product._id,
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
    const customers = await CustomerRepository.findAll({}, { limit: 1000 });
    for (const customer of customers) {
      try {
        const customerId = customer.id || customer._id;
        const transactions = await CustomerTransactionRepository.findAll({ customerId }, {});
        let calculatedPendingBalance = 0;
        let calculatedAdvanceBalance = 0;
        for (const txn of transactions) {
          const affectsPending = txn.affects_pending_balance ?? txn.affectsPendingBalance;
          const affectsAdvance = txn.affects_advance_balance ?? txn.affectsAdvanceBalance;
          const impact = Number(txn.balance_impact ?? txn.balanceImpact ?? 0);
          if (affectsPending) calculatedPendingBalance += impact;
          if (affectsAdvance) calculatedAdvanceBalance += impact;
        }
        const storedPendingBalance = Number(customer.pending_balance ?? customer.pendingBalance ?? 0);
        const storedAdvanceBalance = Number(customer.advance_balance ?? customer.advanceBalance ?? 0);
        const pendingDifference = Math.abs(calculatedPendingBalance - storedPendingBalance);
        const advanceDifference = Math.abs(calculatedAdvanceBalance - storedAdvanceBalance);

        if (pendingDifference > 0.01) {
          issues.push({
            type: 'customer_pending_balance_mismatch',
            customerId,
            customerName: customer.business_name ?? customer.businessName ?? customer.name,
            calculated: calculatedPendingBalance,
            stored: storedPendingBalance,
            difference: pendingDifference,
            severity: 'high'
          });
        }
        if (advanceDifference > 0.01) {
          issues.push({
            type: 'customer_advance_balance_mismatch',
            customerId,
            customerName: customer.business_name ?? customer.businessName ?? customer.name,
            calculated: calculatedAdvanceBalance,
            stored: storedAdvanceBalance,
            difference: advanceDifference,
            severity: 'high'
          });
        }
      } catch (error) {
        issues.push({
          type: 'customer_balance_validation_error',
          customerId: customer.id || customer._id,
          error: error.message,
          severity: 'medium'
        });
      }
    }
    return issues;
  }

  async runAllValidations() {
    const startTime = Date.now();
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
    const criticalIssues = [
      ...doubleEntryIssues.filter((i) => i.severity === 'high'),
      ...referentialIssues.filter((i) => i.severity === 'high'),
      ...duplicateIssues.filter((i) => i.severity === 'high'),
      ...inventoryIssues.filter((i) => i.severity === 'high'),
      ...customerBalanceIssues.filter((i) => i.severity === 'high')
    ];

    return {
      ...results,
      hasIssues: totalIssues > 0,
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
  }

  /**
   * Fix detected issues (where possible) using Postgres repos
   */
  async fixIssues(issues) {
    const fixes = [];
    for (const issue of issues) {
      try {
        switch (issue.type) {
          case 'incorrect_available_stock': {
            const inventory = await InventoryRepository.findOne({ product: issue.productId, productId: issue.productId });
            if (inventory) {
              const currentStock = Number(inventory.current_stock ?? inventory.currentStock ?? 0);
              const reservedStock = Number(inventory.reserved_stock ?? inventory.reservedStock ?? 0);
              const availableStock = Math.max(0, currentStock - reservedStock);
              await InventoryRepository.updateById(inventory.id, { availableStock });
              fixes.push({ issue, fixed: true, action: 'Updated availableStock' });
            }
            break;
          }
          case 'stock_sync_mismatch': {
            const inv = await InventoryRepository.findOne({ product: issue.productId, productId: issue.productId });
            if (inv) {
              const higherStock = Math.max(issue.productStock, issue.inventoryStock);
              const reserved = Number(inv.reserved_stock ?? inv.reservedStock ?? 0);
              await InventoryRepository.updateById(inv.id, {
                currentStock: higherStock,
                availableStock: Math.max(0, higherStock - reserved)
              });
              fixes.push({ issue, fixed: true, action: `Synced inventory stock to ${higherStock}` });
            }
            break;
          }
          default:
            break;
        }
      } catch (error) {
        fixes.push({ issue, fixed: false, error: error.message });
      }
    }
    return fixes;
  }
}

module.exports = new DataIntegrityService();
