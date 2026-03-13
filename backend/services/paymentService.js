const crypto = require('crypto');
const PaymentRepository = require('../repositories/PaymentRepository');
const SalesRepository = require('../repositories/SalesRepository');
// TransactionRepository and Payment model removed (PostgreSQL migration) - using repos only

// Stub: create transaction-like object (no DB persist) so gateway flow continues to work
const createTransactionStub = (data) => ({
  ...data,
  gateway: data.gateway || {},
  status: data.status,
  processing: data.processing || {},
  save: async () => {}
});

const TransactionStub = {
  findOne: async () => null,
  getTransactionStats: async () => ({ totalTransactions: 0, totalAmount: 0, byStatus: {}, byMethod: {} })
};

class PaymentService {
  constructor() {
    this.gateways = new Map();
    this.initializeGateways();
  }

  // Initialize payment gateways
  initializeGateways() {
    // Stripe integration
    if (process.env.STRIPE_SECRET_KEY) {
      this.gateways.set('stripe', require('./gateways/stripeGateway'));
    }
    
    // PayPal integration
    if (process.env.PAYPAL_CLIENT_ID) {
      this.gateways.set('paypal', require('./gateways/paypalGateway'));
    }
    
    // Square integration
    if (process.env.SQUARE_APPLICATION_ID) {
      this.gateways.set('square', require('./gateways/squareGateway'));
    }
    
    // Manual/Offline processing
    this.gateways.set('manual', require('./gateways/manualGateway'));
  }

