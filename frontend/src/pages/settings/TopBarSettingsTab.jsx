import React, { memo } from 'react';
import { Wallet, Shield } from 'lucide-react';
import { toast } from 'sonner';
import {
  TOP_BAR_ACTION_ITEMS,
  saveTopBarConfig,
  isTopBarItemEnabled,
} from '../../config/topBarConfig';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export const TopBarSettingsTab = memo(function TopBarSettingsTab({
  topBarConfig,
  setTopBarConfig,
}) {
  const applyConfig = (next) => {
    setTopBarConfig(next);
    saveTopBarConfig(next);
  };

  return (
    <div className="card shadow-lg border-gray-100">
      <div className="card-header border-b border-gray-50 pb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600 shadow-sm">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 leading-tight">Top Bar Configuration</h2>
            <p className="text-sm text-gray-500 mt-1 font-medium">
              Control which financial quick-action buttons appear in the top bar. These settings are independent from sidebar visibility.
            </p>
          </div>
        </div>
      </div>
      <div className="card-content p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TOP_BAR_ACTION_ITEMS.map((item) => {
            const Icon = item.icon;
            const inputId = `topbar-${item.name}`.replace(/\s+/g, '-');
            return (
              <div
                key={item.name}
                className="flex items-center space-x-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-indigo-400 hover:shadow-lg transition-all duration-300 group"
              >
                <Checkbox
                  id={inputId}
                  checked={isTopBarItemEnabled(topBarConfig, item.name)}
                  onCheckedChange={(checked) => {
                    applyConfig({ ...topBarConfig, [item.name]: !!checked });
                    toast.success(`${item.name} ${checked ? 'shown' : 'hidden'} in top bar`);
                  }}
                  className="w-5 h-5 rounded-md border-2 border-gray-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 transition-colors"
                />
                <Label
                  htmlFor={inputId}
                  className="flex items-center gap-3 text-sm font-bold text-gray-700 cursor-pointer group-hover:text-indigo-800 flex-1 min-w-0"
                >
                  <div className="p-2 bg-gray-50 rounded-xl text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all duration-300 flex-shrink-0">
                    {Icon && <Icon className="h-4 w-4" />}
                  </div>
                  <span className="truncate">{item.name}</span>
                </Label>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const next = {};
              TOP_BAR_ACTION_ITEMS.forEach((item) => {
                next[item.name] = true;
              });
              applyConfig(next);
              toast.success('All top bar buttons enabled');
            }}
          >
            Enable All
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const next = {};
              TOP_BAR_ACTION_ITEMS.forEach((item) => {
                next[item.name] = false;
              });
              applyConfig(next);
              toast.success('All top bar buttons hidden');
            }}
          >
            Disable All
          </Button>
        </div>

        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-blue-900">Independent from sidebar</h4>
              <p className="text-xs text-blue-800 mt-1">
                The same financial modules can be shown or hidden in the sidebar under Settings → Sidebar Configuration (Financials section) without affecting these top bar buttons, and vice versa.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default TopBarSettingsTab;
