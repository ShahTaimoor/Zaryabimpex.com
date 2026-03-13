const express = require('express');
const { body, validationResult, query } = require('express-validator');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { auth, requirePermission } = require('../middleware/auth');
const { validateUuidParam } = require('../middleware/validation');
const { sanitizeRequest, handleValidationErrors } = require('../middleware/validation');
const { validateDateParams, processDateFilter } = require('../middleware/dateFilter');
const purchaseInvoiceService = require('../services/purchaseInvoiceService');
const purchaseInvoiceRepository = require('../repositories/postgres/PurchaseInvoiceRepository');
const supplierRepository = require('../repositories/postgres/SupplierRepository');
const AccountingService = require('../services/accountingService');

const router = express.Router();

// Format supplier address for invoice supplierInfo (for print)
const formatSupplierAddress = (supplierData) => {
  if (!supplierData) return '';
  if (supplierData.address && typeof supplierData.address === 'string') return supplierData.address.trim();
  if (Array.isArray(supplierData.address) && supplierData.address.length > 0) {
    const a = supplierData.address.find(x => x.isDefault) || supplierData.address.find(x => x.type === 'billing' || x.type === 'both') || supplierData.address[0];
    const parts = [a.street || a.address_line1 || a.addressLine1, a.city, a.state || a.province, a.country, a.zipCode || a.zip].filter(Boolean);
    return parts.join(', ');
  }
  if (supplierData.address && typeof supplierData.address === 'object') {
    const a = supplierData.address;
    const parts = [a.street || a.address_line1 || a.addressLine1 || a.line1, a.address_line2 || a.addressLine2 || a.line2, a.city, a.state || a.province, a.country, a.zipCode || a.zip || a.postalCode || a.postal_code].filter(Boolean);
    return parts.join(', ');
  }
  if (supplierData.addresses && Array.isArray(supplierData.addresses) && supplierData.addresses.length > 0) {
    const addr = supplierData.addresses.find(a => a.isDefault) || supplierData.addresses.find(a => a.type === 'billing' || a.type === 'both') || supplierData.addresses[0];
    const parts = [addr.street || addr.address_line1 || addr.addressLine1, addr.city, addr.state || addr.province, addr.country, addr.zipCode || addr.zip].filter(Boolean);
    return parts.join(', ');
  }
  return '';
};

// Helper functions to transform names to uppercase
const transformSupplierToUppercase = (supplier) => {
  if (!supplier) return supplier;
  if (supplier.toObject) supplier = supplier.toObject();
  if (supplier.companyName) supplier.companyName = supplier.companyName.toUpperCase();
  if (supplier.name) supplier.name = supplier.name.toUpperCase();
  if (supplier.contactPerson && supplier.contactPerson.name) {
    supplier.contactPerson.name = supplier.contactPerson.name.toUpperCase();
  }
  return supplier;
};

const transformProductToUppercase = (product) => {
  if (!product) return product;
  if (product.toObject) product = product.toObject();
  if (product.name) product.name = product.name.toUpperCase();
  if (product.description) product.description = product.description.toUpperCase();
  return product;
};

