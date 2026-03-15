const cron = require('node-cron');
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Sales = require('../models/Sales');
const CashReceipt = require('../models/CashReceipt');
const BankReceipt = require('../models/BankReceipt');
const Return = require('../models/Return');
const PurchaseInvoice = require('../models/PurchaseInvoice');
const CashPayment = require('../models/CashPayment');
const BankPayment = require('../models/BankPayment');

/**
 * Balance Rebuild Cron Jobs
 * Automatically rebuilds all customer and supplier balances from the Account Ledger
 */

let rebuildJob = null;
let isRunning = false;
let lastRunTime = null;
let lastRunStats = {
    customersUpdated: 0,
    suppliersUpdated: 0,
    errors: 0,
    duration: 0
};

/**
 * Calculate customer balance from all transactions
 */
async function calculateCustomerBalance(customerId) {
    let balance = 0;

    // Sales Invoices (increase balance - debit)
    const sales = await Sales.find({
        customer: customerId,
        isDeleted: { $ne: true }
    }).lean();

    const salesTotal = sales.reduce((sum, sale) => sum + (sale.pricing?.total || 0), 0);
    balance += salesTotal;

    // Cash Payments TO customer (increase balance - debit) - advances/refunds
    const cashPayments = await CashPayment.find({
        customer: customerId
    }).lean();

    const cashPaymentsTotal = cashPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    balance += cashPaymentsTotal;

    // Bank Payments TO customer (increase balance - debit) - advances/refunds
    const bankPayments = await BankPayment.find({
        customer: customerId
    }).lean();

    const bankPaymentsTotal = bankPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    balance += bankPaymentsTotal;

    // Cash Receipts FROM customer (decrease balance - credit)
    const cashReceipts = await CashReceipt.find({
        customer: customerId
    }).lean();

    const cashReceiptsTotal = cashReceipts.reduce((sum, receipt) => sum + (receipt.amount || 0), 0);
    balance -= cashReceiptsTotal;

    // Bank Receipts FROM customer (decrease balance - credit)
    const bankReceipts = await BankReceipt.find({
        customer: customerId
    }).lean();

    const bankReceiptsTotal = bankReceipts.reduce((sum, receipt) => sum + (receipt.amount || 0), 0);
    balance -= bankReceiptsTotal;

    // Sales Returns (decrease balance - credit)
    const returns = await Return.find({
        customer: customerId,
        origin: 'sales',
        status: { $in: ['completed', 'refunded', 'approved', 'received'] },
        isDeleted: { $ne: true }
    }).lean();

    const returnsTotal = returns.reduce((sum, ret) => sum + (ret.netRefundAmount || ret.totalRefundAmount || 0), 0);
    balance -= returnsTotal;

    return Math.round(balance * 100) / 100;
}

/**
 * Calculate supplier balance from all transactions
 */
async function calculateSupplierBalance(supplierId) {
    let balance = 0;

    // Purchase Invoices (increase balance - credit/payable)
    // NOTE: Only CONFIRMED purchases, to match Account Ledger Summary
    const purchases = await PurchaseInvoice.find({
        supplier: supplierId,
        status: 'confirmed',
        isDeleted: { $ne: true }
    }).lean();

    const purchasesTotal = purchases.reduce((sum, purchase) => sum + (purchase.pricing?.total || 0), 0);
    balance += purchasesTotal;

    // Cash Payments TO supplier (decrease balance - debit)
    const cashPayments = await CashPayment.find({
        supplier: supplierId
    }).lean();

    const cashPaymentsTotal = cashPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    balance -= cashPaymentsTotal;

    // Bank Payments TO supplier (decrease balance - debit)
    const bankPayments = await BankPayment.find({
        supplier: supplierId
    }).lean();

    const bankPaymentsTotal = bankPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    balance -= bankPaymentsTotal;

    // Cash Receipts FROM supplier (decrease balance - debit) - refunds/advances from supplier
    const cashReceipts = await CashReceipt.find({
        supplier: supplierId
    }).lean();

    const cashReceiptsTotal = cashReceipts.reduce((sum, receipt) => sum + (receipt.amount || 0), 0);
    balance -= cashReceiptsTotal;

    // Bank Receipts FROM supplier (decrease balance - debit) - refunds/advances from supplier
    const bankReceipts = await BankReceipt.find({
        supplier: supplierId
    }).lean();

    const bankReceiptsTotal = bankReceipts.reduce((sum, receipt) => sum + (receipt.amount || 0), 0);
    balance -= bankReceiptsTotal;

    // Purchase Returns (decrease balance - debit)
    const returns = await Return.find({
        supplier: supplierId,
        origin: 'purchase',
        status: { $in: ['completed', 'refunded', 'approved', 'received'] },
        isDeleted: { $ne: true }
    }).lean();

    const returnsTotal = returns.reduce((sum, ret) => sum + (ret.netRefundAmount || ret.totalRefundAmount || 0), 0);
    balance -= returnsTotal;

    return Math.round(balance * 100) / 100;
}

