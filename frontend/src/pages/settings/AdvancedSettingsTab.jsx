import React, { memo, useState, useEffect } from 'react';
import { BarChart3, Camera } from 'lucide-react';
import { toast } from 'sonner';
import {
  useGetCompanySettingsQuery,
  useUpdateCompanySettingsMutation,
  useGetUserPreferencesQuery,
  useUpdateUserPreferencesMutation,
} from '../../store/services/settingsApi';
import { OrderItemWiseConfirmationSettings } from '../../components/OrderItemWiseConfirmationSettings';
import { handleApiError } from '../../utils/errorHandler';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export const AdvancedSettingsTab = memo(function AdvancedSettingsTab({ setSidebarConfig }) {
  const { data: settings, refetch: refetchSettings } = useGetCompanySettingsQuery();
  const [updateCompanySettings] = useUpdateCompanySettingsMutation();
  const { data: userPreferencesResponse } = useGetUserPreferencesQuery();
  const [updateUserPreferences, { isLoading: isSavingUserPreferences }] = useUpdateUserPreferencesMutation();
  const userPreferences = userPreferencesResponse?.data || userPreferencesResponse || {};

  const [accountLedgerShowReturn, setAccountLedgerShowReturn] = useState(() => {
    const saved = localStorage.getItem('accountLedgerShowReturnColumn');
    return saved === null ? true : saved === 'true';
  });
  const [showTopBarUI, setShowTopBarUI] = useState(() => {
    const saved = localStorage.getItem('showTopBarUI');
    return saved === null ? true : saved === 'true';
  });
  const [useMarketPurchasePrices, setUseMarketPurchasePrices] = useState(false);
  const [enableImportPurchaseLandedCost, setEnableImportPurchaseLandedCost] = useState(false);
  const [warehouseInventoryEnabled, setWarehouseInventoryEnabled] = useState(false);
  const [productSearchCameraEnabled, setProductSearchCameraEnabled] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  useEffect(() => {
    setUseMarketPurchasePrices(settings?.orderSettings?.useMarketPurchasePrices === true);
  }, [settings?.orderSettings?.useMarketPurchasePrices]);

  useEffect(() => {
    setEnableImportPurchaseLandedCost(settings?.orderSettings?.enableImportPurchaseLandedCost === true);
  }, [settings?.orderSettings?.enableImportPurchaseLandedCost]);

  useEffect(() => {
    setWarehouseInventoryEnabled(settings?.orderSettings?.warehouseInventoryEnabled === true);
  }, [settings?.orderSettings?.warehouseInventoryEnabled]);

  useEffect(() => {
    setProductSearchCameraEnabled(settings?.orderSettings?.productSearchCameraEnabled === true);
  }, [settings?.orderSettings?.productSearchCameraEnabled]);

  useEffect(() => {
    setTwoFactorEnabled(!!userPreferences?.twoFactorEnabled);
  }, [userPreferences?.twoFactorEnabled]);

  const syncMarketPricesSidebarVisibility = (enabled) => {
    const savedSidebarRaw = localStorage.getItem('sidebarConfig');
    let savedSidebar = {};
    if (savedSidebarRaw) {
      try {
        savedSidebar = JSON.parse(savedSidebarRaw) || {};
      } catch (_) {
        savedSidebar = {};
      }
    }
    const nextSidebar = {
      ...savedSidebar,
      'Current Purchase Market Prices': !!enabled,
    };
    delete nextSidebar['Current Market Prices'];
    localStorage.setItem('sidebarConfig', JSON.stringify(nextSidebar));
    setSidebarConfig(nextSidebar);
    window.dispatchEvent(new Event('sidebarConfigChanged'));
  };

  const syncWarehouseInventorySidebarVisibility = (enabled) => {
    const savedSidebarRaw = localStorage.getItem('sidebarConfig');
    let savedSidebar = {};
    if (savedSidebarRaw) {
      try {
        savedSidebar = JSON.parse(savedSidebarRaw) || {};
      } catch (_) {
        savedSidebar = {};
      }
    }
    const nextSidebar = { ...savedSidebar, 'Stock Transfers': !!enabled };
    localStorage.setItem('sidebarConfig', JSON.stringify(nextSidebar));
    setSidebarConfig(nextSidebar);
    window.dispatchEvent(new Event('sidebarConfigChanged'));
  };

  const handleMarketPriceFeatureToggle = async (checked) => {
    const nextChecked = !!checked;
    const previousChecked = useMarketPurchasePrices;
    setUseMarketPurchasePrices(nextChecked);
    syncMarketPricesSidebarVisibility(nextChecked);
    try {
      await updateCompanySettings({
        orderSettings: {
          ...(settings?.orderSettings || {}),
          useMarketPurchasePrices: nextChecked,
        },
      }).unwrap();
      toast.success(`Market purchase prices ${nextChecked ? 'enabled' : 'disabled'}.`);
      refetchSettings();
    } catch (error) {
      setUseMarketPurchasePrices(previousChecked);
      syncMarketPricesSidebarVisibility(previousChecked);
      handleApiError(error, 'Update Market Purchase Price Setting');
    }
  };

  const handleImportPurchaseFeatureToggle = async (checked) => {
    const nextChecked = !!checked;
    const previousChecked = enableImportPurchaseLandedCost;
    setEnableImportPurchaseLandedCost(nextChecked);
    try {
      await updateCompanySettings({
        orderSettings: {
          ...(settings?.orderSettings || {}),
          enableImportPurchaseLandedCost: nextChecked,
        },
      }).unwrap();
      toast.success(`Import purchase landed-cost ${nextChecked ? 'enabled' : 'disabled'}.`);
      refetchSettings();
    } catch (error) {
      setEnableImportPurchaseLandedCost(previousChecked);
      handleApiError(error, 'Update Import Purchase Landed Cost Setting');
    }
  };

  const handleWarehouseInventoryToggle = async (checked) => {
    const nextChecked = !!checked;
    const previousChecked = warehouseInventoryEnabled;
    setWarehouseInventoryEnabled(nextChecked);
    syncWarehouseInventorySidebarVisibility(nextChecked);
    try {
      await updateCompanySettings({
        orderSettings: {
          ...(settings?.orderSettings || {}),
          warehouseInventoryEnabled: nextChecked,
        },
      }).unwrap();
      toast.success(`Warehouse inventory ${nextChecked ? 'enabled' : 'disabled'}.`);
      refetchSettings();
    } catch (error) {
      setWarehouseInventoryEnabled(previousChecked);
      syncWarehouseInventorySidebarVisibility(previousChecked);
      handleApiError(error, 'Update Warehouse Inventory Setting');
    }
  };

  const handleProductSearchCameraToggle = async (checked) => {
    const nextChecked = !!checked;
    const previousChecked = productSearchCameraEnabled;
    setProductSearchCameraEnabled(nextChecked);
    try {
      await updateCompanySettings({
        orderSettings: {
          ...(settings?.orderSettings || {}),
          productSearchCameraEnabled: nextChecked,
        },
      }).unwrap();
      toast.success(`Product search camera ${nextChecked ? 'enabled' : 'disabled'}.`);
      refetchSettings();
    } catch (error) {
      setProductSearchCameraEnabled(previousChecked);
      handleApiError(error, 'Update Product Search Camera Setting');
    }
  };

  const handleToggleTwoFactor = async (checked) => {
    setTwoFactorEnabled(!!checked);
    try {
      await updateUserPreferences({ twoFactorEnabled: !!checked }).unwrap();
      toast.success(`Two-factor authentication ${checked ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      setTwoFactorEnabled(!checked);
      handleApiError(error, 'Update 2FA Setting');
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center space-x-2">
          <BarChart3 className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold">Advanced Settings</h2>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Display options, financial guidance, and advanced controls
        </p>
      </div>
      <div className="card-content">
        <div className="page-container">
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Financial Help</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm text-gray-700">
              <div><strong>Sales:</strong> Total revenue from Sales Orders + Sales Invoices</div>
              <div><strong>Net Revenue:</strong> Sales minus discounts given</div>
              <div><strong>Purchase (COGS):</strong> Cost of goods purchased from suppliers</div>
              <div><strong>Gross Profit:</strong> Net Revenue - COGS (your margin)</div>
              <div><strong>Receipts:</strong> Total money received (Cash Receipts + Bank Receipts + Sales Invoice Payments)</div>
              <div><strong>Payments:</strong> Cash/Bank money paid (includes supplier payments + expenses)</div>
              <div><strong>Net Cash Flow:</strong> Total receipts minus total payments (cash position)</div>
            </div>
            <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded text-sm text-gray-800">
              <strong>Note:</strong> Receipts/Payments may include both sales/purchases and separate cash/bank transactions.
              For accurate accounting, check individual transaction pages.
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3 p-3.5 border border-gray-200 rounded-xl bg-white hover:border-blue-300 hover:shadow-md transition-all duration-200 group">
              <Checkbox
                id="accountLedgerShowReturn"
                className="w-5 h-5 rounded-md border-2 border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                checked={accountLedgerShowReturn}
                onCheckedChange={(checked) => {
                  setAccountLedgerShowReturn(checked);
                  localStorage.setItem('accountLedgerShowReturnColumn', String(checked));
                  toast.success(`Return column ${checked ? 'shown' : 'hidden'} in Account Ledger Summary`);
                  window.dispatchEvent(new Event('accountLedgerConfigChanged'));
                }}
              />
              <Label htmlFor="accountLedgerShowReturn" className="flex flex-col cursor-pointer group-hover:text-blue-700">
                <span className="text-sm font-semibold">Show Ledger Return</span>
                <span className="text-[10px] text-gray-400">Column in Ledger Summary</span>
              </Label>
            </div>

            <div className="flex items-center space-x-3 p-3.5 border border-gray-200 rounded-xl bg-white hover:border-blue-300 hover:shadow-md transition-all duration-200 group">
              <Checkbox
                id="showTopBarUI"
                className="w-5 h-5 rounded-md border-2 border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                checked={showTopBarUI}
                onCheckedChange={(checked) => {
                  setShowTopBarUI(checked);
                  localStorage.setItem('showTopBarUI', String(checked));
                  toast.success(`Top bar ${checked ? 'shown' : 'hidden'} in app layout`);
                  window.dispatchEvent(new Event('topBarVisibilityChanged'));
                }}
              />
              <Label htmlFor="showTopBarUI" className="flex flex-col cursor-pointer group-hover:text-blue-700">
                <span className="text-sm font-semibold">Show Top Bar</span>
                <span className="text-[10px] text-gray-400">Header visibility across pages</span>
              </Label>
            </div>

            <div className="flex items-center space-x-3 p-3.5 border border-gray-200 rounded-xl bg-white hover:border-blue-300 hover:shadow-md transition-all duration-200 group">
              <Checkbox
                id="useMarketPurchasePrices"
                className="w-5 h-5 rounded-md border-2 border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                checked={useMarketPurchasePrices}
                onCheckedChange={(checked) => handleMarketPriceFeatureToggle(!!checked)}
              />
              <Label htmlFor="useMarketPurchasePrices" className="flex flex-col cursor-pointer group-hover:text-blue-700">
                <span className="text-sm font-semibold">Enable Market Purchase Prices</span>
                <span className="text-[10px] text-gray-400">Uses Current Purchase Market Prices in Purchase and shows sidebar link</span>
              </Label>
            </div>

            <div className="flex items-center space-x-3 p-3.5 border border-gray-200 rounded-xl bg-white hover:border-blue-300 hover:shadow-md transition-all duration-200 group">
              <Checkbox
                id="enableImportPurchaseLandedCost"
                className="w-5 h-5 rounded-md border-2 border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                checked={enableImportPurchaseLandedCost}
                onCheckedChange={(checked) => handleImportPurchaseFeatureToggle(!!checked)}
              />
              <Label htmlFor="enableImportPurchaseLandedCost" className="flex flex-col cursor-pointer group-hover:text-blue-700">
                <span className="text-sm font-semibold">Enable Import Purchase Duties & Landed Cost</span>
                <span className="text-[10px] text-gray-400">When off (default), Import Purchase works like old purchase flow</span>
              </Label>
            </div>

            <div className="flex items-center space-x-3 p-3.5 border border-gray-200 rounded-xl bg-white hover:border-blue-300 hover:shadow-md transition-all duration-200 group">
              <Checkbox
                id="warehouseInventoryEnabled"
                className="w-5 h-5 rounded-md border-2 border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                checked={warehouseInventoryEnabled}
                onCheckedChange={(checked) => handleWarehouseInventoryToggle(!!checked)}
              />
              <Label htmlFor="warehouseInventoryEnabled" className="flex flex-col cursor-pointer group-hover:text-blue-700">
                <span className="text-sm font-semibold">Enable Warehouse Inventory</span>
                <span className="text-[10px] text-gray-400">When on: purchases go to warehouse, sales use shop stock, and stock transfers move warehouse → shop. Off by default.</span>
              </Label>
            </div>

            <div className="flex items-center space-x-3 p-3.5 border border-gray-200 rounded-xl bg-white hover:border-blue-300 hover:shadow-md transition-all duration-200 group">
              <Checkbox
                id="productSearchCameraEnabled"
                className="w-5 h-5 rounded-md border-2 border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                checked={productSearchCameraEnabled}
                onCheckedChange={(checked) => handleProductSearchCameraToggle(!!checked)}
              />
              <Label htmlFor="productSearchCameraEnabled" className="flex flex-col cursor-pointer group-hover:text-blue-700">
                <span className="text-sm font-semibold flex items-center gap-1.5">
                  <Camera className="h-4 w-4 text-gray-600" aria-hidden />
                  Show Product Search Camera
                </span>
                <span className="text-[10px] text-gray-400">Shows the camera scan button in Product Selection &amp; Cart (Sales, Purchases, etc.). Off by default.</span>
              </Label>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <OrderItemWiseConfirmationSettings />
          </div>

          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-start justify-between gap-4 p-4 border border-gray-200 rounded-xl bg-white">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Two-Factor Authentication (2FA)</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Require a one-time code after email/password login for this account.
                </p>
              </div>
              <Checkbox
                id="twoFactorEnabled"
                checked={twoFactorEnabled}
                disabled={isSavingUserPreferences}
                onCheckedChange={(checked) => handleToggleTwoFactor(!!checked)}
                className="w-5 h-5 rounded-md border-2 border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default AdvancedSettingsTab;
