const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const journalVoucherRepository = require('../repositories/JournalVoucherRepository');
const journalVoucherService = require('../services/journalVoucherService');

const router = express.Router();

/**
 * GET /api/journal-vouchers - List all journal vouchers with filtering
 */
router.get('/', [
  auth,
  query('status').optional().isIn(['draft', 'posted', 'reversed', 'cancelled']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('voucherNumber').optional().trim(),
  query('dateFrom').optional().isISO8601(),
  query('dateTo').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { status, limit = 20, page = 1, voucherNumber, dateFrom, dateTo } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (voucherNumber) filters.voucherNumber = voucherNumber;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;

    const result = await journalVoucherService.listJournalVouchers(filters, {
      limit: Math.min(parseInt(limit) || 20, 100),
      page: parseInt(page) || 1
    });

    const vouchers = (result.data || []).map(v => ({ ...v, _id: v.id }));
    res.json({ 
      success: true, 
      data: { vouchers, pagination: result.pagination }, 
      vouchers 
    });
  } catch (error) {
    console.error('Journal vouchers list error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch journal vouchers', 
      error: error.message 
    });
  }
});

/**
 * GET /api/journal-vouchers/stats - Get JV statistics
 */
router.get('/stats', auth, async (req, res) => {
  try {
    const stats = await journalVoucherService.getJournalVoucherStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Journal voucher stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch statistics', 
      error: error.message 
    });
  }
});

/**
 * GET /api/journal-vouchers/:id - Get single journal voucher
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const voucher = await journalVoucherService.getJournalVoucher(req.params.id);
    res.json({ 
      success: true, 
      data: { ...voucher, _id: voucher.id }, 
      ...voucher, 
      _id: voucher.id 
    });
  } catch (error) {
    console.error('Journal voucher get error:', error);
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ 
      success: false, 
      message: error.message || 'Failed to fetch journal voucher' 
    });
  }
});

/**
 * POST /api/journal-vouchers - Create a new journal voucher
 */
router.post('/', [
  auth,
  body('voucherDate').optional().isISO8601(),
  body('description').optional().trim(),
  body('notes').optional().trim(),
  body('entries').isArray({ min: 2 }).withMessage('Must have at least 2 line items'),
  body('entries.*.accountCode').trim().notEmpty().withMessage('Account code is required'),
  body('entries.*.debitAmount').optional().isFloat({ min: 0 }).toFloat(),
  body('entries.*.creditAmount').optional().isFloat({ min: 0 }).toFloat(),
  body('entries.*.particulars').optional().trim(),
  body('entries.*.description').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const data = { ...req.body, createdBy: req.user?.id || req.user?._id };
    const voucher = await journalVoucherService.createJournalVoucher(data, data.createdBy);
    
    res.status(201).json({ 
      success: true, 
      message: 'Journal Voucher created successfully',
      data: { ...voucher, _id: voucher.id }, 
      ...voucher, 
      _id: voucher.id 
    });
  } catch (error) {
    console.error('Journal voucher create error:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message || 'Failed to create journal voucher' 
    });
  }
});

/**
 * PUT /api/journal-vouchers/:id - Update journal voucher (draft only)
 */
router.put('/:id', [
  auth,
  body('voucherDate').optional().isISO8601(),
  body('description').optional().trim(),
  body('notes').optional().trim(),
  body('entries').optional().isArray({ min: 2 }),
  body('entries.*.accountCode').optional().trim().notEmpty(),
  body('entries.*.debitAmount').optional().isFloat({ min: 0 }).toFloat(),
  body('entries.*.creditAmount').optional().isFloat({ min: 0 }).toFloat(),
  body('entries.*.particulars').optional().trim(),
  body('entries.*.description').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const data = { ...req.body, updatedBy: req.user?.id || req.user?._id };
    const voucher = await journalVoucherService.updateJournalVoucher(
      req.params.id,
      data,
      data.updatedBy
    );
    
    res.json({ 
      success: true, 
      message: 'Journal Voucher updated successfully',
      data: { ...voucher, _id: voucher.id }, 
      ...voucher, 
      _id: voucher.id 
    });
  } catch (error) {
    console.error('Journal voucher update error:', error);
    const status = error.message.includes('not found') ? 404 : 400;
    res.status(status).json({ 
      success: false, 
      message: error.message || 'Failed to update journal voucher' 
    });
  }
});

/**
 * PUT /api/journal-vouchers/:id/status - Update journal voucher status
 * Legacy endpoint for compatibility
 */
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const voucherId = req.params.id;
    const userId = req.user?.id || req.user?._id;

    if (!['draft', 'posted', 'cancelled'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid status. Must be draft, posted, or cancelled.' 
      });
    }

    if (status === 'posted') {
      const voucher = await journalVoucherService.postJournalVoucher(voucherId, userId);
      return res.json({ 
        success: true, 
        message: 'Journal Voucher posted successfully',
        data: { ...voucher, _id: voucher.id }, 
        ...voucher, 
        _id: voucher.id 
      });
    }

    // For other statuses, just update status
    const updatedVoucher = await journalVoucherRepository.updateStatus(voucherId, status, userId);
    res.json({ 
      success: true,
      data: { ...updatedVoucher, _id: updatedVoucher.id }, 
      ...updatedVoucher, 
      _id: updatedVoucher.id 
    });
  } catch (error) {
    console.error('Journal voucher status update error:', error);
    const status = error.message.includes('not found') ? 404 : 400;
    res.status(status).json({ 
      success: false, 
      message: error.message || 'Failed to update journal voucher status' 
    });
  }
});

/**
 * POST /api/journal-vouchers/:id/post - Post journal voucher to ledger
 */
router.post('/:id/post', auth, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const voucher = await journalVoucherService.postJournalVoucher(req.params.id, userId);

    res.json({ 
      success: true, 
      message: 'Journal Voucher posted successfully',
      data: { ...voucher, _id: voucher.id }, 
      ...voucher, 
      _id: voucher.id 
    });
  } catch (error) {
    console.error('Journal voucher post error:', error);
    const status = error.message.includes('not found') ? 404 : 400;
    res.status(status).json({ 
      success: false, 
      message: error.message || 'Failed to post journal voucher' 
    });
  }
});

/**
 * POST /api/journal-vouchers/:id/reverse - Reverse a posted journal voucher
 */
router.post('/:id/reverse', [
  auth,
  body('reason').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const userId = req.user?.id || req.user?._id;
    const result = await journalVoucherService.reverseJournalVoucher(
      req.params.id,
      req.body.reason,
      userId
    );

    res.json({ 
      success: true, 
      message: 'Journal Voucher reversed successfully',
      data: result
    });
  } catch (error) {
    console.error('Journal voucher reverse error:', error);
    const status = error.message.includes('not found') ? 404 : 400;
    res.status(status).json({ 
      success: false, 
      message: error.message || 'Failed to reverse journal voucher' 
    });
  }
});

/**
 * DELETE /api/journal-vouchers/:id - Delete journal voucher (draft only)
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    await journalVoucherService.deleteJournalVoucher(req.params.id, userId);

    res.json({ 
      success: true, 
      message: 'Journal Voucher deleted successfully' 
    });
  } catch (error) {
    console.error('Journal voucher delete error:', error);
    const status = error.message.includes('not found') ? 404 : 400;
    res.status(status).json({ 
      success: false, 
      message: error.message || 'Failed to delete journal voucher' 
    });
  }
});

module.exports = router;
