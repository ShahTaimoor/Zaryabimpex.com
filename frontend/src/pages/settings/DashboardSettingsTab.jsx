import React, { memo } from 'react';
import { LayoutDashboard } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  DASHBOARD_WIDGET_SECTIONS,
  saveDashboardWidgetsConfig,
  applyReceiptsDisplayMode,
  applyPaymentsDisplayMode,
  isReceiptsCombined,
  isPaymentsCombined,
} from '../../config/dashboardConfig';
import { useGetCompanySettingsQuery } from '../../store/services/settingsApi';
import { isDailyCashClosingEnabled } from '../../utils/dailyCashSettings';

export const DashboardSettingsTab = memo(function DashboardSettingsTab({
  sidebarConfig,
  setSidebarConfig,
  isSidebarItemEnabled,
  dashboardWidgetsConfig,
  setDashboardWidgetsConfig,
}) {
  const { data: settingsResponse } = useGetCompanySettingsQuery();
  const settings = settingsResponse?.data || settingsResponse;
  const dailyCashEnabled = isDailyCashClosingEnabled(settings?.orderSettings);

  const updateSidebarDashboard = (checked) => {
    const newConfig = { ...sidebarConfig, Dashboard: !!checked };
    setSidebarConfig(newConfig);
    localStorage.setItem('sidebarConfig', JSON.stringify(newConfig));
    toast.success(`Dashboard ${checked ? 'shown' : 'hidden'} in left sidebar`);
    window.dispatchEvent(new Event('sidebarConfigChanged'));
  };

  const updateWidget = (widgetKey, widgetLabel, checked) => {
    const next = { ...dashboardWidgetsConfig, [widgetKey]: checked === true };
    setDashboardWidgetsConfig(next);
    saveDashboardWidgetsConfig(next);
    toast.success(`${widgetLabel} ${checked ? 'shown' : 'hidden'} on dashboard`);
  };

  return (
    <div className="card shadow-lg border-gray-100">
      <div className="card-header border-b border-gray-50 pb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600 shadow-sm">
            <LayoutDashboard className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 leading-tight">Dashboard Settings</h2>
            <p className="text-sm text-gray-500 mt-1 font-medium">
              Control sidebar visibility and which dashboard metric cards are shown.
            </p>
          </div>
        </div>
      </div>
      <div className="card-content p-6 space-y-10">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="dashboard-sidebar-visible"
              checked={isSidebarItemEnabled('Dashboard')}
              onCheckedChange={(checked) => updateSidebarDashboard(!!checked)}
              className="w-5 h-5 rounded-md border-2 border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
            />
            <Label htmlFor="dashboard-sidebar-visible" className="flex flex-col cursor-pointer">
              <span className="text-sm font-semibold text-gray-900">Show Dashboard in Left Sidebar</span>
              <span className="text-xs text-gray-500">
                Off by default. Dashboard still opens as the first tab after login.
              </span>
            </Label>
          </div>
        </div>

        {DASHBOARD_WIDGET_SECTIONS.map((section) => (
          <div key={section.id} className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full border shadow-sm bg-gray-50 text-gray-600 border-gray-100">
                {section.label}
              </h3>
              {section.id === 'receipts' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const next = applyReceiptsDisplayMode(dashboardWidgetsConfig, 'combined');
                      setDashboardWidgetsConfig(next);
                      saveDashboardWidgetsConfig(next);
                      toast.success('Receipts set to combined view');
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                      isReceiptsCombined(dashboardWidgetsConfig)
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'
                    }`}
                  >
                    Combined
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = applyReceiptsDisplayMode(dashboardWidgetsConfig, 'split');
                      setDashboardWidgetsConfig(next);
                      saveDashboardWidgetsConfig(next);
                      toast.success('Receipts set to split view (cash, bank, sales)');
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                      !isReceiptsCombined(dashboardWidgetsConfig)
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'
                    }`}
                  >
                    Split
                  </button>
                </div>
              )}
              {section.id === 'payments' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const next = applyPaymentsDisplayMode(dashboardWidgetsConfig, 'combined');
                      setDashboardWidgetsConfig(next);
                      saveDashboardWidgetsConfig(next);
                      toast.success('Payments set to combined view');
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                      isPaymentsCombined(dashboardWidgetsConfig)
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    Combined
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = applyPaymentsDisplayMode(dashboardWidgetsConfig, 'split');
                      setDashboardWidgetsConfig(next);
                      saveDashboardWidgetsConfig(next);
                      toast.success('Payments set to split view (cash, bank)');
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                      !isPaymentsCombined(dashboardWidgetsConfig)
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    Split
                  </button>
                </div>
              )}
              <div className="h-[1px] flex-1 min-w-[4rem] bg-gradient-to-r from-gray-100 to-transparent" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {section.widgets
                .filter((widget) => widget.key !== 'dailyCash' || dailyCashEnabled)
                .map((widget) => (
                <div
                  key={widget.key}
                  className="flex items-center space-x-3 p-3.5 border border-gray-200 rounded-xl bg-white hover:border-blue-300 hover:shadow-md transition-all duration-200"
                >
                  <Checkbox
                    id={`dashboard-widget-${widget.key}`}
                    checked={dashboardWidgetsConfig[widget.key] !== false}
                    onCheckedChange={(checked) => updateWidget(widget.key, widget.label, checked)}
                    className="w-5 h-5 rounded-md border-2 border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  />
                  <Label htmlFor={`dashboard-widget-${widget.key}`} className="flex flex-col cursor-pointer">
                    <span className="text-sm font-semibold text-gray-900">{widget.label}</span>
                    <span className="text-[10px] text-gray-400">{widget.description}</span>
                  </Label>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

export default DashboardSettingsTab;
