const Customer = require('../models/Customer');
const Inventory = require('../models/Inventory');
const ChartOfAccounts = require('../models/ChartOfAccounts');
const AccountingPeriod = require('../models/AccountingPeriod');
const Product = require('../models/Product');

/**
 * Business Rule Validation Service
 * Validates business rules and constraints before operations
 */
class BusinessRuleValidationService {
  /**
   * Validate sales order
   */
  async validateSalesOrder(orderData) {
    const errors = [];
    
    // Validate customer exists and is active
    if (orderData.customer) {
      try {
        const customer = await Customer.findById(orderData.customer);
        if (!customer) {
          errors.push({
            field: 'customer',
            message: 'Customer not found'
          });
        } else if (customer.isDeleted) {
          errors.push({
            field: 'customer',
            message: 'Customer has been deleted'
          });
        } else if (customer.isSuspended) {
          errors.push({
            field: 'customer',
            message: `Customer is suspended: ${customer.suspensionReason || 'No reason provided'}`
          });
        }
        
        // Validate credit limit if account payment
        if (customer && orderData.payment?.method === 'account') {
          const currentBalance = customer.currentBalance || 0;
          const orderTotal = orderData.pricing?.total || 0;
          const newBalance = currentBalance + orderTotal;
          
          if (customer.creditLimit > 0 && newBalance > customer.creditLimit) {
            errors.push({
              field: 'customer',
              message: `Credit limit exceeded. Current balance: ${currentBalance.toFixed(2)}, Credit limit: ${customer.creditLimit.toFixed(2)}, Order total: ${orderTotal.toFixed(2)}, New balance would be: ${newBalance.toFixed(2)}`
            });
          }
        }
      } catch (error) {
        errors.push({
          field: 'customer',
          message: `Error validating customer: ${error.message}`
        });
      }
    }
    
    // Validate items and stock availability
    if (orderData.items && Array.isArray(orderData.items)) {
      for (let i = 0; i < orderData.items.length; i++) {
        const item = orderData.items[i];
        
        // Validate product/variant exists
        try {
          const Product = require('../models/Product');
          const ProductVariant = require('../models/ProductVariant');
          const productRepository = require('../repositories/ProductRepository');
          const productVariantRepository = require('../repositories/ProductVariantRepository');
          
          // Try to find as product first, then as variant
          let product = await productRepository.findById(item.product);
          let isVariant = false;
          
          if (!product) {
            product = await productVariantRepository.findById(item.product);
            if (product) {
              isVariant = true;
            }
          }
          
          if (!product) {
            errors.push({
              field: `items[${i}].product`,
              message: `Product or variant not found: ${item.product}`
            });
            continue;
          }
          
          if (product.status !== 'active') {
            const productName = isVariant 
              ? (product.displayName || product.variantName || 'Variant')
              : product.name;
            errors.push({
              field: `items[${i}].product`,
              message: `Product/variant is not active: ${productName}`
            });
          }
          
          // Validate stock availability
          const Inventory = require('../models/Inventory');
          const inventory = await Inventory.findOne({ product: item.product });
          const availableStock = inventory 
            ? Math.max(0, inventory.currentStock - inventory.reservedStock)
            : (product.inventory?.currentStock || 0);
          
          const productName = isVariant 
            ? (product.displayName || product.variantName || 'Variant')
            : product.name;
          
          if (availableStock < item.quantity) {
            errors.push({
              field: `items[${i}].quantity`,
              message: `Insufficient stock for ${productName}. Available: ${availableStock}, Requested: ${item.quantity}`
            });
          }
          
          // Validate quantity
          if (!item.quantity || item.quantity <= 0) {
            errors.push({
              field: `items[${i}].quantity`,
              message: 'Quantity must be greater than 0'
            });
          }
          
          // Validate unit price
          if (item.unitPrice !== undefined && item.unitPrice < 0) {
            errors.push({
              field: `items[${i}].unitPrice`,
              message: 'Unit price cannot be negative'
            });
          }
        } catch (error) {
          errors.push({
            field: `items[${i}].product`,
            message: `Error validating product: ${error.message}`
          });
        }
      }
    }
    
    // Validate pricing
    if (orderData.pricing) {
      if (orderData.pricing.total < 0) {
        errors.push({
          field: 'pricing.total',
          message: 'Order total cannot be negative'
        });
      }
      
      if (orderData.pricing.subtotal < 0) {
        errors.push({
          field: 'pricing.subtotal',
          message: 'Subtotal cannot be negative'
        });
      }
      
      if (orderData.pricing.discountAmount < 0) {
        errors.push({
          field: 'pricing.discountAmount',
          message: 'Discount amount cannot be negative'
        });
      }
      
      if (orderData.pricing.taxAmount < 0) {
        errors.push({
          field: 'pricing.taxAmount',
          message: 'Tax amount cannot be negative'
        });
      }
    }
    
    // Validate payment
    if (orderData.payment) {
      if (orderData.payment.amount < 0) {
        errors.push({
          field: 'payment.amount',
          message: 'Payment amount cannot be negative'
        });
      }
      
      const orderTotal = orderData.pricing?.total || 0;
      if (orderData.payment.amount > orderTotal) {
        errors.push({
          field: 'payment.amount',
          message: `Payment amount (${orderData.payment.amount}) cannot exceed order total (${orderTotal})`
        });
      }
    }
    
    return errors;
  }
  
