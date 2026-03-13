// Date formatting utilities
export const formatDate = (dateString) => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch (error) {
    return dateString;
  }
};

export const formatDateTime = (dateString) => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (error) {
    return dateString;
  }
};

export const formatTime = (dateString) => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    return dateString;
  }
};

// Currency formatting utilities (without dollar sign)
export const formatCurrency = (amount, currency = 'USD') => {
  if (amount === null || amount === undefined) return '';
  
  try {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return '';
    
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numAmount);
  } catch (error) {
    return amount.toString();
  }
};

// Number formatting utilities
export const formatNumber = (number, decimals = 2) => {
  if (number === null || number === undefined) return '';
  
  try {
    const num = parseFloat(number);
    if (isNaN(num)) return '';
    
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num);
  } catch (error) {
    return number.toString();
  }
};

// Percentage formatting utilities
export const formatPercentage = (value, decimals = 2) => {
  if (value === null || value === undefined) return '';
  
  try {
    const num = parseFloat(value);
    if (isNaN(num)) return '';
    
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num / 100);
  } catch (error) {
    return value.toString();
  }
};

// Phone number formatting
export const formatPhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return '';
  
  // Remove all non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // Format as (XXX) XXX-XXXX for US numbers
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  // Return original if not 10 digits
  return phoneNumber;
};

// File size formatting
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Text truncation
export const truncateText = (text, maxLength = 50) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// Capitalize first letter
export const capitalizeFirst = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// Format name (first name + last name)
export const formatName = (firstName, lastName) => {
  const first = firstName || '';
  const last = lastName || '';
  return `${first} ${last}`.trim();
};

// Format address
export const formatAddress = (address) => {
  if (!address) return '';
  
  // Handle string addresses (legacy format)
  if (typeof address === 'string') {
    return address;
  }
  
  // Handle object addresses
  const parts = [
    address.street,
    address.city,
    address.state || address.province,
    address.zipCode || address.zip || address.postalCode,
    address.country
  ].filter(Boolean);
  
  return parts.join(', ');
};

// Format order status
export const formatOrderStatus = (status) => {
  const statusMap = {
    'pending': 'Pending',
    'confirmed': 'Confirmed',
    'processing': 'Processing',
    'shipped': 'Shipped',
    'delivered': 'Delivered',
    'cancelled': 'Cancelled',
    'returned': 'Returned'
  };
  
  return statusMap[status] || capitalizeFirst(status);
};

// Format payment method
export const formatPaymentMethod = (method) => {
  const methodMap = {
    'cash': 'Cash',
    'credit_card': 'Credit Card',
    'debit_card': 'Debit Card',
    'check': 'Check',
    'account': 'Account',
    'split': 'Split Payment',
    'bank_transfer': 'Bank Transfer'
  };
  
  return methodMap[method] || capitalizeFirst(method);
};

// Format customer tier
export const formatCustomerTier = (tier) => {
  const tierMap = {
    'bronze': 'Bronze',
    'silver': 'Silver',
    'gold': 'Gold',
    'platinum': 'Platinum'
  };
  
  return tierMap[tier] || capitalizeFirst(tier);
};
