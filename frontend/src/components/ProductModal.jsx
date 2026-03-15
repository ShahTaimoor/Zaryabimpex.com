import React, { useState, useCallback, useEffect } from 'react';
import { Camera } from 'lucide-react';
import { LoadingButton } from './LoadingSpinner';
import ValidationSummary from './ValidationSummary';
import toast from 'react-hot-toast';

export const ProductModal = ({ product, isOpen, onClose, onSave, isSubmitting, allProducts = [], onEditExisting, categories = [] }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    status: 'active',
    expiryDate: '',
    pricing: {
      cost: '',
      retail: '',
      wholesale: ''
    },
    inventory: {
      currentStock: '',
      reorderPoint: ''
    }
  });
  
  const [showSimilarProducts, setShowSimilarProducts] = useState(false);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [exactMatch, setExactMatch] = useState(null);
  const [errors, setErrors] = useState({});
  const [priceValidationShown, setPriceValidationShown] = useState(false);

  const handleChange = useCallback((event) => {
    const { name, value, type, checked } = event.target;
    let fieldValue = type === 'checkbox' ? checked : value;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: fieldValue
        }
      }));
      
      // Reset price validation flag when price changes
      if (parent === 'pricing') {
        setPriceValidationShown(false);
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: fieldValue
      }));
    }
    
    if (name === 'name' && value.length > 2 && !product) {
      const exact = allProducts.find(p => 
        p.name.toLowerCase() === value.toLowerCase()
      );
      
      if (exact) {
        setExactMatch(exact);
        setShowSimilarProducts(false);
        setSimilarProducts([]);
      } else {
        setExactMatch(null);
        const similar = allProducts.filter(p => 
          p.name.toLowerCase().includes(value.toLowerCase())
        ).slice(0, 3);
        
        if (similar.length > 0) {
          setSimilarProducts(similar);
          setShowSimilarProducts(true);
        } else {
          setShowSimilarProducts(false);
          setSimilarProducts([]);
        }
      }
    } else if (name === 'name') {
      setShowSimilarProducts(false);
      setSimilarProducts([]);
      setExactMatch(null);
    }
    
    setErrors(prev => {
      if (prev[name]) {
        return { ...prev, [name]: null };
      }
      return prev;
    });
  }, [product, allProducts]);

  const handleBlur = useCallback((event) => {
    const { name, value } = event.target;
    
    if (name === 'name' && (!value || value.trim() === '')) {
      setErrors(prev => ({ ...prev, [name]: 'Product name is required' }));
    } else if (name === 'name' && value.length < 2) {
      setErrors(prev => ({ ...prev, [name]: 'Product name must be at least 2 characters' }));
    } else {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
    
    // Validate price hierarchy when price fields are blurred (only show once)
    if (name.startsWith('pricing.') && !priceValidationShown) {
      const retailPrice = parseFloat(formData.pricing.retail) || 0;
      const wholesalePrice = parseFloat(formData.pricing.wholesale) || 0;
      
      if (retailPrice > 0 && wholesalePrice > 0 && retailPrice < wholesalePrice) {
        toast.error('Wholesale price cannot be greater than retail price. Please correct the wholesale price.', {
          duration: 5000,
          position: 'top-center'
        });
        setPriceValidationShown(true);
      }
    }
  }, [formData.pricing, priceValidationShown]);

  const validateForm = useCallback(() => {
    const newErrors = {};
    
    if (!formData.name || formData.name.trim() === '') {
      newErrors.name = 'Product name is required';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Product name must be at least 2 characters';
    }
    
    // Validate price hierarchy (only show toast if not already shown)
    const retailPrice = parseFloat(formData.pricing.retail) || 0;
    const wholesalePrice = parseFloat(formData.pricing.wholesale) || 0;
    const costPrice = parseFloat(formData.pricing.cost) || 0;
    
    if (retailPrice > 0 && wholesalePrice > 0 && retailPrice < wholesalePrice) {
      if (!priceValidationShown) {
        toast.error('Wholesale price cannot be greater than retail price. Please correct the wholesale price.', {
          duration: 5000,
          position: 'top-center'
        });
        setPriceValidationShown(true);
      }
      return false;
    }
    
    if (costPrice > 0 && wholesalePrice > 0 && costPrice > wholesalePrice) {
      toast.error('Cost price cannot be greater than wholesale price. Please correct the cost price.', {
        duration: 5000,
        position: 'top-center'
      });
      return false;
    }
    
    if (costPrice > 0 && retailPrice > 0 && costPrice > retailPrice) {
      toast.error('Cost price cannot be greater than retail price. Please correct the cost price.', {
        duration: 5000,
        position: 'top-center'
      });
      return false;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData.name, formData.pricing, priceValidationShown]);

  const resetForm = useCallback((newData = {}) => {
    let expiryDateValue = '';
    if (newData.expiryDate) {
      const expiryDate = new Date(newData.expiryDate);
      if (!isNaN(expiryDate.getTime())) {
        expiryDateValue = expiryDate.toISOString().split('T')[0];
      }
    }
    
    setFormData({
      name: newData.name || '',
      description: newData.description || '',
      category: newData.category || '',
      status: newData.status || 'active',
      expiryDate: expiryDateValue,
      barcode: newData.barcode || '',
      sku: newData.sku || '',
      brand: newData.brand || '',
      pricing: {
        cost: newData.pricing?.cost || '',
        retail: newData.pricing?.retail || '',
        wholesale: newData.pricing?.wholesale || ''
      },
      inventory: {
        currentStock: newData.inventory?.currentStock || '',
        reorderPoint: newData.inventory?.reorderPoint || ''
      }
    });
    setErrors({});
    setPriceValidationShown(false); // Reset validation flag when form is reset
  }, []);

  useEffect(() => {
    if (product) {
      resetForm(product);
    } else {
      resetForm({});
    }
  }, [product, resetForm]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        const firstInput = document.querySelector('input[name="name"]');
        if (firstInput) {
          firstInput.focus();
        }
      }, 100);
    }
  }, [isOpen]);

  const onSubmit = (e) => {
    e.preventDefault();
    
    const isValid = validateForm();
    
    if (!isValid) {
      const firstErrorField = Object.keys(errors).find(key => errors[key]);
      if (firstErrorField) {
        setTimeout(() => {
          const fieldElement = document.querySelector(`[name="${firstErrorField}"], #${firstErrorField}`);
          if (fieldElement) {
            fieldElement.focus();
            fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
      return;
    }
    
    onSave(formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={onClose} />
        
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <form onSubmit={onSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {product ? 'Edit Product' : 'Add New Product'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Product Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={formData.name || ''}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Enter product name"
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                      errors.name ? 'border-red-300' : 'border-gray-300'
                    }`}
                    autoComplete="off"
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                  )}
                  
                  {exactMatch && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-red-800">
                            ⚠️ This product already exists!
                          </p>
                          <p className="text-xs text-red-600 mt-1">
                            Product: "{exactMatch.name}"
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            setTimeout(() => {
                              if (onEditExisting) {
                                onEditExisting(exactMatch);
                              }
                            }, 100);
                          }}
                          className="text-red-600 hover:text-red-800 underline text-xs font-medium"
                        >
                          Edit Existing
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {showSimilarProducts && similarProducts.length > 0 && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="text-sm font-medium text-blue-800 mb-2">
                        Similar existing products:
                      </p>
                      <ul className="space-y-1">
                        {similarProducts.map((similar, index) => (
                          <li key={index} className="flex items-center justify-between text-sm text-blue-700">
                            <span>• {similar.name}</span>
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                setTimeout(() => {
                                  if (onEditExisting) {
                                    onEditExisting(similar);
                                  }
                                }, 100);
                              }}
                              className="text-blue-600 hover:text-blue-800 underline text-xs"
                            >
                              Edit
                            </button>
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-blue-600 mt-2">
                        Choose a unique name to avoid duplicates, or edit an existing product.
                      </p>
                    </div>
                  )}
                  <p className="mt-1 text-sm text-gray-500">
                    Product name must be unique - no duplicates allowed
                  </p>
                </div>
                
                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Select a category</option>
                    {categories?.map((category) => (
                      <option key={category._id} value={category._id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-sm text-gray-500">
                    Optional product category
                  </p>
                </div>
                
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description || ''}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Enter product description"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Optional description of the product
                  </p>
                </div>
                
                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status || 'active'}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive (Disabled)</option>
                    <option value="discontinued">Discontinued</option>
                  </select>
                  <p className="mt-1 text-sm text-gray-500">
                    {formData.status === 'active' && 'Product is active and available for sale'}
                    {formData.status === 'inactive' && 'Product is disabled and hidden from sales'}
                    {formData.status === 'discontinued' && 'Product is discontinued and no longer available'}
                  </p>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="pricing.cost" className="block text-sm font-medium text-gray-700 mb-1">
                      Cost Price
                    </label>
                    <input
                      id="pricing.cost"
                      name="pricing.cost"
                      type="number"
                      step="0.01"
                      value={formData.pricing.cost || ''}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <p className="mt-1 text-sm text-gray-500">Product cost</p>
                  </div>
                  <div>
                    <label htmlFor="pricing.retail" className="block text-sm font-medium text-gray-700 mb-1">
                      Retail Price
                    </label>
                    <input
                      id="pricing.retail"
                      name="pricing.retail"
                      type="number"
                      step="0.01"
                      value={formData.pricing.retail || ''}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <p className="mt-1 text-sm text-gray-500">Retail selling price</p>
                  </div>
                  <div>
                    <label htmlFor="pricing.wholesale" className="block text-sm font-medium text-gray-700 mb-1">
                      Wholesale Price
                    </label>
                    <input
                      id="pricing.wholesale"
                      name="pricing.wholesale"
                      type="number"
                      step="0.01"
                      value={formData.pricing.wholesale || ''}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <p className="mt-1 text-sm text-gray-500">Wholesale selling price</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="inventory.currentStock" className="block text-sm font-medium text-gray-700 mb-1">
                      Current Stock
                    </label>
                    <input
                      id="inventory.currentStock"
                      name="inventory.currentStock"
                      type="number"
                      value={formData.inventory.currentStock || ''}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <p className="mt-1 text-sm text-gray-500">Current inventory quantity</p>
                  </div>
                  <div>
                    <label htmlFor="inventory.reorderPoint" className="block text-sm font-medium text-gray-700 mb-1">
                      Reorder Point
                    </label>
                    <input
                      id="inventory.reorderPoint"
                      name="inventory.reorderPoint"
                      type="number"
                      value={formData.inventory.reorderPoint || ''}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <p className="mt-1 text-sm text-gray-500">Minimum stock level for reordering</p>
                  </div>
                </div>
                
                <div>
                  <label htmlFor="expiryDate" className="block text-sm font-medium text-gray-700 mb-1">
                    Expiry Date
                  </label>
                  <input
                    id="expiryDate"
                    name="expiryDate"
                    type="date"
                    value={formData.expiryDate || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Optional expiry date for the product. Leave empty if product does not expire.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="barcode" className="block text-sm font-medium text-gray-700 mb-1">
                      Barcode
                    </label>
                    <div className="flex space-x-2">
                      <input
                        id="barcode"
                        name="barcode"
                        type="text"
                        value={formData.barcode || ''}
                        onChange={handleChange}
                        placeholder="Enter or scan barcode"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (window.scanBarcode) {
                            window.scanBarcode((barcode) => {
                              handleChange({ target: { name: 'barcode', value: barcode } });
                            });
                          }
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                        title="Scan barcode"
                      >
                        <Camera className="h-4 w-4 text-gray-600" />
                      </button>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">Product barcode for scanning</p>
                  </div>
                  <div>
                    <label htmlFor="sku" className="block text-sm font-medium text-gray-700 mb-1">
                      SKU
                    </label>
                    <input
                      id="sku"
                      name="sku"
                      type="text"
                      value={formData.sku || ''}
                      onChange={handleChange}
                      placeholder="Enter SKU"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <p className="mt-1 text-sm text-gray-500">Stock Keeping Unit</p>
                  </div>
                </div>

                <div>
                  <label htmlFor="brand" className="block text-sm font-medium text-gray-700 mb-1">
                    Brand
                  </label>
                  <input
                    id="brand"
                    name="brand"
                    type="text"
                    value={formData.brand || ''}
                    onChange={handleChange}
                    placeholder="Enter brand name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">Product brand name</p>
                </div>
              </div>
              
              {Object.keys(errors).some(key => errors[key]) && (
                <ValidationSummary
                  errors={errors}
                  title="Please fix the following errors before submitting:"
                  onFieldClick={(fieldName) => {
                    const fieldElement = document.querySelector(`[name="${fieldName}"], #${fieldName}`);
                    if (fieldElement) {
                      fieldElement.focus();
                      fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                  }}
                />
              )}
            </div>
            
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <LoadingButton
                type="submit"
                isLoading={isSubmitting}
                disabled={!formData.name || isSubmitting || Object.keys(errors).some(key => errors[key])}
                className="btn btn-primary btn-md w-full sm:w-auto sm:ml-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {product ? 'Update Product' : 'Create Product'}
              </LoadingButton>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="btn btn-secondary btn-md w-full sm:w-auto mt-3 sm:mt-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

