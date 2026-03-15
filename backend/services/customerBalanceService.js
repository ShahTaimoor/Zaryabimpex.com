const Customer = require('../models/Customer');
const Sales = require('../models/Sales');
const CustomerTransaction = require('../models/CustomerTransaction');
const mongoose = require('mongoose');
const AccountingService = require('./accountingService');

class CustomerBalanceService {
  /**
   * Update customer balance when payment is received (using transaction sub-ledger)
   * @param {String} customerId - Customer ID
   * @param {Number} paymentAmount - Amount paid
   * @param {String} orderId - Order ID (optional)
   * @param {Object} user - User recording payment
   * @param {Object} paymentDetails - Payment details
   * @returns {Promise<Object>}
   */
  static async recordPayment(customerId, paymentAmount, orderId = null, user = null, paymentDetails = {}) {
    try {
      const customer = await Customer.findById(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Get current balances
      const balanceBefore = {
        pendingBalance: customer.pendingBalance || 0,
        advanceBalance: customer.advanceBalance || 0,
        currentBalance: customer.currentBalance || 0
      };

      // Calculate new balances
      let pendingBalance = balanceBefore.pendingBalance;
      let advanceBalance = balanceBefore.advanceBalance;
      let remainingPayment = paymentAmount;

      // Reduce pending balance first
      if (pendingBalance > 0 && remainingPayment > 0) {
        const pendingReduction = Math.min(remainingPayment, pendingBalance);
        pendingBalance -= pendingReduction;
        remainingPayment -= pendingReduction;
      }

      // If there's still payment left, add to advance balance
      if (remainingPayment > 0) {
        advanceBalance += remainingPayment;
      }

      const currentBalance = pendingBalance - advanceBalance;
      const balanceAfter = { pendingBalance, advanceBalance, currentBalance };

      // Create customer transaction record
      if (user) {
        const transactionNumber = await CustomerTransaction.generateTransactionNumber('payment', customerId);

        const paymentTransaction = new CustomerTransaction({
          customer: customerId,
          transactionNumber,
          transactionType: 'payment',
          transactionDate: new Date(),
          referenceType: orderId ? 'sales_order' : 'manual_entry',
          referenceId: orderId,
          netAmount: paymentAmount,
          affectsPendingBalance: true,
          affectsAdvanceBalance: remainingPayment > 0,
          balanceImpact: -paymentAmount,
          balanceBefore,
          balanceAfter,
          paymentDetails: {
            paymentMethod: paymentDetails.paymentMethod || 'account',
            paymentReference: paymentDetails.paymentReference,
            paymentDate: new Date()
          },
          status: 'posted',
          createdBy: user._id,
          postedBy: user._id,
          postedAt: new Date()
        });

        await paymentTransaction.save();
      }

      // Note: We no longer update Customer balance fields (pendingBalance, advanceBalance, currentBalance)
      // All balances are now fetched dynamically from the ledger.

      return customer;
    } catch (error) {
      console.error('Error recording payment:', error);
      throw error;
    }
  }

  /**
   * Update customer balance when invoice is created (using transaction sub-ledger)
   * @param {String} customerId - Customer ID
   * @param {Number} invoiceAmount - Invoice amount
   * @param {String} orderId - Order ID
   * @param {Object} user - User creating invoice
   * @param {Object} invoiceData - Invoice details
   * @returns {Promise<Object>}
   */
  static async recordInvoice(customerId, invoiceAmount, orderId = null, user = null, invoiceData = {}) {
    try {
      const customer = await Customer.findById(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Get current balances
      const balanceBefore = {
        pendingBalance: customer.pendingBalance || 0,
        advanceBalance: customer.advanceBalance || 0,
        currentBalance: customer.currentBalance || 0
      };

      // Calculate new balances
      const balanceAfter = {
        pendingBalance: balanceBefore.pendingBalance + invoiceAmount,
        advanceBalance: balanceBefore.advanceBalance,
        currentBalance: (balanceBefore.pendingBalance + invoiceAmount) - balanceBefore.advanceBalance
      };

      // Create customer transaction record
      if (user) {
        const transactionNumber = await CustomerTransaction.generateTransactionNumber('invoice', customerId);

        // Calculate due date
        const dueDate = this.calculateDueDate(customer.paymentTerms);
        const aging = this.calculateAging(dueDate);

        const invoiceTransaction = new CustomerTransaction({
          customer: customerId,
          transactionNumber,
          transactionType: 'invoice',
          transactionDate: new Date(),
          dueDate,
          referenceType: 'sales_order',
          referenceId: orderId,
          referenceNumber: invoiceData.invoiceNumber,
          grossAmount: invoiceData.grossAmount || invoiceAmount,
          discountAmount: invoiceData.discountAmount || 0,
          taxAmount: invoiceData.taxAmount || 0,
          netAmount: invoiceAmount,
          affectsPendingBalance: true,
          balanceImpact: invoiceAmount,
          balanceBefore,
          balanceAfter,
          lineItems: invoiceData.lineItems || [],
          status: 'posted',
          remainingAmount: invoiceAmount,
          ageInDays: aging.ageInDays,
          agingBucket: aging.agingBucket,
          isOverdue: aging.isOverdue,
          daysOverdue: aging.daysOverdue,
          createdBy: user._id,
          postedBy: user._id,
          postedAt: new Date()
        });

        await invoiceTransaction.save();
      }

      // Note: We no longer update Customer balance fields (pendingBalance, advanceBalance, currentBalance)
      // All balances are now fetched dynamically from the ledger.

      return customer;
    } catch (error) {
      console.error('Error recording invoice:', error);
      throw error;
    }
  }

  /**
   * Calculate due date based on payment terms
   * @param {String} paymentTerms - Payment terms
   * @returns {Date}
   */
  static calculateDueDate(paymentTerms) {
    const today = new Date();
    const dueDate = new Date(today);

    switch (paymentTerms) {
      case 'cash':
        return today;
      case 'net15':
        dueDate.setDate(today.getDate() + 15);
        break;
      case 'net30':
        dueDate.setDate(today.getDate() + 30);
        break;
      case 'net45':
        dueDate.setDate(today.getDate() + 45);
        break;
      case 'net60':
        dueDate.setDate(today.getDate() + 60);
        break;
      default:
        dueDate.setDate(today.getDate() + 30);
    }

    return dueDate;
  }

  /**
   * Calculate aging for a due date
   * @param {Date} dueDate - Due date
   * @returns {Object}
   */
  static calculateAging(dueDate) {
    const today = new Date();
    const ageInDays = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));

    let agingBucket = 'current';
    let isOverdue = false;
    let daysOverdue = 0;

    if (ageInDays > 0) {
      isOverdue = true;
      daysOverdue = ageInDays;

      if (ageInDays <= 30) {
        agingBucket = '1-30';
      } else if (ageInDays <= 60) {
        agingBucket = '31-60';
      } else if (ageInDays <= 90) {
        agingBucket = '61-90';
      } else {
        agingBucket = '90+';
      }
    }

    return { ageInDays, agingBucket, isOverdue, daysOverdue };
  }

