import React, { useState, useEffect } from 'react';
import { Tag, Percent, TrendingUp, CheckCircle, AlertCircle, X } from 'lucide-react';
import { useCheckApplicableDiscountsMutation } from '../store/services/discountsApi';
import { showSuccessToast, showErrorToast } from '../utils/errorHandler';

const DiscountSelector = ({ 
  orderData, 
  customerData, 
  appliedDiscounts = [], 
  onApplyDiscount, 
  onRemoveDiscount,
  isLoading = false 
}) => {
  const [discountCode, setDiscountCode] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Fetch applicable discounts
  const [checkApplicableDiscounts, { isLoading: discountsLoading }] = useCheckApplicableDiscountsMutation();
  const [applicableDiscounts, setApplicableDiscounts] = useState([]);

  useEffect(() => {
    const fetchApplicableDiscounts = async () => {
      if (!!orderData && typeof orderData === 'object' && orderData.total > 0) {
        try {
          const result = await checkApplicableDiscounts({ orderData, customerData }).unwrap();
          setApplicableDiscounts(result?.data?.applicableDiscounts || []);
        } catch (error) {
          // Don't show error toast for this as it's not critical
          setApplicableDiscounts([]);
        }
      } else {
        setApplicableDiscounts([]);
      }
    };

    fetchApplicableDiscounts();
  }, [orderData, customerData, checkApplicableDiscounts]);

  const handleApplyDiscount = async () => {
    if (!discountCode.trim()) {
      showErrorToast({ message: 'Please enter a discount code' });
      return;
    }

    try {
      await onApplyDiscount(discountCode.trim());
      setDiscountCode('');
      setShowSuggestions(false);
    } catch (error) {
      showErrorToast({ message: error.response?.data?.message || 'Failed to apply discount' });
    }
  };

  const handleRemoveDiscount = async (discountCode) => {
    try {
      await onRemoveDiscount(discountCode);
    } catch (error) {
      showErrorToast({ message: error.response?.data?.message || 'Failed to remove discount' });
    }
  };

  const getDiscountIcon = (type) => {
    return type === 'percentage' ? 
      <Percent className="h-4 w-4 text-blue-500" /> : 
      <TrendingUp className="h-4 w-4 text-green-500" />;
  };

  const formatDiscountValue = (discount) => {
    if (discount.type === 'percentage') {
      return `${discount.value}%`;
    } else {
      return `${discount.value.toFixed(2)}`;
    }
  };

  const calculateDiscountAmount = (discount) => {
    if (!orderData || !orderData.total || orderData.total <= 0) {
      return 0;
    }
    
    if (discount.type === 'percentage') {
      let amount = (orderData.total * discount.value) / 100;
      if (discount.maximumDiscount && amount > discount.maximumDiscount) {
        amount = discount.maximumDiscount;
      }
      return amount;
    } else {
      return Math.min(discount.value, orderData.total);
    }
  };

  const getTotalDiscountAmount = () => {
    return appliedDiscounts.reduce((total, discount) => total + discount.amount, 0);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      {/* Applied Discounts */}
      {appliedDiscounts.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-green-800 mb-3 flex items-center">
            <CheckCircle className="h-4 w-4 mr-2" />
            Applied Discounts
          </h4>
          <div className="space-y-2">
            {appliedDiscounts.map((discount, index) => (
              <div key={index} className="flex items-center justify-between bg-white rounded-md p-3 border border-green-200">
                <div className="flex items-center">
                  {getDiscountIcon(discount.type)}
                  <div className="ml-2">
                    <div className="text-sm font-medium text-gray-900">
                      {discount.code}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDiscountValue(discount)} off
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-semibold text-green-600">
                    -{formatCurrency(discount.amount)}
                  </span>
                  <button
                    onClick={() => handleRemoveDiscount(discount.code)}
                    className="text-red-500 hover:text-red-700"
                    disabled={isLoading}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-green-200">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-green-800">Total Discount:</span>
              <span className="text-lg font-bold text-green-800">
                -{formatCurrency(getTotalDiscountAmount())}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Discount Code Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Apply Discount Code
        </label>
        <div className="flex space-x-2">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Tag className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              value={discountCode}
              onChange={(e) => {
                setDiscountCode(e.target.value.toUpperCase());
                setShowSuggestions(e.target.value.length > 0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApplyDiscount();
                }
              }}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Enter discount code..."
              disabled={isLoading}
            />
          </div>
          <button
            onClick={handleApplyDiscount}
            disabled={isLoading || !discountCode.trim()}
            className="btn btn-primary"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Available Discount Suggestions */}
      {showSuggestions && applicableDiscounts.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-800 mb-3 flex items-center">
            <AlertCircle className="h-4 w-4 mr-2" />
            Available Discounts
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {applicableDiscounts
              .filter(discount => 
                discount.discount.code.toLowerCase().includes(discountCode.toLowerCase()) &&
                !appliedDiscounts.some(applied => applied.code === discount.discount.code)
              )
              .slice(0, 5)
              .map((item) => {
                const discount = item.discount;
                const amount = calculateDiscountAmount(discount);
                return (
                  <div 
                    key={discount._id}
                    className="flex items-center justify-between bg-white rounded-md p-3 border border-blue-200 cursor-pointer hover:bg-blue-50"
                    onClick={() => {
                      setDiscountCode(discount.code);
                      handleApplyDiscount();
                    }}
                  >
                    <div className="flex items-center">
                      {getDiscountIcon(discount.type)}
                      <div className="ml-2">
                        <div className="text-sm font-medium text-gray-900">
                          {discount.code}
                        </div>
                        <div className="text-xs text-gray-500">
                          {discount.name} • {formatDiscountValue(discount)} off
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-blue-600">
                        Save {formatCurrency(amount)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.reason}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* No Available Discounts */}
      {showSuggestions && applicableDiscounts.length === 0 && discountCode.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-4 w-4 text-gray-400 mr-2" />
            <span className="text-sm text-gray-600">
              No available discounts found for "{discountCode}"
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiscountSelector;
