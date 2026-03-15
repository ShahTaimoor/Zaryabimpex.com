const mongoose = require('mongoose');

const citySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 100
  },
  state: {
    type: String,
    trim: true,
    maxlength: 100
  },
  country: {
    type: String,
    default: 'US',
    trim: true,
    maxlength: 100
  },
  isActive: {
    type: Boolean,
    default: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
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

// Index for better query performance
// name index removed - already has unique: true in field definition
citySchema.index({ isActive: 1 });
citySchema.index({ state: 1 });

module.exports = mongoose.model('City', citySchema);

