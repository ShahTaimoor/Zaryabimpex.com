const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { validateDateParams, processDateFilter } = require('../middleware/dateFilter');
const { checkSegregationOfDuties } = require('../middleware/segregationOfDuties');
const JournalVoucher = require('../models/JournalVoucher'); // Still needed for new JournalVoucher() and static methods
const ChartOfAccounts = require('../models/ChartOfAccounts'); // Still needed for model reference
const { runWithTransactionRetry } = require('../services/transactionUtils');
const journalVoucherRepository = require('../repositories/JournalVoucherRepository');
const chartOfAccountsRepository = require('../repositories/ChartOfAccountsRepository');

const router = express.Router();

// Removed withValidation - using handleValidationErrors from middleware/validation instead

router.get('/', [
  auth,
  requirePermission('view_reports'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional({ checkFalsy: true }).isIn(['draft', 'posted']).withMessage('Invalid status filter'),
  ...validateDateParams,
  query('search').optional({ checkFalsy:true }).isString().trim().isLength({ max: 100 }).withMessage('Search must be a string'),
  handleValidationErrors,
  processDateFilter('voucherDate'),
], async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      search
    } = req.query;

    const filter = {};

    if (status) {
      filter.status = status;
    }

    // Date range filter - use dateFilter from middleware (Pakistan timezone)
    if (req.dateFilter && Object.keys(req.dateFilter).length > 0) {
      Object.assign(filter, req.dateFilter);
    }

    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { voucherNumber: regex },
        { reference: regex },
        { description: regex },
        { 'entries.accountName': regex },
        { 'entries.particulars': regex }
      ];
    }

    const result = await journalVoucherRepository.findWithPagination(filter, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { voucherDate: -1, createdAt: -1 },
      populate: [
        { path: 'createdBy', select: 'firstName lastName email' },
        { path: 'approvedBy', select: 'firstName lastName email' }
      ],
      lean: true
    });
    
    const vouchers = result.vouchers;
    const total = result.total;

    res.json({
      success: true,
      data: {
        vouchers,
        pagination: {
          currentPage: parseInt(page, 10),
          itemsPerPage: parseInt(limit, 10),
          totalItems: total,
          totalPages: Math.ceil(total / parseInt(limit, 10)) || 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching journal vouchers:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/:id', [
  auth,
  requirePermission('view_reports'),
  param('id').isMongoId().withMessage('Invalid voucher ID')
], handleValidationErrors, async (req, res) => {
  try {
    const voucher = await journalVoucherRepository.findById(req.params.id, {
      populate: [
        { path: 'entries.account', select: 'accountCode accountName accountType' },
        { path: 'createdBy', select: 'firstName lastName email' },
        { path: 'approvedBy', select: 'firstName lastName email' }
      ]
    });

    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: 'Journal voucher not found'
      });
    }

    res.json({
      success: true,
      data: voucher
    });
  } catch (error) {
    console.error('Error fetching journal voucher:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.post('/', [
  auth,
  requirePermission('manage_reports'),
  checkSegregationOfDuties('manage_reports', 'approve_journal_vouchers'),
  body('voucherDate').optional().isISO8601().withMessage('Voucher date must be a valid date'),
  body('reference').optional().isString().trim().isLength({ max: 100 }).withMessage('Reference is too long'),
  body('description').optional().isString().trim().isLength({ max: 1000 }).withMessage('Description is too long'),
  body('entries').isArray({ min: 2 }).withMessage('At least two entries are required'),
  body('entries.*.accountId').isMongoId().withMessage('Account ID is required for each entry'),
  body('entries.*.debit').optional().isFloat({ min: 0 }).withMessage('Debit must be a non-negative number'),
  body('entries.*.credit').optional().isFloat({ min: 0 }).withMessage('Credit must be a non-negative number'),
  body('entries.*.particulars').optional().isString().trim().isLength({ max: 500 }).withMessage('Particulars are too long'),
  body('approvalThreshold').optional().isFloat({ min: 0 }).withMessage('Approval threshold must be a non-negative number')
], handleValidationErrors, async (req, res) => {
  try {
    const { voucherDate, reference, description, entries, notes } = req.body;
    const createdBy = req.user?._id;

    const accountIds = entries.map(entry => entry.accountId);
    const accounts = await chartOfAccountsRepository.findAll({ _id: { $in: accountIds } });

    if (accounts.length !== entries.length) {
      throw new Error('One or more selected accounts were not found.');
    }

    const entriesWithAccount = entries.map(entry => {
      const account = accounts.find(acc => acc._id.toString() === entry.accountId);
      if (!account) {
        throw new Error('Invalid account selected.');
      }

      const debit = Number(entry.debit || 0);
      const credit = Number(entry.credit || 0);

      if (debit <= 0 && credit <= 0) {
        throw new Error('Each entry must have either a debit or credit amount greater than zero.');
      }

      if (debit > 0 && credit > 0) {
        throw new Error('An entry cannot have both debit and credit amounts.');
      }

      return {
        account: account._id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        particulars: entry.particulars || '',
        debit,
        credit
      };
    });

    const totalDebit = entriesWithAccount.reduce((sum, entry) => sum + entry.debit, 0);
    const totalCredit = entriesWithAccount.reduce((sum, entry) => sum + entry.credit, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.0001) {
      throw new Error('Total debit and credit must be equal.');
    }

    if (totalDebit <= 0) {
      throw new Error('Total debit must be greater than zero.');
    }

    const populatedVoucher = await runWithTransactionRetry(async (session) => {
      // Check if approval is required
      const approvalThreshold = req.body.approvalThreshold || 10000; // Default $10,000
      const requiresApproval = totalDebit >= approvalThreshold;
      
      const journalVoucher = new JournalVoucher({
        voucherDate: voucherDate ? new Date(voucherDate) : new Date(),
        reference,
        description,
        entries: entriesWithAccount,
        notes,
        createdBy,
        status: requiresApproval ? 'pending_approval' : 'draft',
        requiresApproval: requiresApproval,
        approvalThreshold: approvalThreshold,
        approvalWorkflow: requiresApproval ? {
          status: 'pending',
          approvers: [], // Will be assigned by approval service
          currentApproverIndex: 0
        } : undefined
      });

      await journalVoucher.save({ session });

      // Update account balances
      for (const entry of entriesWithAccount) {
        const account = accounts.find(acc => acc._id.toString() === entry.account.toString());
        if (!account) continue;

        const amount = entry.debit > 0 ? entry.debit : entry.credit;
        const isDebitEntry = entry.debit > 0;

        let delta = amount;
        if (account.normalBalance === 'debit') {
          delta = isDebitEntry ? amount : -amount;
        } else {
          delta = isDebitEntry ? -amount : amount;
        }

        await chartOfAccountsRepository.updateBalance(
          account._id,
          { $inc: { currentBalance: delta } },
          { session }
        );
      }

      return journalVoucherRepository.findByIdWithSession(journalVoucher._id, {
        session,
        populate: [{ path: 'createdBy', select: 'firstName lastName email' }]
      });
    });

    res.status(201).json({
      success: true,
      message: populatedVoucher.requiresApproval 
        ? 'Journal voucher created and requires approval' 
        : 'Journal voucher created successfully',
      data: populatedVoucher,
      requiresApproval: populatedVoucher.requiresApproval
    });
  } catch (error) {
    console.error('Error creating journal voucher:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create journal voucher'
    });
  }
});