  /**
   * Validate journal entry
   */
  async validateJournalEntry(entryData) {
    const errors = [];
    
    // Validate entries exist
    if (!entryData.entries || !Array.isArray(entryData.entries) || entryData.entries.length === 0) {
      errors.push({
        field: 'entries',
        message: 'Journal entry must have at least one entry'
      });
      return errors;
    }
    
    // Validate debits = credits
    const totalDebits = entryData.entries.reduce((sum, e) => sum + (e.debitAmount || 0), 0);
    const totalCredits = entryData.entries.reduce((sum, e) => sum + (e.creditAmount || 0), 0);
    const difference = Math.abs(totalDebits - totalCredits);
    
    if (difference > 0.01) {
      errors.push({
        field: 'entries',
        message: `Debits (${totalDebits.toFixed(2)}) must equal Credits (${totalCredits.toFixed(2)}). Difference: ${difference.toFixed(2)}`
      });
    }
    
    // Validate at least one debit and one credit
    const hasDebit = entryData.entries.some(e => (e.debitAmount || 0) > 0);
    const hasCredit = entryData.entries.some(e => (e.creditAmount || 0) > 0);
    
    if (!hasDebit) {
      errors.push({
        field: 'entries',
        message: 'Journal entry must have at least one debit entry'
      });
    }
    
    if (!hasCredit) {
      errors.push({
        field: 'entries',
        message: 'Journal entry must have at least one credit entry'
      });
    }
    
    // Validate accounts exist and are active
    for (let i = 0; i < entryData.entries.length; i++) {
      const entry = entryData.entries[i];
      
      if (!entry.accountCode) {
        errors.push({
          field: `entries[${i}].accountCode`,
          message: 'Account code is required'
        });
        continue;
      }
      
      try {
        const account = await ChartOfAccounts.findOne({
          accountCode: entry.accountCode,
          isActive: true
        });
        
        if (!account) {
          errors.push({
            field: `entries[${i}].accountCode`,
            message: `Account ${entry.accountCode} not found or inactive`
          });
        } else {
          // Validate account allows direct posting
          if (!account.allowDirectPosting) {
            errors.push({
              field: `entries[${i}].accountCode`,
              message: `Account ${entry.accountCode} (${account.accountName}) does not allow direct posting`
            });
          }
        }
      } catch (error) {
        errors.push({
          field: `entries[${i}].accountCode`,
          message: `Error validating account: ${error.message}`
        });
      }
      
      // Validate amounts
      if ((entry.debitAmount || 0) < 0) {
        errors.push({
          field: `entries[${i}].debitAmount`,
          message: 'Debit amount cannot be negative'
        });
      }
      
      if ((entry.creditAmount || 0) < 0) {
        errors.push({
          field: `entries[${i}].creditAmount`,
          message: 'Credit amount cannot be negative'
        });
      }
      
      // Validate at least one amount > 0
      if ((entry.debitAmount || 0) === 0 && (entry.creditAmount || 0) === 0) {
        errors.push({
          field: `entries[${i}]`,
          message: 'Entry must have either debit or credit amount > 0'
        });
      }
      
      // Validate not both > 0
      if ((entry.debitAmount || 0) > 0 && (entry.creditAmount || 0) > 0) {
        errors.push({
          field: `entries[${i}]`,
          message: 'Entry cannot have both debit and credit amounts > 0'
        });
      }
    }
    
    // Validate transaction date against accounting period
    if (entryData.voucherDate) {
      try {
        await this.validatePeriodLocking(entryData.voucherDate);
      } catch (error) {
        errors.push({
          field: 'voucherDate',
          message: error.message
        });
      }
    }
    
    return errors;
  }
  
