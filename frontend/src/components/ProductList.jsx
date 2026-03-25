import React, { useState, useEffect } from 'react';
import { Package, Edit, Trash2, Barcode, TrendingUp } from 'lucide-react';
import { Checkbox } from './Checkbox';
import { isLowStock, getExpiryStatus } from '../utils/productHelpers';

export const ProductList = ({
  products,
  searchTerm,
  bulkOps,
  onEdit,
  onDelete,
  onManageInvestors,
  onGenerateBarcode
}) => {
  const [showImages, setShowImages] = useState(localStorage.getItem('showProductImagesUI') !== 'false');

  useEffect(() => {
    const handleStorageChange = () => {
      setShowImages(localStorage.getItem('showProductImagesUI') !== 'false');
    };
    window.addEventListener('productImagesConfigChanged', handleStorageChange);
    return () => window.removeEventListener('productImagesConfigChanged', handleStorageChange);
  }, []);
  if (products.length === 0) {
    return (
      <div className="text-center py-8 xl:py-12 px-3 xl:px-4">
        <Package className="mx-auto h-10 w-10 xl:h-12 xl:w-12 text-gray-400" />
        <h3 className="mt-2 text-xs xl:text-sm font-medium text-gray-900">No products found</h3>
        <p className="mt-1 text-[10px] xl:text-sm text-gray-500">
          {searchTerm ? 'Try adjusting your search terms.' : 'Get started by adding a new product.'}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Desktop Table Header - Hidden on mobile/tablet - Responsive scaling */}
        <div className="hidden lg:block bg-gray-50 border-b border-gray-200">
          <div className="px-3 py-2 xl:px-4 xl:py-3 2xl:px-6 2xl:py-4">
            <div className="grid grid-cols-12 gap-2 xl:gap-3 2xl:gap-4 items-center">
              <div className="col-span-1">
                <Checkbox
                  checked={bulkOps.isSelectAll}
                  onChange={() => bulkOps.toggleSelectAll(products)}
                />
              </div>
              <div className="col-span-5 xl:col-span-3">
                <h3 className="text-[10px] xl:text-xs 2xl:text-sm font-medium text-gray-700">Product Name</h3>
              </div>
              <div className="col-span-1">
                <h3 className="text-[10px] xl:text-xs 2xl:text-sm font-medium text-gray-700">Stock</h3>
              </div>
              <div className="col-span-1">
                <h3 className="text-[10px] xl:text-xs 2xl:text-sm font-medium text-gray-700">Cost</h3>
              </div>
              <div className="col-span-1">
                <h3 className="text-[10px] xl:text-xs 2xl:text-sm font-medium text-gray-700">Retail</h3>
              </div>
              <div className="col-span-1 hidden xl:block">
                <h3 className="text-[10px] xl:text-xs 2xl:text-sm font-medium text-gray-700">Wholesale</h3>
              </div>
              <div className="col-span-1 hidden lg:block xl:col-span-1">
                <h3 className="text-[10px] xl:text-xs 2xl:text-sm font-medium text-gray-700">Category</h3>
              </div>
              <div className="col-span-1">
                <h3 className="text-[10px] xl:text-xs 2xl:text-sm font-medium text-gray-700">Status</h3>
              </div>
              <div className="col-span-1 xl:col-span-2">
                <h3 className="text-[10px] xl:text-xs 2xl:text-sm font-medium text-gray-700">Actions</h3>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Header - Only checkbox and title */}
        <div className="lg:hidden bg-gray-50 border-b border-gray-200 px-3 py-2 xl:px-4 xl:py-3">
          <div className="flex items-center justify-between">
            <Checkbox
              checked={bulkOps.isSelectAll}
              onChange={() => bulkOps.toggleSelectAll(products)}
            />
            <h3 className="text-xs xl:text-sm font-medium text-gray-700">Products ({products.length})</h3>
            <div className="w-6"></div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {products.map((product) => (
            <div key={product._id}>
              {/* Desktop Table Row - Responsive scaling */}
              <div className="hidden lg:block px-3 py-2 xl:px-4 xl:py-3 2xl:px-6 2xl:py-4 hover:bg-gray-50 transition-colors">
                <div className="grid grid-cols-12 gap-2 xl:gap-3 2xl:gap-4 items-center">
                  <div className="col-span-1">
                    <Checkbox
                      checked={bulkOps.isSelected(product._id)}
                      onChange={() => bulkOps.toggleSelection(product._id)}
                    />
                  </div>
                  <div className="col-span-5 xl:col-span-3 min-w-0">
                    <div className="flex items-center space-x-1.5 xl:space-x-2 2xl:space-x-3">
                      {showImages ? (
                        product.imageUrl ? (
                          <img 
                            src={product.imageUrl} 
                            alt={product.name} 
                            className="h-6 w-6 xl:h-8 xl:w-8 2xl:h-10 2xl:w-10 object-cover rounded-md flex-shrink-0 border border-gray-200" 
                          />
                        ) : (
                          <Package className="h-4 w-4 xl:h-5 xl:w-5 2xl:h-6 2xl:w-6 text-gray-400 flex-shrink-0" />
                        )
                      ) : null}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 xl:gap-1.5 2xl:gap-2 flex-wrap">
                          <h3 className="text-[10px] xl:text-xs 2xl:text-sm font-medium text-gray-900 truncate">
                            {product.name}
                          </h3>
                          {product.expiryDate && (() => {
                            const expiryStatus = getExpiryStatus(product);
                            if (expiryStatus?.status === 'expired') {
                              return (
                                <span className="inline-flex items-center px-1 xl:px-1.5 py-0.5 rounded text-[10px] xl:text-xs font-medium bg-red-100 text-red-800 flex-shrink-0" title={`Expired ${expiryStatus.days} day${expiryStatus.days > 1 ? 's' : ''} ago`}>
                                  Expired
                                </span>
                              );
                            } else if (expiryStatus?.status === 'expiring_soon') {
                              return (
                                <span className="inline-flex items-center px-1 xl:px-1.5 py-0.5 rounded text-[10px] xl:text-xs font-medium bg-yellow-100 text-yellow-800 flex-shrink-0" title={`Expires in ${expiryStatus.days} day${expiryStatus.days > 1 ? 's' : ''}`}>
                                  Soon
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>

                      </div>
                    </div>
                  </div>

                  <div className="col-span-1">
                    <p className={`text-[10px] xl:text-xs 2xl:text-sm font-medium ${isLowStock(product) ? 'text-danger-600' : 'text-gray-600'
                      }`}>
                      {product.inventory?.currentStock || 0}
                    </p>
                    {isLowStock(product) && (
                      <p className="text-[10px] xl:text-xs text-danger-600">Low</p>
                    )}
                  </div>

                  <div className="col-span-1">
                    <p className="text-[10px] xl:text-xs 2xl:text-sm text-gray-600">{Math.round(product.pricing?.cost || 0)}</p>
                  </div>

                  <div className="col-span-1">
                    <p className="text-[10px] xl:text-xs 2xl:text-sm text-gray-600">{Math.round(product.pricing?.retail || 0)}</p>
                  </div>

                  <div className="col-span-1 hidden xl:block">
                    <p className="text-[10px] xl:text-xs 2xl:text-sm text-gray-600">{Math.round(product.pricing?.wholesale || 0)}</p>
                  </div>

                  <div className="col-span-1 hidden lg:block xl:col-span-1">
                    <p className="text-[10px] xl:text-xs 2xl:text-sm text-gray-600 truncate">{product.category?.name || '-'}</p>
                  </div>

                  <div className="col-span-1">
                    <span className={`badge badge-sm text-[10px] xl:text-xs ${product.status === 'active' ? 'badge-success' : 'badge-gray'
                      }`}>
                      {product.status}
                    </span>
                  </div>

                  <div className="col-span-1 xl:col-span-2">
                    <div className="flex items-center space-x-1 xl:space-x-1.5 2xl:space-x-2">
                      <button
                        onClick={() => onGenerateBarcode(product)}
                        className="text-green-600 hover:text-green-800 p-0.5 xl:p-1"
                        title="Generate Barcode"
                      >
                        <Barcode className="h-3.5 w-3.5 xl:h-4 xl:w-4 2xl:h-5 2xl:w-5" />
                      </button>
                      <button
                        onClick={() => onManageInvestors(product)}
                        className="text-blue-600 hover:text-blue-800 p-0.5 xl:p-1"
                        title="Manage Investors"
                      >
                        <TrendingUp className="h-3.5 w-3.5 xl:h-4 xl:w-4 2xl:h-5 2xl:w-5" />
                      </button>
                      <button
                        onClick={() => onEdit(product)}
                        className="text-primary-600 hover:text-primary-800 p-0.5 xl:p-1"
                        title="Edit Product"
                      >
                        <Edit className="h-3.5 w-3.5 xl:h-4 xl:w-4 2xl:h-5 2xl:w-5" />
                      </button>
                      <button
                        onClick={() => onDelete(product)}
                        className="text-danger-600 hover:text-danger-800 p-0.5 xl:p-1"
                        title="Delete Product"
                      >
                        <Trash2 className="h-3.5 w-3.5 xl:h-4 xl:w-4 2xl:h-5 2xl:w-5" />
                      </button>
                    </div>
                    {product.hasInvestors && (
                      <span className="inline-flex items-center px-1 xl:px-1.5 py-0.5 rounded-full text-[10px] xl:text-xs font-medium bg-blue-100 text-blue-800 mt-0.5 xl:mt-1">
                        Investors
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Mobile/Tablet Card View - Responsive scaling */}
              <div className="lg:hidden px-3 py-3 xl:px-4 xl:py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start space-x-2 xl:space-x-3">
                  <div className="pt-0.5 flex-shrink-0">
                    <Checkbox
                      checked={bulkOps.isSelected(product._id)}
                      onChange={() => bulkOps.toggleSelection(product._id)}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start space-x-2 xl:space-x-3">
                      {showImages ? (
                        product.imageUrl ? (
                          <img 
                            src={product.imageUrl} 
                            alt={product.name} 
                            className="h-8 w-8 xl:h-10 xl:w-10 object-cover rounded-md flex-shrink-0 border border-gray-200 mt-0.5" 
                          />
                        ) : (
                          <Package className="h-5 w-5 xl:h-6 xl:w-6 text-gray-400 flex-shrink-0 mt-0.5" />
                        )
                      ) : null}
                      <div className="flex-1 min-w-0">
                        {/* Product Name and Status */}
                        <div className="flex items-start justify-between gap-1.5 xl:gap-2 mb-1.5 xl:mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm xl:text-base font-medium text-gray-900 truncate">
                              {product.name}
                            </h3>

                          </div>
                          <span className={`badge badge-sm flex-shrink-0 ${product.status === 'active' ? 'badge-success' : 'badge-gray'
                            }`}>
                            {product.status}
                          </span>
                        </div>

                        {/* Description */}


                        {/* Product Details Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 xl:gap-3 mb-2 xl:mb-3">
                          <div>
                            <p className="text-[10px] xl:text-xs text-gray-500 mb-0.5">Stock</p>
                            <p className={`text-xs xl:text-sm font-semibold ${isLowStock(product) ? 'text-danger-600' : 'text-gray-900'
                              }`}>
                              {product.inventory?.currentStock || 0}
                              {isLowStock(product) && (
                                <span className="text-xs font-normal text-danger-600 ml-1">(Low)</span>
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] xl:text-xs text-gray-500 mb-0.5">Cost</p>
                            <p className="text-xs xl:text-sm font-semibold text-gray-900">
                              {Math.round(product.pricing?.cost || 0)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] xl:text-xs text-gray-500 mb-0.5">Retail</p>
                            <p className="text-xs xl:text-sm font-semibold text-gray-900">
                              {Math.round(product.pricing?.retail || 0)}
                            </p>
                          </div>
                          <div className="hidden sm:block">
                            <p className="text-[10px] xl:text-xs text-gray-500 mb-0.5">Wholesale</p>
                            <p className="text-xs xl:text-sm font-semibold text-gray-900">
                              {Math.round(product.pricing?.wholesale || 0)}
                            </p>
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <p className="text-[10px] xl:text-xs text-gray-500 mb-0.5">Category</p>
                            <p className="text-xs xl:text-sm font-semibold text-gray-900 truncate">
                              {product.category?.name || '-'}
                            </p>
                          </div>
                        </div>

                        {/* Expiry Date Badge */}
                        {product.expiryDate && (() => {
                          const expiryStatus = getExpiryStatus(product);
                          if (expiryStatus?.status === 'expired') {
                            return (
                              <div className="mb-3">
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                                  ⚠️ Expired {expiryStatus.days} day{expiryStatus.days > 1 ? 's' : ''} ago
                                </span>
                              </div>
                            );
                          } else if (expiryStatus?.status === 'expiring_soon') {
                            return (
                              <div className="mb-3">
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                  ⚠️ Expires in {expiryStatus.days} day{expiryStatus.days > 1 ? 's' : ''}
                                </span>
                              </div>
                            );
                          } else if (expiryStatus) {
                            return (
                              <div className="mb-3">
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                                  Expires: {new Date(product.expiryDate).toLocaleDateString()}
                                </span>
                              </div>
                            );
                          }
                          return null;
                        })()}

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between pt-2 xl:pt-3 border-t border-gray-200">
                          <div className="flex items-center space-x-1 xl:space-x-2">
                            <button
                              onClick={() => onGenerateBarcode(product)}
                              className="text-green-600 hover:text-green-800 p-1.5 xl:p-2 rounded hover:bg-green-50 transition-colors"
                              title="Generate Barcode"
                            >
                              <Barcode className="h-4 w-4 xl:h-5 xl:w-5" />
                            </button>
                            <button
                              onClick={() => onManageInvestors(product)}
                              className="text-blue-600 hover:text-blue-800 p-1.5 xl:p-2 rounded hover:bg-blue-50 transition-colors"
                              title="Manage Investors"
                            >
                              <TrendingUp className="h-4 w-4 xl:h-5 xl:w-5" />
                            </button>
                            <button
                              onClick={() => onEdit(product)}
                              className="text-primary-600 hover:text-primary-800 p-1.5 xl:p-2 rounded hover:bg-primary-50 transition-colors"
                              title="Edit Product"
                            >
                              <Edit className="h-4 w-4 xl:h-5 xl:w-5" />
                            </button>
                            <button
                              onClick={() => onDelete(product)}
                              className="text-danger-600 hover:text-danger-800 p-1.5 xl:p-2 rounded hover:bg-red-50 transition-colors"
                              title="Delete Product"
                            >
                              <Trash2 className="h-4 w-4 xl:h-5 xl:w-5" />
                            </button>
                          </div>
                          {product.hasInvestors && (
                            <span className="inline-flex items-center px-1.5 xl:px-2 py-0.5 xl:py-1 rounded-full text-[10px] xl:text-xs font-medium bg-blue-100 text-blue-800">
                              Has Investors
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
