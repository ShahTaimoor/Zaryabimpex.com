const express = require('express');
const router = express.Router();
const Sales = require('../models/Sales'); // Still needed for model reference
const PurchaseInvoice = require('../models/PurchaseInvoice'); // Still needed for model reference
const SalesOrder = require('../models/SalesOrder'); // Still needed for model reference
const PurchaseOrder = require('../models/PurchaseOrder'); // Still needed for model reference
const CashReceipt = require('../models/CashReceipt'); // Still needed for model reference
const CashPayment = require('../models/CashPayment'); // Still needed for model reference
const BankReceipt = require('../models/BankReceipt'); // Still needed for model reference
const BankPayment = require('../models/BankPayment'); // Still needed for model reference
const { auth } = require('../middleware/auth');
const salesOrderRepository = require('../repositories/SalesOrderRepository');
const purchaseOrderRepository = require('../repositories/PurchaseOrderRepository');
const cashReceiptRepository = require('../repositories/CashReceiptRepository');
const cashPaymentRepository = require('../repositories/CashPaymentRepository');
const bankReceiptRepository = require('../repositories/BankReceiptRepository');
const bankPaymentRepository = require('../repositories/BankPaymentRepository');
const salesRepository = require('../repositories/SalesRepository');
const purchaseInvoiceRepository = require('../repositories/PurchaseInvoiceRepository');

