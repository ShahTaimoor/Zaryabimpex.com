/**
 * Balance Calculation Service
 * 
 * This service calculates balances from the Account Ledger.
 * The Account Ledger is the single source of truth for all balances.
 * 
 * Formula: Closing Balance = Opening Balance + Total Debit - Total Credit
 */

const Sales = require('../models/Sales');
const SalesOrder = require('../models/SalesOrder');
const CashReceipt = require('../models/CashReceipt');
const BankReceipt = require('../models/BankReceipt');
const Return = require('../models/Return');
const PurchaseInvoice = require('../models/PurchaseInvoice');
const PurchaseOrder = require('../models/PurchaseOrder');
const CashPayment = require('../models/CashPayment');
const BankPayment = require('../models/BankPayment');

class BalanceCalculationService {
    /**
     * Calculate customer balance from ledger entries
     * 
     * @param {ObjectId} customerId - Customer ID
     * @param {Date} asOfDate - Calculate balance as of this date (optional)
     * @returns {Object} Balance breakdown
     */
    async calculateCustomerBalance(customerId, asOfDate = null) {
        const dateFilter = asOfDate ? { $lte: asOfDate } : {};

        // Sales Invoices (DEBIT - increases customer balance)
        // NOTE: Include ALL sales to match Account Ledger Summary
        const sales = await Sales.find({
            customer: customerId,
            isDeleted: { $ne: true },
            ...(asOfDate && { createdAt: dateFilter })
        }).lean();

        const totalSales = sales.reduce((sum, sale) => sum + (sale.pricing?.total || 0), 0);

        // Cash Payments TO customer (DEBIT - increases balance) - advances/refunds
        const cashPayments = await CashPayment.find({
            customer: customerId,
            ...(asOfDate && { date: dateFilter })
        }).lean();

        const totalCashPayments = cashPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);

        // Bank Payments TO customer (DEBIT - increases balance) - advances/refunds
        const bankPayments = await BankPayment.find({
            customer: customerId,
            ...(asOfDate && { date: dateFilter })
        }).lean();

