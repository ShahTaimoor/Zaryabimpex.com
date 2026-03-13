const DiscountRepository = require('../repositories/DiscountRepository');
const SalesRepository = require('../repositories/SalesRepository');
const CustomerRepository = require('../repositories/CustomerRepository');
const ProductRepository = require('../repositories/ProductRepository');

function discountToObject(d) {
  return d && typeof d === 'object' ? { ...d, _id: d.id, id: d.id } : d;
}

function calculateDiscountAmount(discount, orderTotal) {
  const total = Number(orderTotal ?? 0);
  const type = discount.type || discount.discount_type;
  const value = Number(discount.value ?? 0);
  if (type === 'percentage') {
    const cap = discount.maximum_discount ?? discount.maximumDiscount;
    const amount = Math.min((total * value) / 100, cap != null ? Number(cap) : Infinity);
    return Math.max(0, amount);
  }
  return Math.min(value, total);
}

function isApplicableToOrder(discount, order, orderCustomer) {
  const now = new Date();
  const validFrom = discount.valid_from || discount.validFrom;
  const validUntil = discount.valid_until || discount.validUntil;
  if (validFrom && new Date(validFrom) > now) return { applicable: false, reason: 'Discount not yet valid' };
  if (validUntil && new Date(validUntil) < now) return { applicable: false, reason: 'Discount expired' };
  const minOrder = discount.minimum_order_amount ?? discount.minimumOrderAmount ?? 0;
  const orderTotal = Number(order?.total ?? order?.totalAmount ?? 0);
  if (orderTotal < minOrder) return { applicable: false, reason: `Minimum order amount is ${minOrder}` };
  return { applicable: true };
}

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

      const merged = { ...discount, ...updateData };
      const validation = await this.validateDiscountData(merged);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      if (updateData.code && updateData.code !== (discount.code || discount.discount_code)) {
        const codeExists = await DiscountRepository.codeExists(updateData.code, discountId);
        if (codeExists) throw new Error('Discount code already exists');
      }

      const updatePayload = {
        ...updateData,
        lastModifiedBy: modifiedBy,
      };
      const updatedDiscount = await DiscountRepository.updateById(discountId, updatePayload);
      return updatedDiscount;
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

      let filteredDiscounts = discounts;
      if (status) {
        const statusVal = status === 'active' ? true : status === 'inactive' ? false : null;
        if (statusVal !== null) filteredDiscounts = discounts.filter(d => (d.is_active ?? d.isActive) === statusVal);
        else filteredDiscounts = discounts.filter(d => (d.status || (d.is_active ? 'active' : 'inactive')) === status);
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
    const discount = await DiscountRepository.findById(discountId);
    if (!discount) throw new Error('Discount not found');
    return discount;
  }

  // Get discount by code
  async getDiscountByCode(code) {
    return await DiscountRepository.findByCode((code || '').toUpperCase());
  }

  // Apply discount to an order
  async applyDiscountToOrder(orderId, discountCode, customerId = null) {
    const order = await SalesRepository.findById(orderId);
    if (!order) throw new Error('Order not found');

    const discount = await this.getDiscountByCode(discountCode);
    if (!discount) throw new Error('Discount code not found');

    // Enforce total usage limit
    const usageLimit = discount.usage_limit ?? discount.usageLimit;
    const usageSoFar = discount.current_usage ?? discount.currentUsage ?? 0;
    if (usageLimit != null && usageLimit > 0 && usageSoFar >= usageLimit) {
      throw new Error('Discount usage limit reached');
    }

    // Enforce per-customer usage limit
    const orderCustomerId = order.customer_id || order.customer || customerId;
    const perCustomerLimit = discount.usage_limit_per_customer ?? discount.usageLimitPerCustomer;
    if (perCustomerLimit != null && perCustomerLimit > 0 && orderCustomerId) {
      const analytics = discount.analytics && typeof discount.analytics === 'object' ? discount.analytics : {};
      const usageHistory = Array.isArray(analytics.usageHistory) ? analytics.usageHistory : [];
      const customerUsageCount = usageHistory.filter(
        u => String(u.customerId || u.customer_id || '') === String(orderCustomerId)
      ).length;
      if (customerUsageCount >= perCustomerLimit) {
        throw new Error('You have reached the maximum uses of this discount');
      }
    }

    const applicability = isApplicableToOrder(discount, order, order.customer_id || order.customer);
    if (!applicability.applicable) throw new Error(applicability.reason);

    const orderTotal = Number(order.total ?? 0);
    const appliedDiscounts = order.applied_discounts && Array.isArray(order.applied_discounts) ? order.applied_discounts : (typeof order.applied_discounts === 'string' ? JSON.parse(order.applied_discounts || '[]') : []);
    const discountIdStr = String(discount.id || discount._id);
    if (appliedDiscounts.some(d => String(d.discountId || d.discount_id) === discountIdStr)) {
      throw new Error('Discount already applied to this order');
    }

    const discountAmount = calculateDiscountAmount(discount, orderTotal);
    if (appliedDiscounts.length > 0 && !(discount.combinable_with_other_discounts ?? discount.combinableWithOtherDiscounts)) {
      throw new Error('This discount cannot be combined with other discounts');
    }

    const newTotal = Math.max(0, orderTotal - discountAmount);
    const appliedDiscount = {
      discountId: discount.id || discount._id,
      code: discount.code || discount.discount_code,
      type: discount.type,
      value: discount.value,
      amount: discountAmount,
      appliedAt: new Date(),
    };
    const updatedApplied = [...appliedDiscounts, appliedDiscount];
    const totalDiscountAmount = (Number(order.discount ?? 0) || 0) + discountAmount;

    await SalesRepository.update(orderId, {
      total: newTotal,
      discount: totalDiscountAmount,
      appliedDiscounts: updatedApplied,
    });

    const currentUsage = (discount.current_usage ?? discount.currentUsage ?? 0) + 1;
    const analytics = discount.analytics && typeof discount.analytics === 'object' ? discount.analytics : {};
    const usageHistory = Array.isArray(analytics.usageHistory) ? analytics.usageHistory : [];
    const orderCustomerIdForHistory = order.customer_id || order.customer || customerId;
    usageHistory.push({ orderId, customerId: orderCustomerIdForHistory, discountAmount, orderTotal: orderTotal, appliedAt: new Date() });
    await DiscountRepository.updateById(discount.id, { currentUsage, analytics: { ...analytics, usageHistory } });

    return {
      discount,
      appliedDiscount,
      newTotal,
    };
  }

  /**
   * Record that a discount code was used (e.g. when creating a sale with applied discounts).
   * Increments usage and appends to analytics.usageHistory. Does not modify the order.
   */
  async recordDiscountUsage(discountCode, customerId, amount, orderId) {
    const discount = await this.getDiscountByCode(discountCode);
    if (!discount) return;
    const currentUsage = (discount.current_usage ?? discount.currentUsage ?? 0) + 1;
    const analytics = discount.analytics && typeof discount.analytics === 'object' ? discount.analytics : {};
    const usageHistory = Array.isArray(analytics.usageHistory) ? analytics.usageHistory : [];
    usageHistory.push({ orderId, customerId, discountAmount: amount, appliedAt: new Date() });
    await DiscountRepository.updateById(discount.id ?? discount._id, { currentUsage, analytics: { ...analytics, usageHistory } });
  }

  // Remove discount from an order
  async removeDiscountFromOrder(orderId, discountCode) {
    const order = await SalesRepository.findById(orderId);
    if (!order) throw new Error('Order not found');

    const discount = await this.getDiscountByCode(discountCode);
    if (!discount) throw new Error('Discount code not found');

    const appliedDiscounts = order.applied_discounts && Array.isArray(order.applied_discounts) ? order.applied_discounts : (typeof order.applied_discounts === 'string' ? JSON.parse(order.applied_discounts || '[]') : []);
    const discountIdStr = String(discount.id || discount._id);
    const index = appliedDiscounts.findIndex(d => String(d.discountId || d.discount_id) === discountIdStr);
    if (index === -1) throw new Error('Discount not applied to this order');

    const appliedDiscount = appliedDiscounts[index];
    appliedDiscounts.splice(index, 1);
    const newTotal = Number(order.total ?? 0) + (appliedDiscount.amount ?? 0);
    const totalDiscount = Math.max(0, (Number(order.discount ?? 0) || 0) - (appliedDiscount.amount ?? 0));

    await SalesRepository.update(orderId, { total: newTotal, discount: totalDiscount, appliedDiscounts });

    return {
      removedDiscount: appliedDiscount,
      newTotal,
    };
  }

  // Get applicable discounts for an order
  async getApplicableDiscounts(orderData, customerData = null) {
    const orderTotal = Number(orderData?.total ?? 0);
    const customerId = orderData?.customerId ?? orderData?.customer_id ?? customerData?.id ?? customerData?._id ?? null;
    const all = await DiscountRepository.findAll({ isActive: true }, { limit: 200 });
    const now = new Date();
    const applicable = [];
    for (const d of all) {
      const validFrom = d.valid_from || d.validFrom;
      const validUntil = d.valid_until || d.validUntil;
      if (validFrom && new Date(validFrom) > now) continue;
      if (validUntil && new Date(validUntil) < now) continue;
      const minOrder = Number(d.minimum_order_amount ?? d.minimumOrderAmount ?? 0);
      if (orderTotal < minOrder) continue;
      // Skip if total usage limit reached
      const usageLimit = d.usage_limit ?? d.usageLimit;
      const usageSoFar = d.current_usage ?? d.currentUsage ?? 0;
      if (usageLimit != null && usageLimit > 0 && usageSoFar >= usageLimit) continue;
      // Skip if per-customer limit reached for this customer
      const perCustomerLimit = d.usage_limit_per_customer ?? d.usageLimitPerCustomer;
      if (perCustomerLimit != null && perCustomerLimit > 0 && customerId) {
        const analytics = d.analytics && typeof d.analytics === 'object' ? d.analytics : {};
        const usageHistory = Array.isArray(analytics.usageHistory) ? analytics.usageHistory : [];
        const customerUsageCount = usageHistory.filter(
          u => String(u.customerId || u.customer_id || '') === String(customerId)
        ).length;
        if (customerUsageCount >= perCustomerLimit) continue;
      }
      const amount = calculateDiscountAmount(d, orderTotal);
      applicable.push({ discount: d, amount });
    }
    const priority = d => d.priority ?? 0;
    return applicable.sort((a, b) => {
      if (priority(a.discount) !== priority(b.discount)) return priority(b.discount) - priority(a.discount);
      return b.amount - a.amount;
    });
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
      const updatedDiscount = await DiscountRepository.updateById(discountId, {
        isActive: newStatus,
        lastModifiedBy: modifiedBy
      });

      return updatedDiscount;
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

      const usage = discount.current_usage ?? discount.currentUsage ?? 0;
      if (usage > 0) {
        throw new Error('Cannot delete discount that has been used');
      }

      await DiscountRepository.updateById(discountId, { isActive: false });
      return { message: 'Discount deleted successfully' };
    } catch (error) {
      console.error('Error deleting discount:', error);
      throw error;
    }
  }

  // Get discount statistics
  async getDiscountStats(period = {}) {
    return await DiscountRepository.getDiscountStats(period);
  }

  // Generate discount code suggestions
  generateDiscountCodeSuggestions(name, type) {
    const suggestions = [];
    const nameStr = (name != null && name !== '') ? String(name) : '';
    const typeStr = (type != null && type !== '') ? String(type) : '';
    const baseName = nameStr.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    
    // Simple suggestions based on name and type
    suggestions.push(baseName.substring(0, 8));
    suggestions.push(`${baseName.substring(0, 4)}${typeStr.toUpperCase().substring(0, 4)}`);
    suggestions.push(`${baseName.substring(0, 6)}${Date.now().toString().slice(-2)}`);
    suggestions.push(`${typeStr.toUpperCase()}${baseName.substring(0, 6)}`);
    
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
