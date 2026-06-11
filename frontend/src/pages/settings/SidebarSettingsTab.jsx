import React, { memo } from 'react';
import { LayoutDashboard, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { navigation } from '../../config/navigation';
import {
  useGetCompanySettingsQuery,
  useUpdateCompanySettingsMutation,
} from '../../store/services/settingsApi';
import { isDailyCashClosingEnabled } from '../../utils/dailyCashSettings';
import { handleApiError } from '../../utils/errorHandler';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export const SidebarSettingsTab = memo(function SidebarSettingsTab({
  sidebarConfig,
  setSidebarConfig,
  isSidebarItemEnabled,
}) {
  const { data: settingsResponse, refetch: refetchSettings } = useGetCompanySettingsQuery();
  const [updateCompanySettings] = useUpdateCompanySettingsMutation();
  const settings = settingsResponse?.data || settingsResponse;
  const dailyCashEnabled = isDailyCashClosingEnabled(settings?.orderSettings);

  const syncDailyCashFeatureFlag = async (child, checked) => {
    if (child.requiresFeature !== 'dailyCashClosing') return;
    await updateCompanySettings({
      orderSettings: {
        ...(settings?.orderSettings || {}),
        dailyCashClosingEnabled: !!checked,
      },
    }).unwrap();
    refetchSettings();
  };

  const isChildVisibleInSettings = (child) => {
    if (child.requiresFeature === 'dailyCashClosing' && !dailyCashEnabled) {
      return false;
    }
    return true;
  };

  const updateSidebarConfig = (next) => {
    setSidebarConfig(next);
    localStorage.setItem('sidebarConfig', JSON.stringify(next));
    window.dispatchEvent(new Event('sidebarConfigChanged'));
  };

  const sections = navigation.reduce((acc, current) => {
    if (current.type === 'heading') {
      acc.push({ heading: current, items: [] });
    } else if (current.name) {
      if (acc.length === 0) {
        acc.push({ heading: { name: 'General' }, items: [current] });
      } else {
        acc[acc.length - 1].items.push(current);
      }
    }
    return acc;
  }, []);

  return (
    <div className="card shadow-lg border-gray-100">
      <div className="card-header border-b border-gray-50 pb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600 shadow-sm">
            <LayoutDashboard className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 leading-tight">Sidebar Configuration</h2>
            <p className="text-sm text-gray-500 mt-1 font-medium">
              Tailor your navigation experience by enabling or disabling specific modules.
            </p>
          </div>
        </div>
      </div>
      <div className="card-content p-6">
        <div className="space-y-12">
          {sections.map((section, sIdx) => (
            <div key={sIdx} className="page-container">
              <div className="flex items-center gap-4">
                <h3
                  className={`text-[11px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full border shadow-sm ${
                    section.heading.color || 'bg-gray-50 text-gray-500 border-gray-100'
                  } ${section.heading.color ? 'text-white border-transparent' : ''}`}
                >
                  {section.heading.name}
                </h3>
                <div className="h-[1px] flex-1 bg-gradient-to-r from-gray-100 to-transparent" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {section.items.map((item) => {
                  const hasChildren = item.children && item.children.length > 0;
                  if (hasChildren) {
                    return (
                      <div
                        key={item.name}
                        className="col-span-1 sm:col-span-2 lg:col-span-4 rounded-2xl border border-gray-200/60 bg-gray-50/40 p-6 space-y-5"
                      >
                        <div className="flex items-center justify-between border-b border-gray-200/50 pb-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-xl shadow-sm border border-gray-100">
                              {item.icon && <item.icon className="h-4 w-4 text-indigo-500 flex-shrink-0" />}
                            </div>
                            <span className="text-sm font-bold text-gray-800 uppercase tracking-tight">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-[11px] font-semibold text-gray-600 bg-white px-2.5 py-1.5 rounded-lg border border-gray-200">
                              <Checkbox
                                id={`sidebar-group-${item.name}`.replace(/\s+/g, '-')}
                                checked={item.children.every((child) => isSidebarItemEnabled(child.name))}
                                onCheckedChange={(checked) => {
                                  const newConfig = { ...sidebarConfig };
                                  item.children.forEach((child) => {
                                    newConfig[child.name] = !!checked;
                                  });
                                  updateSidebarConfig(newConfig);
                                  toast.success(`${item.name} submenu ${checked ? 'enabled' : 'disabled'}`);
                                }}
                                className="w-4 h-4 rounded border-2 border-gray-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 transition-colors"
                              />
                              <span>Select All</span>
                            </label>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter bg-gray-100/50 px-2 py-0.5 rounded">
                              Module Links
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          {item.children.filter(isChildVisibleInSettings).map((child) => {
                            const childId = `sidebar-${section.heading.name}-${item.name}-${child.name}`.replace(/\s+/g, '-');
                            return (
                              <div
                                key={child.name}
                                className="flex items-center space-x-3 p-3.5 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all duration-300 group"
                              >
                                <Checkbox
                                  id={childId}
                                  checked={isSidebarItemEnabled(child.name)}
                                  onCheckedChange={async (checked) => {
                                    const nextChecked = !!checked;
                                    const previousConfig = { ...sidebarConfig };
                                    updateSidebarConfig({ ...sidebarConfig, [child.name]: nextChecked });
                                    try {
                                      if (child.requiresFeature === 'dailyCashClosing') {
                                        await syncDailyCashFeatureFlag(child, nextChecked);
                                        toast.success(
                                          `Daily Cash Closing ${nextChecked ? 'enabled' : 'disabled'}`
                                        );
                                      } else {
                                        toast.success(`${child.name} ${nextChecked ? 'shown' : 'hidden'} in sidebar`);
                                      }
                                    } catch (error) {
                                      updateSidebarConfig(previousConfig);
                                      handleApiError(error, 'Update sidebar setting');
                                    }
                                  }}
                                  className="w-5 h-5 rounded-md border-2 border-gray-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 transition-colors"
                                />
                                <Label
                                  htmlFor={childId}
                                  className="text-xs font-bold text-gray-600 cursor-pointer flex-1 flex items-center min-w-0 group-hover:text-indigo-800"
                                >
                                  {child.icon && (
                                    <child.icon className="h-4 w-4 mr-2 text-gray-400 group-hover:text-indigo-500 flex-shrink-0 transition-colors" />
                                  )}
                                  <span className="truncate">{child.name}</span>
                                </Label>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  const singleId = `sidebar-${item.name}`.replace(/\s+/g, '-');
                  return (
                    <div
                      key={item.name}
                      className="flex items-center space-x-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-indigo-400 hover:shadow-lg transition-all duration-300 group"
                    >
                      <Checkbox
                        id={singleId}
                        checked={isSidebarItemEnabled(item.name)}
                        onCheckedChange={(checked) => {
                          updateSidebarConfig({ ...sidebarConfig, [item.name]: checked });
                          toast.success(`${item.name} ${checked ? 'shown' : 'hidden'} in sidebar`);
                        }}
                        className="w-5 h-5 rounded-md border-2 border-gray-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 transition-colors"
                      />
                      <Label
                        htmlFor={singleId}
                        className="flex items-center gap-3 text-sm font-bold text-gray-700 cursor-pointer group-hover:text-indigo-800"
                      >
                        <div className="p-2 bg-gray-50 rounded-xl text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all duration-300">
                          {item.icon && <item.icon className="h-4.5 w-4.5" />}
                        </div>
                        {item.name}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-blue-900">Pro Tip</h4>
              <p className="text-xs text-blue-800 mt-1">
                Unchecking hides that link from the sidebar; grouped sections (Sales, Purchase, …) stay as headers if at least one child link stays visible. You can still open a hidden page by URL if your role allows.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default SidebarSettingsTab;