// @route   GET /api/purchase-invoices
// @desc    Get all purchase invoices with filtering and pagination
// @access  Private
router.get('/', [
  auth,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().trim(),
  query('status').optional().isIn(['draft', 'confirmed', 'received', 'paid', 'cancelled', 'closed']),
  query('paymentStatus').optional().isIn(['pending', 'paid', 'partial', 'overdue']),
  query('invoiceType').optional().isIn(['purchase', 'return', 'adjustment']),
  ...validateDateParams,
  handleValidationErrors,
  processDateFilter(['invoiceDate', 'createdAt']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Merge date filter from middleware if present (for Pakistan timezone)
    const queryParams = { ...req.query };
    if (req.dateFilter && Object.keys(req.dateFilter).length > 0) {
      queryParams.dateFilter = req.dateFilter;
    }

    // Call service to get purchase invoices
    const result = await purchaseInvoiceService.getPurchaseInvoices(queryParams);

    res.json({
      invoices: result.invoices,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching purchase invoices:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/purchase-invoices/sync-ledger
// @desc    Sync purchase invoices to ledger: update existing entries + post missing
// @access  Private
router.post('/sync-ledger', auth, requirePermission('view_reports'), async (req, res) => {
  try {
    const dateFrom = req.query.dateFrom || req.body?.dateFrom;
    const dateTo = req.query.dateTo || req.body?.dateTo;
    const result = await purchaseInvoiceService.syncPurchaseInvoicesLedger({ dateFrom, dateTo });
    return res.json({
      success: true,
      message: `Synced purchase invoices ledger. Updated ${result.updated}, posted ${result.posted}.` + (result.errors.length ? ` ${result.errors.length} failed.` : ''),
      ...result
    });
  } catch (error) {
    console.error('Sync purchase invoices ledger error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to sync purchase invoices ledger.' });
  }
});

// @route   GET /api/purchase-invoices/:id
// @desc    Get single purchase invoice
// @access  Private
router.get('/:id', [
  auth,
  validateUuidParam('id'),
  handleValidationErrors
], async (req, res) => {
  try {
    const invoice = await purchaseInvoiceService.getPurchaseInvoiceById(req.params.id);

    res.json({ invoice });
  } catch (error) {
    if (error.message === 'Purchase invoice not found') {
      return res.status(404).json({ message: 'Purchase invoice not found' });
    }
    console.error('Error fetching purchase invoice:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/purchase-invoices
// @desc    Create new purchase invoice
// @access  Private
router.post('/', [
  auth,
  body('supplier').optional().isUUID(4).withMessage('Invalid supplier ID'),
  body('items').isArray({ min: 1 }).withMessage('Items array is required'),
  body('items.*.product').isUUID(4).withMessage('Valid Product ID is required'),
  body('items.*.quantity').isFloat({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.unitCost').isFloat({ min: 0 }).withMessage('Unit cost must be positive'),
  body('pricing.subtotal').isFloat({ min: 0 }).withMessage('Subtotal must be positive'),
  body('pricing.total').isFloat({ min: 0 }).withMessage('Total must be positive'),
  body('invoiceNumber')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      // Allow empty string, null, or undefined - backend will auto-generate
      if (!value || value === '' || value === null || value === undefined) {
        return true;
      }
      // If provided, it must not be empty after trimming
      if (typeof value === 'string' && value.trim().length === 0) {
        throw new Error('Invoice number must not be empty if provided');
      }
      return true;
    }),
  body('invoiceDate').optional().isISO8601().withMessage('Valid invoice date required (ISO 8601 format)'),
  handleValidationErrors
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      supplier,
      supplierInfo,
      items,
      pricing,
      payment,
      invoiceNumber,
      expectedDelivery,
      notes,
      terms,
      invoiceDate
    } = req.body;

    const genInvoiceNumber = () => `PI-${Date.now()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    // Ensure supplierInfo has address - fetch from supplier record if missing
    let enrichedSupplierInfo = supplierInfo || {};
    if (supplier && (!enrichedSupplierInfo.address || (typeof enrichedSupplierInfo.address === 'string' && !enrichedSupplierInfo.address.trim()))) {
      try {
        const supplierData = await supplierRepository.findById(supplier);
        if (supplierData) {
          const addr = formatSupplierAddress(supplierData);
          if (addr) {
            enrichedSupplierInfo = { ...enrichedSupplierInfo, address: addr };
          }
        }
      } catch (e) {
        // Ignore - use whatever supplierInfo was provided
      }
    }
    const invoiceData = {
      supplier,
      supplierInfo: enrichedSupplierInfo,
      items,
      pricing,
      payment: {
        ...payment,
        status: payment?.status || 'pending',
        method: payment?.method || 'cash',
        paidAmount: payment?.amount || payment?.paidAmount || 0,
        isPartialPayment: payment?.isPartialPayment || false
      },
      invoiceNumber: invoiceNumber && String(invoiceNumber).trim() ? invoiceNumber : genInvoiceNumber(),
      expectedDelivery,
      notes,
      terms,
      invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
      createdBy: req.user?.id || req.user?._id
    };

    let invoice = await purchaseInvoiceRepository.create(invoiceData);

    // IMMEDIATE INVENTORY UPDATE - No confirmation required
    const inventoryService = require('../services/inventoryService');
    const inventoryUpdates = [];
    let inventoryUpdateFailed = false;

    for (const item of items) {
      try {

        const inventoryUpdate = await inventoryService.updateStock({
          productId: item.product,
          type: 'in',
          quantity: item.quantity,
          cost: item.unitCost, // Pass cost price from purchase invoice
          reason: 'Purchase Invoice Creation',
          reference: 'Purchase Invoice',
          referenceId: invoice._id,
          referenceModel: 'PurchaseInvoice',
          performedBy: req.user._id,
          notes: `Stock increased due to purchase invoice creation - Invoice: ${invoiceNumber}`
        });

        inventoryUpdates.push({
          productId: item.product,
          quantity: item.quantity,
          newStock: inventoryUpdate.currentStock,
          success: true
        });

      } catch (inventoryError) {
        console.error(`Failed to update inventory for product ${item.product}:`, inventoryError);
        console.error('Full error details:', {
          message: inventoryError.message,
          stack: inventoryError.stack,
          name: inventoryError.name
        });

        inventoryUpdates.push({
          productId: item.product,
          quantity: item.quantity,
          success: false,
          error: inventoryError.message
        });

        inventoryUpdateFailed = true;

        // Continue with other items instead of failing immediately
        console.warn(`Continuing with other items despite inventory update failure for product ${item.product}`);
      }
    }

    // If any inventory updates failed, still create the invoice but warn about it
    if (inventoryUpdateFailed) {
      console.warn('Some inventory updates failed, but invoice will still be created');
      // Don't return error - just log the issue and continue
    }

    // Update supplier outstanding balance for purchase invoices
    // Logic:
    // 1. Add invoice total to pendingBalance (we owe this amount)
    // 2. Record payment which will reduce pendingBalance and handle overpayments (add to advanceBalance)

    if (supplier && pricing && pricing.total > 0) {
      try {
        const SupplierBalanceService = require('../services/supplierBalanceService');
        const supplierExists = await supplierRepository.findById(supplier);
        if (supplierExists) {
          const amountPaid = payment?.amount || payment?.paidAmount || 0;
          if (amountPaid > 0) {
            await SupplierBalanceService.recordPayment(supplier, amountPaid, invoice.id);
          }
        }
      } catch (error) {
        console.error('Error updating supplier balance on purchase invoice creation:', error);
      }
    }

    await purchaseInvoiceRepository.updateById(invoice.id, { status: 'confirmed', confirmedDate: new Date() });
    invoice = await purchaseInvoiceRepository.findById(invoice.id);

    // Post to account ledger
    try {
      const AccountingService = require('../services/accountingService');
      await AccountingService.recordPurchaseInvoice(invoice);
    } catch (error) {
      console.error('Error creating accounting entries for purchase invoice:', error);
      // Don't fail the request, but log the error
    }

    const successCount = inventoryUpdates.filter(update => update.success).length;
    const failureCount = inventoryUpdates.filter(update => !update.success).length;

    let message = 'Purchase invoice created successfully';
    if (successCount > 0) {
      message += ` and ${successCount} product(s) added to inventory`;
    }
    if (failureCount > 0) {
      message += ` (${failureCount} inventory update(s) failed - check logs for details)`;
    }

    res.status(201).json({
      message: message,
      invoice,
      inventoryUpdates: inventoryUpdates
    });
  } catch (error) {
    console.error('Error creating purchase invoice:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/purchase-invoices/:id
// @desc    Update purchase invoice
// @access  Private
router.put('/:id', [
  auth,
  body('supplier').optional().isUUID(4).withMessage('Valid supplier is required'),
  body('invoiceType').optional().isIn(['purchase', 'return', 'adjustment']).withMessage('Invalid invoice type'),
  body('notes').optional().trim().isLength({ max: 1000 }).withMessage('Notes too long'),
  body('items').optional().isArray({ min: 1 }).withMessage('Items array is required'),
  body('items.*.product').optional().isUUID(4).withMessage('Valid Product ID is required'),
  body('items.*.quantity').optional().isFloat({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.unitCost').optional().isFloat({ min: 0 }).withMessage('Unit cost must be positive'),
  body('invoiceDate').optional().isISO8601().withMessage('Valid invoice date required (ISO 8601 format)'),
  handleValidationErrors
], async (req, res) => {
  try {
    const invoice = await purchaseInvoiceRepository.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: 'Purchase invoice not found' });
    }

    // Cannot update received, paid, or closed invoices
    if (['received', 'paid', 'closed'].includes(invoice.status)) {
      return res.status(400).json({ message: 'Cannot update received, paid, or closed invoices' });
    }

    // Store old values for comparison
    const oldItems = JSON.parse(JSON.stringify(invoice.items || []));
    const oldTotal = invoice.pricing.total;
    const oldSupplier = invoice.supplier;

    let supplierData = null;
    if (req.body.supplier) {
      supplierData = await supplierRepository.findById(req.body.supplier);
      if (!supplierData) {
        return res.status(400).json({ message: 'Supplier not found' });
      }
    }

    const updateData = {
      ...req.body,
      lastModifiedBy: req.user?.id || req.user?._id
    };

    // Update invoiceDate if provided (for backdating/postdating)
    if (req.body.invoiceDate !== undefined) {
      updateData.invoiceDate = req.body.invoiceDate ? new Date(req.body.invoiceDate) : null;
    }

    // Update supplier info if supplier is being updated
    if (req.body.supplier !== undefined) {
      updateData.supplierId = req.body.supplier || null;
      updateData.supplierInfo = supplierData ? {
        name: supplierData.name || supplierData.contact_person,
        email: supplierData.email,
        phone: supplierData.phone,
        companyName: supplierData.company_name || supplierData.companyName,
        address: formatSupplierAddress(supplierData)
      } : null;
    }

    // Recalculate pricing if items are being updated
    if (req.body.items && req.body.items.length > 0) {
      let newSubtotal = 0;
      let newTotalDiscount = 0;
      let newTotalTax = 0;

      for (const item of req.body.items) {
        const itemSubtotal = item.quantity * item.unitCost;
        const itemDiscount = itemSubtotal * ((item.discountPercent || 0) / 100);
        const itemTaxable = itemSubtotal - itemDiscount;
        const itemTax = (invoice.pricing && invoice.pricing.isTaxExempt) ? 0 : itemTaxable * (item.taxRate || 0);

        newSubtotal += itemSubtotal;
        newTotalDiscount += itemDiscount;
        newTotalTax += itemTax;
      }

      // Update pricing in updateData
      updateData.pricing = {
        ...invoice.pricing,
        subtotal: newSubtotal,
        discountAmount: newTotalDiscount,
        taxAmount: newTotalTax,
        total: newSubtotal - newTotalDiscount + newTotalTax
      };
    }

    const updatedInvoice = await purchaseInvoiceRepository.updateById(req.params.id, updateData);

    // Parse updatedInvoice payment/pricing if they came back as string from DB
    const updatedPayment = typeof updatedInvoice?.payment === 'string' ? JSON.parse(updatedInvoice.payment || '{}') : (updatedInvoice?.payment || {});
    const updatedPricing = typeof updatedInvoice?.pricing === 'string' ? JSON.parse(updatedInvoice.pricing || '{}') : (updatedInvoice?.pricing || {});
    const updatedSupplierId = updatedInvoice.supplier_id || updatedInvoice.supplierId || updatedInvoice.supplier;

    const totalChanged = Math.abs((updatedPricing.total || 0) - oldTotal) >= 0.01;
    const supplierChanged = String(oldSupplier || '') !== String(updatedSupplierId || '');

    // Account Ledger: When confirmed invoice and (total or supplier) changed - reverse old entries and re-post
    let didFullLedgerRepost = false;
    if (invoice.status === 'confirmed' && (totalChanged || supplierChanged)) {
      try {
        const invoiceId = updatedInvoice.id || updatedInvoice._id;
        await AccountingService.reverseLedgerEntriesByReference('purchase_invoice', invoiceId);
        await AccountingService.reverseLedgerEntriesByReference('purchase_invoice_payment', invoiceId);
        const fullInvoiceForLedger = await purchaseInvoiceRepository.findById(req.params.id);
        await AccountingService.recordPurchaseInvoice({
          ...fullInvoiceForLedger,
          createdBy: req.user?.id || req.user?._id
        });
        didFullLedgerRepost = true;
      } catch (ledgerErr) {
        console.error('Failed to re-post purchase invoice to ledger:', ledgerErr);
      }
    }

    // Account Ledger: When only payment amount changed (and we didn't do full re-post)
    if (!didFullLedgerRepost && req.body.payment !== undefined) {
      const oldAmountPaid = parseFloat(invoice.payment?.amount ?? invoice.payment?.paidAmount ?? 0) || 0;
      const newAmountPaid = parseFloat(updatedPayment?.amount ?? updatedPayment?.paidAmount ?? 0) || 0;
      if (Math.abs(newAmountPaid - oldAmountPaid) >= 0.01) {
        try {
          const supplierId = updatedInvoice.supplier_id || updatedInvoice.supplierId || invoice.supplier_id || invoice.supplierId;
          await AccountingService.recordPurchasePaymentAdjustment({
            invoiceId: updatedInvoice.id || updatedInvoice._id,
            invoiceNumber: updatedInvoice.invoice_number || updatedInvoice.invoiceNumber,
            supplierId: supplierId || updatedInvoice.supplier,
            oldAmountPaid,
            newAmountPaid,
            paymentMethod: updatedPayment?.method || invoice.payment?.method || 'cash',
            createdBy: req.user?.id || req.user?._id
          });
        } catch (ledgerErr) {
          console.error('Failed to post purchase payment adjustment to ledger:', ledgerErr);
        }
      }
    }

    // Adjust inventory based on item changes if invoice was confirmed
    if (invoice.status === 'confirmed' && req.body.items && req.body.items.length > 0) {
      try {
        const inventoryService = require('../services/inventoryService');

        for (const newItem of req.body.items) {
          const oldItem = oldItems.find(oi => {
            const oldProductId = (oi.product?.id || oi.product?._id || oi.product)?.toString?.() || String(oi.product);
            const newProductId = (newItem.product?.id || newItem.product)?.toString?.() || String(newItem.product);
            return oldProductId === newProductId;
          });
          const oldQuantity = oldItem ? oldItem.quantity : 0;
          const quantityChange = newItem.quantity - oldQuantity;

          if (quantityChange !== 0) {
            if (quantityChange > 0) {
              // Quantity increased - add more inventory
              const productId = newItem.product?.id || newItem.product?._id || newItem.product;
              await inventoryService.updateStock({
                productId,
                type: 'in',
                quantity: quantityChange,
                reason: 'Purchase Invoice Update - Quantity Increased',
                reference: 'Purchase Invoice',
                referenceId: updatedInvoice.id || updatedInvoice._id,
                referenceModel: 'PurchaseInvoice',
                performedBy: req.user?.id || req.user?._id,
                notes: `Inventory increased due to purchase invoice ${updatedInvoice.invoice_number || updatedInvoice.invoiceNumber} update - quantity increased by ${quantityChange}`
              });
            } else {
              // Quantity decreased - reduce inventory
              const productId = newItem.product?.id || newItem.product?._id || newItem.product;
              await inventoryService.updateStock({
                productId,
                type: 'out',
                quantity: Math.abs(quantityChange),
                reason: 'Purchase Invoice Update - Quantity Decreased',
                reference: 'Purchase Invoice',
                referenceId: updatedInvoice.id || updatedInvoice._id,
                referenceModel: 'PurchaseInvoice',
                performedBy: req.user?.id || req.user?._id,
                notes: `Inventory reduced due to purchase invoice ${updatedInvoice.invoice_number || updatedInvoice.invoiceNumber} update - quantity decreased by ${Math.abs(quantityChange)}`
              });
            }
          }
        }

        for (const oldItem of oldItems) {
          const oldProductId = (oldItem.product?.id || oldItem.product?._id || oldItem.product)?.toString?.() || String(oldItem.product);
          const stillExists = req.body.items.find(newItem => {
            const newProductId = (newItem.product?.id || newItem.product)?.toString?.() || String(newItem.product);
            return oldProductId === newProductId;
          });
          if (!stillExists) {
            await inventoryService.updateStock({
              productId: oldItem.product?.id || oldItem.product?._id || oldItem.product,
              type: 'out',
              quantity: oldItem.quantity,
              reason: 'Purchase Invoice Update - Item Removed',
              reference: 'Purchase Invoice',
              referenceId: updatedInvoice.id,
              referenceModel: 'PurchaseInvoice',
              performedBy: req.user?.id || req.user?._id,
              notes: `Inventory reduced due to purchase invoice ${updatedInvoice.invoice_number || updatedInvoice.invoiceNumber} update - item removed`
            });
          }
        }
      } catch (error) {
        console.error('Error adjusting inventory on purchase invoice update:', error);
        // Don't fail update if inventory adjustment fails
      }
    }

    // Adjust supplier balance if total changed, payment changed, or supplier changed
    // Need to properly handle overpayments using SupplierBalanceService
    if (updatedSupplierId && (
      updatedPricing.total !== oldTotal ||
      oldSupplier?.toString() !== String(updatedSupplierId) ||
      (updatedPayment?.amount || updatedPayment?.paidAmount || 0) !== (invoice.payment?.amount || invoice.payment?.paidAmount || 0)
    )) {
      try {
        const SupplierBalanceService = require('../services/supplierBalanceService');

        // Note: Manual supplier balance rollback and update removed.
        // The ledger entries will be updated/reversed as needed.

        // Record new payment if any
        const newAmountPaid = updatedPayment?.amount || updatedPayment?.paidAmount || 0;
        if (newAmountPaid > 0) {
          await SupplierBalanceService.recordPayment(updatedSupplierId, newAmountPaid, updatedInvoice.id || updatedInvoice._id);
        }
      } catch (error) {
        console.error('Error adjusting supplier balance on purchase invoice update:', error);
        // Don't fail update if balance adjustment fails
      }
    }

    // Fetch full invoice with supplier/items (Postgres - no Mongoose populate)
    const fullInvoice = await purchaseInvoiceRepository.findById(req.params.id);

    res.json({
      message: 'Purchase invoice updated successfully',
      invoice: fullInvoice || updatedInvoice
    });
  } catch (error) {
    console.error('Error updating purchase invoice:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/purchase-invoices/:id
// @desc    Delete purchase invoice (with inventory and supplier balance rollback)
// @access  Private
router.delete('/:id', [
  auth,
  requirePermission('delete_purchase_invoices')
], async (req, res) => {
  try {
    const invoice = await purchaseInvoiceRepository.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: 'Purchase invoice not found' });
    }

    // Cannot delete paid or closed invoices
    if (['paid', 'closed'].includes(invoice.status)) {
      return res.status(400).json({ message: 'Cannot delete paid or closed invoices' });
    }


    const inventoryService = require('../services/inventoryService');
    const inventoryRollbacks = [];
    const items = Array.isArray(invoice.items) ? invoice.items : (typeof invoice.items === 'string' ? JSON.parse(invoice.items) : []);

    if (invoice.status === 'confirmed') {
      for (const item of items) {
        try {

          const productId = item.product?.id ?? item.product?._id ?? item.product;
          const inventoryRollback = await inventoryService.updateStock({
            productId,
            type: 'out',
            quantity: item.quantity,
            reason: 'Purchase Invoice Deletion',
            reference: 'Purchase Invoice Deletion',
            referenceId: invoice.id,
            referenceModel: 'PurchaseInvoice',
            performedBy: req.user?.id || req.user?._id,
            notes: `Inventory rolled back due to deletion of purchase invoice ${invoice.invoice_number || invoice.invoiceNumber}`
          });

          inventoryRollbacks.push({
            productId,
            quantity: item.quantity,
            newStock: inventoryRollback.currentStock,
            success: true
          });

        } catch (error) {
          console.error(`Failed to rollback inventory for product ${productId}:`, error);
          inventoryRollbacks.push({
            productId: productId,
            quantity: item.quantity,
            success: false,
            error: error.message
          });
        }
      }
    }

    // ROLLBACK SUPPLIER BALANCE - Reverse invoice total and payment
    // This matches the new logic in purchase invoice creation
    if (invoice.supplier && invoice.pricing && invoice.pricing.total > 0) {
      try {
        // Note: Supplier balance rollback removed from route.
        // The ledger entries will handle the reversal.

        // Potential reversal of payment if needed
        const amountPaid = invoice.payment?.amount || invoice.payment?.paidAmount || 0;
        if (amountPaid > 0) {
          // If we had a direct reversal method in SupplierBalanceService, we'd use it here.
          // For now, the ledger reversal in AccountingService will handle it partially,
          // but we should ensure the payment entry in the ledger is also voided.
        }
      } catch (error) {
        console.error('Error rolling back supplier balance:', error);
        // Continue with deletion even if supplier update fails
      }
    }

    await purchaseInvoiceRepository.softDelete(req.params.id);


    res.json({
      message: 'Purchase invoice deleted successfully',
      inventoryRollbacks: inventoryRollbacks
    });
  } catch (error) {
    console.error('Error deleting purchase invoice:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/purchase-invoices/:id/confirm
// @desc    Confirm purchase invoice (DEPRECATED - Purchase invoices are now auto-confirmed)
// @access  Private
router.put('/:id/confirm', [
  auth
], async (req, res) => {
  try {
    const invoice = await purchaseInvoiceRepository.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: 'Purchase invoice not found' });
    }

    // Purchase invoices are now automatically confirmed upon creation
    // This endpoint is kept for backward compatibility but does nothing
    res.json({
      message: 'Purchase invoice is already confirmed (auto-confirmed upon creation)',
      invoice
    });
  } catch (error) {
    console.error('Error confirming purchase invoice:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/purchase-invoices/:id/cancel
// @desc    Cancel purchase invoice
// @access  Private
router.put('/:id/cancel', [
  auth
], async (req, res) => {
  try {
    const invoice = await purchaseInvoiceRepository.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: 'Purchase invoice not found' });
    }

    if (['paid', 'closed'].includes(invoice.status)) {
      return res.status(400).json({ message: 'Cannot cancel paid or closed invoice' });
    }

    const updated = await purchaseInvoiceRepository.updateById(req.params.id, {
      status: 'cancelled',
      lastModifiedBy: req.user?.id || req.user?._id
    });

    res.json({
      message: 'Purchase invoice cancelled successfully',
      invoice: updated || invoice
    });
  } catch (error) {
    console.error('Error cancelling purchase invoice:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/purchase-invoices/export/pdf
// @desc    Export purchase invoices to PDF
// @access  Private
router.post('/export/pdf', [auth, requirePermission('view_purchase_invoices')], async (req, res) => {
  try {
    const { filters = {} } = req.body;
    const filter = {};
    if (filters.search) filter.search = filters.search;
    if (filters.status) filter.status = filters.status;
    if (filters.paymentStatus) filter.paymentStatus = filters.paymentStatus;
    if (filters.supplier) filter.supplierId = filters.supplier;
    if (filters.dateFrom) filter.dateFrom = filters.dateFrom;
    if (filters.dateTo) filter.dateTo = filters.dateTo;

    let supplierName = null;
    if (filters.supplier) {
      const supplier = await supplierRepository.findById(filters.supplier);
      if (supplier) {
        supplierName = supplier.company_name || supplier.companyName || supplier.name ||
          `${supplier.first_name || ''} ${supplier.last_name || ''}`.trim() || 'Unknown Supplier';
      }
    }

    const { invoices } = await purchaseInvoiceRepository.findWithPagination(filter, { getAll: true });
    invoices.forEach(inv => {
      inv.createdAt = inv.created_at ?? inv.createdAt;
      inv.invoiceNumber = inv.invoice_number ?? inv.invoiceNumber;
      if (typeof inv.pricing === 'string') inv.pricing = JSON.parse(inv.pricing);
      if (typeof inv.items === 'string') inv.items = JSON.parse(inv.items);
    });

    // Ensure exports directory exists
    const exportsDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `purchases_${timestamp}.pdf`;
    const filepath = path.join(exportsDir, filename);

    // Create PDF document
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    // Helper function to format currency
    const formatCurrency = (amount) => {
      return `$${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Helper function to format date as DD/MM/YYYY
    const formatDate = (date) => {
      if (!date) return 'N/A';
      const d = new Date(date);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('PURCHASE REPORT', { align: 'center' });
    doc.moveDown(0.5);

    // Supplier name (if filtered by supplier)
    if (supplierName) {
      doc.fontSize(14).font('Helvetica-Bold').text(`Supplier: ${supplierName}`, { align: 'center' });
      doc.moveDown(0.5);
    }

    // Report date range (only show if date filters are applied)
    if (filters.dateFrom || filters.dateTo) {
      const dateRange = `Period: ${filters.dateFrom ? formatDate(filters.dateFrom) : 'All'} - ${filters.dateTo ? formatDate(filters.dateTo) : 'All'}`;
      doc.fontSize(12).font('Helvetica').text(dateRange, { align: 'center' });
      doc.moveDown(0.5);
    }

    doc.moveDown(1);

    // Summary section
    const totalInvoices = invoices.length;
    const totalAmount = invoices.reduce((sum, invoice) => sum + (invoice.pricing?.total || 0), 0);
    const statusCounts = {};
    const paymentStatusCounts = {};
    let totalItems = 0;
    let earliestDate = null;
    let latestDate = null;

    invoices.forEach(invoice => {
      // Status breakdown
      statusCounts[invoice.status] = (statusCounts[invoice.status] || 0) + 1;

      // Payment status breakdown
      const paymentStatus = invoice.payment?.status || 'pending';
      paymentStatusCounts[paymentStatus] = (paymentStatusCounts[paymentStatus] || 0) + 1;

      // Total items
      if (invoice.items && Array.isArray(invoice.items)) {
        totalItems += invoice.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      }

      // Date range
      if (invoice.createdAt) {
        const invoiceDate = new Date(invoice.createdAt);
        if (!earliestDate || invoiceDate < earliestDate) {
          earliestDate = invoiceDate;
        }
        if (!latestDate || invoiceDate > latestDate) {
          latestDate = invoiceDate;
        }
      }
    });

    const averageInvoiceValue = totalInvoices > 0 ? totalAmount / totalInvoices : 0;

    // Summary section with three columns (similar to invoice format)
    const leftColumnX = 50;
    const middleColumnX = 220;
    const rightColumnX = 390;
    const columnWidth = 160; // Width for each column
    const lineHeight = 16; // Consistent line height
    const headerLineYOffset = 12; // Offset for header separator line

    doc.fontSize(11).font('Helvetica-Bold').text('Summary', { underline: true });
    doc.moveDown(0.5);

    // Start all columns at the same Y position
    const startY = doc.y;
    let leftY = startY;
    let middleY = startY;
    let rightY = startY;

    // Left column - Purchase Summary
    doc.fontSize(10).font('Helvetica-Bold').text('Purchase Summary:', leftColumnX, leftY);
    // Draw separator line under header
    doc.moveTo(leftColumnX, leftY + headerLineYOffset).lineTo(leftColumnX + columnWidth, leftY + headerLineYOffset).stroke({ color: '#cccccc', width: 0.5 });
    leftY += lineHeight + 3;

    doc.fontSize(10).font('Helvetica');
    doc.text(`Total Amount: ${formatCurrency(totalAmount)}`, leftColumnX, leftY);
    leftY += lineHeight;
    doc.text(`Total Items: ${totalItems}`, leftColumnX, leftY);
    leftY += lineHeight;
    doc.text(`Avg Invoice Value: ${formatCurrency(averageInvoiceValue)}`, leftColumnX, leftY);
    leftY += lineHeight;

    // Middle column - Status Details
    doc.fontSize(10).font('Helvetica-Bold').text('Status Details:', middleColumnX, middleY);
    // Draw separator line under header
    doc.moveTo(middleColumnX, middleY + headerLineYOffset).lineTo(middleColumnX + columnWidth, middleY + headerLineYOffset).stroke({ color: '#cccccc', width: 0.5 });
    middleY += lineHeight + 3;

    doc.fontSize(10).font('Helvetica');
    if (Object.keys(statusCounts).length > 0) {
      Object.entries(statusCounts).forEach(([status, count]) => {
        doc.text(`${status.charAt(0).toUpperCase() + status.slice(1)}: ${count}`, middleColumnX, middleY);
        middleY += lineHeight;
      });
    }

    // Right column - Payment & Types
    doc.fontSize(10).font('Helvetica-Bold').text('Payment Status:', rightColumnX, rightY);
    // Draw separator line under header
    doc.moveTo(rightColumnX, rightY + headerLineYOffset).lineTo(rightColumnX + columnWidth, rightY + headerLineYOffset).stroke({ color: '#cccccc', width: 0.5 });
    rightY += lineHeight + 3;

    doc.fontSize(10).font('Helvetica');
    if (Object.keys(paymentStatusCounts).length > 0) {
      Object.entries(paymentStatusCounts).forEach(([status, count]) => {
        doc.text(`${status.charAt(0).toUpperCase() + status.slice(1)}: ${count}`, rightColumnX, rightY);
        rightY += lineHeight;
      });
    }

    // Move to the lower of all three columns
    const finalY = Math.max(leftY, Math.max(middleY, rightY));
    doc.y = finalY;
    doc.moveDown(1);

    // Table setup
    const tableTop = doc.y;
    const leftMargin = 50;
    const pageWidth = 550;

    // Adjust column widths based on whether supplier filter is applied
    const showSupplierColumn = !supplierName; // Only show supplier column if no supplier filter
    const availableWidth = pageWidth - leftMargin; // Total available width for columns

    const colWidths = showSupplierColumn ? {
      sno: 30,
      invoiceNumber: 110,
      supplier: 120,
      date: 75,
      status: 65,
      total: 75,
      items: 65
    } : {
      sno: 30,
      invoiceNumber: 130,
      date: 85,
      status: 65,
      total: 85,
      items: 90
    };

    // Verify total width doesn't exceed available space
    const totalWidth = Object.values(colWidths).reduce((sum, width) => sum + width, 0);
    if (totalWidth > availableWidth) {
      // Scale down proportionally if needed
      const scale = availableWidth / totalWidth;
      Object.keys(colWidths).forEach(key => {
        colWidths[key] = Math.floor(colWidths[key] * scale);
      });
    }

    // Table headers
    doc.fontSize(10).font('Helvetica-Bold');
    let xPos = leftMargin;
    doc.text('SNO', xPos, tableTop, { width: colWidths.sno, align: 'center' });
    xPos += colWidths.sno;
    doc.text('Date', xPos, tableTop);
    xPos += colWidths.date;
    doc.text('Invoice #', xPos, tableTop);
    xPos += colWidths.invoiceNumber;
    if (showSupplierColumn) {
      doc.text('Supplier', xPos, tableTop);
      xPos += colWidths.supplier;
    }
    doc.text('Status', xPos, tableTop);
    xPos += colWidths.status;
    // Total header - right-aligned to match data
    doc.text('Total', xPos, tableTop, { width: colWidths.total, align: 'right' });
    xPos += colWidths.total;
    // Items header - right-aligned to match data
    doc.text('Items', xPos, tableTop, { width: colWidths.items, align: 'right' });

    // Draw header line
    doc.moveTo(leftMargin, tableTop + 15).lineTo(pageWidth, tableTop + 15).stroke();

    let currentY = tableTop + 25;
    const rowHeight = 20;
    const pageHeight = 750;
    let serialNumber = 1; // Track serial number across pages

    // Table rows
    invoices.forEach((invoice, index) => {
      // Check if we need a new page
      if (currentY > pageHeight - 50) {
        doc.addPage();
        currentY = 50;

        // Redraw headers on new page
        doc.fontSize(10).font('Helvetica-Bold');
        xPos = leftMargin;
        doc.text('SNO', xPos, currentY, { width: colWidths.sno, align: 'center' });
        xPos += colWidths.sno;
        doc.text('Date', xPos, currentY);
        xPos += colWidths.date;
        doc.text('Invoice #', xPos, currentY);
        xPos += colWidths.invoiceNumber;
        if (showSupplierColumn) {
          doc.text('Supplier', xPos, currentY);
          xPos += colWidths.supplier;
        }
        doc.text('Status', xPos, currentY);
        xPos += colWidths.status;
        // Total header - right-aligned to match data
        doc.text('Total', xPos, currentY, { width: colWidths.total, align: 'right' });
        xPos += colWidths.total;
        // Items header - right-aligned to match data
        doc.text('Items', xPos, currentY, { width: colWidths.items, align: 'right' });

        doc.moveTo(leftMargin, currentY + 15).lineTo(pageWidth, currentY + 15).stroke();
        currentY += 25;
      }

      const statusText = invoice.status ? invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1) : 'N/A';
      const itemsCount = invoice.items?.length || 0;

      // Alternating row background color (zebra striping)
      const isEvenRow = (serialNumber - 1) % 2 === 1;
      const rowBgColor = isEvenRow ? '#f9fafb' : '#ffffff';

      // Draw row background
      doc.fillColor(rowBgColor);
      doc.rect(leftMargin, currentY, pageWidth - leftMargin, rowHeight).fill();

      // Reset fill color to black for text
      doc.fillColor('black');
      doc.fontSize(9).font('Helvetica');
      xPos = leftMargin;
      // Serial number - centered
      doc.text(serialNumber.toString(), xPos, currentY, {
        width: colWidths.sno,
        align: 'center'
      });
      xPos += colWidths.sno;
      serialNumber++; // Increment for next row
      // Date - before Invoice #
      doc.text(formatDate(invoice.createdAt), xPos, currentY, {
        width: colWidths.date
      });
      xPos += colWidths.date;
      // Invoice number - prevent wrapping, use ellipsis if too long
      const invoiceNum = invoice.invoiceNumber || 'N/A';
      doc.text(invoiceNum, xPos, currentY, {
        width: colWidths.invoiceNumber,
        ellipsis: true
      });
      xPos += colWidths.invoiceNumber;
      // Supplier name - only show if no supplier filter is applied
      if (showSupplierColumn) {
        const invoiceSupplierName = invoice.supplier?.companyName ||
          invoice.supplier?.name ||
          `${invoice.supplier?.firstName || ''} ${invoice.supplier?.lastName || ''}`.trim() ||
          invoice.supplierInfo?.companyName ||
          invoice.supplierInfo?.name ||
          'Unknown Supplier';
        doc.text(invoiceSupplierName.substring(0, 20), xPos, currentY, {
          width: colWidths.supplier,
          ellipsis: true
        });
        xPos += colWidths.supplier;
      }
      doc.text(statusText, xPos, currentY, {
        width: colWidths.status
      });
      xPos += colWidths.status;
      doc.text(formatCurrency(invoice.pricing?.total || 0), xPos, currentY, {
        width: colWidths.total,
        align: 'right'
      });
      xPos += colWidths.total;
      doc.text(itemsCount.toString(), xPos, currentY, {
        width: colWidths.items,
        align: 'right'
      });

      // Draw row line
      doc.moveTo(leftMargin, currentY + 12).lineTo(pageWidth, currentY + 12).stroke({ color: '#cccccc', width: 0.5 });

      currentY += rowHeight;
    });

    // Footer - Center aligned (same line format like invoice)
    currentY += 20;
    if (currentY > pageHeight - 50) {
      doc.addPage();
      currentY = 50;
    }

    doc.moveDown(2);
    let footerText = `Generated on: ${formatDate(new Date())}`;
    if (req.user) {
      const userName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();
      if (userName) {
        footerText += ` | Generated by: ${userName}`;
      }
    }
    // Center the footer text by using the full page width
    const footerX = leftMargin;
    const footerWidth = pageWidth - leftMargin;
    doc.fontSize(9).font('Helvetica').text(footerText, footerX, doc.y, {
      width: footerWidth,
      align: 'center'
    });

    // Add date range below if available
    if (earliestDate && latestDate) {
      doc.moveDown(0.3);
      const dateRangeText = `Date Range: ${formatDate(earliestDate)} ${formatDate(latestDate)}`;
      doc.fontSize(9).font('Helvetica').text(dateRangeText, footerX, doc.y, {
        width: footerWidth,
        align: 'center'
      });
    }

    // Finalize PDF
    doc.end();

    // Wait for stream to finish
    await new Promise((resolve, reject) => {
      stream.on('finish', () => {
        resolve();
      });
      stream.on('error', reject);
    });

    res.json({
      message: 'Purchase invoices exported successfully',
      filename: filename,
      recordCount: invoices.length,
      downloadUrl: `/api/purchase-invoices/download/${filename}`
    });

  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ message: 'Export failed', error: error.message });
  }
});

// @route   GET /api/purchase-invoices/download/:filename
// @desc    Download exported file
// @access  Private
router.get('/download/:filename', [auth, requirePermission('view_purchase_invoices')], (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(__dirname, '../exports', filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Download failed', error: err.message });
        }
      }
    });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ message: 'Download failed', error: error.message });
  }
});

module.exports = router;
