import React, { memo, useState } from 'react';
import { Users } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { getVisibilityFlag } from '../../utils/fieldVisibility';

const CUSTOMER_FIELDS = [
  { id: 'contactPerson', label: 'Contact Person', sub: 'Name of the person' },
  { id: 'email', label: 'Email', sub: 'Primary contact email' },
  { id: 'customerTier', label: 'Customer Tier', sub: 'Bronze, Silver, Gold, etc.' },
  { id: 'state', label: 'State / Province', sub: 'Part of address details' },
  { id: 'zipCode', label: 'Zip Code', sub: 'Postal code for address' },
  { id: 'notes', label: 'Notes', sub: 'Additional information' },
];

export const CustomerSettingsTab = memo(function CustomerSettingsTab() {
  const [fieldFlags, setFieldFlags] = useState(() => {
    const initial = {};
    CUSTOMER_FIELDS.forEach((field) => {
      const key = `showCustomerSetting_${field.id}`;
      initial[field.id] = field.id === 'contactPerson'
        ? getVisibilityFlag(key, true)
        : localStorage.getItem(key) === 'true';
    });
    return initial;
  });

  const toggleField = (fieldId, checked) => {
    const stateKey = `showCustomerSetting_${fieldId}`;
    setFieldFlags((prev) => ({ ...prev, [fieldId]: !!checked }));
    localStorage.setItem(stateKey, String(checked));
    const field = CUSTOMER_FIELDS.find((f) => f.id === fieldId);
    toast.success(`${field?.label || fieldId} ${checked ? 'shown' : 'hidden'}`);
    window.dispatchEvent(new Event('customerVisibilitySettingsChanged'));
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center space-x-2">
          <Users className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold">Customer Settings</h2>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Customize which fields are visible in the customer entry form
        </p>
      </div>
      <div className="card-content">
        <div className="page-container">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 px-1">Field Visibility</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CUSTOMER_FIELDS.map((item) => {
              const stateKey = `showCustomerSetting_${item.id}`;
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

export default CustomerSettingsTab;
