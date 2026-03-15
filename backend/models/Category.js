const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  image: {
    type: String,
    trim: true
  },
  metadata: {
    type: Map,
    of: String
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
// name index removed - already has unique: true in field definition
categorySchema.index({ parentCategory: 1 });
categorySchema.index({ isActive: 1 });

// Virtual for subcategories
categorySchema.virtual('subcategories', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parentCategory'
});

// Virtual for product count
categorySchema.virtual('productCount', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'category',
  count: true
});

// Pre-save middleware to ensure name uniqueness
categorySchema.pre('save', async function(next) {
  if (this.isModified('name')) {
    const existingCategory = await this.constructor.findOne({
      name: this.name,
      _id: { $ne: this._id }
    });
    
    if (existingCategory) {
      const error = new Error('Category name already exists');
      return next(error);
    }
  }
  next();
});

// Static method to get category tree
categorySchema.statics.getCategoryTree = async function() {
  const categories = await this.find({ isActive: true })
    .populate('subcategories')
    .sort({ sortOrder: 1, name: 1 });
  
  return categories.filter(cat => !cat.parentCategory);
};

// Static method to get category with all subcategories
categorySchema.statics.getCategoryWithSubcategories = async function(categoryId) {
  return await this.findById(categoryId)
    .populate({
      path: 'subcategories',
      populate: {
        path: 'subcategories'
      }
    });
};

module.exports = mongoose.model('Category', categorySchema);
