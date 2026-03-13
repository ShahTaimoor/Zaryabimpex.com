const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const {
  calculateInitialDueDate,
  calculateNextDueDate,
  hasReminderWindowStarted
} = require('../services/recurringExpenseService');
const recurringExpenseRepository = require('../repositories/postgres/RecurringExpenseRepository');
const supplierRepository = require('../repositories/postgres/SupplierRepository');
const customerRepository = require('../repositories/postgres/CustomerRepository');
const bankRepository = require('../repositories/postgres/BankRepository');
const cashPaymentRepository = require('../repositories/postgres/CashPaymentRepository');
const bankPaymentRepository = require('../repositories/postgres/BankPaymentRepository');
const { transaction } = require('../config/postgres');

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
    const supplierDoc = await supplierRepository.findById(supplier);
    if (!supplierDoc) {
      throw new Error('Supplier not found');
    }
  }

  if (customer) {
    const customerDoc = await customerRepository.findById(customer);
    if (!customerDoc) {
      throw new Error('Customer not found');
    }
  }

  if (bank) {
    const bankDoc = await bankRepository.findById(bank);
    if (!bankDoc) {
      throw new Error('Bank account not found');
    }
    if (bankDoc.is_active === false) {
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
        filter.search = search;
      }
      if (typeof dueInDays !== 'undefined') {
        filter.dueInDays = dueInDays;
        filter.includePastDue = includePastDue;
      }

      const recurringExpenses = await recurringExpenseRepository.findWithFilter(filter, {
        sort: { nextDueDate: 1, name: 1 }
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
        nextDueDateLte: end
      }, {
        sort: { nextDueDate: 1 }
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
    body('supplier').optional().isUUID(4),
    body('customer').optional().isUUID(4),
    body('expenseAccount').optional().isUUID(4),
    body('bank').optional().isUUID(4),
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

      const userId = req.user?.id || req.user?._id;
      const created = await recurringExpenseRepository.create({
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
        createdBy: userId
      });
      const recurringExpense = await recurringExpenseRepository.findByIdWithJoins(created.id);

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
    param('id').isUUID(4),
    body('name').optional().trim().notEmpty(),
    body('description').optional().isString().trim(),
    body('amount').optional().isFloat({ min: 0 }),
    body('dayOfMonth').optional().isInt({ min: 1, max: 31 }),
    body('reminderDaysBefore').optional().isInt({ min: 0, max: 31 }),
    body('defaultPaymentType').optional().isIn(['cash', 'bank']),
    body('supplier').optional().isUUID(4),
    body('customer').optional().isUUID(4),
    body('expenseAccount').optional().isUUID(4),
    body('bank').optional().isUUID(4),
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

      const existing = await recurringExpenseRepository.findById(req.params.id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Recurring expense not found'
        });
      }

      const currentPaymentType = existing.default_payment_type || existing.defaultPaymentType;
      if (defaultPaymentType === 'bank' || (defaultPaymentType === undefined && currentPaymentType === 'bank')) {
        const bankId = typeof bank !== 'undefined' ? bank : (existing.bank_id || existing.bank);
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

      const update = {};
      if (name) update.name = name.trim();
      if (typeof description !== 'undefined') update.description = description ? description.trim() : undefined;
      if (typeof amount !== 'undefined') update.amount = parseFloat(amount);
      if (typeof reminderDaysBefore !== 'undefined') update.reminderDaysBefore = reminderDaysBefore;
      if (typeof defaultPaymentType !== 'undefined') update.defaultPaymentType = defaultPaymentType;
      if (typeof supplier !== 'undefined') update.supplierId = supplier || null;
      if (typeof customer !== 'undefined') update.customerId = customer || null;
      if (typeof expenseAccount !== 'undefined') update.expenseAccountId = expenseAccount || null;
      if (typeof status !== 'undefined') update.status = status;
      if (typeof notes !== 'undefined') update.notes = notes ? notes.trim() : undefined;
      if (Array.isArray(tags)) update.tags = tags;

      if (typeof bank !== 'undefined') {
        update.bankId = (defaultPaymentType === 'bank' || currentPaymentType === 'bank') ? (bank || null) : null;
      }

      let dueDateToUpdate = null;
      const currentDayOfMonth = existing.day_of_month || existing.dayOfMonth;
      if (typeof dayOfMonth !== 'undefined' && dayOfMonth !== currentDayOfMonth) {
        update.dayOfMonth = dayOfMonth;
        dueDateToUpdate = calculateInitialDueDate(dayOfMonth, new Date());
      }
      if (typeof nextDueDate !== 'undefined') {
        dueDateToUpdate = new Date(nextDueDate);
      }
      if (dueDateToUpdate) {
        update.nextDueDate = dueDateToUpdate;
        update.lastReminderSentAt = null;
      }

      await recurringExpenseRepository.updateById(req.params.id, update);
      const recurringExpense = await recurringExpenseRepository.findByIdWithJoins(req.params.id);

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
    param('id').isUUID(4)
  ],
  async (req, res) => {
    if (!handleValidation(req, res)) {
      return;
    }

    try {
      const existing = await recurringExpenseRepository.findById(req.params.id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Recurring expense not found'
        });
      }
      await recurringExpenseRepository.updateById(req.params.id, { status: 'inactive' });

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
    param('id').isUUID(4),
    body('paymentDate').optional().isISO8601().withMessage('paymentDate must be a valid date'),
    body('paymentType').optional().isIn(['cash', 'bank']),
    body('notes').optional().isString().trim()
  ],
  async (req, res) => {
    if (!handleValidation(req, res)) {
      return;
    }

    const userId = req.user?.id || req.user?._id;
    const { paymentDate, paymentType, notes } = req.body;

    try {
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

      const effectivePaymentType = paymentType || recurringExpense.default_payment_type || 'cash';
      const effectivePaymentDate = paymentDate ? new Date(paymentDate) : new Date();
      effectivePaymentDate.setHours(0, 0, 0, 0);

      const amount = parseFloat(recurringExpense.amount);
      const supplierId = recurringExpense.supplier_id || null;
      const customerId = recurringExpense.customer_id || null;
      const bankId = recurringExpense.bank_id || null;
      const name = recurringExpense.name;
      const notesVal = notes ? notes.trim() : (recurringExpense.notes || null);

      const { paymentRecord, updatedRecurring } = await transaction(async (client) => {
        let paymentRecord;

        if (effectivePaymentType === 'bank') {
          if (!bankId) {
            throw new Error('Bank account is required for bank payments');
          }
          paymentRecord = await bankPaymentRepository.create({
            date: effectivePaymentDate,
            amount,
            particular: name,
            bankId,
            supplierId,
            customerId,
            notes: notesVal,
            createdBy: userId
          }, client);
        } else {
          paymentRecord = await cashPaymentRepository.create({
            date: effectivePaymentDate,
            amount,
            particular: name,
            supplierId,
            customerId,
            paymentMethod: 'cash',
            notes: notesVal,
            createdBy: userId
          }, client);
        }

        const anchorDate = recurringExpense.next_due_date
          ? new Date(recurringExpense.next_due_date)
          : calculateInitialDueDate(recurringExpense.day_of_month, effectivePaymentDate);
        let nextDue = calculateNextDueDate(anchorDate, recurringExpense.day_of_month);
        if (effectivePaymentDate > anchorDate) {
          nextDue = calculateNextDueDate(effectivePaymentDate, recurringExpense.day_of_month);
        }

        const updated = await recurringExpenseRepository.updateById(req.params.id, {
          lastPaidAt: effectivePaymentDate,
          nextDueDate: nextDue,
          lastReminderSentAt: null
        }, client);

        return { paymentRecord, updatedRecurring: updated };
      });

      if (supplierId && amount > 0) {
        try {
          const SupplierBalanceService = require('../services/supplierBalanceService');
          await SupplierBalanceService.recordPayment(supplierId, amount, null);
        } catch (err) {
          console.error('Error updating supplier balance for recurring payment:', err);
        }
      }
      if (customerId && amount > 0) {
        try {
          const CustomerBalanceService = require('../services/customerBalanceService');
          await CustomerBalanceService.recordPayment(customerId, amount, null);
        } catch (err) {
          console.error('Error updating customer balance for recurring payment:', err);
        }
      }

      const recurringExpenseData = await recurringExpenseRepository.findByIdWithJoins(req.params.id);

      res.status(201).json({
        success: true,
        message: 'Recurring expense payment recorded successfully',
        data: {
          payment: paymentRecord,
          recurringExpense: recurringExpenseData
        }
      });
    } catch (error) {
      console.error('Error recording recurring expense payment:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Server error'
      });
    }
  }
);

