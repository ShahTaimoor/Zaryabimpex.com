const express = require('express');
const { body, query, param } = require('express-validator');
const { auth, requireAnyPermission } = require('../middleware/auth');
const investorService = require('../services/investorService');

const router = express.Router();

// Get all investors
router.get('/', [
  auth,
  requireAnyPermission(['view_investors', 'manage_investors', 'view_reports']),
  query('status').optional().isIn(['active', 'inactive', 'suspended']),
  query('search').optional().isString().trim()
], async (req, res) => {
  try {
    const investors = await investorService.getInvestors({
      status: req.query.status,
      search: req.query.search
    });
    
    res.json({
      success: true,
      data: investors
    });
  } catch (error) {
    console.error('Error fetching investors:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get single investor
router.get('/:id', [
  auth,
  requireAnyPermission(['view_investors', 'manage_investors', 'view_reports']),
  param('id').isUUID(4).withMessage('Invalid investor ID')
], async (req, res) => {
  try {
    const result = await investorService.getInvestorById(req.params.id);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching investor:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create investor
router.post('/', [
  auth,
  requireAnyPermission(['manage_investors', 'create_investors']),
  body('name').isString().trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').optional().isString().trim(),
  body('totalInvestment').optional().isFloat({ min: 0 }).withMessage('Total investment must be >= 0'),
  body('defaultProfitSharePercentage').optional().isFloat({ min: 0, max: 100 }).withMessage('Profit share percentage must be between 0 and 100'),
  body('status').optional().isIn(['active', 'inactive', 'suspended'])
], async (req, res) => {
  try {
    const investor = await investorService.createInvestor(req.body, req.user._id);
    
    res.status(201).json({
      success: true,
      message: 'Investor created successfully',
      data: investor
    });
  } catch (error) {
    if (error.message === 'Investor with this email already exists') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    console.error('Error creating investor:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update investor
router.put('/:id', [
  auth,
  requireAnyPermission(['manage_investors', 'edit_investors']),
  param('id').isUUID(4).withMessage('Invalid investor ID'),
  body('name').optional().isString().trim().notEmpty(),
  body('email').optional().isEmail(),
  body('phone').optional().isString().trim(),
  body('totalInvestment').optional().isFloat({ min: 0 }),
  body('defaultProfitSharePercentage').optional().isFloat({ min: 0, max: 100 }).withMessage('Profit share percentage must be between 0 and 100'),
  body('status').optional().isIn(['active', 'inactive', 'suspended'])
], async (req, res) => {
  try {
    const investor = await investorService.updateInvestor(req.params.id, req.body, req.user._id);
    
    res.json({
      success: true,
      message: 'Investor updated successfully',
      data: investor
    });
  } catch (error) {
    if (error.message === 'Investor not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    if (error.message === 'Investor with this email already exists') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    console.error('Error updating investor:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete investor
router.delete('/:id', [
  auth,
  requireAnyPermission(['manage_investors']),
  param('id').isUUID(4).withMessage('Invalid investor ID')
], async (req, res) => {
  try {
    const result = await investorService.deleteInvestor(req.params.id);
    
    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    if (error.message === 'Investor not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    if (error.message.includes('Cannot delete investor')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    console.error('Error deleting investor:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Record payout for investor
router.post('/:id/payout', [
  auth,
  requireAnyPermission(['manage_investors', 'payout_investors']),
  param('id').isUUID(4).withMessage('Invalid investor ID'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Payout amount must be greater than 0')
], async (req, res) => {
  try {
    const investor = await investorService.recordPayout(req.params.id, req.body.amount);
    
    res.json({
      success: true,
      message: 'Payout recorded successfully',
      data: investor
    });
  } catch (error) {
    if (error.message === 'Investor not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    if (error.message.includes('Payout amount exceeds')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    console.error('Error recording payout:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Record investment (receive money from investor)
router.post('/:id/investment', [
  auth,
  requireAnyPermission(['manage_investors', 'payout_investors']),
  param('id').isUUID(4).withMessage('Invalid investor ID'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Investment amount must be greater than 0'),
  body('notes').optional().isString().trim().isLength({ max: 500 }).withMessage('Notes too long')
], async (req, res) => {
  try {
    const investor = await investorService.recordInvestment(req.params.id, req.body.amount);
    
    res.json({
      success: true,
      message: 'Investment recorded successfully',
      data: investor
    });
  } catch (error) {
    if (error.message === 'Investor not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    console.error('Error recording investment:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get profit shares for investor
router.get('/:id/profit-shares', [
  auth,
  requireAnyPermission(['view_investors', 'manage_investors', 'view_reports']),
  param('id').isUUID(4).withMessage('Invalid investor ID'),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], async (req, res) => {
  try {
    const profitShares = await profitDistributionService.getProfitSharesForInvestor(
      req.params.id,
      req.query.startDate,
      req.query.endDate
    );
    
    res.json({
      success: true,
      data: profitShares
    });
  } catch (error) {
    console.error('Error fetching profit shares:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get profit summary
router.get('/profit-shares/summary', [
  auth,
  requireAnyPermission(['view_investors', 'manage_investors', 'view_reports']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], async (req, res) => {
  try {
    const summary = await profitDistributionService.getProfitSummary(
      req.query.startDate,
      req.query.endDate
    );
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching profit summary:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get profit shares for order
router.get('/profit-shares/order/:orderId', [
  auth,
  requireAnyPermission(['view_investors', 'manage_investors', 'view_reports']),
  param('orderId').isUUID(4).withMessage('Invalid order ID')
], async (req, res) => {
  try {
    const profitShares = await profitDistributionService.getProfitSharesForOrder(req.params.orderId);
    
    res.json({
      success: true,
      data: profitShares
    });
  } catch (error) {
    console.error('Error fetching profit shares for order:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get products linked to an investor
router.get('/:id/products', [
  auth,
  requireAnyPermission(['view_investors', 'manage_investors']),
  param('id').isUUID(4).withMessage('Invalid investor ID')
], async (req, res) => {
  try {
    const products = await investorService.getProductsForInvestor(req.params.id);
    
    // Sort products by name
    products.sort((a, b) => {
      const nameA = (a.name || '').toUpperCase();
      const nameB = (b.name || '').toUpperCase();
      return nameA.localeCompare(nameB);
    });
    
    // Map products to include the share percentage for this specific investor
    const productsWithShares = products.map(product => {
      const investorData = product.investors.find(
        inv => inv.investor.toString() === req.params.id
      );
      
      return {
        _id: product._id,
        name: product.name,
        description: product.description,
        category: product.category,
        pricing: product.pricing,
        inventory: product.inventory,
        status: product.status,
        sharePercentage: investorData?.sharePercentage || 0,
        linkedAt: investorData?.addedAt
      };
    });
    
    res.json({
      success: true,
      data: productsWithShares
    });
  } catch (error) {
    console.error('Error fetching investor products:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;