// Get backdate/future date report
router.get('/', auth, async (req, res) => {
  try {
    const { getStartOfDayPakistan, getEndOfDayPakistan, formatDatePakistan } = require('../utils/dateFilter');
    const today = new Date();
    const todayStr = formatDatePakistan(today);
    const todayDate = getStartOfDayPakistan(todayStr);
    
    // Define date ranges for backdate and future date detection (30 days)
    const thirtyDaysAgoDate = new Date(today);
    thirtyDaysAgoDate.setDate(thirtyDaysAgoDate.getDate() - 30);
    const thirtyDaysAgoStr = formatDatePakistan(thirtyDaysAgoDate);
    const thirtyDaysAgo = getStartOfDayPakistan(thirtyDaysAgoStr);
    
    const thirtyDaysFutureDate = new Date(today);
    thirtyDaysFutureDate.setDate(thirtyDaysFutureDate.getDate() + 30);
    const thirtyDaysFutureStr = formatDatePakistan(thirtyDaysFutureDate);
    const thirtyDaysFuture = getEndOfDayPakistan(thirtyDaysFutureStr);

    // Helper function to format entry for report
    const formatEntry = (entry, type, dateField, amountField, referenceField) => ({
      type,
      id: entry._id,
      reference: entry[referenceField],
      date: entry[dateField],
      amount: entry[amountField] || 0,
      status: entry.status || 'N/A',
      createdBy: entry.createdBy,
      createdAt: entry.createdAt
    });

    // Query all transaction types for backdated/future entries
    const [
      salesOrders,
      purchaseOrders,
      cashReceipts,
      cashPayments,
      bankReceipts,
      bankPayments,
      sales,
      purchases
    ] = await Promise.all([
      // Sales Orders - check orderDate vs createdAt
      salesOrderRepository.findAll({
        $or: [
          { orderDate: { $lt: thirtyDaysAgo } },
          { orderDate: { $gt: thirtyDaysFuture } }
        ]
      }, {
        populate: [
          { path: 'customer', select: 'name' },
          { path: 'createdBy', select: 'name' }
        ]
      }),

      // Purchase Orders - check orderDate vs createdAt  
      purchaseOrderRepository.findAll({
        $or: [
          { orderDate: { $lt: thirtyDaysAgo } },
          { orderDate: { $gt: thirtyDaysFuture } }
        ]
      }, {
        populate: [
          { path: 'supplier', select: 'name' },
          { path: 'createdBy', select: 'name' }
        ]
      }),

      // Cash Receipts - check date vs createdAt
      cashReceiptRepository.findAll({
        $or: [
          { date: { $lt: thirtyDaysAgo } },
          { date: { $gt: thirtyDaysFuture } }
        ]
      }, {
        populate: [
          { path: 'customer', select: 'name' },
          { path: 'createdBy', select: 'name' }
        ]
      }),

      // Cash Payments - check date vs createdAt
      cashPaymentRepository.findAll({
        $or: [
          { date: { $lt: thirtyDaysAgo } },
          { date: { $gt: thirtyDaysFuture } }
        ]
      }, {
        populate: [
          { path: 'supplier', select: 'name' },
          { path: 'createdBy', select: 'name' }
        ]
      }),

      // Bank Receipts - check date vs createdAt
      bankReceiptRepository.findAll({
        $or: [
          { date: { $lt: thirtyDaysAgo } },
          { date: { $gt: thirtyDaysFuture } }
        ]
      }, {
        populate: [
          { path: 'customer', select: 'name' },
          { path: 'createdBy', select: 'name' }
        ]
      }),

      // Bank Payments - check date vs createdAt
      bankPaymentRepository.findAll({
        $or: [
          { date: { $lt: thirtyDaysAgo } },
          { date: { $gt: thirtyDaysFuture } }
        ]
      }, {
        populate: [
          { path: 'supplier', select: 'name' },
          { path: 'createdBy', select: 'name' }
        ]
      }),

      // Sales (Orders) - get recent entries created in the last 30 days
      // Note: Sales model doesn't have a separate transaction date field,
      // so we can only detect entries created recently (potential backdated entries)
      salesRepository.findAll({
        createdAt: { $gte: thirtyDaysAgo }
      }, {
        populate: [
          { path: 'customer', select: 'name' },
          { path: 'createdBy', select: 'name' }
        ]
      }),

      // Purchases (Purchase Invoices) - get recent entries created in the last 30 days
      // Note: PurchaseInvoice model doesn't have a separate invoice date field,
      // so we can only detect entries created recently (potential backdated entries)
      purchaseInvoiceRepository.findAll({
        createdAt: { $gte: thirtyDaysAgo }
      }, {
        populate: [
          { path: 'supplier', select: 'name' },
          { path: 'createdBy', select: 'name' }
        ]
      })
    ]);

    // Format entries for the report
    const reportEntries = [];

    // Add Sales Orders
    salesOrders.forEach(order => {
      const isBackdate = order.orderDate < thirtyDaysAgo;
      const isFuture = order.orderDate > thirtyDaysFuture;
      
      if (isBackdate || isFuture) {
        reportEntries.push({
          ...formatEntry(order, 'Sales Order', 'orderDate', 'total', 'soNumber'),
          dateType: isBackdate ? 'Backdate' : 'Future Date',
          daysDifference: Math.floor((order.orderDate - today) / (1000 * 60 * 60 * 24)),
          customer: order.customer?.name || 'N/A'
        });
      }
    });

    // Add Purchase Orders
    purchaseOrders.forEach(order => {
      const isBackdate = order.orderDate < thirtyDaysAgo;
      const isFuture = order.orderDate > thirtyDaysFuture;
      
      if (isBackdate || isFuture) {
        reportEntries.push({
          ...formatEntry(order, 'Purchase Order', 'orderDate', 'total', 'poNumber'),
          dateType: isBackdate ? 'Backdate' : 'Future Date',
          daysDifference: Math.floor((order.orderDate - today) / (1000 * 60 * 60 * 24)),
          supplier: order.supplier?.name || 'N/A'
        });
      }
    });

    // Add Cash Receipts
    cashReceipts.forEach(receipt => {
      const isBackdate = receipt.date < thirtyDaysAgo;
      const isFuture = receipt.date > thirtyDaysFuture;
      
      if (isBackdate || isFuture) {
        reportEntries.push({
          ...formatEntry(receipt, 'Cash Receipt', 'date', 'amount', 'voucherCode'),
          dateType: isBackdate ? 'Backdate' : 'Future Date',
          daysDifference: Math.floor((receipt.date - today) / (1000 * 60 * 60 * 24)),
          customer: receipt.customer?.name || 'N/A'
        });
      }
    });

    // Add Cash Payments
    cashPayments.forEach(payment => {
      const isBackdate = payment.date < thirtyDaysAgo;
      const isFuture = payment.date > thirtyDaysFuture;
      
      if (isBackdate || isFuture) {
        reportEntries.push({
          ...formatEntry(payment, 'Cash Payment', 'date', 'amount', 'voucherCode'),
          dateType: isBackdate ? 'Backdate' : 'Future Date',
          daysDifference: Math.floor((payment.date - today) / (1000 * 60 * 60 * 24)),
          supplier: payment.supplier?.name || 'N/A'
        });
      }
    });

    // Add Bank Receipts
    bankReceipts.forEach(receipt => {
      const isBackdate = receipt.date < thirtyDaysAgo;
      const isFuture = receipt.date > thirtyDaysFuture;
      
      if (isBackdate || isFuture) {
        reportEntries.push({
          ...formatEntry(receipt, 'Bank Receipt', 'date', 'amount', 'voucherCode'),
          dateType: isBackdate ? 'Backdate' : 'Future Date',
          daysDifference: Math.floor((receipt.date - today) / (1000 * 60 * 60 * 24)),
          customer: receipt.customer?.name || 'N/A'
        });
      }
    });

    // Add Bank Payments
    bankPayments.forEach(payment => {
      const isBackdate = payment.date < thirtyDaysAgo;
      const isFuture = payment.date > thirtyDaysFuture;
      
      if (isBackdate || isFuture) {
        reportEntries.push({
          ...formatEntry(payment, 'Bank Payment', 'date', 'amount', 'voucherCode'),
          dateType: isBackdate ? 'Backdate' : 'Future Date',
          daysDifference: Math.floor((payment.date - today) / (1000 * 60 * 60 * 24)),
          supplier: payment.supplier?.name || 'N/A'
        });
      }
    });

    // Add Sales (Orders) - these are created recently but might have backdated dates
    sales.forEach(order => {
      reportEntries.push({
        ...formatEntry(order, 'Sales', 'createdAt', 'pricing.total', 'orderNumber'),
        dateType: 'Recent Entry',
        daysDifference: Math.floor((today - order.createdAt) / (1000 * 60 * 60 * 24)),
        customer: order.customer?.name || order.customerInfo?.name || 'N/A'
      });
    });

    // Add Purchases (Purchase Invoices)
    purchases.forEach(invoice => {
      reportEntries.push({
        ...formatEntry(invoice, 'Purchase', 'createdAt', 'pricing.total', 'invoiceNumber'),
        dateType: 'Recent Entry',
        daysDifference: Math.floor((today - invoice.createdAt) / (1000 * 60 * 60 * 24)),
        supplier: invoice.supplier?.name || invoice.supplierInfo?.name || 'N/A'
      });
    });

    // Sort by date (most recent first)
    reportEntries.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate summary statistics
    const summary = {
      totalEntries: reportEntries.length,
      backdateEntries: reportEntries.filter(entry => entry.dateType === 'Backdate').length,
      futureEntries: reportEntries.filter(entry => entry.dateType === 'Future Date').length,
      recentEntries: reportEntries.filter(entry => entry.dateType === 'Recent Entry').length,
      totalAmount: reportEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0),
      byType: {}
    };

    // Group by transaction type
    reportEntries.forEach(entry => {
      if (!summary.byType[entry.type]) {
        summary.byType[entry.type] = {
          count: 0,
          totalAmount: 0,
          backdateCount: 0,
          futureCount: 0
        };
      }
      summary.byType[entry.type].count++;
      summary.byType[entry.type].totalAmount += entry.amount || 0;
      if (entry.dateType === 'Backdate') summary.byType[entry.type].backdateCount++;
      if (entry.dateType === 'Future Date') summary.byType[entry.type].futureCount++;
    });

    res.json({
      success: true,
      data: {
        entries: reportEntries,
        summary,
        reportDate: today,
        dateRange: {
          from: thirtyDaysAgo,
          to: thirtyDaysFuture
        }
      }
    });

  } catch (error) {
    console.error('Error generating backdate report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate backdate report',
      error: error.message
    });
  }
});

module.exports = router;
