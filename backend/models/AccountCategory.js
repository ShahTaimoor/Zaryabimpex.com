const mongoose = require('mongoose');

const accountCategorySchema = new mongoose.Schema({
  // Category Identification
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  code: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    uppercase: true
  },
  
  // Category Classification
  accountType: {
    type: String,
    required: true,
    enum: ['asset', 'liability', 'equity', 'revenue', 'expense']
  },
  
  // Category Properties
  description: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isSystemCategory: {
    type: Boolean,
    default: false // System categories cannot be deleted
  },
  
  // Display Properties
  displayOrder: {
    type: Number,
    default: 0
  },
  color: {
    type: String,
    default: '#6B7280' // Default gray color
  },
  
  // Metadata
  notes: {
    type: String
  },
  
  // Audit Trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for efficient queries
accountCategorySchema.index({ accountType: 1, displayOrder: 1 });
// code index removed - already has unique: true in field definition

// Virtual for full category path
accountCategorySchema.virtual('fullCategoryPath').get(function() {
  return `${this.accountType.toUpperCase()} > ${this.name}`;
});

// Method to get categories by account type
accountCategorySchema.statics.getCategoriesByType = async function(accountType) {
  return await this.find({ 
    accountType: accountType, 
    isActive: true 
  }).sort({ displayOrder: 1, name: 1 });
};

// Method to get all categories grouped by type
accountCategorySchema.statics.getAllCategoriesGrouped = async function() {
  const categories = await this.find({ isActive: true })
    .sort({ accountType: 1, displayOrder: 1, name: 1 });
  
  const grouped = {
    asset: [],
    liability: [],
    equity: [],
    revenue: [],
    expense: []
  };
  
  categories.forEach(category => {
    if (grouped[category.accountType]) {
      grouped[category.accountType].push(category);
    }
  });
  
  return grouped;
};

const AccountCategory = mongoose.model('AccountCategory', accountCategorySchema);

module.exports = AccountCategory;
