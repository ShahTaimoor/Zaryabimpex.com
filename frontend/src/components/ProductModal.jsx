import React, { useState, useCallback, useEffect } from 'react';
import BaseModal from './BaseModal';
import { Camera, Image as ImageIcon, X } from 'lucide-react';
import { LoadingButton } from './LoadingSpinner';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export const ProductModal = ({ product, isOpen, onClose, onSave, isSubmitting, allProducts = [], onEditExisting, categories = [] }) => {
  const showImages = localStorage.getItem('showProductImagesUI') !== 'false';
  const [showHsCodeField, setShowHsCodeField] = useState(
    () => localStorage.getItem('showProductHsCodeColumn') !== 'false'
  );
  const [imageUploading, setImageUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    status: 'active',
    expiryDate: '',
    imageUrl: '',
    pricing: {
      cost: '',
      retail: '',
      wholesale: ''
    },
    inventory: {
      currentStock: '',
      reorderPoint: ''
    },
    piecesPerBox: '',
    hsCode: ''
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

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageUploading(true);
    const form = new FormData();
    form.append('image', file);

    try {
      const response = await fetch('/api/images/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: form
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Image upload failed');
      
      setFormData(prev => ({
        ...prev,
        imageUrl: data.urls.optimized
      }));
      toast.success('Image uploaded successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to upload image');
    } finally {
      setImageUploading(false);
    }
  };

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
      return null; // already showed toast
    }
    
    if (costPrice > 0 && wholesalePrice > 0 && costPrice > wholesalePrice) {
      toast.error('Cost price cannot be greater than wholesale price. Please correct the cost price.', {
        duration: 5000,
        position: 'top-center'
      });
      return null;
    }
    
    if (costPrice > 0 && retailPrice > 0 && costPrice > retailPrice) {
      toast.error('Cost price cannot be greater than retail price. Please correct the cost price.', {
        duration: 5000,
        position: 'top-center'
      });
      return null;
    }
    
    setErrors(newErrors);
    if (Object.keys(newErrors).length === 0) return true;
    return newErrors;
  }, [formData.name, formData.pricing, priceValidationShown]);

  const resetForm = useCallback((newData = {}) => {
    let expiryDateValue = '';
    if (newData.expiryDate) {
      const expiryDate = new Date(newData.expiryDate);
      if (!isNaN(expiryDate.getTime())) {
        expiryDateValue = expiryDate.toISOString().split('T')[0];
      }
    }
    
    const categoryId = typeof newData.category === 'object'
      ? (newData.category?.id || newData.category?._id)
      : (newData.categoryId || newData.category || '');
    setFormData({
      name: newData.name || '',
      description: newData.description || '',
      category: categoryId || '',
      status: newData.status || 'active',
      expiryDate: expiryDateValue,
      barcode: newData.barcode || '',
      sku: newData.sku || '',
      hsCode: newData.hsCode ?? newData.hs_code ?? '',
      brand: newData.brand || '',
      imageUrl: newData.imageUrl || '',
      pricing: {
        cost: newData.pricing?.cost || '',
        retail: newData.pricing?.retail || '',
        wholesale: newData.pricing?.wholesale || ''
      },
      inventory: {
        currentStock: newData.inventory?.currentStock || '',
        reorderPoint: newData.inventory?.reorderPoint || ''
      },
      piecesPerBox: newData.piecesPerBox ?? newData.pieces_per_box ?? ''
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

  useEffect(() => {
    const syncHsCodeVisibility = () => {
      setShowHsCodeField(localStorage.getItem('showProductHsCodeColumn') !== 'false');
    };
    window.addEventListener('productHsCodeColumnConfigChanged', syncHsCodeVisibility);
    return () => window.removeEventListener('productHsCodeColumnConfigChanged', syncHsCodeVisibility);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setShowHsCodeField(localStorage.getItem('showProductHsCodeColumn') !== 'false');
    }
  }, [isOpen]);

  const onSubmit = (e) => {
    e.preventDefault();
    
    const result = validateForm();
    
    if (result === null) return; // price validation, already showed toast
    
    if (result !== true) {
      const errorMessages = Object.values(result).filter(Boolean).join('. ');
      toast.error(`Please fix the following errors: ${errorMessages}`, {
        duration: 5000,
        position: 'top-center'
      });
      const firstErrorField = Object.keys(result)[0];
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
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={product ? 'Edit Product' : 'Add New Product'}
      maxWidth="2xl"
      variant="centered"
      contentClassName="px-3 pt-4 pb-3 sm:px-5 sm:pt-5 sm:pb-4 xl:px-6 xl:pt-5 xl:pb-4"
      headerClassName="p-3 sm:p-4 xl:p-5"
    >
      <form onSubmit={onSubmit}>
        <div className="space-y-3 xl:space-y-4">
                 <div className="flex flex-col sm:flex-row gap-3 xl:gap-4">
                  {showImages && (
                    <div className="w-full sm:w-[120px] xl:w-[150px] flex-shrink-0 flex flex-col gap-2">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700">Image</label>
                      <div className="relative border-2 border-dashed border-gray-300 rounded-md bg-gray-50 flex items-center justify-center overflow-hidden h-[120px] xl:h-[150px] group">
                        {formData.imageUrl ? (
                          <>
                            <img src={formData.imageUrl} alt="Product" className="object-cover w-full h-full" />
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, imageUrl: '' }))}
                              className="absolute top-1 right-1 bg-white rounded-full p-1 border border-gray-200 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-3 w-3 sm:h-4 sm:w-4 text-gray-600" />
                            </button>
                          </>
                        ) : (
                          <div className="text-center flex flex-col items-center justify-center p-2">
                            <ImageIcon className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400 mb-1" />
                            <span className="text-[10px] sm:text-xs text-gray-500">
                              {imageUploading ? 'Uploading...' : 'Upload Image'}
                            </span>
                          </div>
                        )}
                        
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleImageUpload} 
                          disabled={imageUploading}
                          className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed" 
                        />
                      </div>
                    </div>
                  )}
                  
                  <div className="w-full flex-1 flex flex-col gap-3 xl:gap-4 min-w-0">
                    <div className="flex flex-col sm:flex-row gap-3 xl:gap-4">
                      <div className="w-full sm:flex-[7] min-w-0">
                        <label htmlFor="name" className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
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
                      className={`w-full px-2 py-1.5 sm:px-3 sm:py-2 text-sm border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[2rem] sm:min-h-0 ${
                        errors.name ? 'border-red-300' : 'border-gray-300'
                      }`}
                      autoComplete="off"
                    />
                    {errors.name && (
                      <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-red-600">{errors.name}</p>
                    )}
                    
                    {exactMatch && (
                    <div className="mt-1.5 sm:mt-2 p-2 sm:p-3 bg-red-50 border border-red-200 rounded-md">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-medium text-red-800">
                            ⚠️ This product already exists!
                          </p>
                          <p className="text-[10px] sm:text-xs text-red-600 mt-0.5 sm:mt-1 truncate">
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
                    <div className="mt-1.5 sm:mt-2 p-2 sm:p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="text-xs sm:text-sm font-medium text-blue-800 mb-1.5 sm:mb-2">
                        Similar existing products:
                      </p>
                      <ul className="space-y-0.5 sm:space-y-1">
                        {similarProducts.map((similar, index) => (
                          <li key={index} className="flex items-center justify-between text-xs sm:text-sm text-blue-700 gap-2">
                            <span className="truncate min-w-0">• {similar.name}</span>
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
                              className="text-blue-600 hover:text-blue-800 underline text-[10px] sm:text-xs flex-shrink-0"
                            >
                              Edit
                            </button>
                          </li>
                        ))}
                      </ul>
                      <p className="text-[10px] sm:text-xs text-blue-600 mt-1.5 sm:mt-2">
                        Choose a unique name to avoid duplicates, or edit an existing product.
                      </p>
                    </div>
                  )}
                    <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-gray-500">
                      Product name must be unique - no duplicates allowed
                    </p>
                  </div>
                  <div className="w-full sm:w-[20%] min-w-0 flex-shrink-0">
                    <label htmlFor="category" className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
                      Category
                    </label>
                    <select
                      id="category"
                      name="category"
                      value={formData.category || ''}
                      onChange={handleChange}
                      className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[2rem] sm:min-h-0"
                    >
                      <option value="">Select a category</option>
                      {categories?.map((category) => {
                        const catId = category.id || category._id;
                        return (
                          <option key={catId} value={catId}>
                            {category.name}
                          </option>
                        );
                      })}
                    </select>
                    <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-gray-500">Optional category</p>
                  </div>
                  <div className="w-full sm:flex-[1] min-w-0">
                    <label htmlFor="status" className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
                      Status
                    </label>
                    <select
                      id="status"
                      name="status"
                      value={formData.status || 'active'}
                      onChange={handleChange}
                      className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[2rem] sm:min-h-0"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive (Disabled)</option>
                      <option value="discontinued">Discontinued</option>
                    </select>
                    <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-gray-500">Product availability</p>
                  </div>
                </div>
                </div>
                </div>
                
                <div>
                  <label htmlFor="description" className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description || ''}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Enter product description"
                    rows={2}
                    className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[2.5rem] sm:min-h-0 resize-y"
                  />
                  <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-gray-500">
                    Optional description of the product
                  </p>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 xl:gap-4">
                  <div>
                    <label htmlFor="pricing.cost" className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
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
                      className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[2rem] sm:min-h-0"
                    />
                    <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-gray-500">Product cost</p>
                  </div>
                  <div>
                    <label htmlFor="pricing.retail" className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
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
                      className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[2rem] sm:min-h-0"
                    />
                    <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-gray-500">Retail selling price</p>
                  </div>
                  <div>
                    <label htmlFor="pricing.wholesale" className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
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
                      className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[2rem] sm:min-h-0"
                    />
                    <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-gray-500">Wholesale price</p>
                  </div>
                  <div>
                    <label htmlFor="inventory.currentStock" className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
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
                      className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[2rem] sm:min-h-0"
                    />
                    <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-gray-500">Inventory quantity</p>
                  </div>
                  <div>
                    <label htmlFor="inventory.reorderPoint" className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
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
                      className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[2rem] sm:min-h-0"
                    />
                    <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-gray-500">Min stock for reorder</p>
                  </div>
                  <div>
                    <label htmlFor="piecesPerBox" className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
                      Pieces per Box
                    </label>
                    <input
                      id="piecesPerBox"
                      name="piecesPerBox"
                      type="number"
                      min="1"
                      step="0.01"
                      value={formData.piecesPerBox || ''}
                      onChange={handleChange}
                      placeholder="e.g. 10"
                      className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[2rem] sm:min-h-0"
                    />
                    <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-gray-500">1 box = X pieces. Leave empty for pieces only</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 xl:gap-4">
                  <div>
                    <label htmlFor="expiryDate" className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
                      Expiry Date
                    </label>
                    <input
                      id="expiryDate"
                      name="expiryDate"
                      type="date"
                      value={formData.expiryDate || ''}
                      onChange={handleChange}
                      className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[2rem] sm:min-h-0"
                    />
                    <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-gray-500">Leave empty if N/A</p>
                  </div>
                  <div>
                    <label htmlFor="brand" className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
                      Brand
                    </label>
                    <input
                      id="brand"
                      name="brand"
                      type="text"
                      value={formData.brand || ''}
                      onChange={handleChange}
                      placeholder="Enter brand name"
                      className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[2rem] sm:min-h-0"
                    />
                    <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-gray-500">Product brand</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 xl:gap-4">
                  <div>
                    <label htmlFor="barcode" className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
                      Barcode
                    </label>
                    <div className="flex gap-1.5 sm:gap-2">
                      <input
                        id="barcode"
                        name="barcode"
                        type="text"
                        value={formData.barcode || ''}
                        onChange={handleChange}
                        placeholder="Enter or scan barcode"
                        className="flex-1 min-w-0 px-2 py-1.5 sm:px-3 sm:py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[2rem] sm:min-h-0"
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
                        className="px-2 py-1.5 sm:px-3 sm:py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex-shrink-0"
                        title="Scan barcode"
                      >
                        <Camera className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-600" />
                      </button>
                    </div>
                    <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-gray-500">Product barcode for scanning</p>
                  </div>
                  <div>
                    <label htmlFor="sku" className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
                      SKU
                    </label>
                    <input
                      id="sku"
                      name="sku"
                      type="text"
                      value={formData.sku || ''}
                      onChange={handleChange}
                      placeholder="Enter SKU"
                      className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[2rem] sm:min-h-0"
                    />
                    <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-gray-500">Stock Keeping Unit</p>
                  </div>
                  {showHsCodeField && (
                    <div className="sm:col-span-2 lg:col-span-1">
                      <label htmlFor="hsCode" className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
                        HS code
                      </label>
                      <input
                        id="hsCode"
                        name="hsCode"
                        type="text"
                        autoComplete="off"
                        value={formData.hsCode || ''}
                        onChange={handleChange}
                        placeholder="e.g. 8517.12"
                        className="w-full px-2 py-1.5 sm:px-3 sm:py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[2rem] sm:min-h-0"
                      />
                      <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-gray-500">
                        Harmonized System code (customs / import classification). Optional.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
            
            <div className="bg-gray-50 px-3 py-2.5 sm:px-5 sm:py-3 xl:px-6 xl:py-3 flex flex-col-reverse sm:flex-row-reverse gap-2 sm:gap-3 sm:justify-end">
              <LoadingButton
                type="submit"
                isLoading={isSubmitting}
                disabled={!formData.name || isSubmitting || Object.keys(errors).some(key => errors[key])}
                variant="default"
                size="default"
                className="w-full sm:w-auto text-sm min-h-[2rem] sm:min-h-9 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {product ? 'Update Product' : 'Create Product'}
              </LoadingButton>
              <Button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                variant="secondary"
                size="default"
                className="w-full sm:w-auto text-sm min-h-[2rem] sm:min-h-9 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </Button>
            </div>
      </form>
    </BaseModal>
  );
};

