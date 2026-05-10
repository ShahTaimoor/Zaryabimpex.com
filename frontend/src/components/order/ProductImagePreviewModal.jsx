import React from 'react';
import BaseModal from '@/components/BaseModal';

/**
 * Reusable preview dialog for product/variant images. Replaces the
 * identical BaseModal block that was duplicated across Sales, SalesOrders,
 * Purchase, and PurchaseOrders.
 *
 * Pass `product` (or `null` to close). The modal opens whenever `product`
 * is truthy and resolves the title from the product's display fields.
 */
export function ProductImagePreviewModal({ product, onClose, title }) {
  const resolvedTitle =
    title ??
    product?.displayName ??
    product?.variantName ??
    product?.name ??
    'Product Image';

  return (
    <BaseModal
      isOpen={!!product}
      onClose={onClose}
      title={resolvedTitle}
    >
      <div className="flex justify-center items-center bg-gray-50 rounded-lg overflow-hidden min-h-[300px] p-4">
        {product?.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={resolvedTitle}
            className="max-w-full max-h-[70vh] object-contain"
          />
        ) : (
          <div className="text-gray-400">No image available</div>
        )}
      </div>
    </BaseModal>
  );
}

export default ProductImagePreviewModal;
