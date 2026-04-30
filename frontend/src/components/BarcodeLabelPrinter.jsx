import React, { useState, useRef, useEffect, useMemo } from 'react';
import JsBarcode from 'jsbarcode';
import { Printer, Eye, X, Package, Settings, Search } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Barcode Label Printer Component
 * Prints barcode labels for products with customizable layouts
 */
export const BarcodeLabelPrinter = ({ 
  products = [], 
  onClose,
  initialLabelSize = 'standard', // 'standard', 'small', 'large'
  /** When true, show per-line label counts (e.g. purchase receipt qty) */
  quantityMode = false,
  modalTitle = 'Print Barcode Labels',
}) => {
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [labelQuantities, setLabelQuantities] = useState({});
  const [labelSize, setLabelSize] = useState(initialLabelSize);
  const labelFormat = 'CODE128';
  const [includePrice, setIncludePrice] = useState(false);
  const [includeName, setIncludeName] = useState(true);
  const [labelsPerRow, setLabelsPerRow] = useState(2);
  const [productSearch, setProductSearch] = useState('');
  const printRef = useRef(null);

  const getSafeBarcodeValue = (value) => {
    const normalized = String(value || '').trim().replace(/\s+/g, '');
    return normalized.replace(/[\x00-\x1F\x7F]/g, '');
  };

  const getLabelSpec = (size) => {
    if (size === 'small') {
      return {
        page: '58mm 30mm',
        pageWidth: '58mm',
        labelWidthPx: 220,
        labelHeightPx: 110,
        barcodeWidth: 1.7,
        barcodeHeight: 46,
        fontSize: 12,
        margin: 10,
      };
    }
    if (size === 'large') {
      return {
        page: '100mm 50mm',
        pageWidth: '100mm',
        labelWidthPx: 360,
        labelHeightPx: 180,
        barcodeWidth: 2.4,
        barcodeHeight: 82,
        fontSize: 14,
        margin: 12,
      };
    }
    return {
      page: '80mm 40mm',
      pageWidth: '80mm',
      labelWidthPx: 300,
      labelHeightPx: 140,
      barcodeWidth: 2.0,
      barcodeHeight: 64,
      fontSize: 13,
      margin: 12,
    };
  };

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => (p.name || '').toLowerCase().includes(q));
  }, [products, productSearch]);

  useEffect(() => {
    if (products.length > 0) {
      setSelectedProducts(products.map(p => p._id || p.id));
      const next = {};
      products.forEach((p) => {
        const id = p._id || p.id;
        const q = Math.max(1, Math.min(9999, Math.round(Number(p.labelQuantity) || 1)));
        next[id] = q;
      });
      setLabelQuantities(next);
    }
  }, [products]);

  const toggleProduct = (productId) => {
    setSelectedProducts(prev => 
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const setLabelQty = (productId, raw) => {
    const n = Math.round(Number(raw));
    const v = Number.isFinite(n) ? Math.max(1, Math.min(9999, n)) : 1;
    setLabelQuantities((prev) => ({ ...prev, [productId]: v }));
  };

  const getLabelCount = (product) => {
    const id = product._id || product.id;
    const fromState = labelQuantities[id];
    if (fromState != null) return fromState;
    return Math.max(1, Math.min(9999, Math.round(Number(product.labelQuantity) || 1)));
  };

  const expandSelectedForPrint = (selected) => {
    const out = [];
    for (const product of selected) {
      const n = getLabelCount(product);
      const barcodeValue = product.barcode || product.sku || product._id || product.id;
      if (!barcodeValue) continue;
      for (let i = 0; i < n; i++) out.push(product);
    }
    return out;
  };

  const selectAll = () => {
    setSelectedProducts(filteredProducts.map((p) => p._id || p.id));
  };

  const deselectAll = () => {
    setSelectedProducts([]);
  };

  const generateBarcodeCanvas = (barcodeValue) => {
    const safeValue = getSafeBarcodeValue(barcodeValue);
    if (!safeValue) return null;

    const canvas = document.createElement('canvas');
    const spec = getLabelSpec(labelSize);
    try {
      JsBarcode(canvas, safeValue, {
        format: 'CODE128',
        width: spec.barcodeWidth,
        height: spec.barcodeHeight,
        displayValue: true,
        fontSize: spec.fontSize,
        margin: spec.margin,
        marginLeft: spec.margin,
        marginRight: spec.margin,
        marginTop: 8,
        marginBottom: 8,
        background: '#ffffff',
        lineColor: '#000000',
        textAlign: 'center',
        flat: true
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

    const toPrint = expandSelectedForPrint(selected);
    if (toPrint.length === 0) {
      toast.error('No printable barcodes: add barcode or SKU on products, or select lines with a code.');
      return;
    }

    const printWindow = window.open('', '_blank');
    const spec = getLabelSpec(labelSize);
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Barcode Labels</title>
          <style>
            @media print {
              @page {
                size: ${spec.page};
                margin: 0;
              }
              html,
              body {
                width: ${spec.pageWidth};
                margin: 0;
                padding: 0;
                overflow: hidden;
                background: #fff !important;
                print-color-adjust: exact !important;
                -webkit-print-color-adjust: exact !important;
              }
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 2mm;
              background: #fff;
            }
            .labels-container {
              display: grid;
              grid-template-columns: repeat(${Math.max(1, Math.min(labelsPerRow, 4))}, minmax(0, max-content));
              gap: 2mm;
              width: fit-content;
              margin: 0 auto;
              justify-content: center;
            }
            .label {
              border: 1px solid #000;
              box-sizing: border-box;
              width: ${spec.labelWidthPx}px;
              min-height: ${spec.labelHeightPx}px;
              padding: 3mm 2mm;
              text-align: center;
              page-break-inside: avoid;
              break-inside: avoid;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              overflow: hidden;
              background: #fff;
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
              margin: 2px 0;
              background: #fff;
              display: inline-block;
              padding: 1mm;
            }
            .barcode-image {
              display: block;
              width: auto;
              height: auto;
              max-width: none;
              max-height: none;
              transform: none !important;
              image-rendering: pixelated;
              image-rendering: crisp-edges;
              filter: contrast(100%) brightness(100%);
            }
            @media print {
              .labels-container {
                width: calc(${spec.pageWidth} - 4mm);
              }
            }
          </style>
        </head>
        <body>
          <div class="labels-container">
            ${toPrint.map(product => {
              const barcodeValue = product.barcode || product.sku || product._id || product.id;
              if (!barcodeValue) return '';
              
              const canvas = generateBarcodeCanvas(barcodeValue);
              if (!canvas) return '';
              
              const barcodeDataUrl = canvas.toDataURL('image/png');
              
              return `
                <div class="label">
                  ${includeName ? `<div class="label-name">${product.name || 'Product'}</div>` : ''}
                  <div class="barcode-container">
                    <img class="barcode-image" width="${canvas.width}" height="${canvas.height}" src="${barcodeDataUrl}" alt="Barcode" />
                  </div>
                  ${includePrice && product.pricing?.retail ? 
                    `<div class="label-price">PKR ${Number(product.pricing.retail).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</div>` : ''}
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
    toast.success(`Printing ${toPrint.length} label(s)`);
  };

  const handlePreview = () => {
    if (selectedProducts.length === 0) {
      toast.error('Please select at least one product');
      return;
    }

    const selected = products.filter(p => 
      selectedProducts.includes(p._id || p.id)
    );

    const toPrint = expandSelectedForPrint(selected);
    if (toPrint.length === 0) {
      toast.error('No printable barcodes: add barcode or SKU on products, or select lines with a code.');
      return;
    }

    const printWindow = window.open('', '_blank');
    const spec = getLabelSpec(labelSize);
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
              grid-template-columns: repeat(${Math.max(1, Math.min(labelsPerRow, 4))}, minmax(0, max-content));
              gap: 2mm;
              width: fit-content;
              margin: 0 auto;
              justify-content: center;
            }
            .label {
              border: 1px solid #000;
              box-sizing: border-box;
              width: ${spec.labelWidthPx}px;
              min-height: ${spec.labelHeightPx}px;
              padding: 3mm 2mm;
              text-align: center;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              overflow: hidden;
              background: #fff;
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
              margin: 2px 0;
              background: #fff;
              display: inline-block;
              padding: 1mm;
            }
            .barcode-image {
              display: block;
              width: auto;
              height: auto;
              max-width: none;
              max-height: none;
              transform: none !important;
              image-rendering: pixelated;
              image-rendering: crisp-edges;
            }
          </style>
        </head>
        <body>
          <div class="labels-container">
            ${toPrint.map(product => {
              const barcodeValue = product.barcode || product.sku || product._id || product.id;
              if (!barcodeValue) return '';
              
              const canvas = generateBarcodeCanvas(barcodeValue);
              if (!canvas) return '';
              
              const barcodeDataUrl = canvas.toDataURL('image/png');
              
              return `
                <div class="label">
                  ${includeName ? `<div class="label-name">${product.name || 'Product'}</div>` : ''}
                  <div class="barcode-container">
                    <img class="barcode-image" width="${canvas.width}" height="${canvas.height}" src="${barcodeDataUrl}" alt="Barcode" />
                  </div>
                  ${includePrice && product.pricing?.retail ? 
                    `<div class="label-price">PKR ${Number(product.pricing.retail).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</div>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    toast.success(`Labels ready for download/print (${toPrint.length} labels)`);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-75 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <Printer className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">{modalTitle}</h2>
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
                      onChange={() => {}}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50"
                      disabled
                    >
                      <option value="CODE128">CODE128 (Scanner-safe)</option>
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
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
                <h3 className="font-medium text-gray-900">
                  {quantityMode ? 'Receipt lines' : 'Select products'} ({selectedProducts.length} of {products.length})
                </h3>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    Select All
                  </button>
                  <span className="text-gray-300 hidden sm:inline">|</span>
                  <button
                    type="button"
                    onClick={deselectAll}
                    className="text-sm text-gray-600 hover:text-gray-700"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden />
                <input
                  type="search"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search by product name..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  autoComplete="off"
                  aria-label="Search products by name"
                />
              </div>

              <div className="border rounded-lg max-h-96 overflow-y-auto">
                {products.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                    <p>No products available</p>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Search className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No products match &quot;{productSearch.trim()}&quot;</p>
                    <button
                      type="button"
                      onClick={() => setProductSearch('')}
                      className="mt-2 text-sm text-primary-600 hover:text-primary-700"
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredProducts.map(product => {
                      const pid = product._id || product.id;
                      const isSelected = selectedProducts.includes(pid);
                      const hasBarcode = !!(product.barcode || product.sku);
                      
                      return (
                        <div
                          key={pid}
                          className={`flex items-center p-3 hover:bg-gray-50 ${
                            isSelected ? 'bg-primary-50' : ''
                          }`}
                        >
                          <label className="flex items-center flex-1 min-w-0 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleProduct(pid)}
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <div className="ml-3 flex-1 min-w-0">
                              <div className="font-medium text-gray-900 truncate">{product.name}</div>
                              <div className="text-sm text-gray-500">
                                {hasBarcode ? (
                                  <span className="font-mono">{product.barcode || product.sku}</span>
                                ) : (
                                  <span className="text-yellow-600">No barcode/SKU — cannot print</span>
                                )}
                              </div>
                            </div>
                          </label>
                          {quantityMode && (
                            <div className="ml-2 flex items-center gap-1 flex-shrink-0">
                              <span className="text-xs text-gray-500 whitespace-nowrap">Labels</span>
                              <input
                                type="number"
                                min={1}
                                max={9999}
                                value={getLabelCount(product)}
                                onChange={(e) => setLabelQty(pid, e.target.value)}
                                className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                              />
                            </div>
                          )}
                        </div>
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
            onClick={handlePreview}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center space-x-2"
          >
            <Eye className="h-4 w-4" />
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