/**
 * Rebuild all customer balances
 */
async function rebuildCustomerBalances() {
    const customers = await Customer.find({}).lean();
    let updated = 0;
    let errors = 0;

    for (const customer of customers) {
        try {
            const calculatedBalance = await calculateCustomerBalance(customer._id);
            await Customer.findByIdAndUpdate(customer._id, {
                currentBalance: calculatedBalance
            });
            updated++;
        } catch (error) {
            console.error(`[Balance Rebuild] Error updating customer ${customer.name}:`, error.message);
            errors++;
        }
    }

    return { updated, errors };
}

/**
 * Rebuild all supplier balances
 */
async function rebuildSupplierBalances() {
    const suppliers = await Supplier.find({}).lean();
    let updated = 0;
    let errors = 0;

    for (const supplier of suppliers) {
        try {
            const calculatedBalance = await calculateSupplierBalance(supplier._id);
            await Supplier.findByIdAndUpdate(supplier._id, {
                pendingBalance: calculatedBalance
            });
            updated++;
        } catch (error) {
            console.error(`[Balance Rebuild] Error updating supplier ${supplier.name || supplier.companyName}:`, error.message);
            errors++;
        }
    }

    return { updated, errors };
}

/**
 * Initialize balance rebuild cron job
 * Runs every 1 minute
 */
function initializeBalanceRebuild() {
    // Run every 1 minute: */1 * * * *
    rebuildJob = cron.schedule('*/1 * * * *', async () => {
        // Prevent concurrent runs
        if (isRunning) {
            console.log('[Balance Rebuild] Previous run still in progress, skipping...');
            return;
        }

        isRunning = true;
        const startTime = Date.now();

        try {
            console.log('[Balance Rebuild] Starting balance rebuild at', new Date().toISOString());

            // Rebuild customer balances
            const customerResults = await rebuildCustomerBalances();

            // Rebuild supplier balances
            const supplierResults = await rebuildSupplierBalances();

            const duration = Date.now() - startTime;
            lastRunTime = new Date();
            lastRunStats = {
                customersUpdated: customerResults.updated,
                suppliersUpdated: supplierResults.updated,
                errors: customerResults.errors + supplierResults.errors,
                duration
            };

            console.log('[Balance Rebuild] Completed successfully in', duration, 'ms');
            console.log('[Balance Rebuild] Results:', {
                customers: customerResults.updated,
                suppliers: supplierResults.updated,
                errors: lastRunStats.errors
            });

            if (lastRunStats.errors > 0) {
                console.error('[Balance Rebuild] Total errors encountered:', lastRunStats.errors);
            }
        } catch (error) {
            console.error('[Balance Rebuild] Fatal error:', error);
            console.error('[Balance Rebuild] Stack trace:', error.stack);
        } finally {
            isRunning = false;
        }
    }, {
        scheduled: true,
        timezone: 'Asia/Karachi' // Pakistan timezone
    });

    console.log('[Balance Rebuild] Cron job initialized - runs every 1 minute');
}

/**
 * Stop the balance rebuild cron job
 */
function stopBalanceRebuild() {
    if (rebuildJob) {
        rebuildJob.stop();
        console.log('[Balance Rebuild] Cron job stopped');
    }
}

/**
 * Manually trigger balance rebuild (for testing or manual runs)
 */
async function triggerManualRun() {
    if (isRunning) {
        throw new Error('Balance rebuild is already running');
    }

    isRunning = true;
    const startTime = Date.now();

    try {
        console.log('[Balance Rebuild] Manual run triggered at', new Date().toISOString());

        const customerResults = await rebuildCustomerBalances();
        const supplierResults = await rebuildSupplierBalances();

        const duration = Date.now() - startTime;
        const results = {
            customersUpdated: customerResults.updated,
            suppliersUpdated: supplierResults.updated,
            errors: customerResults.errors + supplierResults.errors,
            duration
        };

        console.log('[Balance Rebuild] Manual run completed:', results);
        return results;
    } finally {
        isRunning = false;
    }
}

/**
 * Get balance rebuild status
 */
function getBalanceRebuildStatus() {
    return {
        isInitialized: rebuildJob !== null,
        isRunning,
        schedule: '*/1 * * * *',
        description: 'Runs every 1 minute',
        timezone: 'Asia/Karachi',
        lastRunTime,
        lastRunStats
    };
}

module.exports = {
    initializeBalanceRebuild,
    stopBalanceRebuild,
    triggerManualRun,
    getBalanceRebuildStatus
};