  /**
   * Update customer balance when refund is issued
   * @param {String} customerId - Customer ID
   * @param {Number} refundAmount - Refund amount
   * @param {String} orderId - Order ID (optional)
   * @returns {Promise<Object>}
   */
  static async recordRefund(customerId, refundAmount, orderId = null) {
    try {
      const customer = await Customer.findById(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Get current balances
      const balanceBefore = {
        pendingBalance: customer.pendingBalance || 0,
        advanceBalance: customer.advanceBalance || 0,
        currentBalance: customer.currentBalance || 0
      };

      // Update customer balances
      const updates = {};
      let newAdvanceBalance = balanceBefore.advanceBalance;

      if (refundAmount > 0) {
        // Reduce advance balance first
        if (customer.advanceBalance > 0) {
          const advanceReduction = Math.min(refundAmount, customer.advanceBalance);
          newAdvanceBalance = customer.advanceBalance - advanceReduction;
          refundAmount -= advanceReduction;
        }

        // If there's still refund left, it means we're refunding more than advance balance
        // This creates a new advance (we now owe them more)
        if (refundAmount > 0) {
          newAdvanceBalance = newAdvanceBalance + refundAmount;
        }

        updates.advanceBalance = newAdvanceBalance;
      }

      // Note: Manual balance updates removed. 
      // Reliance now exclusively on AccountingService for dynamic balances.

      return customer;
    } catch (error) {
      console.error('Error recording refund:', error);
      throw error;
    }
  }

  /**
   * Get customer balance summary
   * @param {String} customerId - Customer ID
   * @returns {Promise<Object>}
   */
  static async getBalanceSummary(customerId) {
    try {
      const customer = await Customer.findById(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Get recent orders for this customer
      const recentOrders = await Sales.find({ customer: customerId })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('orderNumber pricing.total payment.status createdAt');

      const balance = await AccountingService.getCustomerBalance(customerId);

      return {
        customer: {
          _id: customer._id,
          name: customer.name,
          businessName: customer.businessName,
          email: customer.email,
          phone: customer.phone
        },
        balances: {
          pendingBalance: balance > 0 ? balance : 0,
          advanceBalance: balance < 0 ? Math.abs(balance) : 0,
          currentBalance: balance,
          creditLimit: customer.creditLimit || 0
        },
        recentOrders: recentOrders.map(order => ({
          orderNumber: order.orderNumber,
          total: order.pricing.total,
          status: order.payment.status,
          createdAt: order.createdAt
        }))
      };
    } catch (error) {
      console.error('Error getting balance summary:', error);
      throw error;
    }
  }

  /**
   * Recalculate customer balance from CustomerTransaction sub-ledger
   * @param {String} customerId - Customer ID
   * @returns {Promise<Object>}
   */
  static async recalculateBalance(customerId) {
    try {
      const customer = await Customer.findById(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Use reconciliation service to calculate from transactions
      const reconciliationService = require('./reconciliationService');
      const reconciliation = await reconciliationService.reconcileCustomerBalance(customerId, {
        autoCorrect: true, // Auto-correct discrepancies
        alertOnDiscrepancy: false
      });

      const calculated = reconciliation.calculated;

      // Update customer balances atomically with version check
      const updatedCustomer = await Customer.findOneAndUpdate(
        { _id: customerId, __v: customer.__v },
        {
          $set: {
            pendingBalance: calculated.pendingBalance,
            advanceBalance: calculated.advanceBalance,
            currentBalance: calculated.currentBalance
          },
          $inc: { __v: 1 }
        },
        { new: true }
      );

      if (!updatedCustomer) {
        throw new Error('Concurrent update conflict during balance recalculation');
      }

      console.log(`Customer ${customerId} balance recalculated from transactions:`, {
        calculated: calculated,
        hadDiscrepancy: reconciliation.discrepancy.hasDifference,
        transactionCount: reconciliation.transactionCount
      });

      return {
        customer: updatedCustomer,
        reconciliation,
        corrected: reconciliation.discrepancy.hasDifference
      };
    } catch (error) {
      console.error('Error recalculating balance:', error);
      throw error;
    }
  }

  /**
   * Check if customer can make purchase
   * @param {String} customerId - Customer ID
   * @param {Number} amount - Purchase amount
   * @returns {Promise<Object>}
   */
  static async canMakePurchase(customerId, amount) {
    try {
      const customer = await Customer.findById(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      const currentBalance = await AccountingService.getCustomerBalance(customerId);
      const canPurchase = (currentBalance + amount) <= (customer.creditLimit || 0);
      const availableCredit = (customer.creditLimit || 0) - currentBalance;

      return {
        canPurchase,
        availableCredit,
        currentBalance,
        creditLimit: customer.creditLimit,
        pendingBalance: currentBalance > 0 ? currentBalance : 0,
        advanceBalance: currentBalance < 0 ? Math.abs(currentBalance) : 0
      };
    } catch (error) {
      console.error('Error checking purchase eligibility:', error);
      throw error;
    }
  }

  /**
   * Fix currentBalance for a customer by recalculating from pendingBalance and advanceBalance
   * This is useful when currentBalance is out of sync
   * @param {String} customerId - Customer ID
   * @returns {Promise<Object>}
   */
  static async fixCurrentBalance(customerId) {
    try {
      const customer = await Customer.findById(customerId);
      if (!customer) {
        throw new Error('Customer not found');
      }

      const pendingBalance = customer.pendingBalance || 0;
      const advanceBalance = customer.advanceBalance || 0;
      const correctCurrentBalance = pendingBalance - advanceBalance;
      const oldCurrentBalance = customer.currentBalance || 0;

      // Only update if there's a difference
      if (Math.abs(oldCurrentBalance - correctCurrentBalance) > 0.01) {
        const updatedCustomer = await Customer.findOneAndUpdate(
          { _id: customerId, __v: customer.__v },
          {
            $set: {
              currentBalance: correctCurrentBalance
            },
            $inc: { __v: 1 }
          },
          { new: true }
        );

        if (!updatedCustomer) {
          throw new Error('Concurrent balance update conflict. Please retry.');
        }

        console.log(`Customer ${customerId} currentBalance fixed:`, {
          oldCurrentBalance,
          newCurrentBalance: correctCurrentBalance,
          pendingBalance,
          advanceBalance
        });

        return {
          customer: updatedCustomer,
          fixed: true,
          oldCurrentBalance,
          newCurrentBalance: correctCurrentBalance
        };
      }

      return {
        customer,
        fixed: false,
        message: 'CurrentBalance is already correct'
      };
    } catch (error) {
      console.error('Error fixing currentBalance:', error);
      throw error;
    }
  }

  /**
   * Fix currentBalance for all customers by recalculating from pendingBalance and advanceBalance
   * @returns {Promise<Object>}
   */
  static async fixAllCurrentBalances() {
    try {
      const customers = await Customer.find({ isDeleted: { $ne: true } });
      const results = [];

      for (const customer of customers) {
        try {
          const pendingBalance = customer.pendingBalance || 0;
          const advanceBalance = customer.advanceBalance || 0;
          const correctCurrentBalance = pendingBalance - advanceBalance;
          const oldCurrentBalance = customer.currentBalance || 0;

          // Only update if there's a difference
          if (Math.abs(oldCurrentBalance - correctCurrentBalance) > 0.01) {
            const updatedCustomer = await Customer.findOneAndUpdate(
              { _id: customer._id, __v: customer.__v },
              {
                $set: {
                  currentBalance: correctCurrentBalance
                },
                $inc: { __v: 1 }
              },
              { new: true }
            );

            if (updatedCustomer) {
              results.push({
                customerId: customer._id,
                customerName: customer.businessName || customer.name,
                success: true,
                oldCurrentBalance,
                newCurrentBalance: correctCurrentBalance,
                pendingBalance,
                advanceBalance
              });
            } else {
              results.push({
                customerId: customer._id,
                customerName: customer.businessName || customer.name,
                success: false,
                error: 'Concurrent update conflict'
              });
            }
          } else {
            results.push({
              customerId: customer._id,
              customerName: customer.businessName || customer.name,
              success: true,
              fixed: false,
              message: 'Already correct'
            });
          }
        } catch (error) {
          results.push({
            customerId: customer._id,
            customerName: customer.businessName || customer.name,
            success: false,
            error: error.message
          });
        }
      }

      const fixed = results.filter(r => r.success && r.fixed !== false).length;
      const alreadyCorrect = results.filter(r => r.success && r.fixed === false).length;
      const failed = results.filter(r => !r.success).length;

      return {
        results,
        summary: {
          total: results.length,
          fixed,
          alreadyCorrect,
          failed
        }
      };
    } catch (error) {
      console.error('Error fixing all currentBalances:', error);
      throw error;
    }
  }
}

module.exports = CustomerBalanceService;
