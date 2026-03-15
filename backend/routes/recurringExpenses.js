const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const RecurringExpense = require('../models/RecurringExpense'); // Still needed for new RecurringExpense(), static methods, and session
const Supplier = require('../models/Supplier'); // Still needed for model reference
const Customer = require('../models/Customer'); // Still needed for model reference
const Bank = require('../models/Bank'); // Still needed for model reference
const CashPayment = require('../models/CashPayment'); // Still needed for new CashPayment()
const BankPayment = require('../models/BankPayment'); // Still needed for new BankPayment()
const {
  calculateInitialDueDate,
  calculateNextDueDate,
  hasReminderWindowStarted
} = require('../services/recurringExpenseService');
const recurringExpenseRepository = require('../repositories/RecurringExpenseRepository');
const supplierRepository = require('../repositories/SupplierRepository');
const customerRepository = require('../repositories/CustomerRepository');
const bankRepository = require('../repositories/BankRepository');

const router = express.Router();

const handleValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return false;
  }
  return true;
};

const validateRelatedEntities = async ({ supplier, customer, bank }) => {
  if (supplier) {
    const supplierExists = await supplierRepository.exists({ _id: supplier });
    if (!supplierExists) {
      throw new Error('Supplier not found');
    }
  }

  if (customer) {
    const customerExists = await customerRepository.exists({ _id: customer });
    if (!customerExists) {
      throw new Error('Customer not found');
    }
  }

  if (bank) {
    const bankDoc = await bankRepository.findById(bank);
    if (!bankDoc) {
      throw new Error('Bank account not found');
    }
    if (!bankDoc.isActive) {
      throw new Error('Bank account is inactive');
    }
  }
};