router.post(
  '/:id/snooze',
  [
    auth,
    requirePermission('create_orders'),
    param('id').isUUID(4),
    body('snoozeDays').optional().isInt({ min: 1, max: 30 }),
    body('targetDate').optional().isISO8601()
  ],
  async (req, res) => {
    if (!handleValidation(req, res)) {
      return;
    }

    try {
      const { snoozeDays, targetDate } = req.body;
      const existing = await recurringExpenseRepository.findById(req.params.id);

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Recurring expense not found'
        });
      }

      if (existing.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Recurring expense is inactive'
        });
      }

      let nextDueDate;
      if (targetDate) {
        const newDate = new Date(targetDate);
        newDate.setHours(0, 0, 0, 0);
        nextDueDate = newDate;
      } else if (snoozeDays) {
        const currentDue = existing.next_due_date || existing.nextDueDate;
        const newDate = new Date(currentDue);
        newDate.setDate(newDate.getDate() + parseInt(snoozeDays, 10));
        nextDueDate = newDate;
      } else {
        const currentDue = existing.next_due_date || existing.nextDueDate;
        const dayOfMonth = existing.day_of_month || existing.dayOfMonth;
        nextDueDate = calculateNextDueDate(currentDue, dayOfMonth);
      }

      await recurringExpenseRepository.updateById(req.params.id, {
        nextDueDate,
        lastReminderSentAt: null
      });
      const recurringExpense = await recurringExpenseRepository.findByIdWithJoins(req.params.id);

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


