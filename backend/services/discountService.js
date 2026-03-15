const DiscountRepository = require('../repositories/DiscountRepository');
const SalesRepository = require('../repositories/SalesRepository');
const CustomerRepository = require('../repositories/CustomerRepository');
const ProductRepository = require('../repositories/ProductRepository');
const Discount = require('../models/Discount'); // Still needed for model methods
const Sales = require('../models/Sales'); // Still needed for model methods

class DiscountService {
  constructor() {
    this.discountTypes = {
      PERCENTAGE: 'percentage',
      FIXED_AMOUNT: 'fixed_amount'
    };
  }

  // Create a new discount
  async createDiscount(discountData, createdBy) {
    try {
      // Validate discount data
      const validation = await this.validateDiscountData(discountData);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Check if discount code already exists
      const existingDiscount = await DiscountRepository.findByCode(discountData.code);
      if (existingDiscount) {
        throw new Error('Discount code already exists');
      }

      // Create the discount
      const discountDataWithAudit = {
        ...discountData,
        createdBy,
        auditTrail: [{
          action: 'created',
          performedBy: createdBy,
          details: 'Discount created',
          performedAt: new Date()
        }]
      };

      const discount = await DiscountRepository.create(discountDataWithAudit);
      return discount;
    } catch (error) {
      console.error('Error creating discount:', error);
      throw error;
    }
  }

  // Update an existing discount
  async updateDiscount(discountId, updateData, modifiedBy) {
    try {
      const discount = await DiscountRepository.findById(discountId);
      if (!discount) {
        throw new Error('Discount not found');
      }

      // Validate update data
      const validation = await this.validateDiscountData({ ...discount.toObject(), ...updateData });
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Check if code is being changed and if it already exists
      if (updateData.code && updateData.code !== discount.code) {
        const codeExists = await DiscountRepository.codeExists(updateData.code, discountId);
        if (codeExists) {
          throw new Error('Discount code already exists');
        }
      }

      // Store original values for audit trail
      const originalValues = discount.toObject();

      // Prepare update data with audit trail
      const updateDataWithAudit = {
        ...updateData,
        lastModifiedBy: modifiedBy
      };

      // Get existing audit trail and add new entry
      const existingAuditTrail = discount.auditTrail || [];
      const updatedDiscount = await DiscountRepository.update(discountId, updateDataWithAudit);
      
      // Add audit trail entry (need to update the document after getting it)
      const updatedDiscountDoc = await DiscountRepository.findById(discountId);
      updatedDiscountDoc.auditTrail = existingAuditTrail;
      updatedDiscountDoc.auditTrail.push({
        action: 'updated',
        performedBy: modifiedBy,
        details: 'Discount updated',
        changes: this.getChangedFields(originalValues, { ...originalValues, ...updateData }),
        performedAt: new Date()
      });
      await updatedDiscountDoc.save();

      return updatedDiscountDoc;
    } catch (error) {
      console.error('Error updating discount:', error);
      throw error;
    }
  }

