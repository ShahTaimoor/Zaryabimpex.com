const express = require('express');
const { auth, requirePermission } = require('../middleware/auth');
const CustomerAnalyticsService = require('../services/customerAnalyticsService');
const { query, validationResult } = require('express-validator');

const router = express.Router();

// @route   GET /api/customer-analytics
// @desc    Get analytics for all customers
// @access  Private
router.get('/', [
  auth,
  requirePermission('view_customer_analytics'),
  query('includeInactive').optional().isIn(['true', 'false']),
  query('minOrders').optional().isInt({ min: 0 }),
  query('segment').optional().isIn(['VIP', 'champion', 'loyal', 'regular', 'new', 'at_risk', 'churned']),
  query('churnRisk').optional().isIn(['very_low', 'low', 'medium', 'high', 'very_high'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const options = {
      includeInactive: req.query.includeInactive === 'true',
      minOrders: parseInt(req.query.minOrders) || 0
    };

    const analytics = await CustomerAnalyticsService.analyzeAllCustomers(options);

    // Apply filters if specified
    let filteredCustomers = analytics.customers;

    if (req.query.segment) {
      filteredCustomers = filteredCustomers.filter(
        c => c.segment.segment === req.query.segment
      );
    }

    if (req.query.churnRisk) {
      filteredCustomers = filteredCustomers.filter(
        c => c.churnRisk.riskLevel === req.query.churnRisk
      );
    }

    res.json({
      success: true,
      data: {
        ...analytics,
        customers: filteredCustomers,
        filteredCount: filteredCustomers.length
      }
    });
  } catch (error) {
    console.error('Customer analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating customer analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/customer-analytics/summary
// @desc    Get analytics summary
// @access  Private
router.get('/summary', [
  auth,
  requirePermission('view_customer_analytics')
], async (req, res) => {
  try {
    const analytics = await CustomerAnalyticsService.analyzeAllCustomers({
      includeInactive: false,
      minOrders: 0
    });

    res.json({
      success: true,
      data: {
        totalCustomers: analytics.totalCustomers,
        segmentCounts: {
          VIP: analytics.segments.VIP.length,
          champion: analytics.segments.champion.length,
          loyal: analytics.segments.loyal.length,
          regular: analytics.segments.regular.length,
          new: analytics.segments.new.length,
          at_risk: analytics.segments.at_risk.length,
          churned: analytics.segments.churned.length
        },
        summary: analytics.summary,
        topCustomers: analytics.customers.slice(0, 10).map(c => ({
          customer: c.customer,
          clv: c.clv.predictedCLV,
          segment: c.segment.segmentName,
          churnRisk: c.churnRisk.riskLevel
        }))
      }
    });
  } catch (error) {
    console.error('Customer analytics summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating analytics summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/customer-analytics/:customerId
// @desc    Get analytics for a specific customer
// @access  Private
router.get('/:customerId', [
  auth,
  requirePermission('view_customer_analytics')
], async (req, res) => {
  try {
    const analytics = await CustomerAnalyticsService.getCustomerAnalytics(req.params.customerId);

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Customer analytics error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error getting customer analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/customer-analytics/segments/:segment
// @desc    Get customers in a specific segment
// @access  Private
router.get('/segments/:segment', [
  auth,
  requirePermission('view_customer_analytics'),
  query('minOrders').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const options = {
      includeInactive: false,
      minOrders: parseInt(req.query.minOrders) || 0
    };

    const analytics = await CustomerAnalyticsService.analyzeAllCustomers(options);
    const segmentCustomers = analytics.segments[req.params.segment] || [];

    res.json({
      success: true,
      data: {
        segment: req.params.segment,
        count: segmentCustomers.length,
        customers: segmentCustomers
      }
    });
  } catch (error) {
    console.error('Segment analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting segment analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/customer-analytics/churn-risk/:level
// @desc    Get customers with specific churn risk level
// @access  Private
router.get('/churn-risk/:level', [
  auth,
  requirePermission('view_customer_analytics')
], async (req, res) => {
  try {
    const analytics = await CustomerAnalyticsService.analyzeAllCustomers({
      includeInactive: false,
      minOrders: 0
    });

    const riskLevel = req.params.level;
    const atRiskCustomers = analytics.customers.filter(
      c => c.churnRisk.riskLevel === riskLevel
    );

    res.json({
      success: true,
      data: {
        riskLevel,
        count: atRiskCustomers.length,
        customers: atRiskCustomers
      }
    });
  } catch (error) {
    console.error('Churn risk analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting churn risk analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;

