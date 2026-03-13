// Helper functions for product operations

export const isLowStock = (product) => {
  return product.inventory?.currentStock <= product.inventory?.reorderPoint;
};

export const getExpiryStatus = (product) => {
  if (!product.expiryDate) return null;
  
  const expiryDate = new Date(product.expiryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiryDate.setHours(0, 0, 0, 0);
  
  const diffTime = expiryDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return { status: 'expired', days: Math.abs(diffDays) };
  } else if (diffDays <= 7) {
    return { status: 'expiring_soon', days: diffDays };
  } else {
    return { status: 'valid', days: diffDays };
  }
};

