const express = require('express');
const { auth, requirePermission } = require('../middleware/auth');
const balanceCalculationService = require('../services/balanceCalculationService');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');

const router = express.Router();

/**
 * @route   GET /api/balance-verification/customer/:id
 * @desc    Verify customer balance against ledger
 * @access  Private (Admin only)
 */
router.get('/customer/:id', [
    auth,
    requirePermission('view_reports')
], async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        const verification = await balanceCalculationService.verifyCustomerBalance(customer);

        res.json({
            success: true,
            data: verification
        });
    } catch (error) {
        console.error('Error verifying customer balance:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify customer balance',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route   GET /api/balance-verification/supplier/:id
 * @desc    Verify supplier balance against ledger
 * @access  Private (Admin only)
 */
router.get('/supplier/:id', [
    auth,
    requirePermission('view_reports')
], async (req, res) => {
    try {
        const supplier = await Supplier.findById(req.params.id);

        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: 'Supplier not found'
            });
        }

        const verification = await balanceCalculationService.verifySupplierBalance(supplier);

        res.json({
            success: true,
            data: verification
        });
    } catch (error) {
        console.error('Error verifying supplier balance:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify supplier balance',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route   POST /api/balance-verification/customer/:id/sync
 * @desc    Sync customer balance from ledger
 * @access  Private (Admin only)
 */
router.post('/customer/:id/sync', [
    auth,
    requirePermission('manage_settings')
], async (req, res) => {
    try {
        const result = await balanceCalculationService.syncCustomerBalance(req.params.id);

        res.json({
            success: true,
            message: 'Customer balance synced from ledger',
            data: result
        });
    } catch (error) {
        console.error('Error syncing customer balance:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to sync customer balance',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route   POST /api/balance-verification/supplier/:id/sync
 * @desc    Sync supplier balance from ledger
 * @access  Private (Admin only)
 */
router.post('/supplier/:id/sync', [
    auth,
    requirePermission('manage_settings')
], async (req, res) => {
    try {
        const result = await balanceCalculationService.syncSupplierBalance(req.params.id);

        res.json({
            success: true,
            message: 'Supplier balance synced from ledger',
            data: result
        });
    } catch (error) {
        console.error('Error syncing supplier balance:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to sync supplier balance',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route   GET /api/balance-verification/all-customers
 * @desc    Verify all customer balances
 * @access  Private (Admin only)
 */
router.get('/all-customers', [
    auth,
    requirePermission('view_reports')
], async (req, res) => {
    try {
        const customers = await Customer.find({}).lean();
        const verifications = [];

        for (const customer of customers) {
            const verification = await balanceCalculationService.verifyCustomerBalance(customer);
            verifications.push(verification);
        }

        const mismatches = verifications.filter(v => !v.isMatch);

        res.json({
            success: true,
            data: {
                total: verifications.length,
                matches: verifications.length - mismatches.length,
                mismatches: mismatches.length,
                details: verifications
            }
        });
    } catch (error) {
        console.error('Error verifying all customer balances:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify customer balances',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route   GET /api/balance-verification/all-suppliers
 * @desc    Verify all supplier balances
 * @access  Private (Admin only)
 */
router.get('/all-suppliers', [
    auth,
    requirePermission('view_reports')
], async (req, res) => {
    try {
        const suppliers = await Supplier.find({}).lean();
        const verifications = [];

        for (const supplier of suppliers) {
            const verification = await balanceCalculationService.verifySupplierBalance(supplier);
            verifications.push(verification);
        }

        const mismatches = verifications.filter(v => !v.isMatch);

        res.json({
            success: true,
            data: {
                total: verifications.length,
                matches: verifications.length - mismatches.length,
                mismatches: mismatches.length,
                details: verifications
            }
        });
    } catch (error) {
        console.error('Error verifying all supplier balances:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify supplier balances',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;
