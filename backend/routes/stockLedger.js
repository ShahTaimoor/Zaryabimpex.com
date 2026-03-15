const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { validateDateParams, processDateFilter } = require('../middleware/dateFilter');
const Sales = require('../models/Sales');
const PurchaseInvoice = require('../models/PurchaseInvoice');
const Return = require('../models/Return');
const StockMovement = require('../models/StockMovement');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');

/**
 * @route   GET /api/stock-ledger
 * @desc    Get stock ledger report with filters
 * @access  Private
 */
router.get('/', [
  auth,
  requirePermission('view_reports'),
  query('invoiceType').optional().isIn(['SALE', 'PURCHASE', 'PURCHASE RETURN', 'SALE RETURN', 'DEMAGE', '--All--']).withMessage('Invalid invoice type'),
  query('customer').optional().isMongoId().withMessage('Invalid customer ID'),
  query('supplier').optional().isMongoId().withMessage('Invalid supplier ID'),
  query('product').optional().isMongoId().withMessage('Invalid product ID'),
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

    // Build date filter for different models
    const buildDateFilter = (dateField) => {
      const filter = {};
      if (startDate || endDate) {
        filter[dateField] = {};
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          filter[dateField].$gte = start;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          filter[dateField].$lte = end;
        }
      }
      return Object.keys(filter).length > 0 ? filter : {};
    };

    const ledgerEntries = [];

    // Helper function to add entry
    const addEntry = (entry) => {
      ledgerEntries.push(entry);
    };

    // Process SALES
    if (!invoiceType || invoiceType === 'SALE' || invoiceType === '--All--') {
      const salesFilter = {
        isDeleted: false,
        ...buildDateFilter('billDate')
      };
      
      if (customer) salesFilter.customer = customer;
      if (invoiceNo) salesFilter.orderNumber = { $regex: invoiceNo, $options: 'i' };

      const sales = await Sales.find(salesFilter)
        .populate('customer', 'name businessName')
        .populate('items.product', 'name sku')
        .lean();

      for (const sale of sales) {
        if (!sale.items || sale.items.length === 0) continue;
        
        for (const item of sale.items) {
          if (product && item.product?._id?.toString() !== product) continue;
          if (!item.product) continue;

          addEntry({
            invoiceDate: sale.billDate || sale.createdAt,
            invoiceNo: sale.orderNumber || sale._id.toString(),
            invoiceType: 'SALE',
            customerSupplier: sale.customer?.businessName || sale.customer?.name || sale.customerInfo?.businessName || sale.customerInfo?.name || 'Walk-in Customer',
            productId: item.product._id,
            productName: item.product.name || 'Unknown Product',
            price: item.unitPrice || 0,
            quantity: -(item.quantity || 0), // Negative for sales (stock out)
            amount: -((item.total || item.subtotal || 0)), // Negative for sales
            referenceId: sale._id,
            referenceType: 'Sales'
          });
        }
      }
    }

    // Process PURCHASE
    if (!invoiceType || invoiceType === 'PURCHASE' || invoiceType === '--All--') {
      const purchaseFilter = {
        isDeleted: false,
        invoiceType: 'purchase',
        ...buildDateFilter('invoiceDate')
      };
      
      if (supplier) purchaseFilter.supplier = supplier;
      if (invoiceNo) purchaseFilter.invoiceNumber = { $regex: invoiceNo, $options: 'i' };

      const purchases = await PurchaseInvoice.find(purchaseFilter)
        .populate('supplier', 'name businessName companyName')
        .populate('items.product', 'name sku')
        .lean();

      for (const purchase of purchases) {
        if (!purchase.items || purchase.items.length === 0) continue;
        
        for (const item of purchase.items) {
          if (product && item.product?._id?.toString() !== product) continue;
          if (!item.product) continue;

          addEntry({
            invoiceDate: purchase.invoiceDate || purchase.createdAt,
            invoiceNo: purchase.invoiceNumber || purchase._id.toString(),
            invoiceType: 'PURCHASE',
            customerSupplier: purchase.supplier?.companyName || purchase.supplier?.businessName || purchase.supplier?.name || 
                             purchase.supplierInfo?.companyName || purchase.supplierInfo?.name || 'Unknown Supplier',
            productId: item.product._id,
            productName: item.product.name || 'Unknown Product',
            price: item.unitCost || 0,
            quantity: item.quantity || 0, // Positive for purchases (stock in)
            amount: item.totalCost || 0, // Positive for purchases
            referenceId: purchase._id,
            referenceType: 'PurchaseInvoice'
          });
        }
      }
    }

    // Process SALE RETURN
    if (!invoiceType || invoiceType === 'SALE RETURN' || invoiceType === '--All--') {
      const saleReturnFilter = {
        origin: 'sales',
        status: { $in: ['approved', 'processing', 'received', 'completed', 'refunded'] },
        ...buildDateFilter('returnDate')
      };
      
      if (customer) saleReturnFilter.customer = customer;
      if (invoiceNo) saleReturnFilter.returnNumber = { $regex: invoiceNo, $options: 'i' };

      const saleReturns = await Return.find(saleReturnFilter)
        .populate('customer', 'name businessName')
        .populate('items.product', 'name sku')
        .populate('originalOrder')
        .lean();

      for (const returnDoc of saleReturns) {
        if (!returnDoc.items || returnDoc.items.length === 0) continue;
        
        // Get original sale for invoice number
        const originalSale = await Sales.findById(returnDoc.originalOrder).lean();
        const invoiceNo = originalSale?.orderNumber || returnDoc.returnNumber || returnDoc._id.toString();

        for (const item of returnDoc.items) {
          if (product && item.product?._id?.toString() !== product) continue;
          if (!item.product) continue;

          addEntry({
            invoiceDate: returnDoc.returnDate || returnDoc.createdAt,
            invoiceNo: invoiceNo,
            invoiceType: 'SALE RETURN',
            customerSupplier: returnDoc.customer?.businessName || returnDoc.customer?.name || 'Unknown Customer',
            productId: item.product._id,
            productName: item.product.name || 'Unknown Product',
            price: item.originalPrice || 0,
            quantity: item.quantity || 0, // Positive for returns (stock in)
            amount: item.refundAmount || (item.originalPrice * (item.quantity || 0)), // Positive for returns
            referenceId: returnDoc._id,
            referenceType: 'Return'
          });
        }
      }
    }

    // Process PURCHASE RETURN
    if (!invoiceType || invoiceType === 'PURCHASE RETURN' || invoiceType === '--All--') {
      const purchaseReturnFilter = {
        origin: 'purchase',
        status: { $in: ['approved', 'processing', 'received', 'completed', 'refunded'] },
        ...buildDateFilter('returnDate')
      };
      
      if (supplier) purchaseReturnFilter.supplier = supplier;
      if (invoiceNo) purchaseReturnFilter.returnNumber = { $regex: invoiceNo, $options: 'i' };

      const purchaseReturns = await Return.find(purchaseReturnFilter)
        .populate('supplier', 'name businessName companyName')
        .populate('items.product', 'name sku')
        .populate('originalOrder')
        .lean();

      for (const returnDoc of purchaseReturns) {
        if (!returnDoc.items || returnDoc.items.length === 0) continue;
        
        // Get original purchase invoice for invoice number
        const originalPurchase = await PurchaseInvoice.findById(returnDoc.originalOrder).lean();
        const invoiceNo = originalPurchase?.invoiceNumber || returnDoc.returnNumber || returnDoc._id.toString();

        for (const item of returnDoc.items) {
          if (product && item.product?._id?.toString() !== product) continue;
          if (!item.product) continue;

          addEntry({
            invoiceDate: returnDoc.returnDate || returnDoc.createdAt,
            invoiceNo: invoiceNo,
            invoiceType: 'PURCHASE RETURN',
            customerSupplier: returnDoc.supplier?.companyName || returnDoc.supplier?.businessName || returnDoc.supplier?.name || 'Unknown Supplier',
            productId: item.product._id,
            productName: item.product.name || 'Unknown Product',
            price: item.originalPrice || 0,
            quantity: -(item.quantity || 0), // Negative for purchase returns (stock out)
            amount: -((item.refundAmount || (item.originalPrice * (item.quantity || 0)))), // Negative
            referenceId: returnDoc._id,
            referenceType: 'Return'
          });
        }
      }
    }

    // Process DAMAGE
    if (!invoiceType || invoiceType === 'DEMAGE' || invoiceType === '--All--') {
      const damageFilter = {
        movementType: 'damage',
        ...buildDateFilter('movementDate')
      };
      
      if (product) damageFilter.product = product;

      const damages = await StockMovement.find(damageFilter)
        .populate('product', 'name sku')
        .populate('customer', 'name businessName')
        .populate('supplier', 'name businessName companyName')
        .lean();

      for (const damage of damages) {
        if (!damage.product) continue;
        if (invoiceNo && damage.referenceNumber && !damage.referenceNumber.includes(invoiceNo)) continue;

        let customerSupplier = 'N/A';
        if (damage.customer) {
          customerSupplier = damage.customer.businessName || damage.customer.name || 'Unknown Customer';
        } else if (damage.supplier) {
          customerSupplier = damage.supplier.companyName || damage.supplier.businessName || 
                           damage.supplier.name || 'Unknown Supplier';
        }

        addEntry({
          invoiceDate: damage.movementDate || damage.createdAt,
          invoiceNo: damage.referenceNumber || `DMG-${damage._id.toString()}`,
          invoiceType: 'DEMAGE',
          customerSupplier: customerSupplier,
          productId: damage.product._id,
          productName: damage.product.name || 'Unknown Product',
          price: damage.unitCost || 0,
          quantity: -(damage.quantity || 0), // Negative for damage (stock out)
          amount: -(damage.totalValue || 0), // Negative for damage
          referenceId: damage._id,
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