        const totalBankPayments = bankPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);

        // Cash Receipts FROM customer (CREDIT - decreases customer balance)
        const cashReceipts = await CashReceipt.find({
            customer: customerId,
            ...(asOfDate && { date: dateFilter })
        }).lean();

        const totalCashReceipts = cashReceipts.reduce((sum, receipt) => sum + (receipt.amount || 0), 0);

        // Bank Receipts FROM customer (CREDIT - decreases customer balance)
        const bankReceipts = await BankReceipt.find({
            customer: customerId,
            ...(asOfDate && { date: dateFilter })
        }).lean();

        const totalBankReceipts = bankReceipts.reduce((sum, receipt) => sum + (receipt.amount || 0), 0);

        // Sales Returns (CREDIT - decreases customer balance)
        const returns = await Return.find({
            customer: customerId,
            origin: 'sales',
            status: { $in: ['completed', 'refunded', 'approved', 'received'] },
            isDeleted: { $ne: true },
            ...(asOfDate && { returnDate: dateFilter })
        }).lean();

        const totalReturns = returns.reduce((sum, ret) => sum + (ret.netRefundAmount || ret.totalRefundAmount || 0), 0);

        // Calculate balance
        const totalDebits = totalSales + totalCashPayments + totalBankPayments;
        const totalCredits = totalCashReceipts + totalBankReceipts + totalReturns;
        const balance = totalDebits - totalCredits;

        return {
            balance: Math.round(balance * 100) / 100,
            breakdown: {
                sales: totalSales,
                cashPaymentsToCustomer: totalCashPayments,
                bankPaymentsToCustomer: totalBankPayments,
                cashReceipts: totalCashReceipts,
                bankReceipts: totalBankReceipts,
                returns: totalReturns,
                totalDebits,
                totalCredits
            },
            transactionCounts: {
                sales: sales.length,
                cashPayments: cashPayments.length,
                bankPayments: bankPayments.length,
                cashReceipts: cashReceipts.length,
                bankReceipts: bankReceipts.length,
                returns: returns.length
            }
        };
    }
    /**
     * Calculate supplier balance from ledger entries
     * 
     * @param {ObjectId} supplierId - Supplier ID
     * @param {Date} asOfDate - Calculate balance as of this date (optional)
     * @returns {Object} Balance breakdown
     */
    async calculateSupplierBalance(supplierId, asOfDate = null) {
        const dateFilter = asOfDate ? { $lte: asOfDate } : {};

        // Purchase Invoices (CREDIT - increases supplier balance/payable)
        // NOTE: Only CONFIRMED purchases to match Account Ledger Summary
        const purchases = await PurchaseInvoice.find({
            supplier: supplierId,
            status: 'confirmed',
            isDeleted: { $ne: true },
            ...(asOfDate && { createdAt: dateFilter })
        }).lean();

        const totalPurchases = purchases.reduce((sum, purchase) => sum + (purchase.pricing?.total || 0), 0);

        // Cash Payments (DEBIT - decreases supplier balance)
        const cashPayments = await CashPayment.find({
            supplier: supplierId,
            ...(asOfDate && { date: dateFilter })
        }).lean();

        const totalCashPayments = cashPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);

        // Bank Payments (DEBIT - decreases supplier balance)
        const bankPayments = await BankPayment.find({
            supplier: supplierId,
            ...(asOfDate && { date: dateFilter })
        }).lean();

        const totalBankPayments = bankPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);

        // Cash Receipts FROM supplier (DEBIT - decreases supplier balance) - refunds/advances
        const cashReceipts = await CashReceipt.find({
            supplier: supplierId,
            ...(asOfDate && { date: dateFilter })
        }).lean();

        const totalCashReceipts = cashReceipts.reduce((sum, receipt) => sum + (receipt.amount || 0), 0);

        // Bank Receipts FROM supplier (DEBIT - decreases supplier balance) - refunds/advances
        const bankReceipts = await BankReceipt.find({
            supplier: supplierId,
            ...(asOfDate && { date: dateFilter })
        }).lean();

        const totalBankReceipts = bankReceipts.reduce((sum, receipt) => sum + (receipt.amount || 0), 0);

        // Purchase Returns (DEBIT - decreases supplier balance)
        const returns = await Return.find({
            supplier: supplierId,
            origin: 'purchase',
            status: { $in: ['completed', 'refunded', 'approved', 'received'] },
            isDeleted: { $ne: true },
            ...(asOfDate && { returnDate: dateFilter })
        }).lean();

        const totalReturns = returns.reduce((sum, ret) => sum + (ret.netRefundAmount || ret.totalRefundAmount || 0), 0);

        // Calculate balance
        const totalCredits = totalPurchases;
        const totalDebits = totalCashPayments + totalBankPayments + totalCashReceipts + totalBankReceipts + totalReturns;
        const balance = totalCredits - totalDebits;

        return {
            balance: Math.round(balance * 100) / 100,
            breakdown: {
                purchases: totalPurchases,
                cashPayments: totalCashPayments,
                bankPayments: totalBankPayments,
                cashReceipts: totalCashReceipts,
                bankReceipts: totalBankReceipts,
                returns: totalReturns,
                totalCredits,
                totalDebits
            },
            transactionCounts: {
                purchases: purchases.length,
                cashPayments: cashPayments.length,
                bankPayments: bankPayments.length,
                cashReceipts: cashReceipts.length,
                bankReceipts: bankReceipts.length,
                returns: returns.length
            }
        };
    }

    /**
     * Get customer balance with detailed breakdown
     */
    async getCustomerBalanceDetails(customerId) {
        const result = await this.calculateCustomerBalance(customerId);
        return {
            customerId,
            currentBalance: result.balance,
            ...result
        };
    }

    /**
     * Get supplier balance with detailed breakdown
     */
    async getSupplierBalanceDetails(supplierId) {
        const result = await this.calculateSupplierBalance(supplierId);
        return {
            supplierId,
            outstandingBalance: result.balance,
            ...result
        };
    }

    /**
     * Verify if customer profile balance matches ledger
     */
    async verifyCustomerBalance(customer) {
        const ledgerBalance = await this.calculateCustomerBalance(customer._id);
        const profileBalance = customer.currentBalance || 0;
        const difference = Math.abs(ledgerBalance.balance - profileBalance);

        return {
            customerId: customer._id,
            customerName: customer.name,
            profileBalance,
            ledgerBalance: ledgerBalance.balance,
            difference,
            isMatch: difference < 0.01, // Allow 1 cent tolerance for rounding
            breakdown: ledgerBalance.breakdown
        };
    }

    /**
     * Verify if supplier profile balance matches ledger
     */
    async verifySupplierBalance(supplier) {
        const ledgerBalance = await this.calculateSupplierBalance(supplier._id);
        const profileBalance = supplier.outstandingBalance || 0;
        const difference = Math.abs(ledgerBalance.balance - profileBalance);

        return {
            supplierId: supplier._id,
            supplierName: supplier.name,
            profileBalance,
            ledgerBalance: ledgerBalance.balance,
            difference,
            isMatch: difference < 0.01, // Allow 1 cent tolerance for rounding
            breakdown: ledgerBalance.breakdown
        };
    }

    /**
     * Sync customer balance from ledger to profile
     */
    async syncCustomerBalance(customerId) {
        const Customer = require('../models/Customer');
        const ledgerBalance = await this.calculateCustomerBalance(customerId);

        await Customer.findByIdAndUpdate(customerId, {
            currentBalance: ledgerBalance.balance
        });

        return {
            customerId,
            newBalance: ledgerBalance.balance,
            breakdown: ledgerBalance.breakdown
        };
    }

    /**
     * Sync supplier balance from ledger to profile
     */
    async syncSupplierBalance(supplierId) {
        const Supplier = require('../models/Supplier');
        const ledgerBalance = await this.calculateSupplierBalance(supplierId);

        await Supplier.findByIdAndUpdate(supplierId, {
            outstandingBalance: ledgerBalance.balance
        });

        return {
            supplierId,
            newBalance: ledgerBalance.balance,
            breakdown: ledgerBalance.breakdown
        };
    }
}

module.exports = new BalanceCalculationService();
