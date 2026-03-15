const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { validateDateParams, processDateFilter } = require('../middleware/dateFilter');
const inventoryService = require('../services/inventoryService');
const purchaseOrderService = require('../services/purchaseOrderService');
const supplierRepository = require('../repositories/SupplierRepository');
const PurchaseOrder = require('../models/PurchaseOrder'); // Still needed for generatePONumber static method

const router = express.Router();

// Helper functions to transform names to uppercase
const transformSupplierToUppercase = (supplier) => {
  if (!supplier) return supplier;
  if (supplier.toObject) supplier = supplier.toObject();
  if (supplier.companyName) supplier.companyName = supplier.companyName.toUpperCase();
  if (supplier.contactPerson && supplier.contactPerson.name) {
    supplier.contactPerson.name = supplier.contactPerson.name.toUpperCase();
  }
  return supplier;
};

const transformProductToUppercase = (product) => {
  if (!product) return product;
  if (product.toObject) product = product.toObject();
  // Handle both products and variants
  if (product.displayName) {
    product.displayName = product.displayName.toUpperCase();
  }
  if (product.variantName) {
    product.variantName = product.variantName.toUpperCase();
  }
  if (product.name) product.name = product.name.toUpperCase();
  if (product.description) product.description = product.description.toUpperCase();
  return product;
};