  // Generate unique payment ID
  generatePaymentId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `PAY_${timestamp}_${random}`.toUpperCase();
  }

  // Generate unique transaction ID
  generateTransactionId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `TXN_${timestamp}_${random}`.toUpperCase();
  }

  // Process payment
  async processPayment(paymentData, user) {
    try {
      const {
        orderId,
        paymentMethod,
        amount,
        currency = 'USD',
        gateway = 'manual',
        cardDetails,
        walletDetails,
        metadata = {}
      } = paymentData;

      // Validate order exists and get details
      const order = await SalesRepository.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      // Validate payment amount
      if (amount <= 0) {
        throw new Error('Invalid payment amount');
      }

      // Check if order is already paid
      const totalPaid = await PaymentRepository.calculateTotalPaid(orderId);

      const orderTotal = Number(order.total ?? order.totalAmount ?? 0);
      if (totalPaid >= orderTotal) {
        throw new Error('Order is already fully paid');
      }

      // Create payment record
      const paymentData = {
        paymentId: this.generatePaymentId(),
        orderId,
        paymentMethod,
        amount,
        currency,
        status: 'pending',
        gateway: {
          name: gateway
        },
        cardDetails: cardDetails ? this.sanitizeCardDetails(cardDetails) : undefined,
        walletDetails,
        metadata: {
          ...metadata,
          customerId: order.customer,
          terminalId: metadata.terminalId || 'POS_001'
        },
        security: {
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          riskScore: await this.calculateRiskScore(paymentData, order)
        }
      };

      const payment = await PaymentRepository.create(paymentData);

      // Process payment through gateway
      const gatewayService = this.gateways.get(gateway);
      if (!gatewayService) {
        throw new Error(`Payment gateway '${gateway}' not available`);
      }

      // Create transaction record
      const transactionData = {
        transactionId: this.generateTransactionId(),
        orderId,
        paymentId: payment._id,
        type: 'sale',
        amount,
        currency,
        status: 'pending',
        paymentMethod,
        gateway: {
          name: gateway
        },
        cardDetails: payment.cardDetails,
        walletDetails: payment.walletDetails,
        customer: {
          id: order.customer,
          email: metadata.customerEmail,
          phone: metadata.customerPhone
        },
        terminal: {
          id: metadata.terminalId || 'POS_001',
          location: metadata.location || 'Main Store',
          version: process.env.APP_VERSION || '1.0.0'
        },
        security: payment.security,
        metadata: {
          receiptNumber: metadata.receiptNumber,
          reference: payment.paymentId
        },
        processing: {
          initiatedAt: new Date(),
          processedBy: user._id
        }
      };

      const transaction = await TransactionRepository.create(transactionData);

      // Process through gateway
      const gatewayResult = await gatewayService.processPayment({
        amount,
        currency,
        paymentMethod,
        cardDetails: payment.cardDetails,
        walletDetails: payment.walletDetails,
        metadata: {
          orderId: order._id,
          paymentId: payment.paymentId,
          transactionId: transaction.transactionId
        }
      });

      // Update transaction with gateway response
      transaction.gateway.transactionId = gatewayResult.transactionId;
      transaction.gateway.gatewayResponse = gatewayResult.response;
      transaction.gateway.processingFee = gatewayResult.fees || 0;
      transaction.status = gatewayResult.status;
      transaction.processing.processedAt = new Date();
      transaction.processing.errorCode = gatewayResult.errorCode;
      transaction.processing.errorMessage = gatewayResult.errorMessage;

      await transaction.save();

      // Update payment with gateway response
      payment.gateway.transactionId = gatewayResult.transactionId;
      payment.gateway.gatewayResponse = gatewayResult.response;
      payment.fees.gatewayFee = gatewayResult.fees || 0;
      payment.status = gatewayResult.status;
      payment.processing.processedAt = new Date();
      payment.processing.processedBy = user._id;

      await payment.save();

      // Update order status if payment is successful
      if (gatewayResult.status === 'completed') {
        await this.updateOrderPaymentStatus(orderId);
      }

      return {
        success: true,
        payment: updatedPayment,
        transaction: updatedTransaction,
        gatewayResult
      };

    } catch (error) {
      console.error('Payment processing error:', error);
      throw error;
    }
  }

  // Process refund
  async processRefund(paymentId, refundData, user) {
    try {
      const { amount, reason } = refundData;

      const payment = await PaymentRepository.findById(paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }

      if (!payment.canRefund()) {
        throw new Error('Payment cannot be refunded');
      }

      if (amount > payment.remainingAmount) {
        throw new Error('Refund amount exceeds remaining amount');
      }

      // Process refund through gateway
      const gatewayService = this.gateways.get(payment.gateway.name);
      if (!gatewayService) {
        throw new Error(`Payment gateway '${payment.gateway.name}' not available`);
      }

      const gatewayResult = await gatewayService.processRefund({
        transactionId: payment.gateway.transactionId,
        amount,
        reason,
        metadata: {
          paymentId: payment.paymentId,
          orderId: payment.orderId
        }
      });

      // Create refund record (using model method)
      const refund = payment.processRefund(amount, reason, user._id);
      refund.status = gatewayResult.status;
      refund.gatewayResponse = gatewayResult.response;

      // Update payment with refund
      await PaymentRepository.update(payment._id, payment.toObject());

      // Create refund transaction
      const refundTransactionData = {
        transactionId: this.generateTransactionId(),
        orderId: payment.orderId,
        paymentId: payment._id,
        type: 'refund',
        amount: -amount, // Negative amount for refund
        currency: payment.currency,
        status: gatewayResult.status,
        paymentMethod: payment.paymentMethod,
        gateway: {
          name: payment.gateway.name,
          transactionId: gatewayResult.transactionId,
          gatewayResponse: gatewayResult.response,
          processingFee: gatewayResult.fees || 0
        },
        processing: {
          initiatedAt: new Date(),
          processedAt: new Date(),
          processedBy: user._id
        },
        metadata: {
          refundId: refund.refundId,
          reason,
          reference: payment.paymentId
        }
      };

      const refundTransaction = createTransactionStub(refundTransactionData);

      return {
        success: true,
        payment,
        refund,
        refundTransaction,
        gatewayResult
      };

    } catch (error) {
      console.error('Refund processing error:', error);
      throw error;
    }
  }

  // Void transaction
  async voidTransaction(transactionId, user, reason) {
    try {
      const transaction = await Transaction.findOne({ transactionId });
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (!transaction.canVoid()) {
        throw new Error('Transaction cannot be voided');
      }

      // Process void through gateway
      const gatewayService = this.gateways.get(transaction.gateway.name);
      if (gatewayService && gatewayService.processVoid) {
        const gatewayResult = await gatewayService.processVoid({
          transactionId: transaction.gateway.transactionId,
          metadata: {
            originalTransactionId: transaction.transactionId
          }
        });

        transaction.gateway.gatewayResponse = gatewayResult.response;
      }

      // Void the transaction
      await transaction.void(user._id, reason);

      // Update payment status
      if (transaction.paymentId) {
        await PaymentRepository.update(transaction.paymentId, { status: 'cancelled' });
      }

      const updatedPayment = transaction.paymentId ? await PaymentRepository.findById(transaction.paymentId) : null;

      return {
        success: true,
        transaction,
        payment: updatedPayment
      };

    } catch (error) {
      console.error('Void transaction error:', error);
      throw error;
    }
  }

  // Get payment history
  async getPaymentHistory(filters = {}) {
    try {
      const {
        orderId,
        paymentId,
        status,
        paymentMethod,
        startDate,
        endDate,
        page = 1,
        limit = 20
      } = filters;

      const query = {};
      
      if (orderId) query.orderId = orderId;
      if (paymentId) query.paymentId = paymentId;
      if (status) query.status = status;
      if (paymentMethod) query.paymentMethod = paymentMethod;
      
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      const populate = [
        { path: 'orderId', select: 'orderNumber total customer' },
        { path: 'processing.processedBy', select: 'firstName lastName email' }
      ];

      const { payments, total, pagination } = await PaymentRepository.findWithPagination(query, {
        page,
        limit,
        sort: { createdAt: -1 },
        populate
      });

      return {
        payments,
        pagination
      };

    } catch (error) {
      console.error('Get payment history error:', error);
      throw error;
    }
  }

  // Get payment statistics
  async getPaymentStats(startDate, endDate) {
    try {
      const stats = await PaymentRepository.getPaymentStats(startDate, endDate);
      const transactionStats = await TransactionStub.getTransactionStats(startDate, endDate);
      
      return {
        paymentStats: stats,
        transactionStats
      };
    } catch (error) {
      console.error('Get payment stats error:', error);
      throw error;
    }
  }

  // Update order payment status
  async updateOrderPaymentStatus(orderId) {
    try {
      const order = await SalesRepository.findById(orderId);
      if (!order) return;

      const totalPaid = await PaymentRepository.calculateTotalPaid(orderId);
      const orderTotal = Number(order.total ?? order.totalAmount ?? 0);
      if (totalPaid >= orderTotal) {
        await SalesRepository.update(orderId, { status: 'paid' });
      }
    } catch (error) {
      console.error('Update order payment status error:', error);
    }
  }

  // Sanitize card details
  sanitizeCardDetails(cardDetails) {
    if (!cardDetails) return undefined;

    return {
      last4: cardDetails.number ? cardDetails.number.slice(-4) : undefined,
      brand: cardDetails.brand,
      expiryMonth: cardDetails.expiryMonth,
      expiryYear: cardDetails.expiryYear,
      holderName: cardDetails.holderName
    };
  }

  // Calculate risk score
  async calculateRiskScore(paymentData, order) {
    let riskScore = 0;

    // Amount-based risk
    if (paymentData.amount > 1000) riskScore += 20;
    if (paymentData.amount > 5000) riskScore += 30;

    // Payment method risk
    if (paymentData.paymentMethod === 'cash') riskScore -= 10;
    if (paymentData.paymentMethod === 'credit_card') riskScore += 5;

    // Customer history (if available)
    if (order.customer) {
      const completedPayments = await PaymentRepository.findAll({ status: 'completed' });
      const customerIdStr = (order.customer && (order.customer.id || order.customer._id || order.customer))?.toString?.() || '';
      const customerPayments = completedPayments.filter(p => {
        const meta = p.metadata && typeof p.metadata === 'object' ? p.metadata : {};
        const pid = meta.customerId?.toString?.() || '';
        return pid && pid === customerIdStr;
      });
      if (customerPayments.length === 0) riskScore += 15; // New customer
    }

    // Time-based risk
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) riskScore += 10; // Unusual hours

    return Math.max(0, Math.min(100, riskScore));
  }
}

module.exports = new PaymentService();