router.get(
  '/',
  [
    auth,
    requirePermission('view_reports'),
    query('status').optional().isIn(['active', 'inactive', 'all']),
    query('search').optional().isString().trim(),
    query('dueInDays').optional().isInt({ min: 0, max: 365 }),
    query('includePastDue').optional().toBoolean()
  ],
  async (req, res) => {
    if (!handleValidation(req, res)) {
      return;
    }

    const {
      status = 'active',
      search,
      dueInDays,
      includePastDue = true
    } = req.query;

    try {
      const filter = {};
      if (status !== 'all') {
        filter.status = status;
      }

      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { notes: { $regex: search, $options: 'i' } },
          { tags: { $regex: search, $options: 'i' } }
        ];
      }

      if (typeof dueInDays !== 'undefined') {
        const days = parseInt(dueInDays, 10);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setDate(end.getDate() + days);
        end.setHours(23, 59, 59, 999);

        filter.nextDueDate = {};
        if (!includePastDue) {
          filter.nextDueDate.$gte = now;
        }
        filter.nextDueDate.$lte = end;
      }

      const recurringExpenses = await recurringExpenseRepository.findWithFilter(filter, {
        sort: { nextDueDate: 1, name: 1 },
        populate: [
          { path: 'supplier', select: 'name companyName businessName displayName' },
          { path: 'customer', select: 'name firstName lastName businessName displayName email' },
          { path: 'bank', select: 'bankName accountNumber accountName' },
          { path: 'expenseAccount', select: 'accountName accountCode' }
        ]
      });

      res.json({
        success: true,
        data: recurringExpenses
      });
    } catch (error) {
      console.error('Error fetching recurring expenses:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

router.get(
  '/upcoming',
  [
    auth,
    requirePermission('view_reports'),
    query('days').optional().isInt({ min: 1, max: 90 })
  ],
  async (req, res) => {
    if (!handleValidation(req, res)) {
      return;
    }

    const days = parseInt(req.query.days || '7', 10);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setDate(end.getDate() + days);
    end.setHours(23, 59, 59, 999);

    try {
      const upcomingExpenses = await recurringExpenseRepository.findWithFilter({
        status: 'active',
        nextDueDate: { $lte: end }
      }, {
        sort: { nextDueDate: 1 },
        populate: [
          { path: 'supplier', select: 'name companyName businessName displayName' },
          { path: 'customer', select: 'name firstName lastName businessName displayName email' },
          { path: 'bank', select: 'bankName accountNumber accountName' }
        ]
      });

      const filtered = upcomingExpenses.filter((expense) =>
        hasReminderWindowStarted(
          expense.nextDueDate,
          typeof expense.reminderDaysBefore === 'number' ? expense.reminderDaysBefore : 0,
          now
        )
      );

      res.json({
        success: true,
        data: filtered
      });
    } catch (error) {
      console.error('Error fetching upcoming recurring expenses:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

router.post(
  '/',
  [
    auth,
    requirePermission('create_orders'),
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('description').optional().isString().trim(),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    body('dayOfMonth').isInt({ min: 1, max: 31 }).withMessage('Day of month must be between 1 and 31'),
    body('reminderDaysBefore').optional().isInt({ min: 0, max: 31 }),
    body('defaultPaymentType').optional().isIn(['cash', 'bank']),
    body('supplier').optional().isMongoId(),
    body('customer').optional().isMongoId(),
    body('expenseAccount').optional().isMongoId(),
    body('bank').optional().isMongoId(),
    body('startFromDate').optional().isISO8601().withMessage('startFromDate must be a valid date'),
    body('tags').optional().isArray(),
    body('tags.*').optional().isString().trim()
  ],
  async (req, res) => {
    if (!handleValidation(req, res)) {
      return;
    }

    try {
      const {
        name,
        description,
        amount,
        dayOfMonth,
        reminderDaysBefore = 3,
        defaultPaymentType = 'cash',
        supplier,
        customer,
        expenseAccount,
        bank,
        notes,
        startFromDate,
        tags = []
      } = req.body;

      if (defaultPaymentType === 'bank' && !bank) {
        return res.status(400).json({
          success: false,
          message: 'Bank account is required for bank payments'
        });
      }

      await validateRelatedEntities({ supplier, customer, bank: defaultPaymentType === 'bank' ? bank : null });

      const baseDate = startFromDate ? new Date(startFromDate) : new Date();
      const nextDueDate = calculateInitialDueDate(dayOfMonth, baseDate);

      const recurringExpense = new RecurringExpense({
        name: name.trim(),
        description: description ? description.trim() : undefined,
        amount: parseFloat(amount),
        dayOfMonth,
        reminderDaysBefore,
        defaultPaymentType,
        supplier: supplier || undefined,
        customer: customer || undefined,
        expenseAccount: expenseAccount || undefined,
        bank: defaultPaymentType === 'bank' ? bank : undefined,
        notes: notes ? notes.trim() : undefined,
        nextDueDate,
        tags,
        createdBy: req.user._id,
        updatedBy: req.user._id
      });

      await recurringExpense.save();

      await recurringExpense.populate([
        { path: 'supplier', select: 'name companyName businessName displayName' },
        { path: 'customer', select: 'name firstName lastName businessName displayName email' },
        { path: 'bank', select: 'bankName accountNumber accountName' },
        { path: 'expenseAccount', select: 'accountName accountCode' }
      ]);

      res.status(201).json({
        success: true,
        message: 'Recurring expense created successfully',
        data: recurringExpense
      });
    } catch (error) {
      console.error('Error creating recurring expense:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Server error'
      });
    }
  }
);

router.put(
  '/:id',
  [
    auth,
    requirePermission('create_orders'),
    param('id').isMongoId(),
    body('name').optional().trim().notEmpty(),
    body('description').optional().isString().trim(),
    body('amount').optional().isFloat({ min: 0 }),
    body('dayOfMonth').optional().isInt({ min: 1, max: 31 }),
    body('reminderDaysBefore').optional().isInt({ min: 0, max: 31 }),
    body('defaultPaymentType').optional().isIn(['cash', 'bank']),
    body('supplier').optional().isMongoId(),
    body('customer').optional().isMongoId(),
    body('expenseAccount').optional().isMongoId(),
    body('bank').optional().isMongoId(),
    body('status').optional().isIn(['active', 'inactive']),
    body('notes').optional().isString().trim(),
    body('nextDueDate').optional().isISO8601().withMessage('nextDueDate must be a valid date'),
    body('tags').optional().isArray(),
    body('tags.*').optional().isString().trim()
  ],
  async (req, res) => {
    if (!handleValidation(req, res)) {
      return;
    }

    try {
      const {
        name,
        description,
        amount,
        dayOfMonth,
        reminderDaysBefore,
        defaultPaymentType,
        supplier,
        customer,
        expenseAccount,
        bank,
        status,
        notes,
        nextDueDate,
        tags
      } = req.body;

      const recurringExpense = await recurringExpenseRepository.findById(req.params.id);
      if (!recurringExpense) {
        return res.status(404).json({
          success: false,
          message: 'Recurring expense not found'
        });
      }

      if (defaultPaymentType === 'bank' || (defaultPaymentType === undefined && recurringExpense.defaultPaymentType === 'bank')) {
        const bankId = typeof bank !== 'undefined' ? bank : recurringExpense.bank;
        if (!bankId) {
          return res.status(400).json({
            success: false,
            message: 'Bank account is required for bank payments'
          });
        }
        await validateRelatedEntities({ supplier, customer, bank: bankId });
      } else {
        await validateRelatedEntities({ supplier, customer });
      }

      if (name) recurringExpense.name = name.trim();
      if (typeof description !== 'undefined') recurringExpense.description = description ? description.trim() : undefined;
      if (typeof amount !== 'undefined') recurringExpense.amount = parseFloat(amount);
      if (typeof reminderDaysBefore !== 'undefined') recurringExpense.reminderDaysBefore = reminderDaysBefore;
      if (typeof defaultPaymentType !== 'undefined') recurringExpense.defaultPaymentType = defaultPaymentType;
      if (typeof supplier !== 'undefined') recurringExpense.supplier = supplier || undefined;
      if (typeof customer !== 'undefined') recurringExpense.customer = customer || undefined;
      if (typeof expenseAccount !== 'undefined') recurringExpense.expenseAccount = expenseAccount || undefined;
      if (typeof status !== 'undefined') recurringExpense.status = status;
      if (typeof notes !== 'undefined') recurringExpense.notes = notes ? notes.trim() : undefined;
      if (Array.isArray(tags)) recurringExpense.tags = tags;

      if (typeof bank !== 'undefined') {
        if (recurringExpense.defaultPaymentType === 'bank') {
          recurringExpense.bank = bank || undefined;
        } else {
          recurringExpense.bank = undefined;
        }
      }

      let dueDateToUpdate = null;
      if (typeof dayOfMonth !== 'undefined' && dayOfMonth !== recurringExpense.dayOfMonth) {
        recurringExpense.dayOfMonth = dayOfMonth;
        dueDateToUpdate = calculateInitialDueDate(dayOfMonth, new Date());
      }

      if (typeof nextDueDate !== 'undefined') {
        dueDateToUpdate = new Date(nextDueDate);
      }

      if (dueDateToUpdate) {
        recurringExpense.nextDueDate = dueDateToUpdate;
        recurringExpense.lastReminderSentAt = undefined;
      }

      recurringExpense.updatedBy = req.user._id;

      await recurringExpense.save();
      await recurringExpense.populate([
        { path: 'supplier', select: 'name companyName businessName displayName' },
        { path: 'customer', select: 'name firstName lastName businessName displayName email' },
        { path: 'bank', select: 'bankName accountNumber accountName' },
        { path: 'expenseAccount', select: 'accountName accountCode' }
      ]);

      res.json({
        success: true,
        message: 'Recurring expense updated successfully',
        data: recurringExpense
      });
    } catch (error) {
      console.error('Error updating recurring expense:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Server error'
      });
    }
  }
);

router.delete(
  '/:id',
  [
    auth,
    requirePermission('create_orders'),
    param('id').isMongoId()
  ],
  async (req, res) => {
    if (!handleValidation(req, res)) {
      return;
    }

    try {
      const recurringExpense = await recurringExpenseRepository.findById(req.params.id);
      if (!recurringExpense) {
        return res.status(404).json({
          success: false,
          message: 'Recurring expense not found'
        });
      }

      recurringExpense.status = 'inactive';
      recurringExpense.updatedBy = req.user._id;
      await recurringExpense.save();

      res.json({
        success: true,
        message: 'Recurring expense deactivated successfully'
      });
    } catch (error) {
      console.error('Error deleting recurring expense:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

router.post(
  '/:id/record-payment',
  [
    auth,
    requirePermission('create_orders'),
    param('id').isMongoId(),
    body('paymentDate').optional().isISO8601().withMessage('paymentDate must be a valid date'),
    body('paymentType').optional().isIn(['cash', 'bank']),
    body('notes').optional().isString().trim()
  ],
  async (req, res) => {
    if (!handleValidation(req, res)) {
      return;
    }

    const session = await RecurringExpense.startSession();
    session.startTransaction();

    try {
      const { paymentDate, paymentType, notes } = req.body;
      const recurringExpense = await recurringExpenseRepository.findByIdWithSession(req.params.id, { session });

      if (!recurringExpense) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: 'Recurring expense not found'
        });
      }

      if (recurringExpense.status !== 'active') {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Recurring expense is inactive'
        });
      }

      const effectivePaymentType = paymentType || recurringExpense.defaultPaymentType || 'cash';
      const effectivePaymentDate = paymentDate ? new Date(paymentDate) : new Date();
      effectivePaymentDate.setHours(0, 0, 0, 0);

      let paymentRecord = null;

      if (effectivePaymentType === 'bank') {
        if (!recurringExpense.bank) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: 'Bank account is required for bank payments'
          });
        }

        const bankPayment = new BankPayment({
          date: effectivePaymentDate,
          amount: recurringExpense.amount,
          particular: recurringExpense.name,
          bank: recurringExpense.bank,
          supplier: recurringExpense.supplier || undefined,
          customer: recurringExpense.customer || undefined,
          notes: notes ? notes.trim() : recurringExpense.notes,
          createdBy: req.user._id
        });

        await bankPayment.save({ session });
        paymentRecord = bankPayment;

        // Update supplier/customer balances asynchronously, don't abort transaction on failure
        if (recurringExpense.supplier && recurringExpense.amount > 0) {
          try {
            const SupplierBalanceService = require('../services/supplierBalanceService');
            await SupplierBalanceService.recordPayment(recurringExpense.supplier, recurringExpense.amount, null);
          } catch (error) {
            console.error('Error updating supplier balance for recurring bank payment:', error);
          }
        }

        if (recurringExpense.customer && recurringExpense.amount > 0) {
          try {
            const CustomerBalanceService = require('../services/customerBalanceService');
            await CustomerBalanceService.recordPayment(recurringExpense.customer, recurringExpense.amount, null);
          } catch (error) {
            console.error('Error updating customer balance for recurring bank payment:', error);
          }
        }

        try {
          const AccountingService = require('../services/accountingService');
          await AccountingService.recordBankPayment(bankPayment);
        } catch (error) {
          console.error('Error creating accounting entries for recurring bank payment:', error);
        }
      } else {
        const cashPayment = new CashPayment({
          date: effectivePaymentDate,
          amount: recurringExpense.amount,
          particular: recurringExpense.name,
          supplier: recurringExpense.supplier || undefined,
          customer: recurringExpense.customer || undefined,
          paymentMethod: 'cash',
          notes: notes ? notes.trim() : recurringExpense.notes,
          createdBy: req.user._id
        });

        await cashPayment.save({ session });
        paymentRecord = cashPayment;

        if (recurringExpense.supplier && recurringExpense.amount > 0) {
          try {
            const SupplierBalanceService = require('../services/supplierBalanceService');
            await SupplierBalanceService.recordPayment(recurringExpense.supplier, recurringExpense.amount, null);
          } catch (error) {
            console.error('Error updating supplier balance for recurring cash payment:', error);
          }
        }

        if (recurringExpense.customer && recurringExpense.amount > 0) {
          try {
            const CustomerBalanceService = require('../services/customerBalanceService');
            await CustomerBalanceService.recordPayment(recurringExpense.customer, recurringExpense.amount, null);
          } catch (error) {
            console.error('Error updating customer balance for recurring cash payment:', error);
          }
        }

        try {
          const AccountingService = require('../services/accountingService');
          await AccountingService.recordCashPayment(cashPayment);
        } catch (error) {
          console.error('Error creating accounting entries for recurring cash payment:', error);
        }
      }

      const anchorDate = recurringExpense.nextDueDate && recurringExpense.nextDueDate instanceof Date
        ? recurringExpense.nextDueDate
        : calculateInitialDueDate(recurringExpense.dayOfMonth, effectivePaymentDate);

      let nextDueDate = calculateNextDueDate(anchorDate, recurringExpense.dayOfMonth);
      if (effectivePaymentDate > anchorDate) {
        nextDueDate = calculateNextDueDate(effectivePaymentDate, recurringExpense.dayOfMonth);
      }

      recurringExpense.lastPaidAt = effectivePaymentDate;
      recurringExpense.nextDueDate = nextDueDate;
      recurringExpense.lastReminderSentAt = undefined;
      recurringExpense.updatedBy = req.user._id;

      await recurringExpense.save({ session });

      await session.commitTransaction();

      await paymentRecord.populate([
        { path: 'supplier', select: 'name companyName businessName displayName' },
        { path: 'customer', select: 'name firstName lastName businessName displayName email' },
        { path: 'createdBy', select: 'firstName lastName' },
        { path: 'bank', select: 'bankName accountNumber accountName' }
      ]);

      res.status(201).json({
        success: true,
        message: 'Recurring expense payment recorded successfully',
        data: {
          payment: paymentRecord,
          recurringExpense
        }
      });
    } catch (error) {
      await session.abortTransaction();
      console.error('Error recording recurring expense payment:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Server error'
      });
    } finally {
      session.endSession();
    }
  }
);

