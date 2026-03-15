const mongoose = require('mongoose');

const tillSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  storeId: { type: String, index: true },
  deviceId: { type: String },
  openedAt: { type: Date, required: true },
  closedAt: { type: Date },
  openingAmount: { type: Number, required: true, default: 0 },
  closingDeclaredAmount: { type: Number },
  expectedAmount: { type: Number },
  varianceAmount: { type: Number },
  varianceType: { type: String, enum: ['over', 'short', 'exact'], default: 'exact' },
  notesOpen: { type: String, default: '' },
  notesClose: { type: String, default: '' },
  status: { type: String, enum: ['open', 'closed'], default: 'open', index: true }
}, { timestamps: true });

tillSessionSchema.methods.closeTill = function(closingDeclaredAmount, expectedAmount, notesClose) {
  if (this.status !== 'open') return false;
  this.closedAt = new Date();
  this.closingDeclaredAmount = closingDeclaredAmount;
  this.expectedAmount = expectedAmount !== undefined ? expectedAmount : closingDeclaredAmount;
  this.varianceAmount = this.closingDeclaredAmount - this.expectedAmount;
  if (this.varianceAmount > 0) {
    this.varianceType = 'over';
  } else if (this.varianceAmount < 0) {
    this.varianceType = 'short';
  } else {
    this.varianceType = 'exact';
  }
  this.notesClose = notesClose || this.notesClose;
  this.status = 'closed';
  return true;
};

tillSessionSchema.index({ user: 1, status: 1 });
tillSessionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('TillSession', tillSessionSchema);

