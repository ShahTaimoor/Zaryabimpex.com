// Manual/Offline payment gateway
// Used for cash payments and manual processing

class ManualGateway {
  constructor() {
    this.name = 'manual';
  }

  // Process payment manually
  async processPayment(paymentData) {
    const { amount, paymentMethod, metadata } = paymentData;

    try {
      // Simulate processing delay
      await this.delay(1000);

      // For cash payments, always succeed
      if (paymentMethod === 'cash') {
        return {
          success: true,
          status: 'completed',
          transactionId: `CASH_${Date.now()}`,
          response: {
            message: 'Cash payment processed successfully',
            amount,
            paymentMethod
          },
          fees: 0
        };
      }

      // For other manual methods, simulate success
      return {
        success: true,
        status: 'completed',
        transactionId: `MANUAL_${Date.now()}`,
        response: {
          message: 'Manual payment processed successfully',
          amount,
          paymentMethod
        },
        fees: 0
      };

    } catch (error) {
      return {
        success: false,
        status: 'failed',
        errorCode: 'MANUAL_ERROR',
        errorMessage: error.message,
        response: {
          error: error.message
        }
      };
    }
  }

  // Process refund manually
  async processRefund(refundData) {
    const { amount, reason, metadata } = refundData;

    try {
      // Simulate processing delay
      await this.delay(500);

      return {
        success: true,
        status: 'completed',
        transactionId: `REFUND_${Date.now()}`,
        response: {
          message: 'Manual refund processed successfully',
          amount,
          reason
        },
        fees: 0
      };

    } catch (error) {
      return {
        success: false,
        status: 'failed',
        errorCode: 'REFUND_ERROR',
        errorMessage: error.message,
        response: {
          error: error.message
        }
      };
    }
  }

  // Process void manually
  async processVoid(voidData) {
    const { transactionId, metadata } = voidData;

    try {
      // Simulate processing delay
      await this.delay(500);

      return {
        success: true,
        status: 'completed',
        transactionId: `VOID_${Date.now()}`,
        response: {
          message: 'Manual void processed successfully',
          originalTransactionId: transactionId
        }
      };

    } catch (error) {
      return {
        success: false,
        status: 'failed',
        errorCode: 'VOID_ERROR',
        errorMessage: error.message,
        response: {
          error: error.message
        }
      };
    }
  }

  // Validate payment method
  validatePaymentMethod(paymentMethod) {
    const validMethods = ['cash', 'check', 'bank_transfer', 'store_credit'];
    return validMethods.includes(paymentMethod);
  }

  // Get supported payment methods
  getSupportedPaymentMethods() {
    return [
      {
        id: 'cash',
        name: 'Cash',
        description: 'Cash payment',
        icon: 'cash',
        processingTime: 'instant',
        fees: 0
      },
      {
        id: 'check',
        name: 'Check',
        description: 'Check payment',
        icon: 'check',
        processingTime: '1-3 days',
        fees: 0
      },
      {
        id: 'bank_transfer',
        name: 'Bank Transfer',
        description: 'Direct bank transfer',
        icon: 'bank',
        processingTime: '1-2 days',
        fees: 0
      },
      {
        id: 'store_credit',
        name: 'Store Credit',
        description: 'Store credit/gift card',
        icon: 'gift',
        processingTime: 'instant',
        fees: 0
      }
    ];
  }

  // Helper method for delays
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new ManualGateway();