  // Get all discounts with filters
  async getDiscounts(filters = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        type,
        status,
        isActive,
        validFrom,
        validUntil,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = filters;

      const skip = (page - 1) * limit;
      const query = {};

      // Apply filters
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { code: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      if (type) query.type = type;
      if (isActive !== undefined) query.isActive = isActive;

      // Date range filter - use dateFilter from middleware if available (Pakistan timezone)
      if (filters.dateFilter && Object.keys(filters.dateFilter).length > 0) {
        Object.assign(query, filters.dateFilter);
      }

      // Date range filters for discount validity (validFrom/validUntil)
      if (validFrom || validUntil) {
        query.validFrom = {};
        if (validFrom) query.validFrom.$gte = validFrom;
        if (validUntil) query.validFrom.$lte = validUntil;
      }

      // Status filter (this is a virtual field, so we need to handle it differently)
      const sortObj = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
      const populate = [
        { path: 'createdBy', select: 'firstName lastName email' },
        { path: 'lastModifiedBy', select: 'firstName lastName email' },
        { path: 'applicableProducts', select: 'name description' },
        { path: 'applicableCategories', select: 'name' },
        { path: 'applicableCustomers', select: 'displayName email' }
      ];

      const { discounts, total } = await DiscountRepository.findWithPagination(query, {
        page,
        limit,
        sort: sortObj,
        populate
      });

      // Apply status filter after fetching (since it's a virtual field)
      let filteredDiscounts = discounts;
      if (status) {
        filteredDiscounts = discounts.filter(discount => discount.status === status);
      }

      return {
        discounts: filteredDiscounts,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Error fetching discounts:', error);
      throw error;
    }
  }

  // Get discount by ID
  async getDiscountById(discountId) {
    try {
      const populate = [
        { path: 'createdBy', select: 'firstName lastName email' },
        { path: 'lastModifiedBy', select: 'firstName lastName email' },
        { path: 'applicableProducts', select: 'name description price' },
        { path: 'applicableCategories', select: 'name description' },
        { path: 'applicableCustomers', select: 'displayName email businessType customerTier' },
        { path: 'analytics.usageHistory.orderId', select: 'orderNumber total createdAt' },
        { path: 'analytics.usageHistory.customerId', select: 'displayName email' }
      ];

      const discount = await DiscountRepository.findById(discountId, populate);

      if (!discount) {
        throw new Error('Discount not found');
      }

      return discount;
    } catch (error) {
      console.error('Error fetching discount:', error);
      throw error;
    }
  }

  // Get discount by code
  async getDiscountByCode(code) {
    try {
      const populate = [
        { path: 'applicableProducts', select: 'name description' },
        { path: 'applicableCategories', select: 'name' },
        { path: 'applicableCustomers', select: 'displayName email' }
      ];

      const discount = await DiscountRepository.findByCode(code.toUpperCase(), { populate });

      return discount;
    } catch (error) {
      console.error('Error fetching discount by code:', error);
      throw error;
    }
  }

  // Apply discount to an order
  async applyDiscountToOrder(orderId, discountCode, customerId = null) {
    try {
      const order = await SalesRepository.findById(orderId, [{ path: 'customer' }]);
      if (!order) {
        throw new Error('Order not found');
      }

      const discount = await this.getDiscountByCode(discountCode);
      if (!discount) {
        throw new Error('Discount code not found');
      }

      // Check if discount is applicable
      const applicability = discount.isApplicableToOrder(order, order.customer);
      if (!applicability.applicable) {
        throw new Error(applicability.reason);
      }

      // Check if discount is already applied to this order
      if (order.appliedDiscounts && order.appliedDiscounts.some(d => d.discountId.toString() === discount._id.toString())) {
        throw new Error('Discount already applied to this order');
      }

      // Calculate discount amount
      const discountAmount = discount.calculateDiscountAmount(order.total);

      // Check if discount can be combined with other discounts
      if (order.appliedDiscounts && order.appliedDiscounts.length > 0 && !discount.combinableWithOtherDiscounts) {
        throw new Error('This discount cannot be combined with other discounts');
      }

      // Apply the discount
      const appliedDiscount = {
        discountId: discount._id,
        code: discount.code,
        type: discount.type,
        value: discount.value,
        amount: discountAmount,
        appliedAt: new Date()
      };

      // Update order
      order.appliedDiscounts = order.appliedDiscounts || [];
      order.appliedDiscounts.push(appliedDiscount);
      order.total = order.total - discountAmount;
      order.total = Math.max(0, order.total); // Ensure total doesn't go negative

      await order.save();

      // Record discount usage
      await discount.recordUsage(orderId, customerId, discountAmount, order.total + discountAmount);

      return {
        discount,
        appliedDiscount,
        newTotal: order.total
      };
    } catch (error) {
      console.error('Error applying discount:', error);
      throw error;
    }
  }

  // Remove discount from an order
  async removeDiscountFromOrder(orderId, discountCode) {
    try {
      const order = await SalesRepository.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      const discount = await this.getDiscountByCode(discountCode);
      if (!discount) {
        throw new Error('Discount code not found');
      }

      // Find and remove the discount from the order
      const discountIndex = order.appliedDiscounts.findIndex(
        d => d.discountId.toString() === discount._id.toString()
      );

      if (discountIndex === -1) {
        throw new Error('Discount not applied to this order');
      }

      const appliedDiscount = order.appliedDiscounts[discountIndex];
      order.appliedDiscounts.splice(discountIndex, 1);
      order.total += appliedDiscount.amount;

      await order.save();

      return {
        removedDiscount: appliedDiscount,
        newTotal: order.total
      };
    } catch (error) {
      console.error('Error removing discount:', error);
      throw error;
    }
  }

  // Get applicable discounts for an order
  async getApplicableDiscounts(orderData, customerData = null) {
    try {
      // Note: findApplicableDiscounts is a static method on the Discount model
      // This should remain as is since it's a model-level method
      const applicableDiscounts = await Discount.findApplicableDiscounts(orderData, customerData);
      
      // Sort by priority and discount amount
      return applicableDiscounts.sort((a, b) => {
        if (a.discount.priority !== b.discount.priority) {
          return b.discount.priority - a.discount.priority;
        }
        
        const aAmount = a.discount.calculateDiscountAmount(orderData.total);
        const bAmount = b.discount.calculateDiscountAmount(orderData.total);
        return bAmount - aAmount;
      });
    } catch (error) {
      console.error('Error getting applicable discounts:', error);
      throw error;
    }
  }

  // Validate discount data
  async validateDiscountData(discountData) {
    const errors = [];

    // Required fields
    if (!discountData.name || discountData.name.trim().length === 0) {
      errors.push('Name is required');
    }

    if (!discountData.code || discountData.code.trim().length === 0) {
      errors.push('Code is required');
    }

    if (!discountData.type || !['percentage', 'fixed_amount'].includes(discountData.type)) {
      errors.push('Valid type (percentage or fixed_amount) is required');
    }

    if (discountData.value === undefined || discountData.value === null || discountData.value < 0) {
      errors.push('Valid value is required');
    }

    if (discountData.type === 'percentage' && discountData.value > 100) {
      errors.push('Percentage discount cannot exceed 100%');
    }

    if (!discountData.validFrom || !discountData.validUntil) {
      errors.push('Valid from and valid until dates are required');
    }

    if (discountData.validFrom && discountData.validUntil && discountData.validUntil <= discountData.validFrom) {
      errors.push('Valid until date must be after valid from date');
    }

    // Validate applicable entities
    if (discountData.applicableTo === 'products' && (!discountData.applicableProducts || discountData.applicableProducts.length === 0)) {
      errors.push('At least one product must be selected when applicable to products');
    }

    if (discountData.applicableTo === 'categories' && (!discountData.applicableCategories || discountData.applicableCategories.length === 0)) {
      errors.push('At least one category must be selected when applicable to categories');
    }

    if (discountData.applicableTo === 'customers' && (!discountData.applicableCustomers || discountData.applicableCustomers.length === 0)) {
      errors.push('At least one customer must be selected when applicable to customers');
    }

    // Validate usage limits
    if (discountData.usageLimit && discountData.usageLimitPerCustomer && 
        discountData.usageLimitPerCustomer > discountData.usageLimit) {
      errors.push('Per-customer usage limit cannot exceed total usage limit');
    }

    // Validate conditions
    if (discountData.conditions) {
      if (discountData.conditions.minimumQuantity && discountData.conditions.maximumQuantity &&
          discountData.conditions.minimumQuantity > discountData.conditions.maximumQuantity) {
        errors.push('Minimum quantity cannot be greater than maximum quantity');
      }

      if (discountData.conditions.timeOfDay && 
          discountData.conditions.timeOfDay.start && discountData.conditions.timeOfDay.end) {
        const startTime = this.parseTime(discountData.conditions.timeOfDay.start);
        const endTime = this.parseTime(discountData.conditions.timeOfDay.end);
        
        if (startTime >= endTime) {
          errors.push('Start time must be before end time');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Parse time string to minutes
  parseTime(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  // Get changed fields for audit trail
  getChangedFields(original, updated) {
    const changes = {};
    
    for (const key in updated) {
      if (original[key] !== updated[key] && key !== '_id' && key !== '__v' && key !== 'timestamps') {
        changes[key] = {
          from: original[key],
          to: updated[key]
        };
      }
    }
    
    return changes;
  }

  // Get active discounts
  async getActiveDiscounts() {
    try {
      return await DiscountRepository.findActive({
        select: 'name code type value description validFrom validUntil applicableTo conditions',
        sort: { priority: -1, createdAt: -1 }
      });
    } catch (error) {
      console.error('Error fetching active discounts:', error);
      throw error;
    }
  }

  // Toggle discount active status
  async toggleDiscountStatus(discountId, modifiedBy) {
    try {
      const discount = await DiscountRepository.findById(discountId);
      if (!discount) {
        throw new Error('Discount not found');
      }

      const oldStatus = discount.isActive;
      const newStatus = !discount.isActive;
      
      // Update discount
      const updatedDiscount = await DiscountRepository.update(discountId, {
        isActive: newStatus,
        lastModifiedBy: modifiedBy
      });

      // Add audit trail entry
      const discountDoc = await DiscountRepository.findById(discountId);
      discountDoc.auditTrail = discountDoc.auditTrail || [];
      discountDoc.auditTrail.push({
        action: newStatus ? 'activated' : 'deactivated',
        performedBy: modifiedBy,
        details: `Discount ${newStatus ? 'activated' : 'deactivated'}`,
        performedAt: new Date()
      });

      await discountDoc.save();
      return discountDoc;
    } catch (error) {
      console.error('Error toggling discount status:', error);
      throw error;
    }
  }

  // Delete discount
  async deleteDiscount(discountId, deletedBy) {
    try {
      const discount = await DiscountRepository.findById(discountId);
      if (!discount) {
        throw new Error('Discount not found');
      }

      // Check if discount has been used
      if (discount.currentUsage > 0) {
        throw new Error('Cannot delete discount that has been used');
      }

      await DiscountRepository.softDelete(discountId);
      return { message: 'Discount deleted successfully' };
    } catch (error) {
      console.error('Error deleting discount:', error);
      throw error;
    }
  }

  // Get discount statistics
  async getDiscountStats(period = {}) {
    try {
      const stats = await Discount.getDiscountStats(period);
      return stats;
    } catch (error) {
      console.error('Error getting discount stats:', error);
      throw error;
    }
  }

  // Generate discount code suggestions
  generateDiscountCodeSuggestions(name, type) {
    const suggestions = [];
    const baseName = name.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    
    // Simple suggestions based on name and type
    suggestions.push(baseName.substring(0, 8));
    suggestions.push(`${baseName.substring(0, 4)}${type.toUpperCase().substring(0, 4)}`);
    suggestions.push(`${baseName.substring(0, 6)}${Date.now().toString().slice(-2)}`);
    suggestions.push(`${type.toUpperCase()}${baseName.substring(0, 6)}`);
    
    return suggestions.filter(s => s.length >= 4 && s.length <= 20);
  }

  // Check discount code availability
  async isDiscountCodeAvailable(code) {
    try {
      const existingDiscount = await DiscountRepository.findByCode(code.toUpperCase());
      return !existingDiscount;
    } catch (error) {
      console.error('Error checking discount code availability:', error);
      throw error;
    }
  }
}

module.exports = new DiscountService();
