import React, { useState, useRef, useEffect } from 'react';
import JsBarcode from 'jsbarcode';
import { Printer, Download, X, Package, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Barcode Label Printer Component
 * Prints barcode labels for products with customizable layouts
 */
export const BarcodeLabelPrinter = ({ 
  products = [], 
  onClose,
  initialLabelSize = 'standard' // 'standard', 'small', 'large'
}) => {
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [labelSize, setLabelSize] = useState(initialLabelSize);
  const [labelFormat, setLabelFormat] = useState('CODE128');
  const [includePrice, setIncludePrice] = useState(false);
  const [includeName, setIncludeName] = useState(true);
  const [labelsPerRow, setLabelsPerRow] = useState(2);
  const printRef = useRef(null);

  useEffect(() => {
    // Select all products by default
    if (products.length > 0) {
      setSelectedProducts(products.map(p => p._id || p.id));
    }
  }, [products]);

  const toggleProduct = (productId) => {
    setSelectedProducts(prev => 
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const selectAll = () => {
    setSelectedProducts(products.map(p => p._id || p.id));
  };

  const deselectAll = () => {
    setSelectedProducts([]);
  };

  const generateBarcodeCanvas = (barcodeValue, format) => {
    const canvas = document.createElement('canvas');
    try {
      JsBarcode(canvas, barcodeValue, {
        format: format,
        width: labelSize === 'small' ? 1.5 : labelSize === 'large' ? 3 : 2,
        height: labelSize === 'small' ? 60 : labelSize === 'large' ? 120 : 80,
        displayValue: true,
        fontSize: labelSize === 'small' ? 12 : labelSize === 'large' ? 18 : 14,
        margin: 5,
        background: '#ffffff',
        lineColor: '#000000'
      });
      return canvas;
    } catch (error) {
      return null;
    }
  };

  const handlePrint = () => {
    if (selectedProducts.length === 0) {
      toast.error('Please select at least one product');
      return;
    }

    const selected = products.filter(p => 
      selectedProducts.includes(p._id || p.id)
    );

    const printWindow = window.open('', '_blank');
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Barcode Labels</title>
          <style>
            @media print {
              @page {
                size: ${labelSize === 'small' ? 'A4' : 'A4'};
                margin: 10mm;
              }
              body {
                margin: 0;
                padding: 0;
              }
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
            }
            .labels-container {
              display: grid;
              grid-template-columns: repeat(${labelsPerRow}, 1fr);
              gap: 10px;
              width: 100%;
            }
            .label {
              border: 1px solid #ddd;
              padding: 10px;
              text-align: center;
              page-break-inside: avoid;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: ${labelSize === 'small' ? '80px' : labelSize === 'large' ? '150px' : '120px'};
            }
            .label-name {
              font-size: ${labelSize === 'small' ? '10px' : labelSize === 'large' ? '16px' : '12px'};
              font-weight: bold;
              margin-bottom: 5px;
              word-wrap: break-word;
            }
            .label-price {
              font-size: ${labelSize === 'small' ? '9px' : labelSize === 'large' ? '14px' : '11px'};
              color: #666;
              margin-top: 5px;
            }
            .barcode-container {
              margin: 5px 0;
            }
          </style>
        </head>
        <body>
          <div class="labels-container">
            ${selected.map(product => {
              const barcodeValue = product.barcode || product.sku || product._id || product.id;
              if (!barcodeValue) return '';
              
              const canvas = generateBarcodeCanvas(barcodeValue, labelFormat);
              if (!canvas) return '';
              
              const barcodeDataUrl = canvas.toDataURL('image/png');
              
              return `
                <div class="label">
                  ${includeName ? `<div class="label-name">${product.name || 'Product'}</div>` : ''}
                  <div class="barcode-container">
                    <img src="${barcodeDataUrl}" alt="Barcode" />
                  </div>
                  ${includePrice && product.pricing?.retail ? 
                    `<div class="label-price">$${product.pricing.retail.toFixed(2)}</div>` : ''}
                </div>
              `;
            }).join('')}
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    toast.success(`Printing ${selected.length} label(s)`);
  };

  const handleDownload = () => {
    if (selectedProducts.length === 0) {
      toast.error('Please select at least one product');
      return;
    }

    const selected = products.filter(p => 
      selectedProducts.includes(p._id || p.id)
    );

    const printWindow = window.open('', '_blank');
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Barcode Labels</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
            }
            .labels-container {
              display: grid;
              grid-template-columns: repeat(${labelsPerRow}, 1fr);
              gap: 10px;
              width: 100%;
            }
            .label {
              border: 1px solid #ddd;
              padding: 10px;
              text-align: center;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: ${labelSize === 'small' ? '80px' : labelSize === 'large' ? '150px' : '120px'};
            }
            .label-name {
              font-size: ${labelSize === 'small' ? '10px' : labelSize === 'large' ? '16px' : '12px'};
              font-weight: bold;
              margin-bottom: 5px;
              word-wrap: break-word;
            }
            .label-price {
              font-size: ${labelSize === 'small' ? '9px' : labelSize === 'large' ? '14px' : '11px'};
              color: #666;
              margin-top: 5px;
            }
            .barcode-container {
              margin: 5px 0;
            }
          </style>
        </head>
        <body>
          <div class="labels-container">
            ${selected.map(product => {
              const barcodeValue = product.barcode || product.sku || product._id || product.id;
              if (!barcodeValue) return '';
              
              const canvas = generateBarcodeCanvas(barcodeValue, labelFormat);
              if (!canvas) return '';
              
              const barcodeDataUrl = canvas.toDataURL('image/png');
              
              return `
                <div class="label">
                  ${includeName ? `<div class="label-name">${product.name || 'Product'}</div>` : ''}
                  <div class="barcode-container">
                    <img src="${barcodeDataUrl}" alt="Barcode" />
                  </div>
                  ${includePrice && product.pricing?.retail ? 
                    `<div class="label-price">$${product.pricing.retail.toFixed(2)}</div>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    toast.success('Labels ready for download/print');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-75 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <Printer className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Print Barcode Labels</h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Settings */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-4">
                  <Settings className="h-4 w-4 text-gray-600" />
                  <h3 className="font-medium text-gray-900">Label Settings</h3>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Label Size
                    </label>
                    <select
                      value={labelSize}
                      onChange={(e) => setLabelSize(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="small">Small</option>
                      <option value="standard">Standard</option>
                      <option value="large">Large</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Barcode Format
                    </label>
                    <select
                      value={labelFormat}
                      onChange={(e) => setLabelFormat(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="CODE128">CODE128</option>
                      <option value="CODE39">CODE39</option>
                      <option value="EAN13">EAN-13</option>
                      <option value="EAN8">EAN-8</option>
                      <option value="UPC">UPC-A</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Labels Per Row
                    </label>
                    <select
                      value={labelsPerRow}
                      onChange={(e) => setLabelsPerRow(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={includeName}
                        onChange={(e) => setIncludeName(e.target.checked)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">Include Product Name</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={includePrice}
                        onChange={(e) => setIncludePrice(e.target.checked)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">Include Price</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Product List */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">
                  Select Products ({selectedProducts.length} of {products.length})
                </h3>
                <div className="flex space-x-2">
                  <button
                    onClick={selectAll}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    Select All
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={deselectAll}
                    className="text-sm text-gray-600 hover:text-gray-700"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="border rounded-lg max-h-96 overflow-y-auto">
                {products.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                    <p>No products available</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {products.map(product => {
                      const isSelected = selectedProducts.includes(product._id || product.id);
                      const hasBarcode = !!(product.barcode || product.sku);
                      
                      return (
                        <label
                          key={product._id || product.id}
                          className={`flex items-center p-3 cursor-pointer hover:bg-gray-50 ${
                            isSelected ? 'bg-primary-50' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleProduct(product._id || product.id)}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <div className="ml-3 flex-1">
                            <div className="font-medium text-gray-900">{product.name}</div>
                            <div className="text-sm text-gray-500">
                              {hasBarcode ? (
                                <span className="font-mono">{product.barcode || product.sku}</span>
                              ) : (
                                <span className="text-yellow-600">No barcode</span>
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-4 border-t bg-gray-50">
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleDownload}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>Preview</span>
          </button>
          <button
            onClick={handlePrint}
            disabled={selectedProducts.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <Printer className="h-4 w-4" />
            <span>Print Labels</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default BarcodeLabelPrinter;