// @route   GET /api/purchase-orders
// @desc    Get all purchase orders with filtering and pagination
// @access  Private
router.get('/', [
  auth,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 999999 }),
  query('all').optional({ checkFalsy: true }).isBoolean(),
  query('search').optional().trim(),
  query('status').optional().isIn(['draft', 'confirmed', 'partially_received', 'fully_received', 'cancelled', 'closed']),
  query('supplier').optional().isMongoId(),
  ...validateDateParams,
  handleValidationErrors,
  processDateFilter('createdAt'),
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

    // Call service to get purchase orders
    const result = await purchaseOrderService.getPurchaseOrders(queryParams);

    res.json({
      purchaseOrders: result.purchaseOrders,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Get purchase orders error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/purchase-orders/:id
// @desc    Get single purchase order
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const purchaseOrder = await purchaseOrderService.getPurchaseOrderById(req.params.id);
    res.json({ purchaseOrder });
  } catch (error) {
    if (error.message === 'Purchase order not found') {
      return res.status(404).json({ message: 'Purchase order not found' });
    }
    console.error('Get purchase order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/purchase-orders
// @desc    Create new purchase order
// @access  Private
router.post('/', [
  auth,
  requirePermission('create_purchase_orders'),
  body('supplier').isMongoId().withMessage('Valid supplier is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product').isMongoId().withMessage('Valid product is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.costPerUnit').isFloat({ min: 0 }).withMessage('Cost per unit must be positive'),
  body('expectedDelivery').optional().isISO8601().withMessage('Valid delivery date required'),
  body('notes').optional().trim().isLength({ max: 1000 }).withMessage('Notes too long'),
  body('isTaxExempt').optional().isBoolean().withMessage('Tax exempt must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const purchaseOrder = await purchaseOrderService.createPurchaseOrder(req.body, req.user._id);

    // Transform names to uppercase
    if (purchaseOrder.supplier) {
      purchaseOrder.supplier = transformSupplierToUppercase(purchaseOrder.supplier);
    }
    if (purchaseOrder.items && Array.isArray(purchaseOrder.items)) {
      purchaseOrder.items.forEach(item => {
        if (item.product) {
          item.product = transformProductToUppercase(item.product);
        }
      });
    }

    res.status(201).json({
      message: 'Purchase order created successfully',
      purchaseOrder
    });
  } catch (error) {
    console.error('Create purchase order error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({
      message: 'Server error. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/purchase-orders/:id
// @desc    Update purchase order
// @access  Private
router.put('/:id', [
  auth,
  requirePermission('edit_purchase_orders'),
  body('supplier').optional().isMongoId().withMessage('Valid supplier is required'),
  body('items').optional().isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product').optional().isMongoId().withMessage('Valid product is required'),
  body('items.*.quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.costPerUnit').optional().isFloat({ min: 0 }).withMessage('Cost per unit must be positive'),
  body('expectedDelivery').optional().isISO8601().withMessage('Valid delivery date required'),
  body('notes').optional().trim().isLength({ max: 1000 }).withMessage('Notes too long'),
  body('terms').optional().trim().isLength({ max: 1000 }).withMessage('Terms too long'),
  body('isTaxExempt').optional().isBoolean().withMessage('Tax exempt must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const updatedPO = await purchaseOrderService.updatePurchaseOrder(
      req.params.id,
      req.body,
      req.user._id
    );

    // Store old items for comparison (for inventory updates)
    const oldItems = JSON.parse(JSON.stringify(updatedPO.items));

    // Adjust inventory if order was confirmed and items changed
    if (updatedPO.status === 'confirmed' && req.body.items && req.body.items.length > 0) {
      try {
        const inventoryService = require('../services/inventoryService');

        for (const newItem of req.body.items) {
          const oldItem = oldItems.find(oi => {
            const oldProductId = oi.product?._id ? oi.product._id.toString() : oi.product?.toString() || oi.product;
            const newProductId = newItem.product?.toString() || newItem.product;
            return oldProductId === newProductId;
          });
          const oldQuantity = oldItem ? oldItem.quantity : 0;
          const quantityChange = newItem.quantity - oldQuantity;

          if (quantityChange !== 0) {
            if (quantityChange > 0) {
              // Quantity increased - add more inventory
              await inventoryService.updateStock({
                productId: newItem.product,
                type: 'in',
                quantity: quantityChange,
                cost: newItem.costPerUnit, // Pass cost price
                reason: 'Purchase Order Update - Quantity Increased',
                reference: 'Purchase Order',
                referenceId: updatedPO._id,
                referenceModel: 'PurchaseOrder',
                performedBy: req.user._id,
                notes: `Inventory increased due to purchase order ${updatedPO.poNumber} update - quantity increased by ${quantityChange}`
              });
            } else {
              // Quantity decreased - reduce inventory
              await inventoryService.updateStock({
                productId: newItem.product,
                type: 'out',
                quantity: Math.abs(quantityChange),
                reason: 'Purchase Order Update - Quantity Decreased',
                reference: 'Purchase Order',
                referenceId: updatedPO._id,
                referenceModel: 'PurchaseOrder',
                performedBy: req.user._id,
                notes: `Inventory reduced due to purchase order ${updatedPO.poNumber} update - quantity decreased by ${Math.abs(quantityChange)}`
              });
            }
          }
        }

        // Handle removed items (items that were in old but not in new)
        for (const oldItem of oldItems) {
          const oldProductId = oldItem.product?._id ? oldItem.product._id.toString() : oldItem.product?.toString() || oldItem.product;
          const stillExists = req.body.items.find(newItem => {
            const newProductId = newItem.product?.toString() || newItem.product;
            return oldProductId === newProductId;
          });

          if (!stillExists) {
            // Item was removed - reduce inventory
            await inventoryService.updateStock({
              productId: oldItem.product?._id || oldItem.product,
              type: 'out',
              quantity: oldItem.quantity,
              reason: 'Purchase Order Update - Item Removed',
              reference: 'Purchase Order',
              referenceId: updatedPO._id,
              referenceModel: 'PurchaseOrder',
              performedBy: req.user._id,
              notes: `Inventory reduced due to purchase order ${updatedPO.poNumber} update - item removed`
            });
          }
        }
      } catch (error) {
        console.error('Error adjusting inventory on purchase order update:', error);
        // Don't fail update if inventory adjustment fails
      }
    }

    // Note: Supplier balance adjustments are handled in the service layer

    res.json({
      message: 'Purchase order updated successfully',
      purchaseOrder: updatedPO
    });
  } catch (error) {
    console.error('Update purchase order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/purchase-orders/:id/confirm
// @desc    Confirm purchase order and update inventory
// @access  Private
router.put('/:id/confirm', [
  auth,
  requirePermission('confirm_purchase_orders')
], async (req, res) => {
  try {
    const purchaseOrder = await purchaseOrderService.confirmPurchaseOrder(req.params.id);

    // Update inventory for each item in the purchase order
    const inventoryUpdates = [];
    for (const item of purchaseOrder.items) {
      try {
        const inventoryUpdate = await inventoryService.updateStock({
          productId: item.product,
          type: 'in',
          quantity: item.quantity,
          cost: item.costPerUnit, // Pass cost price from purchase order
          reason: 'Purchase Order Confirmation',
          reference: 'Purchase Order',
          referenceId: purchaseOrder._id,
          referenceModel: 'PurchaseOrder',
          performedBy: req.user._id,
          notes: `Stock increased due to purchase order confirmation - PO: ${purchaseOrder.poNumber}`
        });

        inventoryUpdates.push({
          productId: item.product,
          quantity: item.quantity,
          newStock: inventoryUpdate.currentStock,
          success: true
        });

      } catch (inventoryError) {
        console.error(`Failed to update inventory for product ${item.product}:`, inventoryError.message);
        inventoryUpdates.push({
          productId: item.product,
          quantity: item.quantity,
          success: false,
          error: inventoryError.message
        });

        // If inventory update fails, return error but don't rollback (since this is stock increase)
        return res.status(400).json({
          message: `Failed to update inventory for product ${item.product}. Cannot confirm purchase order.`,
          details: inventoryError.message,
          inventoryUpdates: inventoryUpdates
        });
      }
    }

    // Update supplier balance: move from pendingBalance to currentBalance
    if (purchaseOrder.supplier && purchaseOrder.total > 0) {
      try {
        const supplier = await supplierRepository.findById(purchaseOrder.supplier);
        if (supplier) {
          // Move amount from pendingBalance to currentBalance (outstanding amount we owe to supplier)
          await supplierRepository.updateById(purchaseOrder.supplier, {
            $inc: {
              pendingBalance: -purchaseOrder.total,  // Remove from pending
              currentBalance: purchaseOrder.total    // Add to current (outstanding)
            }
          });
        }
      } catch (error) {
        console.error('Error updating supplier balance on PO confirmation:', error);
        // Don't fail the confirmation if supplier update fails
      }
    }

    // Update purchase order status only after successful inventory updates
    purchaseOrder.status = 'confirmed';
    purchaseOrder.confirmedDate = new Date();
    purchaseOrder.lastModifiedBy = req.user._id;

    await purchaseOrder.save();

    // Automatically create a Purchase Invoice from this confirmed order
    try {
      const invoice = await purchaseOrderService.createInvoiceFromPurchaseOrder(purchaseOrder, req.user._id);

      // Track conversion in purchase order
      purchaseOrder.conversions = purchaseOrder.conversions || [];
      purchaseOrder.conversions.push({
        invoiceId: invoice._id,
        convertedBy: req.user._id,
        convertedAt: new Date(),
        items: (purchaseOrder.items || []).map(item => ({
          product: item.product,
          quantity: item.quantity,
          costPerUnit: item.costPerUnit,
          status: 'success'
        })),
        notes: `Automatically converted to invoice PI: ${invoice.invoiceNumber} on confirmation`
      });

      // Update PO status to fully_received since confirmation in this system increases stock immediately
      purchaseOrder.status = 'fully_received';
      purchaseOrder.lastReceivedDate = new Date();
    } catch (createInvoiceError) {
      console.error('Failed to automatically create purchase invoice during PO confirmation:', createInvoiceError);
      // Don't fail the confirmation if invoice creation fails
    }

    // Create accounting entries for confirmed purchase order
    try {
      const AccountingService = require('../services/accountingService');
      await AccountingService.recordPurchase(purchaseOrder);
    } catch (error) {
      console.error('Error creating accounting entries for purchase order:', error);
      // Don't fail the confirmation if accounting fails
    }

    await purchaseOrder.populate([
      { path: 'supplier', select: 'companyName contactPerson email phone businessType' },
      { path: 'items.product', select: 'name description pricing inventory' },
      { path: 'createdBy', select: 'firstName lastName email' },
      { path: 'lastModifiedBy', select: 'firstName lastName email' }
    ]);

    // Transform names to uppercase
    if (purchaseOrder.supplier) {
      purchaseOrder.supplier = transformSupplierToUppercase(purchaseOrder.supplier);
    }
    if (purchaseOrder.items && Array.isArray(purchaseOrder.items)) {
      purchaseOrder.items.forEach(item => {
        if (item.product) {
          item.product = transformProductToUppercase(item.product);
        }
      });
    }

    res.json({
      message: 'Purchase order confirmed and converted to invoice successfully',
      purchaseOrder,
      inventoryUpdates: inventoryUpdates
    });
  } catch (error) {
    console.error('Confirm purchase order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/purchase-orders/:id/cancel
// @desc    Cancel purchase order and reduce inventory if previously confirmed
// @access  Private
router.put('/:id/cancel', [
  auth,
  requirePermission('cancel_purchase_orders')
], async (req, res) => {
  try {
    // Get purchase order before cancellation to check status
    const purchaseOrderBeforeCancel = await purchaseOrderService.getPurchaseOrderById(req.params.id);
    const wasConfirmed = purchaseOrderBeforeCancel.status === 'confirmed';

    const purchaseOrder = await purchaseOrderService.cancelPurchaseOrder(req.params.id, req.user._id);

    // If the purchase order was confirmed, reduce inventory
    const inventoryUpdates = [];
    if (wasConfirmed) {
      for (const item of purchaseOrder.items) {
        try {
          const inventoryUpdate = await inventoryService.updateStock({
            productId: item.product,
            type: 'out',
            quantity: item.quantity,
            reason: 'Purchase Order Cancellation',
            reference: 'Purchase Order',
            referenceId: purchaseOrder._id,
            referenceModel: 'PurchaseOrder',
            performedBy: req.user._id,
            notes: `Stock reduced due to purchase order cancellation - PO: ${purchaseOrder.poNumber}`
          });

          inventoryUpdates.push({
            productId: item.product,
            quantity: item.quantity,
            newStock: inventoryUpdate.currentStock,
            success: true
          });

        } catch (inventoryError) {
          console.error(`Failed to reduce inventory for product ${item.product}:`, inventoryError.message);
          inventoryUpdates.push({
            productId: item.product,
            quantity: item.quantity,
            success: false,
            error: inventoryError.message
          });

          // If inventory update fails, check if it's due to insufficient stock
          if (inventoryError.message.includes('Insufficient stock')) {
            return res.status(400).json({
              message: `Insufficient stock to cancel purchase order for product ${item.product}. Stock may have been used in other transactions.`,
              details: inventoryError.message,
              inventoryUpdates: inventoryUpdates
            });
          }

          // Continue with cancellation for other errors
          console.warn(`Continuing with purchase order cancellation despite inventory reduction failure for product ${item.product}`);
        }
      }

      // Reverse supplier balance: move from currentBalance back to pendingBalance
      if (purchaseOrder.supplier && purchaseOrder.total > 0) {
        try {
          const supplier = await supplierRepository.findById(purchaseOrder.supplier);
          if (supplier) {
            // Move amount from currentBalance back to pendingBalance (reverse the confirmation)
            await supplierRepository.updateById(purchaseOrder.supplier, {
              $inc: {
                pendingBalance: purchaseOrder.total,  // Add back to pending
                currentBalance: -purchaseOrder.total  // Remove from current
              }
            });
          }
        } catch (error) {
          console.error('Error reversing supplier balance on PO cancellation:', error);
          // Don't fail the cancellation if supplier update fails
        }
      }
    }

    purchaseOrder.status = 'cancelled';
    purchaseOrder.lastModifiedBy = req.user._id;

    await purchaseOrder.save();

    res.json({
      message: purchaseOrder.status === 'confirmed'
        ? 'Purchase order cancelled successfully and inventory reduced'
        : 'Purchase order cancelled successfully',
      purchaseOrder,
      inventoryUpdates: inventoryUpdates.length > 0 ? inventoryUpdates : undefined
    });
  } catch (error) {
    console.error('Cancel purchase order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/purchase-orders/:id/close
// @desc    Close purchase order
// @access  Private
router.put('/:id/close', [
  auth,
  requirePermission('close_purchase_orders')
], async (req, res) => {
  try {
    const purchaseOrder = await purchaseOrderService.closePurchaseOrder(req.params.id, req.user._id);

    res.json({
      message: 'Purchase order closed successfully',
      purchaseOrder
    });
  } catch (error) {
    console.error('Close purchase order error:', error);
    if (error.message === 'Only fully received purchase orders can be closed') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/purchase-orders/:id
// @desc    Delete purchase order
// @access  Private
router.delete('/:id', [
  auth,
  requirePermission('delete_purchase_orders')
], async (req, res) => {
  try {
    // Get purchase order before deletion to check status
    const purchaseOrder = await purchaseOrderService.getPurchaseOrderById(req.params.id);
    const wasConfirmed = purchaseOrder.status === 'confirmed';

    // Delete the purchase order (service handles validation and supplier balance)
    await purchaseOrderService.deletePurchaseOrder(req.params.id);

    // Restore inventory if PO was confirmed (but we only allow deletion of draft orders, so this shouldn't run)
    // Keeping this for safety in case the status check is bypassed
    if (wasConfirmed) {
      try {
        const inventoryService = require('../services/inventoryService');
        for (const item of purchaseOrder.items) {
          try {
            await inventoryService.updateStock({
              productId: item.product,
              type: 'out',
              quantity: item.quantity,
              reason: 'Purchase Order Deletion',
              reference: 'Purchase Order',
              referenceId: purchaseOrder._id,
              referenceModel: 'PurchaseOrder',
              performedBy: req.user._id,
              notes: `Inventory rolled back due to deletion of purchase order ${purchaseOrder.poNumber}`
            });
          } catch (error) {
            console.error(`Failed to restore inventory for product ${item.product}:`, error);
          }
        }
      } catch (error) {
        console.error('Error restoring inventory on purchase order deletion:', error);
        // Don't fail deletion if inventory update fails
      }
    }

    await purchaseOrderService.deletePurchaseOrder(req.params.id);

    res.json({ message: 'Purchase order deleted successfully' });
  } catch (error) {
    console.error('Delete purchase order error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/purchase-orders/:id/convert
// @desc    Get purchase order items available for conversion
// @access  Private
router.get('/:id/convert', auth, async (req, res) => {
  try {
    const result = await purchaseOrderService.getPurchaseOrderForConversion(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Get conversion data error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/purchase-orders/:id/convert
// @desc    Convert purchase order to actual purchase (update inventory)
// @access  Private
router.post('/:id/convert', [
  auth,
  requirePermission('manage_inventory'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product').isMongoId().withMessage('Valid product is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.costPerUnit').isFloat({ min: 0 }).withMessage('Cost per unit must be positive')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const purchaseOrder = await purchaseOrderService.getPurchaseOrderById(req.params.id);

    if (purchaseOrder.status === 'cancelled' || purchaseOrder.status === 'closed') {
      return res.status(400).json({ message: 'Cannot convert cancelled or closed purchase order' });
    }

    const Inventory = require('../models/Inventory');
    const { items } = req.body;
    const conversionResults = [];

    // Process each item
    for (const item of items) {
      try {
        // Update inventory stock with cost
        await Inventory.updateStock(
          item.product,
          {
            type: 'in',
            quantity: item.quantity,
            cost: item.costPerUnit, // Pass cost price from purchase order
            reason: `Purchase from PO: ${purchaseOrder.poNumber}`,
            reference: 'Purchase Order',
            referenceId: purchaseOrder._id,
            referenceModel: 'PurchaseOrder',
            performedBy: req.user._id,
            notes: `Stock increased from purchase order: ${purchaseOrder.poNumber}`
          }
        );

        // Update purchase order item received quantity
        const poItem = purchaseOrder.items.find(poItem =>
          poItem.product.toString() === item.product
        );

        if (poItem) {
          poItem.receivedQuantity += item.quantity;
          poItem.remainingQuantity = Math.max(0, poItem.quantity - poItem.receivedQuantity);
        }

        conversionResults.push({
          product: item.product,
          quantity: item.quantity,
          costPerUnit: item.costPerUnit,
          status: 'success'
        });

      } catch (itemError) {
        console.error(`Error processing item ${item.product}:`, itemError);
        conversionResults.push({
          product: item.product,
          quantity: item.quantity,
          costPerUnit: item.costPerUnit,
          status: 'error',
          error: itemError.message
        });
      }
    }

    // Update purchase order status
    const allItemsReceived = purchaseOrder.items.every(item => item.remainingQuantity === 0);
    if (allItemsReceived) {
      purchaseOrder.status = 'fully_received';
      purchaseOrder.lastReceivedDate = new Date();
    } else {
      purchaseOrder.status = 'partially_received';
      purchaseOrder.lastReceivedDate = new Date();
    }

    // Add conversion record
    purchaseOrder.conversions = purchaseOrder.conversions || [];
    purchaseOrder.conversions.push({
      convertedBy: req.user._id,
      convertedAt: new Date(),
      items: conversionResults,
      notes: req.body.notes || `Converted ${items.length} items to purchase`
    });

    // Automatically create a Purchase Invoice for the converted items
    try {
      const invoice = await purchaseOrderService.createInvoiceFromPurchaseOrder(purchaseOrder, req.user._id, items);

      // Update conversion record with invoiceId
      const lastConversion = purchaseOrder.conversions[purchaseOrder.conversions.length - 1];
      if (lastConversion) {
        lastConversion.invoiceId = invoice._id;
        lastConversion.notes = lastConversion.notes || ``;
        lastConversion.notes += ` - Created Invoice PI: ${invoice.invoiceNumber}`;
      }
    } catch (createInvoiceError) {
      console.error('Failed to create purchase invoice during conversion:', createInvoiceError);
    }

    await purchaseOrder.save();

    res.json({
      message: 'Purchase order converted successfully',
      conversionResults,
      purchaseOrder: {
        _id: purchaseOrder._id,
        poNumber: purchaseOrder.poNumber,
        status: purchaseOrder.status
      }
    });

  } catch (error) {
    console.error('Convert purchase order error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({
      message: 'Server error. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
