import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Barcode, Download, Printer, Copy, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Barcode Generator Component
 * Generates barcodes for products using various formats
 */
export const BarcodeGenerator = ({ 
  product, 
  barcodeValue, 
  format = 'CODE128',
  onClose 
}) => {
  const canvasRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [barcodeFormat, setBarcodeFormat] = useState(format);
  const [displayValue, setDisplayValue] = useState(barcodeValue || product?.barcode || '');

  const formats = [
    { value: 'CODE128', label: 'CODE128 (Recommended)' },
    { value: 'CODE39', label: 'CODE39' },
    { value: 'EAN13', label: 'EAN-13' },
    { value: 'EAN8', label: 'EAN-8' },
    { value: 'UPC', label: 'UPC-A' },
    { value: 'ITF14', label: 'ITF-14' },
    { value: 'MSI', label: 'MSI' },
    { value: 'pharmacode', label: 'Pharmacode' },
    { value: 'codabar', label: 'Codabar' }
  ];

  useEffect(() => {
    generateBarcode();
  }, [displayValue, barcodeFormat]);

  const generateBarcode = () => {
    if (!canvasRef.current || !displayValue) return;

    try {
      JsBarcode(canvasRef.current, displayValue, {
        format: barcodeFormat,
        width: 2,
        height: 100,
        displayValue: true,
        fontSize: 16,
        margin: 10,
        background: '#ffffff',
        lineColor: '#000000'
      });
    } catch (error) {
      toast.error(`Invalid barcode format for ${barcodeFormat}. Please try a different format.`);
    }
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `barcode-${displayValue}.png`;
    link.href = url;
    link.click();
    toast.success('Barcode downloaded successfully');
  };

  const handleCopy = () => {
    if (!displayValue) return;
    
    navigator.clipboard.writeText(displayValue).then(() => {
      setCopied(true);
      toast.success('Barcode copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast.error('Failed to copy barcode');
    });
  };

  const handlePrint = () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Barcode Print</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
            }
            img {
              max-width: 100%;
              height: auto;
            }
          </style>
        </head>
        <body>
          <img src="${canvas.toDataURL('image/png')}" alt="Barcode" />
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const generateRandomBarcode = () => {
    // Generate a random 13-digit barcode (EAN-13 format)
    const random = Math.floor(1000000000000 + Math.random() * 9000000000000);
    setDisplayValue(random.toString());
  };

  if (!product && !barcodeValue) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>No product or barcode value provided</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Barcode className="h-5 w-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            {product ? `Barcode for ${product.name}` : 'Generate Barcode'}
          </h3>
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

      <div className="space-y-4">
        {/* Barcode Value Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Barcode Value
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={displayValue}
              onChange={(e) => setDisplayValue(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Enter barcode value"
            />
            <button
              onClick={generateRandomBarcode}
              className="px-3 py-2 text-sm text-primary-600 hover:text-primary-700 border border-primary-300 rounded-md hover:bg-primary-50 transition-colors"
            >
              Generate Random
            </button>
          </div>
        </div>

        {/* Format Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Barcode Format
          </label>
          <select
            value={barcodeFormat}
            onChange={(e) => setBarcodeFormat(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {formats.map(format => (
              <option key={format.value} value={format.value}>
                {format.label}
              </option>
            ))}
          </select>
        </div>

        {/* Barcode Display */}
        <div className="flex justify-center p-4 bg-gray-50 rounded-lg">
          <canvas ref={canvasRef} className="max-w-full" />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-2 pt-4 border-t">
          <button
            onClick={handleCopy}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center space-x-2"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span>{copied ? 'Copied!' : 'Copy Value'}</span>
          </button>
          <button
            onClick={handleDownload}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>Download</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 transition-colors flex items-center space-x-2"
          >
            <Printer className="h-4 w-4" />
            <span>Print</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default BarcodeGenerator;