  /**
   * Validate period locking
   */
  async validatePeriodLocking(transactionDate) {
    try {
      const period = await AccountingPeriod.findPeriodForDate(transactionDate);
      
      if (period && (period.status === 'closed' || period.status === 'locked')) {
        throw new Error(
          `Cannot create transaction in ${period.status} period: ${period.periodName} ` +
          `(${period.periodStart.toISOString().split('T')[0]} to ${period.periodEnd.toISOString().split('T')[0]})`
        );
      }
    } catch (error) {
      // If period check fails, allow but log warning
      if (error.message.includes('Cannot create transaction')) {
        throw error;
      }
      console.warn('Period validation error:', error.message);
    }
  }
  
  /**
   * Validate purchase order
   */
  async validatePurchaseOrder(poData) {
    const errors = [];
    
    // Validate supplier exists
    if (poData.supplier) {
      try {
        const Supplier = require('../models/Supplier');
        const supplier = await Supplier.findById(poData.supplier);
        if (!supplier || supplier.isDeleted) {
          errors.push({
            field: 'supplier',
            message: 'Supplier not found or deleted'
          });
        }
      } catch (error) {
        errors.push({
          field: 'supplier',
          message: `Error validating supplier: ${error.message}`
        });
      }
    }
    
    // Validate items
    if (poData.items && Array.isArray(poData.items)) {
      const Product = require('../models/Product');
      const ProductVariant = require('../models/ProductVariant');
      const productRepository = require('../repositories/ProductRepository');
      const productVariantRepository = require('../repositories/ProductVariantRepository');
      
      for (let i = 0; i < poData.items.length; i++) {
        const item = poData.items[i];
        
        if (!item.product) {
          errors.push({
            field: `items[${i}].product`,
            message: 'Product or variant is required'
          });
        } else {
          // Validate product/variant exists
          try {
            let product = await productRepository.findById(item.product);
            let isVariant = false;
            
            if (!product) {
              product = await productVariantRepository.findById(item.product);
              if (product) {
                isVariant = true;
              }
            }
            
            if (!product) {
              errors.push({
                field: `items[${i}].product`,
                message: `Product or variant not found: ${item.product}`
              });
            }
          } catch (error) {
            errors.push({
              field: `items[${i}].product`,
              message: `Error validating product/variant: ${error.message}`
            });
          }
        }
        
        if (!item.quantity || item.quantity <= 0) {
          errors.push({
            field: `items[${i}].quantity`,
            message: 'Quantity must be greater than 0'
          });
        }
        
        if (item.unitPrice !== undefined && item.unitPrice < 0) {
          errors.push({
            field: `items[${i}].unitPrice`,
            message: 'Unit price cannot be negative'
          });
        }
      }
    }
    
    return errors;
  }
  
  /**
   * Validate inventory adjustment
   */
  async validateInventoryAdjustment(adjustmentData) {
    const errors = [];
    
    if (!adjustmentData.productId) {
      errors.push({
        field: 'productId',
        message: 'Product ID is required'
      });
    }
    
    if (adjustmentData.quantity === undefined || adjustmentData.quantity === null) {
      errors.push({
        field: 'quantity',
        message: 'Quantity is required'
      });
    }
    
    if (!adjustmentData.reason) {
      errors.push({
        field: 'reason',
        message: 'Reason is required for inventory adjustment'
      });
    }
    
    // Validate product exists
    if (adjustmentData.productId) {
      try {
        const product = await Product.findById(adjustmentData.productId);
        if (!product) {
          errors.push({
            field: 'productId',
            message: 'Product not found'
          });
        }
      } catch (error) {
        errors.push({
          field: 'productId',
          message: `Error validating product: ${error.message}`
        });
      }
    }
    
    // Validate adjustment won't cause negative stock (unless explicitly allowed)
    if (adjustmentData.quantity < 0 && !adjustmentData.allowNegative) {
      try {
        const inventory = await Inventory.findOne({ product: adjustmentData.productId });
        const currentStock = inventory?.currentStock || 0;
        const newStock = currentStock + adjustmentData.quantity;
        
        if (newStock < 0) {
          errors.push({
            field: 'quantity',
            message: `Adjustment would result in negative stock. Current: ${currentStock}, Adjustment: ${adjustmentData.quantity}, New: ${newStock}`
          });
        }
      } catch (error) {
        // Skip validation if error
      }
    }
    
    return errors;
  }
}

module.exports = new BusinessRuleValidationService();

