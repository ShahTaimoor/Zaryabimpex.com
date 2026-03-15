const express = require('express');
const router = express.Router();
const { auth, requirePermission } = require('../middleware/auth');
const customerMergeService = require('../services/customerMergeService');
const { body, param, query } = require('express-validator');

// @route   POST /api/customer-merges
// @desc    Merge two customers
// @access  Private
router.post('/', [
  auth,
  requirePermission('merge_customers'),
  body('sourceCustomerId').isUUID(4).withMessage('Valid source customer ID is required'),
  body('targetCustomerId').isUUID(4).withMessage('Valid target customer ID is required'),
  body('mergeAddresses').optional().isBoolean().withMessage('mergeAddresses must be boolean'),
  body('mergeNotes').optional().isBoolean().withMessage('mergeNotes must be boolean')
], async (req, res) => {
  try {
    const result = await customerMergeService.mergeCustomers(
      req.body.sourceCustomerId,
      req.body.targetCustomerId,
      req.user,
      {
        mergeAddresses: req.body.mergeAddresses !== false,
        mergeNotes: req.body.mergeNotes !== false
      }
    );

    res.status(201).json({
      success: true,
      message: 'Customers merged successfully',
      data: result
    });
  } catch (error) {
    console.error('Merge customers error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/customer-merges/duplicates
// @desc    Find potential duplicate customers
// @access  Private
router.get('/duplicates', [
  auth,
  requirePermission('view_customers'),
  query('threshold').optional().isFloat({ min: 0, max: 1 }).withMessage('threshold must be between 0 and 1'),
  query('minSimilarity').optional().isFloat({ min: 0, max: 1 }).withMessage('minSimilarity must be between 0 and 1')
], async (req, res) => {
  try {
    const duplicates = await customerMergeService.findPotentialDuplicates({
      threshold: parseFloat(req.query.threshold) || 0.8,
      minSimilarity: parseFloat(req.query.minSimilarity) || 0.7
    });

    res.json({
      success: true,
      data: duplicates,
      count: duplicates.length
    });
  } catch (error) {
    console.error('Find duplicates error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

