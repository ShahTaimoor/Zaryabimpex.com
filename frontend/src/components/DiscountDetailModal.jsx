import React from 'react';
import { Button } from '@/components/ui/button';
import BaseModal from './BaseModal';
import { 
  Tag, 
  Percent, 
  TrendingUp, 
  Calendar, 
  Users, 
  Package, 
  AlertCircle,
  CheckCircle,
  Clock,
  Edit,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

const DiscountDetailModal = ({ 
  discount, 
  isOpen, 
  onClose, 
  onToggleStatus, 
  onDelete, 
  isLoading 
}) => {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString();
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'inactive':
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
      case 'scheduled':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'expired':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'exhausted':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      case 'exhausted':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!isOpen || !discount) return null;

  const statusBadge = (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(discount.status)}`}>
      {getStatusIcon(discount.status)}
      <span className="ml-2 capitalize">{discount.status}</span>
    </span>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-3">
          <span className="p-2 bg-blue-50 rounded-lg">
            <Tag className="h-5 w-5 text-blue-600" />
          </span>
          {discount.name}
        </span>
      }
      subtitle={`Code: ${discount.code} • ${(discount.type ?? '').replace(/_/g, ' ')}`}
      headerExtra={statusBadge}
      maxWidth="xl"
      variant="scrollable"
      contentClassName="p-5"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-4">
            <Button
              type="button"
              onClick={() => onToggleStatus(discount._id)}
              variant="secondary"
              disabled={isLoading}
            >
              {discount.isActive ? (
                <><ToggleLeft className="h-4 w-4 mr-2" /> Deactivate</>
              ) : (
                <><ToggleRight className="h-4 w-4 mr-2" /> Activate</>
              )}
            </Button>
            {discount.currentUsage === 0 && (
              <Button
                type="button"
                onClick={() => onDelete(discount._id)}
                variant="secondary"
                className="text-red-600 hover:text-red-800"
                disabled={isLoading}
              >
                <Edit className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
          <Button onClick={onClose} variant="secondary">
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
          {/* Basic Information */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h4 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-500">Description</label>
                <p className="mt-1 text-sm text-gray-900">{discount.description || 'No description'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Value</label>
                <div className="mt-1 flex items-center">
                  {discount.type === 'percentage' ? (
                    <>
                      <Percent className="h-4 w-4 text-blue-500 mr-1" />
                      <span className="text-lg font-semibold text-gray-900">{discount.value}%</span>
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                      <span className="text-lg font-semibold text-gray-900">{formatCurrency(discount.value)}</span>
                    </>
                  )}
                </div>
                {discount.maximumDiscount && discount.type === 'percentage' && (
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum: {formatCurrency(discount.maximumDiscount)}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Minimum Order Amount</label>
                <p className="mt-1 text-sm text-gray-900">
                  {discount.minimumOrderAmount > 0 ? formatCurrency(discount.minimumOrderAmount) : 'No minimum'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Priority</label>
                <p className="mt-1 text-sm text-gray-900">{discount.priority}</p>
              </div>
            </div>
          </div>

          {/* Validity Period */}
          <div className="bg-blue-50 rounded-lg p-6">
            <h4 className="text-lg font-medium text-gray-900 mb-4">Validity Period</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-500">Valid From</label>
                <div className="mt-1 flex items-center">
                  <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-900">{formatDate(discount.validFrom)}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Valid Until</label>
                <div className="mt-1 flex items-center">
                  <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-900">{formatDate(discount.validUntil)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Applicability */}
          <div className="bg-green-50 rounded-lg p-6">
            <h4 className="text-lg font-medium text-gray-900 mb-4">Applicability</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-500">Applicable To</label>
                <div className="mt-1 flex items-center">
                  {discount.applicableTo === 'all' && <Users className="h-4 w-4 text-gray-400 mr-2" />}
                  {discount.applicableTo === 'products' && <Package className="h-4 w-4 text-gray-400 mr-2" />}
                  {discount.applicableTo === 'categories' && <Tag className="h-4 w-4 text-gray-400 mr-2" />}
                  {discount.applicableTo === 'customers' && <Users className="h-4 w-4 text-gray-400 mr-2" />}
                  <span className="text-sm text-gray-900 capitalize">
                    {discount.applicableTo === 'all' ? 'All Orders' : discount.applicableTo}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Combinable</label>
                <p className="mt-1 text-sm text-gray-900">
                  {discount.combinableWithOtherDiscounts ? 'Yes' : 'No'}
                </p>
              </div>
            </div>

            {/* Show specific selections if applicable */}
            {discount.applicableTo === 'products' && discount.applicableProducts?.length > 0 && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-500">Selected Products</label>
                <div className="mt-2 max-h-32 overflow-y-auto">
                  {discount.applicableProducts.map((product) => (
                    <div key={product._id} className="text-sm text-gray-900 py-1">
                      • {product.name} ({typeof product.category === 'object' ? (product.category?.name ?? 'N/A') : (product.category || 'N/A')})
                    </div>
                  ))}
                </div>
              </div>
            )}

            {discount.applicableTo === 'categories' && discount.applicableCategories?.length > 0 && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-500">Selected Categories</label>
                <div className="mt-2">
                  {discount.applicableCategories.map((category) => (
                    <div key={category._id} className="text-sm text-gray-900 py-1">
                      • {category.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {discount.customerTiers?.length > 0 && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-500">Customer Tiers</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {discount.customerTiers.map((tier) => (
                    <span key={tier} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                      {tier}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {discount.businessTypes?.length > 0 && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-500">Business Types</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {discount.businessTypes.map((type) => (
                    <span key={type} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 capitalize">
                      {type}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Usage Statistics */}
          <div className="bg-purple-50 rounded-lg p-6">
            <h4 className="text-lg font-medium text-gray-900 mb-4">Usage Statistics</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-500">Total Usage</label>
                <div className="mt-1 flex items-center">
                  <TrendingUp className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-lg font-semibold text-gray-900">
                    {discount.currentUsage || 0}
                    {discount.usageLimit && ` / ${discount.usageLimit}`}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Usage Limit Per Customer</label>
                <p className="mt-1 text-sm text-gray-900">
                  {discount.usageLimitPerCustomer || 'Unlimited'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Total Discount Amount</label>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {formatCurrency(discount.analytics?.totalDiscountAmount || 0)}
                </p>
              </div>
            </div>

            {discount.analytics?.lastUsed && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-500">Last Used</label>
                <p className="mt-1 text-sm text-gray-900">
                  {formatDate(discount.analytics.lastUsed)}
                </p>
              </div>
            )}
          </div>

          {/* Conditions */}
          {discount.conditions && (
            <div className="bg-yellow-50 rounded-lg p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Conditions</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {discount.conditions.minimumQuantity > 1 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Minimum Quantity</label>
                    <p className="mt-1 text-sm text-gray-900">{discount.conditions.minimumQuantity}</p>
                  </div>
                )}
                {discount.conditions.maximumQuantity && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Maximum Quantity</label>
                    <p className="mt-1 text-sm text-gray-900">{discount.conditions.maximumQuantity}</p>
                  </div>
                )}
                {discount.conditions.daysOfWeek?.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Valid Days</label>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {discount.conditions.daysOfWeek.map((day) => (
                        <span key={day} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 capitalize">
                          {day}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {discount.conditions.timeOfDay?.start && discount.conditions.timeOfDay?.end && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Valid Time</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {discount.conditions.timeOfDay.start} - {discount.conditions.timeOfDay.end}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
    </BaseModal>
  );
};

export default DiscountDetailModal;
