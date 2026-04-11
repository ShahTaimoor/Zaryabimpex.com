import React from 'react';
import { toast } from 'sonner';
import { 
  CheckSquare, 
  ShoppingCart, 
  Truck, 
  Database, 
  Package, 
  Layers, 
  Tag, 
  Eye, 
  DollarSign, 
  Hash, 
  Search,
  Settings,
  ShieldCheck,
  Layout
} from 'lucide-react';
import { useGetCompanySettingsQuery, useUpdateCompanySettingsMutation } from '../store/services/settingsApi';
import { handleApiError } from '../utils/errorHandler';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export function OrderItemWiseConfirmationSettings() {
  const { data: settingsResponse } = useGetCompanySettingsQuery();
  const [updateCompanySettings, { isLoading: updating }] = useUpdateCompanySettingsMutation();

  const settings = settingsResponse?.data || settingsResponse;
  const orderSettings = settings?.orderSettings || {};
  
  const [localSettings, setLocalSettings] = React.useState({});

  // Sync local state when settings change
  React.useEffect(() => {
    if (orderSettings) {
      setLocalSettings(orderSettings);
    }
  }, [orderSettings]);

  // Use local state for immediate feedback
  const salesEnabled = localSettings.salesOrderItemWiseConfirmation !== false;
  const purchaseEnabled = localSettings.purchaseOrderItemWiseConfirmation !== false;
  const showRemainingStockAfterSale = localSettings.showRemainingStockAfterSale !== false;
  const dualUnitShowBoxInput = localSettings.dualUnitShowBoxInput !== false;
  const dualUnitShowPiecesInput = localSettings.dualUnitShowPiecesInput !== false;
  const showSalesDiscountCode = localSettings.showSalesDiscountCode === true;
  const allowSaleWithoutProduct = localSettings.allowSaleWithoutProduct === true;
  const showCostPrice = localSettings.showCostPrice === true;
  const allowManualCostPrice = localSettings.allowManualCostPrice === true;

  // Invoice Numbering Settings
  const invoiceSequenceEnabled = localSettings.invoiceSequenceEnabled === true;
  const invoiceSequencePrefix = localSettings.invoiceSequencePrefix || 'INV-';
  const invoiceSequenceNext = localSettings.invoiceSequenceNext || 1;
  const invoiceSequencePadding = localSettings.invoiceSequencePadding || 3;

  // Purchase Numbering Settings
  const purchaseSequenceEnabled = localSettings.purchaseSequenceEnabled === true;
  const purchaseSequencePrefix = localSettings.purchaseSequencePrefix || 'PUR-';
  const purchaseSequenceNext = localSettings.purchaseSequenceNext || 1;
  const purchaseSequencePadding = localSettings.purchaseSequencePadding || 3;

  const updateSetting = async (key, value, toastMsg) => {
    // Optimistically update local state
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    
    try {
      const currentOrderSettings = (settingsResponse?.data?.orderSettings || settingsResponse?.orderSettings || {});
      await updateCompanySettings({
        orderSettings: { ...currentOrderSettings, [key]: value },
      }).unwrap();
      if (toastMsg) toast.success(toastMsg);
    } catch (err) {
      // Revert local state on error
      setLocalSettings(orderSettings);
      handleApiError(err, 'Failed to update setting');
    }
  };

  const SettingCard = ({ icon: Icon, title, description, checked, onChange, id, color="blue", disabled=false }) => (
    <div className={`flex items-start space-x-3 p-4 border rounded-xl bg-white shadow-sm hover:border-${color}-300 hover:shadow-md transition-all duration-300 group ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="pt-1">
        <Checkbox 
          id={id} 
          checked={checked} 
          onCheckedChange={onChange}
          disabled={updating || disabled}
          className={`w-5 h-5 rounded-md border-2 border-gray-300 data-[state=checked]:bg-${color}-600 data-[state=checked]:border-${color}-600`}
        />
      </div>
      <Label htmlFor={id} className="flex flex-col cursor-pointer flex-1 space-y-1">
        <div className="flex items-center space-x-2">
          {Icon && <Icon className={`h-4 w-4 text-${color}-500`} />}
          <span className="text-sm font-bold text-gray-900 group-hover:text-blue-700">{title}</span>
        </div>
        <span className="text-[11px] text-gray-500 leading-relaxed font-medium">{description}</span>
      </Label>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Core Logic Toggles */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-gray-200"></div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Order System Operations</h3>
          <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-gray-200"></div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SettingCard 
            id="allowSaleWithoutProduct"
            icon={Package}
            title="Manual Item Sales"
            description="Allow selling items not in catalog (Manual entry)"
            checked={allowSaleWithoutProduct}
            onChange={(val) => updateSetting('allowSaleWithoutProduct', val, val ? 'Manual item entry enabled' : 'Manual item entry disabled')}
            color="emerald"
          />

          <SettingCard 
            id="allowManualCostPrice"
            icon={ShieldCheck}
            title="Manual Item Cost"
            description="Enable cost price input for manual sale items"
            checked={allowManualCostPrice}
            onChange={(val) => updateSetting('allowManualCostPrice', val, val ? 'Manual cost price enabled' : 'Manual cost price disabled')}
            color="indigo"
            disabled={!allowSaleWithoutProduct}
          />

          <SettingCard 
            id="showCostPrice"
            icon={Eye}
            title="Cost Visibility"
            description="Show cost prices in lists, POS, and reports"
            checked={showCostPrice}
            onChange={(val) => updateSetting('showCostPrice', val, val ? 'Cost price visibility enabled' : 'Cost price visibility disabled')}
            color="amber"
          />

          <SettingCard 
            id="salesOrderItemWiseConfirmation"
            icon={ShoppingCart}
            title="Sales Confirmation"
            description="Item-wise checklist before converting to Invoice"
            checked={salesEnabled}
            onChange={(val) => updateSetting('salesOrderItemWiseConfirmation', val, val ? 'Sales item-wise confirmation enabled' : 'Sales item-wise confirmation disabled')}
            color="blue"
          />

          <SettingCard 
            id="purchaseOrderItemWiseConfirmation"
            icon={Truck}
            title="Purchase Confirmation"
            description="Per-item check in Purchase Orders workflow"
            checked={purchaseEnabled}
            onChange={(val) => updateSetting('purchaseOrderItemWiseConfirmation', val, val ? 'Purchase item-wise confirmation enabled' : 'Purchase item-wise confirmation disabled')}
            color="violet"
          />

          <SettingCard 
            id="showRemainingStockAfterSale"
            icon={Database}
            title="Stock Predictions"
            description="Show remaining stock hint during sale entry"
            checked={showRemainingStockAfterSale}
            onChange={(val) => updateSetting('showRemainingStockAfterSale', val, val ? 'Stock hint enabled' : 'Stock hint disabled')}
            color="rose"
          />
        </div>
      </div>

      {/* Interface Options */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-gray-200"></div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Inventory UI & Financials</h3>
          <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-gray-200"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SettingCard 
            id="dualUnitShowBoxInput"
            icon={Layers}
            title="Show Box Input"
            description="Display 'Boxes' column for dual-unit products"
            checked={dualUnitShowBoxInput}
            onChange={(val) => updateSetting('dualUnitShowBoxInput', val, val ? 'Box column enabled' : 'Box column disabled')}
            color="sky"
          />

          <SettingCard 
            id="dualUnitShowPiecesInput"
            icon={Hash}
            title="Show Pieces Input"
            description="Display 'Pieces' column for dual-unit items"
            checked={dualUnitShowPiecesInput}
            onChange={(val) => updateSetting('dualUnitShowPiecesInput', val, val ? 'Pieces column enabled' : 'Pieces column disabled')}
            color="cyan"
          />

          <SettingCard 
            id="showSalesDiscountCode"
            icon={Tag}
            title="Sales Discount"
            description="Show discount code selector in POS panel"
            checked={showSalesDiscountCode}
            onChange={(val) => updateSetting('showSalesDiscountCode', val, val ? 'Discount selector enabled' : 'Discount selector disabled')}
            color="teal"
          />
        </div>
      </div>

      {/* Numbering Schemes */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-gray-200"></div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Document Numbering</h3>
          <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-gray-200"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales Sequence */}
          <div className="bg-white border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
            <div className="bg-blue-50/50 p-4 border-b flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                  <Layout className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Sales Invoice Sequence</h4>
                  <p className="text-[10px] text-gray-500 font-medium caps">Sequential vs Timestamp</p>
                </div>
              </div>
              <Checkbox 
                id="invoiceSequenceEnabled"
                checked={invoiceSequenceEnabled}
                onCheckedChange={(val) => updateSetting('invoiceSequenceEnabled', val, `Sequential Sales numbering ${val ? 'enabled' : 'disabled'}`)}
              />
            </div>
            
            <div className={`p-5 space-y-4 transition-all duration-300 ${!invoiceSequenceEnabled ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-gray-600">Prefix</Label>
                  <Input 
                    value={invoiceSequencePrefix}
                    onChange={(e) => updateSetting('invoiceSequencePrefix', e.target.value)}
                    className="h-8 text-xs font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-gray-600">Next #</Label>
                  <Input 
                    type="number"
                    value={invoiceSequenceNext}
                    onChange={(e) => updateSetting('invoiceSequenceNext', parseInt(e.target.value) || 1)}
                    className="h-8 text-xs font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-gray-600">Padding</Label>
                  <select 
                    value={String(invoiceSequencePadding)}
                    onChange={(e) => updateSetting('invoiceSequencePadding', parseInt(e.target.value))}
                    className="w-full h-8 text-xs font-bold border border-gray-200 rounded px-2 outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    {[1,2,3,4,5,6].map(v => (
                      <option key={v} value={String(v)}>
                        {v} {v > 1 ? `Digits` : '(No padding)'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-[10px] text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-lg font-bold border border-blue-100/50">
                Preview: <span className="underline">{invoiceSequencePrefix}{String(invoiceSequenceNext).padStart(invoiceSequencePadding, '0')}</span>
              </p>
            </div>
          </div>

          {/* Purchase Sequence */}
          <div className="bg-white border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
            <div className="bg-indigo-50/50 p-4 border-b flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                  <Settings className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Purchase Order Sequence</h4>
                  <p className="text-[10px] text-gray-500 font-medium caps">Document ID format</p>
                </div>
              </div>
              <Checkbox 
                id="purchaseSequenceEnabled"
                checked={purchaseSequenceEnabled}
                onCheckedChange={(val) => updateSetting('purchaseSequenceEnabled', val, `Sequential Purchase numbering ${val ? 'enabled' : 'disabled'}`)}
              />
            </div>
            
            <div className={`p-5 space-y-4 transition-all duration-300 ${!purchaseSequenceEnabled ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-gray-600">Prefix</Label>
                  <Input 
                    value={purchaseSequencePrefix}
                    onChange={(e) => updateSetting('purchaseSequencePrefix', e.target.value)}
                    className="h-8 text-xs font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-gray-600">Next #</Label>
                  <Input 
                    type="number"
                    value={purchaseSequenceNext}
                    onChange={(e) => updateSetting('purchaseSequenceNext', parseInt(e.target.value) || 1)}
                    className="h-8 text-xs font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold text-gray-600">Padding</Label>
                  <select 
                    value={String(purchaseSequencePadding)}
                    onChange={(e) => updateSetting('purchaseSequencePadding', parseInt(e.target.value))}
                    className="w-full h-8 text-xs font-bold border border-gray-200 rounded px-2 outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    {[1,2,3,4,5,6].map(v => (
                      <option key={v} value={String(v)}>
                        {v} Digits
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-[10px] text-indigo-600 bg-indigo-50 px-2.5 py-1.5 rounded-lg font-bold border border-indigo-100/50">
                Preview: <span className="underline">{purchaseSequencePrefix}{String(purchaseSequenceNext).padStart(purchaseSequencePadding, '0')}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
