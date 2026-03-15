const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic Information
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
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  phone: {
    type: String,
    trim: true
  },
  
  // Activity Tracking
  lastLogin: {
    type: Date,
    default: null
  },
  loginCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  loginHistory: [{
    loginTime: Date,
    ipAddress: String,
    userAgent: String
  }],
  
  // Permission History Tracking
  permissionHistory: [{
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    changeType: {
      type: String,
      enum: ['created', 'updated', 'role_changed', 'permissions_modified'],
      required: true
    },
    oldRole: String,
    newRole: String,
    oldPermissions: [String],
    newPermissions: [String],
    notes: String
  }],
  
  // Role and Permissions
  role: {
    type: String,
    enum: ['admin', 'manager', 'cashier', 'inventory', 'viewer'],
    default: 'cashier'
  },
  permissions: [{
    type: String,
    enum: [
      'view_products', 'create_products', 'edit_products', 'delete_products',
      'view_customers', 'create_customers', 'edit_customers', 'delete_customers',
      'view_suppliers', 'create_suppliers', 'edit_suppliers', 'delete_suppliers',
      'view_orders', 'create_orders', 'edit_orders', 'cancel_orders',
      'view_inventory', 'update_inventory',       'view_reports', 'view_pl_statements', 
      'view_balance_sheets', 'view_sales_performance', 'view_inventory_reports', 
      'view_general_reports', 'view_backdate_report',
      'view_customer_analytics', 'view_anomaly_detection',
      // Product subcategories
      'view_product_list', 'view_product_details', 'view_product_categories', 'view_product_inventory',
      // Customer subcategories  
      'view_customer_list', 'view_customer_details', 'view_customer_history', 'view_customer_balance',
      // Supplier subcategories
      'view_supplier_list', 'view_supplier_details', 'view_supplier_orders', 'view_supplier_balance',
      // Order subcategories
      'view_sales_orders', 'view_purchase_orders', 'view_sales_invoices', 'view_purchase_invoices',
      // Inventory subcategories
      'view_inventory_levels', 'view_stock_movements', 'view_low_stock_alerts',
      'update_stock_quantities', 'create_stock_adjustments', 'process_receipts',
      // Return subcategories
      'view_return_requests', 'view_return_history', 'view_return_reasons',
      // Discount subcategories
      'view_discount_list', 'view_discount_rules', 'view_discount_history',
      'create_discounts', 'edit_discounts', 'delete_discounts',
      // Admin subcategories
      'create_users', 'edit_users', 'delete_users', 'assign_roles',
      'company_settings', 'system_settings', 'print_settings', 'security_settings',
      'view_backup_list', 'view_backup_logs', 'create_backups', 'restore_backups', 'delete_backups',
      'manage_users',
      'manage_settings', 'view_analytics', 'view_backups', 'manage_backups',
      'view_recommendations',
      'view_returns',
      'create_returns',
      'edit_returns',
      'approve_returns',
      'process_returns',
      'view_discounts',
      'manage_discounts',
      'view_cost_prices',
      // Accounting granular permissions (standardized to underscores)
      'view_accounting_transactions',
      'view_accounting_accounts',
      'view_trial_balance',
      'update_balance_sheet',
      'view_chart_of_accounts',
      'view_accounting_summary',
      // Attendance granular permissions (standardized to underscores)
      'clock_attendance',
      'clock_in',
      'clock_out',
      'manage_attendance_breaks',
      'view_own_attendance',
      'view_team_attendance',
      // Till management permissions (standardized to underscores)
      'open_till',
      'close_till',
      'view_till',
      // Investor management permissions (standardized to underscores)
      'view_investors',
      'manage_investors',
      'create_investors',
      'edit_investors',
      'payout_investors',
      // Financial Operations - Cash Receipts
      'view_cash_receipts', 'create_cash_receipts', 'edit_cash_receipts', 'delete_cash_receipts',
      // Financial Operations - Cash Payments
      'view_cash_payments', 'create_cash_payments', 'edit_cash_payments', 'delete_cash_payments',
      // Financial Operations - Bank Receipts
      'view_bank_receipts', 'create_bank_receipts', 'edit_bank_receipts', 'delete_bank_receipts',
      // Financial Operations - Bank Payments
      'view_bank_payments', 'create_bank_payments', 'edit_bank_payments', 'delete_bank_payments',
      // Financial Operations - Expenses
      'view_expenses', 'create_expenses', 'edit_expenses', 'delete_expenses', 'approve_expenses',
      // Purchase Operations - Granular
      'create_purchase_orders', 'edit_purchase_orders', 'delete_purchase_orders',
      'approve_purchase_orders', 'reject_purchase_orders', 'receive_purchase_orders',
      'create_purchase_invoices', 'edit_purchase_invoices', 'delete_purchase_invoices',
      // Sales Operations - Granular
      'create_sales_orders', 'edit_sales_orders', 'delete_sales_orders',
      'approve_sales_orders', 'reject_sales_orders',
      'create_sales_invoices', 'edit_sales_invoices', 'void_sales_invoices',
      'apply_discounts', 'override_prices',
      // Inventory Operations - Granular
      'generate_purchase_orders', 'acknowledge_inventory_alerts',
      'export_inventory_reports', 'import_inventory_data',
      // Reports & Analytics - Granular
      'export_reports', 'share_reports', 'schedule_reports',
      'view_advanced_analytics',
      // System Operations
      'view_audit_logs', 'export_data', 'import_data',
      'manage_integrations', 'configure_notifications'
    ]
  }],
  
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  
  // Login Information
  lastLogin: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  
  // Profile
  avatar: {
    type: String
  },
  department: {
    type: String,
    trim: true
  },
  
  // Settings
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark'],
      default: 'light'
    },
    language: {
      type: String,
      default: 'en'
    },
    timezone: {
      type: String,
      default: 'America/New_York'
    }
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
userSchema.index({ role: 1, status: 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Track login activity using an atomic update to avoid VersionError under concurrency
userSchema.methods.trackLogin = async function(ipAddress, userAgent) {
  const now = new Date();
  const loginEntry = {
    loginTime: now,
    ipAddress: ipAddress || 'Unknown',
    userAgent: userAgent || 'Unknown'
  };

  // Atomic update: set lastLogin, increment loginCount, and push into loginHistory (capped at 10)
  await this.constructor.updateOne(
    { _id: this._id },
    {
      $set: { lastLogin: now },
      $inc: { loginCount: 1 },
      $push: {
        loginHistory: {
          $each: [loginEntry],
          $position: 0,
          $slice: 10
        }
      }
    }
  );

  // Keep in-memory instance reasonably in sync for downstream logic
  this.lastLogin = now;
  this.loginCount = (this.loginCount || 0) + 1;
  this.loginHistory = [loginEntry, ...(this.loginHistory || [])].slice(0, 10);
};

// Track permission changes using an atomic update to avoid VersionError under concurrency
userSchema.methods.trackPermissionChange = async function(
  changedBy,
  changeType,
  oldData = {},
  newData = {},
  notes = ''
) {
  const permissionRecord = {
    changedBy: changedBy._id || changedBy,
    changedAt: new Date(),
    changeType,
    oldRole: oldData.role,
    newRole: newData.role,
    oldPermissions: oldData.permissions || [],
    newPermissions: newData.permissions || [],
    notes
  };

  await this.constructor.updateOne(
    { _id: this._id },
    {
      $push: {
        permissionHistory: {
          $each: [permissionRecord],
          $position: 0,
          $slice: 20
        }
      }
    }
  );

  // Keep in-memory instance capped as well
  this.permissionHistory = [
    permissionRecord,
    ...(this.permissionHistory || [])
  ].slice(0, 20);
};

// Method to increment login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Method to reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Method to check permission
userSchema.methods.hasPermission = function(permission) {
  if (this.role === 'admin') return true;
  return this.permissions.includes(permission);
};

// Method to get user without sensitive data
userSchema.methods.toSafeObject = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.loginAttempts;
  delete userObject.lockUntil;
  return userObject;
};

module.exports = mongoose.model('User', userSchema);
