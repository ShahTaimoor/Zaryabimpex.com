// Stripe payment gateway integration
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class StripeGateway {
  constructor() {
    this.name = 'stripe';
    this.stripe = stripe;
  }

  // Process payment through Stripe
  async processPayment(paymentData) {
    const { amount, currency, paymentMethod, cardDetails, metadata } = paymentData;

    try {
      // Create payment intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        payment_method_types: this.getPaymentMethodTypes(paymentMethod),
        metadata: {
          orderId: metadata.orderId,
          paymentId: metadata.paymentId,
          transactionId: metadata.transactionId
        },
        description: `Payment for Order ${metadata.orderId}`,
        statement_descriptor: 'POS Payment'
      });

      // Confirm payment intent
      const confirmedPayment = await this.stripe.paymentIntents.confirm(paymentIntent.id, {
        payment_method: {
          type: this.getStripePaymentMethodType(paymentMethod),
          card: cardDetails ? {
            number: cardDetails.number,
            exp_month: cardDetails.expiryMonth,
            exp_year: cardDetails.expiryYear,
            cvc: cardDetails.cvc
          } : undefined
        }
      });

      return {
        success: true,
        status: confirmedPayment.status === 'succeeded' ? 'completed' : 'failed',
        transactionId: confirmedPayment.id,
        response: confirmedPayment,
        fees: this.calculateFees(amount, confirmedPayment)
      };

    } catch (error) {
      console.error('Stripe payment error:', error);
      
      return {
        success: false,
        status: 'failed',
        errorCode: error.code || 'STRIPE_ERROR',
        errorMessage: error.message,
        response: {
          error: error.message,
          type: error.type
        }
      };
    }
  }

  // Process refund through Stripe
  async processRefund(refundData) {
    const { transactionId, amount, reason, metadata } = refundData;

    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: transactionId,
        amount: Math.round(amount * 100), // Convert to cents
        reason: this.getStripeRefundReason(reason),
        metadata: {
          paymentId: metadata.paymentId,
          orderId: metadata.orderId
        }
      });

      return {
        success: true,
        status: refund.status === 'succeeded' ? 'completed' : 'pending',
        transactionId: refund.id,
        response: refund,
        fees: 0 // Refunds don't have additional fees
      };

    } catch (error) {
      console.error('Stripe refund error:', error);
      
      return {
        success: false,
        status: 'failed',
        errorCode: error.code || 'STRIPE_REFUND_ERROR',
        errorMessage: error.message,
        response: {
          error: error.message,
          type: error.type
        }
      };
    }
  }

  // Process void through Stripe
  async processVoid(voidData) {
    const { transactionId, metadata } = voidData;

    try {
      // Cancel payment intent if it's still pending
      const paymentIntent = await this.stripe.paymentIntents.cancel(transactionId);

      return {
        success: true,
        status: 'completed',
        transactionId: paymentIntent.id,
        response: paymentIntent
      };

    } catch (error) {
      console.error('Stripe void error:', error);
      
      return {
        success: false,
        status: 'failed',
        errorCode: error.code || 'STRIPE_VOID_ERROR',
        errorMessage: error.message,
        response: {
          error: error.message,
          type: error.type
        }
      };
    }
  }

  // Get payment method types for Stripe
  getPaymentMethodTypes(paymentMethod) {
    const methodMap = {
      'credit_card': ['card'],
      'debit_card': ['card'],
      'digital_wallet': ['card', 'apple_pay', 'google_pay']
    };

    return methodMap[paymentMethod] || ['card'];
  }

  // Get Stripe payment method type
  getStripePaymentMethodType(paymentMethod) {
    const typeMap = {
      'credit_card': 'card',
      'debit_card': 'card',
      'digital_wallet': 'card'
    };

    return typeMap[paymentMethod] || 'card';
  }

  // Get Stripe refund reason
  getStripeRefundReason(reason) {
    const reasonMap = {
      'customer_request': 'requested_by_customer',
      'fraud': 'fraudulent',
      'duplicate': 'duplicate',
      'defective': 'defective_product',
      'other': 'other'
    };

    return reasonMap[reason] || 'other';
  }

  // Calculate processing fees
  calculateFees(amount, paymentIntent) {
    // Stripe fees: 2.9% + 30¢ for domestic cards
    const percentage = 0.029;
    const fixed = 0.30;
    
    return Math.round((amount * percentage + fixed) * 100) / 100;
  }

  // Validate payment method
  validatePaymentMethod(paymentMethod) {
    const validMethods = ['credit_card', 'debit_card', 'digital_wallet'];
    return validMethods.includes(paymentMethod);
  }

  // Get supported payment methods
  getSupportedPaymentMethods() {
    return [
      {
        id: 'credit_card',
        name: 'Credit Card',
        description: 'Visa, Mastercard, American Express',
        icon: 'credit-card',
        processingTime: 'instant',
        fees: '2.9% + 30¢'
      },
      {
        id: 'debit_card',
        name: 'Debit Card',
        description: 'Visa, Mastercard debit cards',
        icon: 'debit-card',
        processingTime: 'instant',
        fees: '2.9% + 30¢'
      },
      {
        id: 'digital_wallet',
        name: 'Digital Wallet',
        description: 'Apple Pay, Google Pay',
        icon: 'smartphone',
        processingTime: 'instant',
        fees: '2.9% + 30¢'
      }
    ];
  }

  // Create customer in Stripe
  async createCustomer(customerData) {
    try {
      const customer = await this.stripe.customers.create({
        email: customerData.email,
        name: customerData.name,
        phone: customerData.phone,
        metadata: {
          customerId: customerData.id
        }
      });

      return customer;
    } catch (error) {
      console.error('Stripe create customer error:', error);
      throw error;
    }
  }

  // Get customer payment methods
  async getCustomerPaymentMethods(customerId) {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: 'card'
      });

      return paymentMethods.data;
    } catch (error) {
      console.error('Stripe get payment methods error:', error);
      throw error;
    }
  }
}

module.exports = new StripeGateway();
