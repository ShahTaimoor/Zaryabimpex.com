import React, { memo, useState } from 'react';
import { Building } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { getVisibilityFlag } from '../../utils/fieldVisibility';

const SUPPLIER_FIELDS = [
  { key: 'showSupplierSetting_contactPerson', label: 'Contact Person', sub: 'Primary contact name', defaultOn: true },
  { key: 'showSupplierSetting_email', label: 'Email', sub: 'Contact email' },
  { key: 'showSupplierSetting_paymentTerms', label: 'Payment Terms', sub: 'Default payment terms' },
  { key: 'showSupplierSetting_website', label: 'Website', sub: 'Company website' },
  { key: 'showSupplierSetting_leadTime', label: 'Lead Time', sub: 'Delivery lead time' },
  { key: 'showSupplierSetting_minOrder', label: 'Min Order', sub: 'Minimum order quantity' },
  { key: 'showSupplierSetting_rating', label: 'Rating', sub: 'Supplier rating' },
  { key: 'showSupplierSetting_reliability', label: 'Reliability', sub: 'Reliability score' },
  { key: 'showSupplierSetting_state', label: 'State / Province', sub: 'Part of address' },
  { key: 'showSupplierSetting_zipCode', label: 'Zip Code', sub: 'Postal code' },
  { key: 'showSupplierSetting_notes', label: 'Notes', sub: 'Additional information' },
];

function readSupplierFlag(key, defaultOn = false) {
  if (key === 'showSupplierSetting_contactPerson') {
    return getVisibilityFlag(key, true);
  }
  return localStorage.getItem(key) === 'true';
}

export const SupplierSettingsTab = memo(function SupplierSettingsTab() {
  const [flags, setFlags] = useState(() => {
    const initial = {};
    SUPPLIER_FIELDS.forEach((field) => {
      initial[field.key] = readSupplierFlag(field.key, field.defaultOn);
    });
    return initial;
  });

  const toggleField = (key, checked) => {
    setFlags((prev) => ({ ...prev, [key]: !!checked }));
    localStorage.setItem(key, String(!!checked));
    window.dispatchEvent(new Event('supplierVisibilitySettingsChanged'));
    toast.success('Supplier settings updated');
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center space-x-2">
          <Building className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold">Supplier Settings</h2>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Control which fields are visible in supplier forms and lists
        </p>
      </div>
      <div className="card-content">
        <div className="page-container">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 px-1">Field visibility</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SUPPLIER_FIELDS.map((item) => (
              <div
                key={item.key}
                className="flex items-center space-x-3 p-3.5 border border-gray-200 rounded-xl bg-white hover:border-blue-300 hover:shadow-md transition-all duration-200 group"
              >
                <Checkbox
                  id={item.key}
                  className="w-5 h-5 rounded-md border-2 border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  checked={flags[item.key]}
                  onCheckedChange={(checked) => toggleField(item.key, checked === true)}
                />
                <Label htmlFor={item.key} className="flex flex-col cursor-pointer group-hover:text-blue-700">
                  <span className="text-sm font-semibold">{item.label}</span>
                  <span className="text-[10px] text-gray-400">{item.sub}</span>
                </Label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

export default SupplierSettingsTab;
