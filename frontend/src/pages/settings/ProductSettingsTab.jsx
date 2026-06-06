import React, { memo, useState } from 'react';
import { Package } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const PRODUCT_FIELDS = [
  { id: 'reorderPoint', label: 'Reorder Point', sub: 'Min stock for reorder' },
  { id: 'unit', label: 'Unit of Measurement', sub: 'PCS, KG, etc.' },
  { id: 'piecesPerBox', label: 'Pieces per Box', sub: 'Box packing details' },
  { id: 'expiryDate', label: 'Expiry Date', sub: 'Product expiration' },
  { id: 'brand', label: 'Brand', sub: 'Product manufacturer' },
  { id: 'barcode', label: 'Barcode', sub: 'Scan or enter code' },
  { id: 'sku', label: 'SKU', sub: 'Stock keeping unit' },
  { id: 'hsCode', label: 'HS Code', sub: 'Customs code & list column' },
  { id: 'countryOfOrigin', label: 'Country of Origin', sub: 'Manufacturing country' },
  { id: 'netWeight', label: 'Net Weight (KG)', sub: 'Product weight only' },
  { id: 'grossWeight', label: 'Gross Weight (KG)', sub: 'Weight with packing' },
  { id: 'importRefNo', label: 'Import Ref No', sub: 'Tracking for imports' },
  { id: 'gdNumber', label: 'GD Number', sub: 'Goods declaration' },
  { id: 'invoiceRef', label: 'Invoice Ref', sub: 'Supplier invoice reference' },
];

function readFlag(key) {
  return localStorage.getItem(key) === 'true';
}

export const ProductSettingsTab = memo(function ProductSettingsTab() {
  const [showProductImagesUI, setShowProductImagesUI] = useState(() => {
    const saved = localStorage.getItem('showProductImagesUI');
    return saved === null ? true : saved === 'true';
  });

  const [fieldFlags, setFieldFlags] = useState(() => {
    const initial = {};
    PRODUCT_FIELDS.forEach((field) => {
      initial[field.id] = readFlag(`showProductSetting_${field.id}`);
    });
    return initial;
  });

  const toggleField = (fieldId, checked) => {
    const stateKey = `showProductSetting_${fieldId}`;
    setFieldFlags((prev) => ({ ...prev, [fieldId]: !!checked }));
    localStorage.setItem(stateKey, String(checked));
    const field = PRODUCT_FIELDS.find((f) => f.id === fieldId);
    toast.success(`${field?.label || fieldId} ${checked ? 'enabled' : 'disabled'}`);
    window.dispatchEvent(new Event('productVisibilitySettingsChanged'));
    if (fieldId === 'hsCode') {
      localStorage.setItem('showProductHsCodeColumn', String(checked));
      window.dispatchEvent(new Event('productHsCodeColumnConfigChanged'));
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center space-x-2">
          <Package className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold">Product Settings</h2>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Customize which fields are visible in the product entry form and lists
        </p>
      </div>
      <div className="card-content">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div className="flex items-center space-x-3 p-3.5 border border-gray-200 rounded-xl bg-white hover:border-blue-300 hover:shadow-md transition-all duration-200 group">
            <Checkbox
              id="showProductImagesUI_tab"
              className="w-5 h-5 rounded-md border-2 border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
              checked={showProductImagesUI}
              onCheckedChange={(checked) => {
                setShowProductImagesUI(checked);
                localStorage.setItem('showProductImagesUI', String(checked));
                toast.success(`Product images ${checked ? 'shown' : 'hidden'} in UI tables`);
                window.dispatchEvent(new Event('productImagesConfigChanged'));
              }}
            />
            <Label htmlFor="showProductImagesUI_tab" className="flex flex-col cursor-pointer group-hover:text-blue-700">
              <span className="text-sm font-semibold">Show Product Images</span>
              <span className="text-[10px] text-gray-400">Thumbnails in lists & POS</span>
            </Label>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 px-1">Detailed Field Visibility</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PRODUCT_FIELDS.map((item) => {
              const stateKey = `showProductSetting_${item.id}`;
              return (
                <div
                  key={item.id}
                  className="flex items-center space-x-3 p-3.5 border border-gray-200 rounded-xl bg-white hover:border-blue-300 hover:shadow-md transition-all duration-200 group"
                >
                  <Checkbox
                    id={stateKey}
                    className="w-5 h-5 rounded-md border-2 border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    checked={fieldFlags[item.id]}
                    onCheckedChange={(checked) => toggleField(item.id, checked)}
                  />
                  <Label htmlFor={stateKey} className="flex flex-col cursor-pointer group-hover:text-blue-700">
                    <span className="text-sm font-semibold">{item.label}</span>
                    <span className="text-[10px] text-gray-400">{item.sub}</span>
                  </Label>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});

export default ProductSettingsTab;
