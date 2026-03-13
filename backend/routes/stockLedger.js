const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { validateDateParams, processDateFilter } = require('../middleware/dateFilter');
const SalesRepository = require('../repositories/SalesRepository');
const PurchaseInvoiceRepository = require('../repositories/PurchaseInvoiceRepository');
const ReturnRepository = require('../repositories/postgres/ReturnRepository');
const StockMovementRepository = require('../repositories/StockMovementRepository');
const ProductRepository = require('../repositories/postgres/ProductRepository');
const CustomerRepository = require('../repositories/postgres/CustomerRepository');
const SupplierRepository = require('../repositories/postgres/SupplierRepository');

/**
 * @route   GET /api/stock-ledger
 * @desc    Get stock ledger report with filters
 * @access  Private
 */
router.get('/', [
  auth,
  requirePermission('view_reports'),
  query('invoiceType').optional().isIn(['SALE', 'PURCHASE', 'PURCHASE RETURN', 'SALE RETURN', 'DEMAGE', '--All--']).withMessage('Invalid invoice type'),
  query('customer').optional().isUUID(4).withMessage('Invalid customer ID'),
  query('supplier').optional().isUUID(4).withMessage('Invalid supplier ID'),
  query('product').optional().isUUID(4).withMessage('Invalid product ID'),
  query('invoiceNo').optional().isString().trim().withMessage('Invalid invoice number'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
  ...validateDateParams,
  handleValidationErrors,
  processDateFilter(['billDate', 'createdAt', 'invoiceDate', 'returnDate', 'movementDate']),
], async (req, res) => {
  try {
    const {
      invoiceType,
      customer,
      supplier,
      product,
      invoiceNo,
      page = 1,
      limit = 1000
    } = req.query;

    // If no filters are selected, return empty data
    const hasFilters = invoiceType || customer || supplier || product || invoiceNo || 
                      (req.dateRange && (req.dateRange.startDate || req.dateRange.endDate));
    
    if (!hasFilters) {
      return res.json({
        success: true,
        data: {
          ledger: [],
          productTotals: [],
          grandTotal: {
            totalQuantity: 0,
            totalAmount: 0
          },
          pagination: {
            current: 1,
            pages: 1,
            total: 0,
            limit: parseInt(limit)
          }
        }
      });
    }

    const startDate = req.dateRange?.startDate;
    const endDate = req.dateRange?.endDate;

    const dateFrom = startDate ? (() => { const d = new Date(startDate); d.setHours(0, 0, 0, 0); return d; })() : null;
    const dateTo = endDate ? (() => { const d = new Date(endDate); d.setHours(23, 59, 59, 999); return d; })() : null;

    const ledgerEntries = [];

    // Helper function to add entry
    const addEntry = (entry) => {
      ledgerEntries.push(entry);
    };

    if (!invoiceType || invoiceType === 'SALE' || invoiceType === '--All--') {
      const salesFilter = { dateFrom, dateTo };
      if (customer) salesFilter.customerId = customer;
      if (invoiceNo) salesFilter.orderNumber = invoiceNo;
      const sales = await SalesRepository.findAll(salesFilter);
      const customerCache = {};
      for (const sale of sales || []) {
        let items = sale.items;
        if (typeof items === 'string') items = JSON.parse(items);
        if (!items || items.length === 0) continue;
        let customerName = 'Walk-in Customer';
        if (sale.customer_id) {
          customerCache[sale.customer_id] = customerCache[sale.customer_id] || await CustomerRepository.findById(sale.customer_id);
          const c = customerCache[sale.customer_id];
          customerName = c?.business_name || c?.businessName || c?.displayName || c?.name || customerName;
        }
        const saleId = sale.id || sale._id;
        const invoiceDate = sale.sale_date || sale.created_at || sale.createdAt;
        const orderNum = sale.order_number || sale.orderNumber || saleId;
        for (const item of items) {
          const productId = item.product || item.product_id;
          if (product && String(productId) !== product) continue;
          if (!productId) continue;
          const prod = await ProductRepository.findById(productId);
          addEntry({
            invoiceDate,
            invoiceNo: orderNum,
            invoiceType: 'SALE',
            customerSupplier: customerName,
            productId: productId,
            productName: prod?.name || 'Unknown Product',
            price: item.unit_price || item.unitPrice || 0,
            quantity: -(item.quantity || 0),
            amount: -((item.total || item.subtotal || (item.quantity || 0) * (item.unit_price || item.unitPrice || 0))),
            referenceId: saleId,
            referenceType: 'Sales'
          });
        }
      }
    }

    if (!invoiceType || invoiceType === 'PURCHASE' || invoiceType === '--All--') {
      const purchases = await PurchaseInvoiceRepository.findAll(
        { supplierId: supplier, supplier, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined },
        {}
      );
      const supplierCache = {};
      for (const purchase of purchases || []) {
        let items = purchase.items;
        if (typeof items === 'string') items = JSON.parse(items);
        if (!items || items.length === 0) continue;
        let supplierName = 'Unknown Supplier';
        if (purchase.supplier_id) {
          supplierCache[purchase.supplier_id] = supplierCache[purchase.supplier_id] || await SupplierRepository.findById(purchase.supplier_id);
          const s = supplierCache[purchase.supplier_id];
          supplierName = s?.company_name || s?.companyName || s?.business_name || s?.displayName || s?.name || supplierName;
        }
        const purchaseId = purchase.id || purchase._id;
        const invDate = purchase.invoice_date || purchase.created_at || purchase.createdAt;
        const invNum = purchase.invoice_number || purchase.invoiceNumber || purchaseId;
        if (invoiceNo && (!invNum || !String(invNum).toLowerCase().includes(String(invoiceNo).toLowerCase()))) continue;
        if (dateFrom && new Date(invDate) < dateFrom) continue;
        if (dateTo && new Date(invDate) > dateTo) continue;
        for (const item of items) {
          const productId = item.product || item.product_id;
          if (product && String(productId) !== product) continue;
          if (!productId) continue;
          const prod = await ProductRepository.findById(productId);
          addEntry({
            invoiceDate: invDate,
            invoiceNo: invNum,
            invoiceType: 'PURCHASE',
            customerSupplier: supplierName,
            productId,
            productName: prod?.name || 'Unknown Product',
            price: item.unit_cost || item.unitCost || 0,
            quantity: item.quantity || 0,
            amount: item.total_cost || item.totalCost || (item.quantity || 0) * (item.unit_cost || item.unitCost || 0),
            referenceId: purchaseId,
            referenceType: 'PurchaseInvoice'
          });
        }
      }
    }

    if (!invoiceType || invoiceType === 'SALE RETURN' || invoiceType === '--All--') {
      const saleReturnFilter = { returnType: 'sale_return', dateFrom, dateTo, customerId: customer };
      if (invoiceNo) saleReturnFilter.returnNumber = invoiceNo;
      const saleReturns = await ReturnRepository.findAll(saleReturnFilter);
      for (const returnDoc of saleReturns || []) {
        let items = returnDoc.items;
        if (typeof items === 'string') items = JSON.parse(items);
        if (!items || items.length === 0) continue;
        const refId = returnDoc.reference_id || returnDoc.originalOrder;
        const originalSale = refId ? await SalesRepository.findById(refId) : null;
        const invNo = originalSale?.order_number || originalSale?.orderNumber || returnDoc.return_number || returnDoc.returnNumber || (returnDoc.id || returnDoc._id);
        let customerName = 'Unknown Customer';
        if (returnDoc.customer_id) {
          const c = await CustomerRepository.findById(returnDoc.customer_id);
          customerName = c?.business_name || c?.businessName || c?.displayName || c?.name || customerName;
        }
        const retDate = returnDoc.return_date || returnDoc.returnDate || returnDoc.created_at || returnDoc.createdAt;
        for (const item of items) {
          const pid = item.product && (typeof item.product === 'object' ? (item.product.id || item.product._id) : item.product) || item.product_id;
          if (product && String(pid) !== product) continue;
          if (!pid) continue;
          const prod = await ProductRepository.findById(pid);
          addEntry({
            invoiceDate: retDate,
            invoiceNo: invNo,
            invoiceType: 'SALE RETURN',
            customerSupplier: customerName,
            productId: pid,
            productName: prod?.name || 'Unknown Product',
            price: item.originalPrice || item.original_price || 0,
            quantity: item.quantity || 0,
            amount: item.refundAmount || item.refund_amount || (item.originalPrice || item.original_price || 0) * (item.quantity || 0),
            referenceId: returnDoc.id || returnDoc._id,
            referenceType: 'Return'
          });
        }
      }
    }

    if (!invoiceType || invoiceType === 'PURCHASE RETURN' || invoiceType === '--All--') {
      const purchaseReturnFilter = { returnType: 'purchase_return', dateFrom, dateTo, supplierId: supplier };
      if (invoiceNo) purchaseReturnFilter.returnNumber = invoiceNo;
      const purchaseReturns = await ReturnRepository.findAll(purchaseReturnFilter);
      for (const returnDoc of purchaseReturns || []) {
        let items = returnDoc.items;
        if (typeof items === 'string') items = JSON.parse(items);
        if (!items || items.length === 0) continue;
        let supplierName = 'Unknown Supplier';
        if (returnDoc.supplier_id) {
          const s = await SupplierRepository.findById(returnDoc.supplier_id);
          supplierName = s?.company_name || s?.companyName || s?.business_name || s?.displayName || s?.name || supplierName;
        }
        const refId = returnDoc.reference_id || returnDoc.originalOrder;
        const originalPurchase = refId ? await PurchaseInvoiceRepository.findById(refId) : null;
        const invNo = originalPurchase?.invoice_number || originalPurchase?.invoiceNumber || returnDoc.return_number || returnDoc.returnNumber || (returnDoc.id || returnDoc._id);
        const retDate = returnDoc.return_date || returnDoc.returnDate || returnDoc.created_at || returnDoc.createdAt;
        for (const item of items) {
          const pid = item.product && (typeof item.product === 'object' ? (item.product.id || item.product._id) : item.product) || item.product_id;
          if (product && String(pid) !== product) continue;
          if (!pid) continue;
          const prod = await ProductRepository.findById(pid);
          addEntry({
            invoiceDate: retDate,
            invoiceNo: invNo,
            invoiceType: 'PURCHASE RETURN',
            customerSupplier: supplierName,
            productId: pid,
            productName: prod?.name || 'Unknown Product',
            price: item.originalPrice || item.original_price || 0,
            quantity: -(item.quantity || 0),
            amount: -((item.refundAmount || item.refund_amount) || (item.originalPrice || item.original_price || 0) * (item.quantity || 0)),
            referenceId: returnDoc.id || returnDoc._id,
            referenceType: 'Return'
          });
        }
      }
    }

    if (!invoiceType || invoiceType === 'DEMAGE' || invoiceType === '--All--') {
      const damageFilter = { movementType: 'damage', dateFrom, dateTo, productId: product, product };
      const damages = await StockMovementRepository.findAll(damageFilter);
      for (const damage of damages || []) {
        const productId = damage.product_id || damage.product;
        if (product && String(productId) !== product) continue;
        if (invoiceNo && damage.reference_number && !String(damage.reference_number).includes(String(invoiceNo))) continue;
        let customerSupplier = 'N/A';
        if (damage.customer_id) {
          const c = await CustomerRepository.findById(damage.customer_id);
          customerSupplier = c?.business_name || c?.businessName || c?.displayName || c?.name || 'Unknown Customer';
        } else if (damage.supplier_id) {
          const s = await SupplierRepository.findById(damage.supplier_id);
          customerSupplier = s?.company_name || s?.companyName || s?.business_name || s?.displayName || s?.name || 'Unknown Supplier';
        }
        const prod = productId ? await ProductRepository.findById(productId) : null;
        addEntry({
          invoiceDate: damage.created_at || damage.movementDate || damage.createdAt,
          invoiceNo: damage.reference_number || damage.referenceNumber || `DMG-${damage.id || damage._id}`,
          invoiceType: 'DEMAGE',
          customerSupplier,
          productId: productId,
          productName: damage.product_name || prod?.name || 'Unknown Product',
          price: damage.unit_cost || damage.unitCost || 0,
          quantity: -(damage.quantity || 0),
          amount: -(damage.total_value ?? damage.totalValue ?? 0),
          referenceId: damage.id || damage._id,
          referenceType: 'StockMovement'
        });
      }
    }

    // Sort by invoice date
    ledgerEntries.sort((a, b) => {
      const dateA = new Date(a.invoiceDate);
      const dateB = new Date(b.invoiceDate);
      return dateA - dateB;
    });

    // Group by product and calculate totals
    const productMap = new Map();
    let grandTotalQty = 0;
    let grandTotalAmount = 0;

    for (const entry of ledgerEntries) {
      const productId = entry.productId?.toString() || 'unknown';
      
      if (!productMap.has(productId)) {
        productMap.set(productId, {
          productId: entry.productId,
          productName: entry.productName,
          entries: [],
          totalQuantity: 0,
          totalAmount: 0
        });
      }

      const productData = productMap.get(productId);
      productData.entries.push(entry);
      productData.totalQuantity += entry.quantity;
      productData.totalAmount += entry.amount;
      
      grandTotalQty += entry.quantity;
      grandTotalAmount += entry.amount;
    }

    // Convert to array format
    const productTotals = Array.from(productMap.values()).map(productData => ({
      productId: productData.productId,
      productName: productData.productName,
      entries: productData.entries,
      totalQuantity: productData.totalQuantity,
      totalAmount: productData.totalAmount
    }));

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedProducts = productTotals.slice(skip, skip + parseInt(limit));
    const totalPages = Math.ceil(productTotals.length / parseInt(limit));

    res.json({
      success: true,
      data: {
        ledger: paginatedProducts,
        productTotals: paginatedProducts.map(p => ({
          productId: p.productId,
          productName: p.productName,
          totalQuantity: p.totalQuantity,
          totalAmount: p.totalAmount
        })),
        grandTotal: {
          totalQuantity: grandTotalQty,
          totalAmount: grandTotalAmount
        },
        pagination: {
          current: parseInt(page),
          pages: totalPages,
          total: productTotals.length,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching stock ledger:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
