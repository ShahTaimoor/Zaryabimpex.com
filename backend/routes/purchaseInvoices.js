const express = require('express');
const { body, validationResult, query } = require('express-validator');
const fs = require('fs');
const path = require('path');
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
  query('limit').optional().isInt({ min: 1, max: 999999 }),
  query('all').optional({ checkFalsy: true }).isBoolean(),
  query('search').optional().trim(),
  query('status').optional().isIn(['draft', 'confirmed', 'received', 'paid', 'cancelled', 'closed']),
  query('paymentStatus').optional().isIn(['pending', 'paid', 'partial', 'overdue']),
  query('invoiceType').optional().isIn(['purchase', 'return', 'adjustment']),
  query('listMode').optional().isIn(['full', 'minimal']),
  query('cursor').optional().isString().trim(),
  ...validateDateParams,
  handleValidationErrors,
  processDateFilter(['invoiceDate', 'createdAt']),
], async (req, res, next) => {
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
    return next(error);
  }
});

// @route   POST /api/purchase-invoices/sync-ledger
// @desc    Sync purchase invoices to ledger: update existing entries + post missing
// @access  Private
router.post('/sync-ledger', auth, requirePermission('view_reports'), async (req, res, next) => {
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
    return next(error);
  }
});

// @route   GET /api/purchase-invoices/:id
// @desc    Get single purchase invoice
// @access  Private
router.get('/:id', [
  auth,
  validateUuidParam('id'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const invoice = await purchaseInvoiceService.getPurchaseInvoiceById(req.params.id);

    res.json({ invoice });
  } catch (error) {
    if (error.message === 'Purchase invoice not found') {
      return res.status(404).json({ message: 'Purchase invoice not found' });
    }
    return next(error);
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
], async (req, res, next) => {
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
      invoiceNumber: invoiceNumber && String(invoiceNumber).trim() ? invoiceNumber : undefined,
      expectedDelivery,
      notes,
      terms,
      invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date()
    };

    let invoice = await purchaseInvoiceService.createPurchaseInvoice(invoiceData, req.user);

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
        }, { skipAccountingEntry: true });

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
    return next(error);
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
              }, { skipAccountingEntry: true });
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
              }, { skipAccountingEntry: true });
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
            }, { skipAccountingEntry: true });
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
          }, { skipAccountingEntry: true });

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

    // Reverse account ledger entries so ledger summary reflects the deletion
    try {
      const invoiceId = req.params.id;
      await AccountingService.reverseLedgerEntriesByReference('purchase_invoice', invoiceId);
      await AccountingService.reverseLedgerEntriesByReference('purchase_invoice_payment', invoiceId);
    } catch (ledgerErr) {
      console.error('Reverse ledger for purchase invoice delete:', ledgerErr);
      // Continue with deletion; ledger may not have had entries (e.g. draft)
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



// Export the router
module.exports = router;
