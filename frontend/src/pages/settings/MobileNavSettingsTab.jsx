import React, { memo, useMemo } from 'react';
import {
  Smartphone,
  Plus,
  Trash2,
  Save,
  Shield,
  ChevronUp,
  ChevronDown,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { navigation } from '../../config/navigation';
import { getComponentInfo } from '../../utils/componentUtils';
import { LUCIDE_ICON_MAP } from '../../utils/lucideIconMap';
import { LoadingButton } from '../../components/LoadingSpinner';

export const MobileNavSettingsTab = memo(function MobileNavSettingsTab({
  bottomNavConfig,
  setBottomNavConfig,
}) {
  const allAvailableItems = useMemo(() => {
    const items = [];
    const traverse = (navItems) => {
      navItems.forEach((item) => {
        if (item.href && item.name) {
          items.push({ name: item.name, href: item.href, icon: item.icon });
        }
        if (item.children) traverse(item.children);
      });
    };
    traverse(navigation);
    return items;
  }, []);

  const handleAddToNav = (item) => {
    if (bottomNavConfig.length >= 5) {
      toast.error('Mobile bottom navigation is limited to 5 items for best design.');
      return;
    }
    if (bottomNavConfig.find((row) => row.href === item.href)) {
      toast.error('Item already in bottom navigation.');
      return;
    }

    let iconName = 'Circle';
    if (typeof item.icon === 'string') {
      iconName = item.icon;
    } else if (item.icon && item.icon.name) {
      iconName = item.icon.name;
    } else {
      const info = getComponentInfo(item.href);
      if (info && info.icon) iconName = info.icon;
    }

    setBottomNavConfig([
      ...bottomNavConfig,
      { name: item.name, href: item.href, icon: iconName },
    ]);
  };

  const handleRemoveFromNav = (index) => {
    setBottomNavConfig(bottomNavConfig.filter((_, i) => i !== index));
  };

  const handleMoveUp = (index) => {
    if (index === 0) return;
    const newConfig = [...bottomNavConfig];
    [newConfig[index - 1], newConfig[index]] = [newConfig[index], newConfig[index - 1]];
    setBottomNavConfig(newConfig);
  };

  const handleMoveDown = (index) => {
    if (index === bottomNavConfig.length - 1) return;
    const newConfig = [...bottomNavConfig];
    [newConfig[index + 1], newConfig[index]] = [newConfig[index], newConfig[index + 1]];
    setBottomNavConfig(newConfig);
  };

  const handleSaveBottomNav = () => {
    localStorage.setItem('bottomNavConfig', JSON.stringify(bottomNavConfig));
    window.dispatchEvent(new Event('bottomNavConfigChanged'));
    toast.success('Mobile bottom navigation updated successfully');
  };

  return (
    <div className="card shadow-lg border-gray-100">
      <div className="card-header border-b border-gray-50 pb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600 shadow-sm">
            <Smartphone className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 leading-tight">Mobile Bottom Navigation</h2>
            <p className="text-sm text-gray-500 mt-1 font-medium">
              Select and arrange up to 5 items for the mobile bottom shortcut bar. (Recommended: 4 items)
            </p>
          </div>
        </div>
      </div>

      <div className="card-content p-6 flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-4">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Current Order ({bottomNavConfig.length}/5)
          </h3>

          <div className="space-y-3 bg-gray-50/50 p-4 rounded-2xl border border-gray-100 min-h-[300px]">
            {bottomNavConfig.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <Plus className="h-12 w-12 text-gray-300 mb-2" />
                <p className="text-gray-400 font-medium">
                  No items added yet.
                  <br />
                  Select from the right to begin.
                </p>
              </div>
            ) : (
              bottomNavConfig.map((item, index) => {
                const IconComponent =
                  item.icon && LUCIDE_ICON_MAP[item.icon] ? LUCIDE_ICON_MAP[item.icon] : Smartphone;
                return (
                  <div
                    key={`${item.href}-${index}`}
                    className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                        >
                          <ChevronUp className="h-3.5 w-3.5 text-gray-500" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveDown(index)}
                          disabled={index === bottomNavConfig.length - 1}
                          className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                        >
                          <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                        </button>
                      </div>
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate">{item.name}</p>
                        <p className="text-[10px] font-medium text-gray-400 truncate">{item.href}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFromNav(index)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex justify-end pt-2">
            <LoadingButton
              onClick={handleSaveBottomNav}
              className="bg-gray-900 text-white hover:bg-gray-800 rounded-xl px-10 h-11 font-bold shadow-md"
            >
              <Save className="h-4.5 w-4.5 mr-2" />
              Save Configuration
            </LoadingButton>
          </div>
        </div>

        <div className="lg:w-80 space-y-4">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Available Modules
          </h3>

          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
              {allAvailableItems.map((item) => {
                const isAdded = bottomNavConfig.some((row) => row.href === item.href);
                const IconComp = item.icon || Smartphone;
                return (
                  <div
                    key={item.href}
                    className={`flex items-center justify-between p-3.5 border-b border-gray-50 last:border-0 transition-colors ${
                      isAdded ? 'bg-gray-50/80 opacity-60' : 'hover:bg-blue-50/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`p-1.5 rounded-lg ${
                          isAdded ? 'bg-gray-200 text-gray-500' : 'bg-gray-50 text-gray-400'
                        }`}
                      >
                        {typeof IconComp === 'string'
                          ? LUCIDE_ICON_MAP[IconComp]
                            ? React.createElement(LUCIDE_ICON_MAP[IconComp], { className: 'h-4 w-4' })
                            : IconComp
                          : <IconComp className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-700 truncate">{item.name}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddToNav(item)}
                      disabled={isAdded || bottomNavConfig.length >= 5}
                      className={`p-1.5 rounded-lg transition-all ${
                        isAdded
                          ? 'text-green-500 cursor-default'
                          : bottomNavConfig.length >= 5
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-blue-600 hover:bg-blue-100 bg-blue-50'
                      }`}
                    >
                      {isAdded ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl shadow-sm">
            <div className="flex gap-3">
              <Shield className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-900">Permission Sync</h4>
                <p className="text-[10px] font-medium text-amber-800 mt-1 leading-relaxed">
                  Items will only appear for users who have the required permissions for that specific module, even if added to the configuration.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default MobileNavSettingsTab;