router.post(
  '/:id/snooze',
  [
    auth,
    requirePermission('create_orders'),
    param('id').isMongoId(),
    body('snoozeDays').optional().isInt({ min: 1, max: 30 }),
    body('targetDate').optional().isISO8601()
  ],
  async (req, res) => {
    if (!handleValidation(req, res)) {
      return;
    }

    try {
      const { snoozeDays, targetDate } = req.body;
      const recurringExpense = await recurringExpenseRepository.findById(req.params.id);

      if (!recurringExpense) {
        return res.status(404).json({
          success: false,
          message: 'Recurring expense not found'
        });
      }

      if (recurringExpense.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Recurring expense is inactive'
        });
      }

      if (targetDate) {
        const newDate = new Date(targetDate);
        newDate.setHours(0, 0, 0, 0);
        recurringExpense.nextDueDate = newDate;
      } else if (snoozeDays) {
        const newDate = new Date(recurringExpense.nextDueDate);
        newDate.setDate(newDate.getDate() + parseInt(snoozeDays, 10));
        recurringExpense.nextDueDate = newDate;
      } else {
        const nextDueDate = calculateNextDueDate(recurringExpense.nextDueDate, recurringExpense.dayOfMonth);
        recurringExpense.nextDueDate = nextDueDate;
      }

      recurringExpense.lastReminderSentAt = undefined;
      recurringExpense.updatedBy = req.user._id;
      await recurringExpense.save();

      res.json({
        success: true,
        message: 'Recurring expense snoozed successfully',
        data: recurringExpense
      });
    } catch (error) {
      console.error('Error snoozing recurring expense:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Server error'
      });
    }
  }
);

module.exports = router;


