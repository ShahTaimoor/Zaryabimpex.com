const mongoose = require('mongoose');

const disputeSchema = new mongoose.Schema({
  // Transaction Reference
  transaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CustomerTransaction',
    required: true,
    index: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true
  },
  
  // Dispute Information
  disputeNumber: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  disputeType: {
    type: String,
    enum: ['chargeback', 'refund_request', 'billing_error', 'duplicate_charge', 'unauthorized', 'other'],
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['open', 'under_review', 'resolved', 'rejected', 'escalated'],
    default: 'open',
    index: true
  },
  
  // Amount
  disputedAmount: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Details
  reason: {
    type: String,
    required: true,
    maxlength: 2000
  },
  customerDescription: {
    type: String,
    maxlength: 5000
  },
  internalNotes: {
    type: String,
    maxlength: 5000
  },
  
  // Resolution
  resolution: {
    type: String,
    enum: ['refund_full', 'refund_partial', 'credit_note', 'adjustment', 'rejected', 'other'],
    default: null
  },
  resolutionAmount: {
    type: Number,
    min: 0
  },
  resolutionNotes: {
    type: String,
    maxlength: 2000
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedAt: Date,
  
  // Escalation
  escalated: {
    type: Boolean,
    default: false
  },
  escalatedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  escalatedAt: Date,
  escalationReason: String,
  
  // Communication
  communications: [{
    type: {
      type: String,
      enum: ['email', 'phone', 'letter', 'internal_note'],
      required: true
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      required: true
    },
    content: {
      type: String,
      required: true,
      maxlength: 5000
    },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    sentAt: {
      type: Date,
      default: Date.now
    },
    attachments: [{
      filename: String,
      url: String,
      uploadedAt: Date
    }]
  }],
  
  // Priority
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true
  },
  
  // Due date for resolution
  dueDate: {
    type: Date,
    index: true
  },
  
  // Audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
disputeSchema.index({ customer: 1, status: 1, createdAt: -1 });
disputeSchema.index({ transaction: 1 });
disputeSchema.index({ status: 1, priority: 1, dueDate: 1 });
disputeSchema.index({ assignedTo: 1, status: 1 });

// Static method to generate dispute number
disputeSchema.statics.generateDisputeNumber = async function() {
  const Counter = require('./Counter');
  const counter = await Counter.findByIdAndUpdate(
    { _id: 'dispute' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  
  const year = new Date().getFullYear();
  const seq = String(counter.seq).padStart(6, '0');
  
  return `DSP-${year}-${seq}`;
};

// Pre-save hook to generate dispute number
disputeSchema.pre('save', async function(next) {
  if (this.isNew && !this.disputeNumber) {
    this.disputeNumber = await this.constructor.generateDisputeNumber();
  }
  next();
});

// Method to add communication
disputeSchema.methods.addCommunication = function(type, content, sentBy, direction = 'outbound') {
  this.communications.push({
    type,
    direction,
    content,
    sentBy,
    sentAt: new Date()
  });
};

// Method to resolve dispute
disputeSchema.methods.resolve = function(resolution, resolutionAmount, resolutionNotes, resolvedBy) {
  this.status = 'resolved';
  this.resolution = resolution;
  this.resolutionAmount = resolutionAmount;
  this.resolutionNotes = resolutionNotes;
  this.resolvedBy = resolvedBy;
  this.resolvedAt = new Date();
};

module.exports = mongoose.model('Dispute', disputeSchema);

