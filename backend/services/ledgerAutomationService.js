const mongoose = require('mongoose');
const SalesOrder = require('../models/SalesOrder');
const Sales = require('../models/Sales');
const PurchaseOrder = require('../models/PurchaseOrder');
const PurchaseInvoice = require('../models/PurchaseInvoice');

class LedgerAutomationService {
    /**
     * Main automation method - processes all unposted transactions
     */
    async processUnpostedTransactions() {
        const session = await mongoose.startSession();
        const results = {
            salesOrdersConverted: 0,
            purchaseOrdersConverted: 0,
            totalOrdersConverted: 0,
            errors: [],
            timestamp: new Date()
        };

        try {
            await session.startTransaction();

            // Convert confirmed orders to invoices
            await this.convertSalesOrdersToInvoices(session, results);
            await this.convertPurchaseOrdersToInvoices(session, results);

            await session.commitTransaction();

            // Calculate total
            results.totalOrdersConverted = results.salesOrdersConverted + results.purchaseOrdersConverted;

            // Log successful automation run
            console.log('[Ledger Automation] Run completed successfully:', {
                salesOrdersConverted: results.salesOrdersConverted,
                purchaseOrdersConverted: results.purchaseOrdersConverted,
                totalOrdersConverted: results.totalOrdersConverted,
                errorCount: results.errors.length,
                timestamp: results.timestamp
            });

            return results;
        } catch (error) {
            await session.abortTransaction();
            results.errors.push({
                stage: 'transaction',
                error: error.message,
                stack: error.stack
            });

            console.error('[Ledger Automation] Run failed:', error.message);

            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Convert confirmed Sales Orders to Sales Invoices
     */
    async convertSalesOrdersToInvoices(session, results) {
        try {
            const unpostedOrders = await SalesOrder.find({
                status: 'confirmed',
                invoiceId: { $exists: false },
                autoConverted: { $ne: true }
            }).session(session);

            for (const order of unpostedOrders) {
                try {
                    // Create Sales Invoice from Sales Order
                    const invoice = new Sales({
                        salesOrderId: order._id,
                        customer: order.customer,
                        items: order.items.map(item => ({
                            product: item.product,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            unitCost: 0,
                            discountPercent: 0,
                            taxRate: 0,
                            subtotal: item.totalPrice,
                            discountAmount: 0,
                            taxAmount: 0,
                            total: item.totalPrice
                        })),
                        pricing: {
                            subtotal: order.subtotal,
                            discountAmount: 0,
                            taxAmount: order.tax || 0,
                            isTaxExempt: order.isTaxExempt || true,
                            shippingAmount: 0,
                            total: order.total
                        },
                        payment: {
                            method: 'account',
                            status: 'pending',
                            amountPaid: 0,
                            remainingBalance: order.total,
                            isPartialPayment: false,
                            isAdvancePayment: false,
                            advanceAmount: 0,
                            transactions: []
                        },
                        status: 'confirmed',
                        notes: `Auto-generated from Sales Order: ${order.soNumber}`,
                        createdBy: order.createdBy,
                        billDate: new Date()
                    });

                    await invoice.save({ session });

                    // Update Sales Order with invoice reference
                    order.invoiceId = invoice._id;
                    order.autoConverted = true;
                    order.status = 'fully_invoiced';
                    order.lastInvoicedDate = new Date();

                    // Add to conversions array
                    order.conversions.push({
                        invoiceId: invoice._id,
                        convertedDate: new Date(),
                        convertedBy: order.createdBy,
                        items: order.items.map(item => ({
                            product: item.product,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice
                        }))
                    });

                    await order.save({ session });

                    results.salesOrdersConverted++;
                    console.log(`[Ledger Automation] Converted Sales Order ${order.soNumber} to Invoice ${invoice.orderNumber}`);
                } catch (error) {
                    results.errors.push({
                        stage: 'salesOrderConversion',
                        orderId: order._id,
                        orderNumber: order.soNumber,
                        error: error.message
                    });
                }
            }
        } catch (error) {
            results.errors.push({
                stage: 'salesOrderConversion',
                error: error.message
            });
        }
    }

    /**
     * Convert confirmed Purchase Orders to Purchase Invoices
     */
    async convertPurchaseOrdersToInvoices(session, results) {
        try {
            const unpostedOrders = await PurchaseOrder.find({
                status: 'confirmed',
                'conversions.invoiceId': { $exists: false },
                autoConverted: { $ne: true }
            }).session(session);

            for (const order of unpostedOrders) {
                try {
                    // Create Purchase Invoice from Purchase Order
                    const invoice = new PurchaseInvoice({
                        supplier: order.supplier,
                        items: order.items.map(item => ({
                            product: item.product,
                            quantity: item.quantity,
                            unitCost: item.costPerUnit,
                            totalCost: item.totalCost
                        })),
                        pricing: {
                            subtotal: order.subtotal,
                            discountAmount: 0,
                            taxAmount: order.tax || 0,
                            isTaxExempt: order.isTaxExempt || true,
                            total: order.total
                        },
                        payment: {
                            status: 'pending',
                            method: 'credit',
                            paidAmount: 0,
                            isPartialPayment: false
                        },
                        status: 'confirmed',
                        notes: `Auto-generated from Purchase Order: ${order.poNumber}`,
                        createdBy: order.createdBy,
                        invoiceDate: new Date()
                    });

                    await invoice.save({ session });

                    // Update Purchase Order with invoice reference
                    order.autoConverted = true;
                    order.conversions.push({
                        invoiceId: invoice._id,
                        convertedBy: order.createdBy,
                        convertedAt: new Date(),
                        items: order.items.map(item => ({
                            product: item.product,
                            quantity: item.quantity,
                            costPerUnit: item.costPerUnit,
                            status: 'success'
                        })),
                        notes: `Auto-converted to invoice ${invoice.invoiceNumber}`
                    });

                    await order.save({ session });

                    results.purchaseOrdersConverted++;
                    console.log(`[Ledger Automation] Converted Purchase Order ${order.poNumber} to Invoice ${invoice.invoiceNumber}`);
                } catch (error) {
                    results.errors.push({
                        stage: 'purchaseOrderConversion',
                        orderId: order._id,
                        orderNumber: order.poNumber,
                        error: error.message
                    });
                }
            }
        } catch (error) {
            results.errors.push({
                stage: 'purchaseOrderConversion',
                error: error.message
            });
        }
    }
}

module.exports = new LedgerAutomationService();
