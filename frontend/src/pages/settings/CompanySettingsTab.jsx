import React, { memo } from 'react';
import { Building } from 'lucide-react';
import { CompanySettingsForm } from '../../components/CompanySettingsForm';

export const CompanySettingsTab = memo(function CompanySettingsTab() {
  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center space-x-2">
          <Building className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold">Company Information</h2>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Manage your company details and branding information
        </p>
      </div>
      <div className="card-content">
        <CompanySettingsForm />
      </div>
    </div>
  );
});

export default CompanySettingsTab;
