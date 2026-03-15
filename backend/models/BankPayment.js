const mongoose = require('mongoose');

const bankPaymentSchema = new mongoose.Schema({
  // Payment Information
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  voucherCode: {
    type: String,
    required: false,  // Auto-generated in pre-save middleware
    trim: true,
    // Internal sequential voucher number for accounting records (e.g., BP-20251101001)
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  particular: {
    type: String,
    required: false,
    trim: true,
    maxlength: 500,
    default: 'Bank Payment'
  },

  // Bank Information
  bank: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bank',
    required: true
  },
  // Legacy fields (for backward compatibility - will be populated from bank reference)
  bankAccount: {
    type: String,
    required: false,  // Deprecated - use bank reference
    trim: true
  },
  bankName: {
    type: String,
    required: false,  // Deprecated - use bank reference
    trim: true
  },
  transactionReference: {
    type: String,
    trim: true,
    // Bank's transaction reference number from statement (e.g., bank confirmation/check number)
  },
  expenseAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChartOfAccounts'
  },

  // Reference Information
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sales',
    required: false
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: false
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: false
  },

  // Additional Information
  notes: {
    type: String,
    trim: true,
    maxlength: 1000
  },

  // Automation and Ledger Tracking
  ledgerPosted: {
    type: Boolean,
    default: false,
    index: true
  },
  autoPosted: {
    type: Boolean,
    default: false
  },
  postedAt: {
    type: Date
  },
  ledgerReferenceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },

  // Audit Fields
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

// Generate voucher code and transaction reference before saving
const { generateDateBasedVoucherCode } = require('../utils/voucherCodeGenerator');
bankPaymentSchema.pre('save', async function (next) {
  if (this.isNew && !this.voucherCode) {
    try {
      this.voucherCode = await generateDateBasedVoucherCode({
        prefix: 'BP',
        Model: this.constructor
      });
    } catch (error) {
      return next(error);
    }
  }

  // Auto-generate transaction reference if not provided
  if (this.isNew && !this.transactionReference) {
    this.transactionReference = `${this.voucherCode || 'BP'}-${Date.now().toString().slice(-6)}`;
  }

  // Populate legacy fields from bank reference for backward compatibility
  if (this.bank) {
    // Check if bank is populated (has accountNumber property)
    // When populated, this.bank will be an object with accountNumber/bankName
    // When not populated, this.bank will be an ObjectId, and accessing .accountNumber returns undefined
    const isPopulated = this.bank.accountNumber !== undefined && this.bank.bankName !== undefined;

    if (isPopulated) {
      // Bank is already populated (from populate())
      this.bankAccount = this.bank.accountNumber;
      this.bankName = this.bank.bankName;
    } else {
      // Bank reference is set but not populated (it's an ObjectId), fetch it
      try {
        const Bank = mongoose.model('Bank');
        const bankDoc = await Bank.findById(this.bank);
        if (bankDoc) {
          this.bankAccount = bankDoc.accountNumber;
          this.bankName = bankDoc.bankName;
        }
      } catch (error) {
        // If Bank model not found or fetch fails, silently continue
        // Legacy fields will remain unset
        console.error('Error fetching bank details:', error);
      }
    }
  }

  next();
});

// Index for better query performance
bankPaymentSchema.index({ date: -1 });
bankPaymentSchema.index({ voucherCode: 1 }, { unique: true, sparse: true }); // Sparse allows multiple null values
bankPaymentSchema.index({ createdBy: 1 });

module.exports = mongoose.model('BankPayment', bankPaymentSchema);
