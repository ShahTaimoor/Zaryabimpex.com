const express = require('express');
const router = express.Router();
const { auth, requirePermission } = require('../middleware/auth');
const journalVoucherRepository = require('../repositories/JournalVoucherRepository');

// GET /api/journal-vouchers - list vouchers
router.get('/', auth, requirePermission('view_reports'), async (req, res) => {
  try {
    const { status, limit = 50, skip = 0 } = req.query;
    const filters = {};
    if (status) filters.status = status;
    const vouchers = await journalVoucherRepository.findAll(filters, {
      limit: Math.min(parseInt(limit) || 50, 500),
      skip: parseInt(skip) || 0
    });
    const list = (vouchers || []).map(v => ({ ...v, _id: v.id }));
    res.json({ success: true, data: { vouchers: list }, vouchers: list });
  } catch (error) {
    console.error('Journal vouchers list error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch journal vouchers', error: error.message });
  }
});

// GET /api/journal-vouchers/:id
router.get('/:id', auth, requirePermission('view_reports'), async (req, res) => {
  try {
    const voucher = await journalVoucherRepository.findById(req.params.id);
    if (!voucher) return res.status(404).json({ success: false, message: 'Journal voucher not found' });
    res.json({ ...voucher, _id: voucher.id });
  } catch (error) {
    console.error('Journal voucher get error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch journal voucher', error: error.message });
  }
});

// POST /api/journal-vouchers
router.post('/', auth, requirePermission('view_reports'), async (req, res) => {
  try {
    const data = { ...req.body, createdBy: req.user?.id || req.user?._id };
    const voucher = await journalVoucherRepository.create(data);
    res.status(201).json({ ...voucher, _id: voucher.id });
  } catch (error) {
    console.error('Journal voucher create error:', error);
    res.status(500).json({ success: false, message: 'Failed to create journal voucher', error: error.message });
  }
});

module.exports = router;
