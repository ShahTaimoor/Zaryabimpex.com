const mongoose = require('mongoose');

const purchaseInvoiceItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: false // Made optional for manual invoice creation
  },
  productName: {
    type: String,
    required: false // Product name for manual entries
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unitCost: {
    type: Number,
    required: true,
    min: 0
  },
  totalCost: {
    type: Number,
    required: true,
    min: 0
  }
});

const purchaseInvoiceSchema = new mongoose.Schema({
  // Invoice Information
  invoiceNumber: {
    type: String,
    required: false, // Made optional - will be auto-generated if not provided
    unique: true,
    sparse: true // Allow multiple null/undefined values
  },
  invoiceType: {
    type: String,
    enum: ['purchase', 'return', 'adjustment'],
    default: 'purchase'
  },

  // Supplier Information
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  supplierInfo: {
    name: String,
    email: String,
    phone: String,
    companyName: String,
    address: String
  },

  // Invoice Items
  items: [purchaseInvoiceItemSchema],

  // Pricing Summary
  pricing: {
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    isTaxExempt: {
      type: Boolean,
      default: false
    },
    total: {
      type: Number,
      required: true,
      min: 0
    }
  },

  // Payment Information
  payment: {
    status: {
      type: String,
      enum: ['pending', 'paid', 'partial', 'overdue'],
      default: 'pending'
    },
    method: {
      type: String,
      enum: ['cash', 'bank_transfer', 'check', 'credit', 'other'],
      default: 'cash'
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    dueDate: Date,
    paidDate: Date,
    isPartialPayment: {
      type: Boolean,
      default: false
    }
  },

  // Additional Information
  expectedDelivery: Date,
  actualDelivery: Date,
  notes: String,
  terms: String,

  // Editable Invoice Date (for backdating/postdating)
  invoiceDate: {
    type: Date,
    default: null,
    index: true
  },

  // Status and Tracking
  status: {
    type: String,
    enum: ['draft', 'confirmed', 'received', 'paid', 'cancelled', 'closed'],
    default: 'draft'
  },
  confirmedDate: Date,
  receivedDate: Date,
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

  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Soft Delete Fields
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes
// invoiceNumber index removed - already has unique: true in field definition
purchaseInvoiceSchema.index({ supplier: 1 });
purchaseInvoiceSchema.index({ status: 1 });
purchaseInvoiceSchema.index({ createdAt: -1 });

// Pre-save middleware to generate invoice number
purchaseInvoiceSchema.pre('save', async function (next) {
  if (this.isNew && !this.invoiceNumber) {
    // Use invoiceDate if provided (for backdating), otherwise use current date
    const dateToUse = this.invoiceDate ? new Date(this.invoiceDate) : new Date();
    const year = dateToUse.getFullYear();
    const month = String(dateToUse.getMonth() + 1).padStart(2, '0');
    const day = String(dateToUse.getDate()).padStart(2, '0');

    // Use atomic counter for date-based invoice numbers (same approach as Sales)
    try {
      const Counter = mongoose.model('Counter');
      const counterKey = `purchaseInvoiceNumber_${year}${month}${day}`;

      // Atomically increment counter using findOneAndUpdate
      const counter = await Counter.findOneAndUpdate(
        { _id: counterKey },
        { $inc: { seq: 1 } },
        { upsert: true, new: true }
      );

      this.invoiceNumber = `PI-${year}${month}${day}-${String(counter.seq).padStart(4, '0')}`;
    } catch (err) {
      console.error('Error generating purchase invoice number:', err);
      // Fallback to count-based method if Counter model fails
      const startOfDay = new Date(dateToUse.getFullYear(), dateToUse.getMonth(), dateToUse.getDate());
      const endOfDay = new Date(dateToUse.getFullYear(), dateToUse.getMonth(), dateToUse.getDate() + 1);

      const count = await this.constructor.countDocuments({
        $or: [
          { invoiceDate: { $gte: startOfDay, $lt: endOfDay } },
          { createdAt: { $gte: startOfDay, $lt: endOfDay } }
        ]
      });

      this.invoiceNumber = `PI-${year}${month}${day}-${String(count + 1).padStart(4, '0')}`;
    }
  }
  next();
});

// Static method to generate invoice number
purchaseInvoiceSchema.statics.generateInvoiceNumber = function () {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const time = String(now.getTime()).slice(-4);

  return `PI-${year}${month}${day}-${time}`;
};

// Method to calculate totals
purchaseInvoiceSchema.methods.calculateTotals = function () {
  let subtotal = 0;

  this.items.forEach(item => {
    item.totalCost = item.quantity * item.unitCost;
    subtotal += item.totalCost;
  });

  this.pricing.subtotal = subtotal;
  this.pricing.total = subtotal - (this.pricing.discountAmount || 0) + (this.pricing.taxAmount || 0);

  return this.pricing;
};

module.exports = mongoose.model('PurchaseInvoice', purchaseInvoiceSchema);
