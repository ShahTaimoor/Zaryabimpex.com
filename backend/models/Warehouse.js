const mongoose = require('mongoose');

const AddressSchema = new mongoose.Schema(
  {
    line1: { type: String, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    country: { type: String, trim: true },
  },
  { _id: false }
);

const ContactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
  },
  { _id: false }
);

const WarehouseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
      uppercase: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    address: AddressSchema,
    contact: ContactSchema,
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    capacity: {
      type: Number,
      min: 0,
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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
  },
  {
    timestamps: true,
  }
);

WarehouseSchema.index({ name: 1 });
// code index removed - already has unique: true in field definition
WarehouseSchema.index({ isActive: 1 });
WarehouseSchema.index({ isPrimary: 1 });

WarehouseSchema.pre('save', async function ensureSinglePrimary(next) {
  if (this.isPrimary && this.isModified('isPrimary')) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id } },
      { $set: { isPrimary: false } }
    );
  }
  next();
});

module.exports = mongoose.model('Warehouse', WarehouseSchema);

