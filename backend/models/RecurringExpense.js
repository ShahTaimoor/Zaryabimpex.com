const mongoose = require('mongoose');

const recurringExpenseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  frequency: {
    type: String,
    enum: ['monthly'],
    default: 'monthly'
  },
  dayOfMonth: {
    type: Number,
    min: 1,
    max: 31,
    required: true
  },
  nextDueDate: {
    type: Date,
    required: true
  },
  reminderDaysBefore: {
    type: Number,
    min: 0,
    max: 31,
    default: 3
  },
  lastReminderSentAt: {
    type: Date
  },
  lastPaidAt: {
    type: Date
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
  },
  expenseAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChartOfAccounts'
  },
  defaultPaymentType: {
    type: String,
    enum: ['cash', 'bank'],
    default: 'cash'
  },
  bank: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bank'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

recurringExpenseSchema.index({ nextDueDate: 1, status: 1 });
recurringExpenseSchema.index({ name: 1 });

module.exports = mongoose.model('RecurringExpense', recurringExpenseSchema);


