const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  // Employee Identification
  employeeId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    index: true
  },
  
  // Personal Information
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    sparse: true // Allow multiple nulls
  },
  phone: {
    type: String,
    trim: true
  },
  alternatePhone: {
    type: String,
    trim: true
  },
  
  // Address Information
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: {
      type: String,
      default: 'US'
    }
  },
  
  // Employment Information
  position: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  department: {
    type: String,
    trim: true,
    maxlength: 100
  },
  hireDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  terminationDate: {
    type: Date
  },
  employmentType: {
    type: String,
    enum: ['full_time', 'part_time', 'contract', 'temporary', 'intern'],
    default: 'full_time'
  },
  
  // Compensation
  salary: {
    type: Number,
    min: 0
  },
  hourlyRate: {
    type: Number,
    min: 0
  },
  payFrequency: {
    type: String,
    enum: ['weekly', 'biweekly', 'monthly', 'daily'],
    default: 'monthly'
  },
  
  // Work Schedule
  workSchedule: {
    type: String,
    enum: ['fixed', 'flexible', 'shift'],
    default: 'fixed'
  },
  shift: {
    type: String,
    enum: ['morning', 'afternoon', 'evening', 'night', 'rotating'],
    default: 'morning'
  },
  
  // Emergency Contact
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String,
    alternatePhone: String
  },
  
  // Additional Information
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer_not_to_say']
  },
  notes: {
    type: String,
    maxlength: 1000
  },
  
  // System User Link (optional - if employee has system access)
  userAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'terminated', 'on_leave'],
    default: 'active',
    index: true
  },
  
  // Documents
  documents: [{
    type: {
      type: String,
      enum: ['id', 'contract', 'certificate', 'other']
    },
    name: String,
    fileUrl: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
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
// employeeId index removed - already has unique: true and index: true in field definition
employeeSchema.index({ status: 1 });
employeeSchema.index({ department: 1 });
employeeSchema.index({ position: 1 });
employeeSchema.index({ userAccount: 1 });

// Virtual for full name
employeeSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for employment duration
employeeSchema.virtual('employmentDuration').get(function() {
  const endDate = this.terminationDate || new Date();
  const startDate = this.hireDate;
  const diffTime = Math.abs(endDate - startDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const years = Math.floor(diffDays / 365);
  const months = Math.floor((diffDays % 365) / 30);
  return { years, months, days: diffDays };
});

// Pre-save middleware to generate employee ID if not provided
employeeSchema.pre('save', async function(next) {
  if (!this.employeeId) {
    // Generate employee ID: EMP + timestamp + random
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.employeeId = `EMP${timestamp}${random}`;
  }
  next();
});

module.exports = mongoose.model('Employee', employeeSchema);

