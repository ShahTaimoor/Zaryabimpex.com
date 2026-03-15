import React, { useState, useEffect } from 'react';
import { 
  X, 
  CreditCard, 
  Smartphone, 
  Banknote, 
  Check, 
  Gift, 
  AlertCircle,
  CheckCircle,
  Loader
} from 'lucide-react';
import { LoadingButton } from './LoadingSpinner';
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import { useProcessPaymentMutation } from '../store/services/paymentApi';

const PaymentModal = ({ 
  isOpen, 
  onClose, 
  orderData, 
  onPaymentSuccess,
  onPaymentError 
}) => {
  const [selectedMethod, setSelectedMethod] = useState('');
  const [amount, setAmount] = useState('');
  const [cardDetails, setCardDetails] = useState({
    number: '',
    expiryMonth: '',
    expiryYear: '',
    cvc: '',
    holderName: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState({});
  const [processPayment] = useProcessPaymentMutation();

  // Payment methods configuration
  const paymentMethods = [
    {
      id: 'cash',
      name: 'Cash',
      icon: Banknote,
      description: 'Cash payment',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      id: 'credit_card',
      name: 'Credit Card',
      icon: CreditCard,
      description: 'Visa, Mastercard, Amex',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      id: 'debit_card',
      name: 'Debit Card',
      icon: CreditCard,
      description: 'Visa, Mastercard debit',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    },
    {
      id: 'digital_wallet',
      name: 'Digital Wallet',
      icon: Smartphone,
      description: 'Apple Pay, Google Pay',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200'
    },
    {
      id: 'check',
      name: 'Check',
      icon: Check,
      description: 'Check payment',
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200'
    },
    {
      id: 'gift_card',
      name: 'Gift Card',
      icon: Gift,
      description: 'Store gift card',
      color: 'text-pink-600',
      bgColor: 'bg-pink-50',
      borderColor: 'border-pink-200'
    },
    {
      id: 'store_credit',
      name: 'Store Credit',
      icon: CreditCard,
      description: 'Store credit account',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200'
    }
  ];

  // Initialize amount when order data changes
  useEffect(() => {
    if (orderData && orderData.total) {
      setAmount(orderData.total.toString());
    }
  }, [orderData]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedMethod('');
      setAmount('');
      setCardDetails({
        number: '',
        expiryMonth: '',
        expiryYear: '',
        cvc: '',
        holderName: ''
      });
      setErrors({});
    }
  }, [isOpen]);

  const validateForm = () => {
    const newErrors = {};

    if (!selectedMethod) {
      newErrors.method = 'Please select a payment method';
    }

    if (!amount || parseFloat(amount) <= 0) {
      newErrors.amount = 'Please enter a valid amount';
    }

    if (orderData && parseFloat(amount) > orderData.total) {
      newErrors.amount = 'Amount cannot exceed order total';
    }

    // Validate card details for card payments
    if (['credit_card', 'debit_card'].includes(selectedMethod)) {
      if (!cardDetails.number || cardDetails.number.length < 13) {
        newErrors.cardNumber = 'Please enter a valid card number';
      }
      if (!cardDetails.expiryMonth || !cardDetails.expiryYear) {
        newErrors.cardExpiry = 'Please enter card expiry date';
      }
      if (!cardDetails.cvc || cardDetails.cvc.length < 3) {
        newErrors.cardCvc = 'Please enter a valid CVC';
      }
      if (!cardDetails.holderName) {
        newErrors.cardHolder = 'Please enter cardholder name';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePayment = async () => {
    if (!validateForm()) {
      return;
    }

    setIsProcessing(true);
    setErrors({});

    try {
      const paymentData = {
        orderId: orderData._id,
        paymentMethod: selectedMethod,
        amount: parseFloat(amount),
        currency: 'USD',
        gateway: ['credit_card', 'debit_card', 'digital_wallet'].includes(selectedMethod) ? 'stripe' : 'manual',
        cardDetails: ['credit_card', 'debit_card'].includes(selectedMethod) ? cardDetails : undefined,
        metadata: {
          terminalId: 'POS_001',
          location: 'Main Store',
          ipAddress: '127.0.0.1',
          userAgent: navigator.userAgent
        }
      };

      const result = await processPayment(paymentData).unwrap();

      if (result.success) {
        showSuccessToast('Payment processed successfully!');
        onPaymentSuccess && onPaymentSuccess(result.data);
        onClose();
      } else {
        throw new Error(result.message || 'Payment processing failed');
      }

    } catch (error) {
      handleApiError(error, 'Payment Processing');
      onPaymentError && onPaymentError(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const handleCardNumberChange = (e) => {
    const formatted = formatCardNumber(e.target.value);
    setCardDetails(prev => ({ ...prev, number: formatted }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Process Payment</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Order Summary */}
          {orderData && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">Order Summary</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Order #:</span>
                  <span>{orderData.orderNumber || orderData._id}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Amount:</span>
                  <span className="font-medium">${orderData.total?.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Payment Method Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Payment Method
            </label>
            <div className="grid grid-cols-2 gap-3">
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                return (
                  <button
                    key={method.id}
                    onClick={() => setSelectedMethod(method.id)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedMethod === method.id
                        ? `${method.borderColor} ${method.bgColor} ring-2 ring-offset-2 ring-current`
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className={`h-6 w-6 ${method.color}`} />
                      <div className="text-left">
                        <div className={`font-medium ${method.color}`}>
                          {method.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {method.description}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {errors.method && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.method}
              </p>
            )}
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Amount
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                max={orderData?.total || 999999}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="block w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                placeholder="0.00"
              />
            </div>
            {errors.amount && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.amount}
              </p>
            )}
          </div>

          {/* Card Details */}
          {['credit_card', 'debit_card'].includes(selectedMethod) && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Card Details</h3>
              
              {/* Card Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Card Number
                </label>
                <input
                  type="text"
                  value={cardDetails.number}
                  onChange={handleCardNumberChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="1234 5678 9012 3456"
                  maxLength="19"
                />
                {errors.cardNumber && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.cardNumber}
                  </p>
                )}
              </div>

              {/* Card Details Row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Expiry Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expiry Date
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={cardDetails.expiryMonth}
                      onChange={(e) => setCardDetails(prev => ({ ...prev, expiryMonth: e.target.value }))}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      placeholder="MM"
                      min="1"
                      max="12"
                    />
                    <input
                      type="number"
                      value={cardDetails.expiryYear}
                      onChange={(e) => setCardDetails(prev => ({ ...prev, expiryYear: e.target.value }))}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      placeholder="YYYY"
                      min="2024"
                    />
                  </div>
                  {errors.cardExpiry && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.cardExpiry}
                    </p>
                  )}
                </div>

                {/* CVC */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CVC
                  </label>
                  <input
                    type="text"
                    value={cardDetails.cvc}
                    onChange={(e) => setCardDetails(prev => ({ ...prev, cvc: e.target.value.replace(/\D/g, '') }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    placeholder="123"
                    maxLength="4"
                  />
                  {errors.cardCvc && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.cardCvc}
                    </p>
                  )}
                </div>
              </div>

              {/* Cardholder Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cardholder Name
                </label>
                <input
                  type="text"
                  value={cardDetails.holderName}
                  onChange={(e) => setCardDetails(prev => ({ ...prev, holderName: e.target.value }))}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="John Doe"
                />
                {errors.cardHolder && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.cardHolder}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Digital Wallet Info */}
          {selectedMethod === 'digital_wallet' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center">
                <Smartphone className="h-5 w-5 text-blue-600 mr-2" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">Digital Wallet Payment</p>
                  <p>This will open your digital wallet for payment processing.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            disabled={isProcessing}
          >
            Cancel
          </button>
          <LoadingButton
            onClick={handlePayment}
            loading={isProcessing}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            {isProcessing ? 'Processing...' : 'Process Payment'}
          </LoadingButton>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
