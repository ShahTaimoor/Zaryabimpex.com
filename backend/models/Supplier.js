const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  // Basic Information
  companyName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  contactPerson: {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    title: {
      type: String,
      trim: true,
      maxlength: 100
    }
  },
  email: {
    type: String,
    required: false,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },

  // Business Information
  taxId: {
    type: String,
    trim: true
  },
  businessType: {
    type: String,
    enum: ['manufacturer', 'distributor', 'wholesaler', 'dropshipper', 'other'],
    default: 'wholesaler'
  },

  // Address Information
  addresses: [{
    type: {
      type: String,
      enum: ['billing', 'shipping', 'both'],
      default: 'both'
    },
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: {
      type: String,
      default: 'US'
    },
    isDefault: {
      type: Boolean,
      default: false
    }
  }],

  // Payment Terms
  paymentTerms: {
    type: String,
    enum: ['cash', 'net15', 'net30', 'net45', 'net60', 'net90'],
    default: 'net30'
  },
  creditLimit: {
    type: Number,
    default: 0,
    min: 0
  },
  openingBalance: {
    type: Number,
    default: 0
  },
  currentBalance: {
    type: Number,
    default: 0
    // @deprecated - Calculate from Transaction ledger dynamically
  },
  pendingBalance: {
    type: Number,
    default: 0,
    min: 0
    // @deprecated - Calculate from Transaction ledger dynamically
  },
  advanceBalance: {
    type: Number,
    default: 0,
    min: 0
    // @deprecated - Calculate from Transaction ledger dynamically
  },

  // Supplier Rating
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  },
  reliability: {
    type: String,
    enum: ['excellent', 'good', 'average', 'poor'],
    default: 'average'
  },

  // Product Categories
  categories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],

  // Minimum Order
  minOrderAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  minOrderQuantity: {
    type: Number,
    default: 1,
    min: 1
  },

  // Lead Times
  leadTime: {
    type: Number,
    default: 7, // days
    min: 0
  },

  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'blacklisted'],
    default: 'active'
  },

  // Notes
  notes: {
    type: String,
    trim: true,
    maxlength: 1000
  },

  // Audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  ledgerAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChartOfAccounts'
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
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
supplierSchema.index({ companyName: 1 });
supplierSchema.index({ email: 1 });
supplierSchema.index({ businessType: 1, status: 1 });
supplierSchema.index({ status: 1 });

// Virtual for contact person full name
supplierSchema.virtual('contactPerson.fullName').get(function () {
  return `${this.contactPerson.firstName} ${this.contactPerson.lastName}`;
});

// Virtual for display name
supplierSchema.virtual('displayName').get(function () {
  return this.companyName;
});

// Virtual for UI terminology alignment
supplierSchema.virtual('outstandingBalance').get(function () {
  return this.pendingBalance;
});

// Method to get default address
supplierSchema.methods.getDefaultAddress = function (type = 'both') {
  return this.addresses.find(addr =>
    addr.isDefault && (addr.type === type || addr.type === 'both')
  );
};

// Method to check if supplier is reliable
supplierSchema.methods.isReliable = function () {
  return this.reliability === 'excellent' || this.reliability === 'good';
};

// Method to get payment terms in days
supplierSchema.methods.getPaymentTermsDays = function () {
  const termsMap = {
    'cash': 0,
    'net15': 15,
    'net30': 30,
    'net45': 45,
    'net60': 60,
    'net90': 90
  };
  return termsMap[this.paymentTerms] || 30;
};

module.exports = mongoose.model('Supplier', supplierSchema);