// @route   POST /api/journal-vouchers/:id/approve
// @desc    Approve a journal voucher
// @access  Private (requires 'approve_journal_vouchers' permission)
router.post('/:id/approve', [
  auth,
  requirePermission('approve_journal_vouchers'),
  checkSegregationOfDuties('manage_reports', 'approve_journal_vouchers'),
  param('id').isMongoId().withMessage('Valid voucher ID is required'),
  body('notes').optional().isString().trim().isLength({ max: 500 }).withMessage('Notes too long')
], handleValidationErrors, async (req, res) => {
  try {
    const voucher = await journalVoucherRepository.findById(req.params.id);
    
    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: 'Journal voucher not found'
      });
    }

    // Check if user can approve
    const canApprove = voucher.canBeApprovedBy(req.user._id);
    if (!canApprove.allowed) {
      return res.status(403).json({
        success: false,
        message: canApprove.reason
      });
    }

    // Update approval workflow
    voucher.approvalWorkflow.status = 'approved';
    voucher.approvalWorkflow.approvedBy = req.user._id;
    voucher.approvalWorkflow.approvedAt = new Date();
    voucher.status = 'approved';
    voucher.approvedBy = req.user._id;
    
    if (req.body.notes) {
      if (!voucher.approvalWorkflow.approvers || voucher.approvalWorkflow.approvers.length === 0) {
        voucher.approvalWorkflow.approvers = [{
          user: req.user._id,
          role: 'accountant',
          status: 'approved',
          approvedAt: new Date(),
          notes: req.body.notes
        }];
      } else {
        const currentApprover = voucher.approvalWorkflow.approvers[voucher.approvalWorkflow.currentApproverIndex];
        if (currentApprover) {
          currentApprover.status = 'approved';
          currentApprover.approvedAt = new Date();
          currentApprover.notes = req.body.notes;
        }
      }
    }

    await voucher.save();

    // If approved, post the voucher
    if (voucher.status === 'approved') {
      voucher.status = 'posted';
      await voucher.save();
    }

    res.json({
      success: true,
      message: 'Journal voucher approved successfully',
      data: await journalVoucherRepository.findById(req.params.id, {
        populate: [
          { path: 'createdBy', select: 'firstName lastName email' },
          { path: 'approvedBy', select: 'firstName lastName email' },
          { path: 'approvalWorkflow.approvedBy', select: 'firstName lastName email' }
        ]
      })
    });
  } catch (error) {
    console.error('Error approving journal voucher:', error);
    res.status(500).json({
      success: false,
      message: 'Server error approving journal voucher',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/journal-vouchers/:id/reject
// @desc    Reject a journal voucher
// @access  Private (requires 'approve_journal_vouchers' permission)
router.post('/:id/reject', [
  auth,
  requirePermission('approve_journal_vouchers'),
  checkSegregationOfDuties('manage_reports', 'approve_journal_vouchers'),
  param('id').isMongoId().withMessage('Valid voucher ID is required'),
  body('reason').trim().isLength({ min: 1, max: 500 }).withMessage('Rejection reason is required (max 500 characters)')
], handleValidationErrors, async (req, res) => {
  try {
    const voucher = await journalVoucherRepository.findById(req.params.id);
    
    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: 'Journal voucher not found'
      });
    }

    // Check if user can approve/reject
    const canApprove = voucher.canBeApprovedBy(req.user._id);
    if (!canApprove.allowed && !canApprove.reason.includes('already')) {
      return res.status(403).json({
        success: false,
        message: canApprove.reason
      });
    }

    // Update approval workflow
    voucher.approvalWorkflow.status = 'rejected';
    voucher.approvalWorkflow.rejectionReason = req.body.reason;
    voucher.status = 'rejected';

    if (voucher.approvalWorkflow.approvers && voucher.approvalWorkflow.approvers.length > 0) {
      const currentApprover = voucher.approvalWorkflow.approvers[voucher.approvalWorkflow.currentApproverIndex];
      if (currentApprover) {
        currentApprover.status = 'rejected';
        currentApprover.notes = req.body.reason;
      }
    }

    await voucher.save();

    res.json({
      success: true,
      message: 'Journal voucher rejected',
      data: await journalVoucherRepository.findById(req.params.id, {
        populate: [
          { path: 'createdBy', select: 'firstName lastName email' },
          { path: 'approvalWorkflow.approvedBy', select: 'firstName lastName email' }
        ]
      })
    });
  } catch (error) {
    console.error('Error rejecting journal voucher:', error);
    res.status(500).json({
      success: false,
      message: 'Server error rejecting journal voucher',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/journal-vouchers/:id/approval-status
// @desc    Get approval status of a journal voucher
// @access  Private (requires 'view_reports' permission)
router.get('/:id/approval-status', [
  auth,
  requirePermission('view_reports'),
  param('id').isMongoId().withMessage('Valid voucher ID is required')
], handleValidationErrors, async (req, res) => {
  try {
    const voucher = await journalVoucherRepository.findById(req.params.id, {
      populate: [
        { path: 'createdBy', select: 'firstName lastName email' },
        { path: 'approvedBy', select: 'firstName lastName email' },
        { path: 'approvalWorkflow.approvers.user', select: 'firstName lastName email role' },
        { path: 'approvalWorkflow.approvedBy', select: 'firstName lastName email' }
      ]
    });
    
    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: 'Journal voucher not found'
      });
    }

    res.json({
      success: true,
      data: {
        voucherId: voucher._id,
        voucherNumber: voucher.voucherNumber,
        requiresApproval: voucher.requiresApproval,
        approvalThreshold: voucher.approvalThreshold,
        approvalWorkflow: voucher.approvalWorkflow,
        status: voucher.status,
        canBeApprovedBy: voucher.canBeApprovedBy ? voucher.canBeApprovedBy(req.user._id) : null
      }
    });
  } catch (error) {
    console.error('Error getting approval status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting approval status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;

