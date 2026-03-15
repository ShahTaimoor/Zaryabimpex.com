import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, AlertCircle, CheckCircle } from 'lucide-react';

/**
 * Barcode Scanner Component
 * Uses camera API to scan barcodes and QR codes
 */
export const BarcodeScanner = ({ 
  onScan, 
  onClose, 
  isOpen = false,
  scanMode = 'both' // 'barcode', 'qr', or 'both'
}) => {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [lastScanned, setLastScanned] = useState(null);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  useEffect(() => {
    if (isOpen && !html5QrCodeRef.current) {
      html5QrCodeRef.current = new Html5Qrcode('barcode-scanner');
    }

    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, [isOpen]);

  const startScanning = async () => {
    if (!html5QrCodeRef.current) return;

    try {
      setError(null);
      setScanning(true);

      // Start scanning
      // html5-qrcode automatically supports multiple formats including barcodes and QR codes
      await html5QrCodeRef.current.start(
        {
          facingMode: 'environment' // Use back camera on mobile
        },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
          // formatsToSupport is optional - library supports all formats by default
        },
        (decodedText, decodedResult) => {
          // Success callback
          setLastScanned(decodedText);
          if (onScan) {
            onScan(decodedText, decodedResult);
          }
          // Continue scanning for multiple items
        },
        (errorMessage) => {
          // Error callback - ignore if it's just "not found" errors
          if (errorMessage && !errorMessage.includes('NotFoundException')) {
            // Only show actual errors
          }
        }
      );
    } catch (err) {
      setError(err.message || 'Failed to start camera. Please check permissions.');
      setScanning(false);
    }
  };

  const stopScanning = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (err) {
        // Error stopping scanner - silent fail
      }
    }
    setScanning(false);
  };

  const handleClose = async () => {
    await stopScanning();
    if (onClose) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-75 flex items-center justify-center">
      <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <Camera className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Barcode Scanner</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scanner Area */}
        <div className="p-4">
          <div className="relative">
            <div
              id="barcode-scanner"
              className="w-full rounded-lg overflow-hidden bg-gray-100"
              style={{ minHeight: '300px' }}
            />
            
            {!scanning && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 rounded-lg">
                <div className="text-center text-white">
                  <Camera className="h-12 w-12 mx-auto mb-4" />
                  <p className="text-lg font-medium mb-2">Camera Ready</p>
                  <p className="text-sm text-gray-300">Click Start to begin scanning</p>
                </div>
              </div>
            )}

            {error && (
              <div className="absolute top-4 left-4 right-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">Error</p>
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              </div>
            )}

            {lastScanned && (
              <div className="absolute bottom-4 left-4 right-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-start space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-800">Scanned</p>
                  <p className="text-sm text-green-600 font-mono">{lastScanned}</p>
                </div>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Instructions:</strong> Position the barcode/QR code within the frame. 
              The scanner will automatically detect and decode it.
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-end space-x-3 p-4 border-t bg-gray-50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          {!scanning ? (
            <button
              onClick={startScanning}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 transition-colors flex items-center space-x-2"
            >
              <Camera className="h-4 w-4" />
              <span>Start Scanning</span>
            </button>
          ) : (
            <button
              onClick={stopScanning}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
            >
              Stop Scanning
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BarcodeScanner;

