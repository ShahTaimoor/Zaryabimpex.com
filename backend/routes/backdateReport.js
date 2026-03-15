const express = require('express');
const router = express.Router();
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

    const formatEntry = (entry, type, dateField, amountField, referenceField) => {
      const refMap = { soNumber: 'so_number', poNumber: 'po_number', orderNumber: 'order_number', invoiceNumber: 'invoice_number', voucherCode: 'voucher_code' };
      const refKey = refMap[referenceField] || referenceField;
      const dateVal = entry[dateField] || entry[dateField === 'orderDate' ? 'order_date' : dateField];
      const amountFieldNorm = amountField === 'pricing.total' ? 'total' : amountField;
      return {
        type,
        id: entry.id || entry._id,
        reference: entry[refKey] || entry[referenceField],
        date: dateVal,
        amount: (entry[amountFieldNorm] ?? entry[amountField]) || 0,
        status: entry.status || 'N/A',
        createdBy: entry.created_by || entry.createdBy,
        createdAt: entry.created_at || entry.createdAt
      };
    };

    const [salesOrdersRaw, purchaseOrdersRaw, cashReceiptsRaw, cashPaymentsRaw, bankReceiptsRaw, bankPaymentsRaw, salesRaw, purchasesRaw] = await Promise.all([
      salesOrderRepository.findAll({}, { limit: 2000 }),
      purchaseOrderRepository.findAll({}, { limit: 2000 }),
      cashReceiptRepository.findAll({}, { limit: 2000 }),
      cashPaymentRepository.findAll({}, { limit: 2000 }),
      bankReceiptRepository.findAll({}, { limit: 2000 }),
      bankPaymentRepository.findAll({}, { limit: 2000 }),
      salesRepository.findAll({ dateFrom: thirtyDaysAgo }, { limit: 2000 }),
      purchaseInvoiceRepository.findAll({}, { limit: 2000 })
    ]);

    const salesOrders = (salesOrdersRaw || []).filter(o => {
      const d = o.order_date || o.orderDate;
      return d && (new Date(d) < thirtyDaysAgo || new Date(d) > thirtyDaysFuture);
    });
    const purchaseOrders = (purchaseOrdersRaw || []).filter(o => {
      const d = o.order_date || o.orderDate;
      return d && (new Date(d) < thirtyDaysAgo || new Date(d) > thirtyDaysFuture);
    });
    const cashReceipts = (cashReceiptsRaw || []).filter(r => {
      const d = r.date;
      return d && (new Date(d) < thirtyDaysAgo || new Date(d) > thirtyDaysFuture);
    });
    const cashPayments = (cashPaymentsRaw || []).filter(p => {
      const d = p.date;
      return d && (new Date(d) < thirtyDaysAgo || new Date(d) > thirtyDaysFuture);
    });
    const bankReceipts = (bankReceiptsRaw || []).filter(r => {
      const d = r.date;
      return d && (new Date(d) < thirtyDaysAgo || new Date(d) > thirtyDaysFuture);
    });
    const bankPayments = (bankPaymentsRaw || []).filter(p => {
      const d = p.date;
      return d && (new Date(d) < thirtyDaysAgo || new Date(d) > thirtyDaysFuture);
    });
    const sales = salesRaw || [];
    const purchases = (purchasesRaw || []).filter(p => p.created_at || p.createdAt);

    // Format entries for the report
    const reportEntries = [];

    salesOrders.forEach(order => {
      const orderDate = order.order_date || order.orderDate;
      const isBackdate = new Date(orderDate) < thirtyDaysAgo;
      const isFuture = new Date(orderDate) > thirtyDaysFuture;
      reportEntries.push({
        ...formatEntry(order, 'Sales Order', 'orderDate', 'total', 'soNumber'),
        dateType: isBackdate ? 'Backdate' : 'Future Date',
        daysDifference: Math.floor((new Date(orderDate) - today) / (1000 * 60 * 60 * 24)),
        customer: order.customer?.name || 'N/A'
      });
    });

    purchaseOrders.forEach(order => {
      const orderDate = order.order_date || order.orderDate;
      const isBackdate = new Date(orderDate) < thirtyDaysAgo;
      const isFuture = new Date(orderDate) > thirtyDaysFuture;
      reportEntries.push({
        ...formatEntry(order, 'Purchase Order', 'orderDate', 'total', 'poNumber'),
        dateType: isBackdate ? 'Backdate' : 'Future Date',
        daysDifference: Math.floor((new Date(orderDate) - today) / (1000 * 60 * 60 * 24)),
        supplier: order.supplier?.name || 'N/A'
      });
    });

    cashReceipts.forEach(receipt => {
      const d = receipt.date;
      reportEntries.push({
        ...formatEntry(receipt, 'Cash Receipt', 'date', 'amount', 'voucherCode'),
        dateType: new Date(d) < thirtyDaysAgo ? 'Backdate' : 'Future Date',
        daysDifference: Math.floor((new Date(d) - today) / (1000 * 60 * 60 * 24)),
        customer: receipt.customer?.name || 'N/A'
      });
    });
    cashPayments.forEach(payment => {
      const d = payment.date;
      reportEntries.push({
        ...formatEntry(payment, 'Cash Payment', 'date', 'amount', 'voucherCode'),
        dateType: new Date(d) < thirtyDaysAgo ? 'Backdate' : 'Future Date',
        daysDifference: Math.floor((new Date(d) - today) / (1000 * 60 * 60 * 24)),
        supplier: payment.supplier?.name || 'N/A'
      });
    });
    bankReceipts.forEach(receipt => {
      const d = receipt.date;
      reportEntries.push({
        ...formatEntry(receipt, 'Bank Receipt', 'date', 'amount', 'voucherCode'),
        dateType: new Date(d) < thirtyDaysAgo ? 'Backdate' : 'Future Date',
        daysDifference: Math.floor((new Date(d) - today) / (1000 * 60 * 60 * 24)),
        customer: receipt.customer?.name || 'N/A'
      });
    });
    bankPayments.forEach(payment => {
      const d = payment.date;
      reportEntries.push({
        ...formatEntry(payment, 'Bank Payment', 'date', 'amount', 'voucherCode'),
        dateType: new Date(d) < thirtyDaysAgo ? 'Backdate' : 'Future Date',
        daysDifference: Math.floor((new Date(d) - today) / (1000 * 60 * 60 * 24)),
        supplier: payment.supplier?.name || 'N/A'
      });
    });
    sales.forEach(order => {
      const created = order.created_at || order.createdAt;
      reportEntries.push({
        ...formatEntry(order, 'Sales', 'createdAt', 'pricing.total', 'orderNumber'),
        dateType: 'Recent Entry',
        daysDifference: Math.floor((today - new Date(created)) / (1000 * 60 * 60 * 24)),
        customer: order.customer?.name || order.customerInfo?.name || 'N/A'
      });
    });
    purchases.forEach(invoice => {
      const created = invoice.created_at || invoice.createdAt;
      reportEntries.push({
        ...formatEntry(invoice, 'Purchase', 'createdAt', 'pricing.total', 'invoiceNumber'),
        dateType: 'Recent Entry',
        daysDifference: Math.floor((today - new Date(created)) / (1000 * 60 * 60 * 24)),
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
