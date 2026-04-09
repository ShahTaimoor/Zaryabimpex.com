import React from 'react';
import { toast } from 'sonner';
import { useGetCompanySettingsQuery, useUpdateCompanySettingsMutation } from '../store/services/settingsApi';
import { handleApiError } from '../utils/errorHandler';

export function OrderItemWiseConfirmationSettings() {
  const { data: settingsResponse } = useGetCompanySettingsQuery();
  const [updateCompanySettings, { isLoading: updating }] = useUpdateCompanySettingsMutation();

  const settings = settingsResponse?.data || settingsResponse;
  const orderSettings = settings?.orderSettings || {};
  const salesEnabled = orderSettings.salesOrderItemWiseConfirmation !== false;
  const purchaseEnabled = orderSettings.purchaseOrderItemWiseConfirmation !== false;
  const showRemainingStockAfterSale = orderSettings.showRemainingStockAfterSale !== false;
  const dualUnitShowBoxInput = orderSettings.dualUnitShowBoxInput !== false;
  const dualUnitShowPiecesInput = orderSettings.dualUnitShowPiecesInput !== false;
  const showSalesDiscountCode = orderSettings.showSalesDiscountCode === true;

  // Invoice Numbering Settings
  const invoiceSequenceEnabled = orderSettings.invoiceSequenceEnabled === true;
  const invoiceSequencePrefix = orderSettings.invoiceSequencePrefix || 'INV-';
  const invoiceSequenceNext = orderSettings.invoiceSequenceNext || 1;
  const invoiceSequencePadding = orderSettings.invoiceSequencePadding || 3;

  // Purchase Numbering Settings
  const purchaseSequenceEnabled = orderSettings.purchaseSequenceEnabled === true;
  const purchaseSequencePrefix = orderSettings.purchaseSequencePrefix || 'PUR-';
  const purchaseSequenceNext = orderSettings.purchaseSequenceNext || 1;
  const purchaseSequencePadding = orderSettings.purchaseSequencePadding || 3;

  const handleSalesChange = async (checked) => {
    try {
      await updateCompanySettings({
        orderSettings: { ...orderSettings, salesOrderItemWiseConfirmation: checked },
      }).unwrap();
      toast.success(checked ? 'Sales Order item-wise confirmation enabled' : 'Sales Order item-wise confirmation disabled');
    } catch (err) {
      handleApiError(err, 'Failed to update setting');
    }
  };

  const handlePurchaseChange = async (checked) => {
    try {
      await updateCompanySettings({
        orderSettings: { ...orderSettings, purchaseOrderItemWiseConfirmation: checked },
      }).unwrap();
      toast.success(checked ? 'Purchase Order item-wise confirmation enabled' : 'Purchase Order item-wise confirmation disabled');
    } catch (err) {
      handleApiError(err, 'Failed to update setting');
    }
  };

  const handleRemainingStockChange = async (checked) => {
    try {
      await updateCompanySettings({
        orderSettings: { ...orderSettings, showRemainingStockAfterSale: checked },
      }).unwrap();
      toast.success(
        checked
          ? '"After sale" stock hint enabled on Sales & Sales Orders'
          : '"After sale" stock hint disabled'
      );
    } catch (err) {
      handleApiError(err, 'Failed to update setting');
    }
  };

  const handleDualBoxChange = async (checked) => {
    try {
      await updateCompanySettings({
        orderSettings: { ...orderSettings, dualUnitShowBoxInput: checked },
      }).unwrap();
      toast.success(checked ? 'Box column shown for dual-unit products' : 'Box column hidden for dual-unit products');
    } catch (err) {
      handleApiError(err, 'Failed to update setting');
    }
  };

  const handleDualPiecesChange = async (checked) => {
    try {
      await updateCompanySettings({
        orderSettings: { ...orderSettings, dualUnitShowPiecesInput: checked },
      }).unwrap();
      toast.success(checked ? 'Pieces column shown for dual-unit products' : 'Pieces column hidden for dual-unit products');
    } catch (err) {
      handleApiError(err, 'Failed to update setting');
    }
  };

  const handleShowSalesDiscountCodeChange = async (checked) => {
    try {
      await updateCompanySettings({
        orderSettings: { ...orderSettings, showSalesDiscountCode: checked },
      }).unwrap();
      toast.success(checked ? 'Sales discount code dropdown shown' : 'Sales discount code dropdown hidden');
    } catch (err) {
      handleApiError(err, 'Failed to update setting');
    }
  };

  return (
    <>
      <label className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
        <input
          type="checkbox"
          checked={salesEnabled}
          onChange={(e) => handleSalesChange(e.target.checked)}
          disabled={updating}
          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <div>
          <div className="text-sm font-medium text-gray-900">Sales Order Item-wise Confirmation</div>
          <div className="text-xs text-gray-500">Enable checkbox selection and per-item confirm in Sales Orders view. Confirmed items are converted to invoice.</div>
        </div>
      </label>
      <label className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
        <input
          type="checkbox"
          checked={purchaseEnabled}
          onChange={(e) => handlePurchaseChange(e.target.checked)}
          disabled={updating}
          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <div>
          <div className="text-sm font-medium text-gray-900">Purchase Order Item-wise Confirmation</div>
          <div className="text-xs text-gray-500">Enable checkbox selection and per-item confirm in Purchase Orders view.</div>
        </div>
      </label>
      <label className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
        <input
          type="checkbox"
          checked={showRemainingStockAfterSale}
          onChange={(e) => handleRemainingStockChange(e.target.checked)}
          disabled={updating}
          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <div>
          <div className="text-sm font-medium text-gray-900">Show remaining stock after sale (POS &amp; Sales Orders)</div>
          <div className="text-xs text-gray-500">
            When entering quantity, show how much stock will be left (e.g. 1000 in stock, 1 box of 100 pcs → &quot;After sale: 900 pcs&quot;).
          </div>
        </div>
      </label>

      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/80 p-3 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 px-1">Dual units (box + pieces)</p>
        <label className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-white bg-white">
          <input
            type="checkbox"
            checked={dualUnitShowBoxInput}
            onChange={(e) => handleDualBoxChange(e.target.checked)}
            disabled={updating}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <div>
            <div className="text-sm font-medium text-gray-900">Show Box input</div>
            <div className="text-xs text-gray-500">
              Quantity fields for products with &quot;pieces per box&quot;: show the Box(es) column (POS, Sales Orders, Purchase Orders).
            </div>
          </div>
        </label>
        <label className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-white bg-white">
          <input
            type="checkbox"
            checked={dualUnitShowPiecesInput}
            onChange={(e) => handleDualPiecesChange(e.target.checked)}
            disabled={updating}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <div>
            <div className="text-sm font-medium text-gray-900">Show Pieces input</div>
            <div className="text-xs text-gray-500">
              Show the loose Pieces column. If both Box and Pieces are off, only a single total (pcs) field is shown.
            </div>
          </div>
        </label>
      </div>

      <label className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
        <input
          type="checkbox"
          checked={showSalesDiscountCode}
          onChange={(e) => handleShowSalesDiscountCodeChange(e.target.checked)}
          disabled={updating}
          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <div>
          <div className="text-sm font-medium text-gray-900">Show Discount Code in Sales</div>
          <div className="text-xs text-gray-500">
            Show or hide the discount code dropdown in the Sales payment panel.
          </div>
        </div>
      </label>

      {/* Invoice Numbering Settings */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Sales Invoice Numbering</h3>
            <p className="text-xs text-gray-500">Use custom sequential numbering for sales invoices instead of timestamp-based ones.</p>
          </div>
          <input
            type="checkbox"
            checked={invoiceSequenceEnabled}
            onChange={async (e) => {
              try {
                await updateCompanySettings({
                  orderSettings: { ...orderSettings, invoiceSequenceEnabled: e.target.checked },
                }).unwrap();
                toast.success(`Sequential invoice numbering ${e.target.checked ? 'enabled' : 'disabled'}`);
              } catch (err) {
                handleApiError(err, 'Failed to update numbering setting');
              }
            }}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
          />
        </div>

        {invoiceSequenceEnabled && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-100">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Prefix</label>
              <input
                type="text"
                value={invoiceSequencePrefix}
                onChange={async (e) => {
                  try {
                    await updateCompanySettings({
                      orderSettings: { ...orderSettings, invoiceSequencePrefix: e.target.value },
                    }).unwrap();
                  } catch (err) { /* silent */ }
                }}
                placeholder="INV-"
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Next Number</label>
              <input
                type="number"
                min="1"
                value={invoiceSequenceNext}
                onChange={async (e) => {
                  const val = parseInt(e.target.value) || 1;
                  try {
                    await updateCompanySettings({
                      orderSettings: { ...orderSettings, invoiceSequenceNext: val },
                    }).unwrap();
                  } catch (err) { /* silent */ }
                }}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Padding (Digits)</label>
              <select
                value={invoiceSequencePadding}
                onChange={async (e) => {
                  const val = parseInt(e.target.value);
                  try {
                    await updateCompanySettings({
                      orderSettings: { ...orderSettings, invoiceSequencePadding: val },
                    }).unwrap();
                  } catch (err) { /* silent */ }
                }}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
              >
                <option value={1}>1 (1)</option>
                <option value={2}>2 (01)</option>
                <option value={3}>3 (001)</option>
                <option value={4}>4 (0001)</option>
                <option value={5}>5 (00001)</option>
                <option value={6}>6 (000001)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Purchase Numbering Settings */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Purchase Invoice Numbering</h3>
            <p className="text-xs text-gray-500">Use custom sequential numbering for purchase invoices.</p>
          </div>
          <input
            type="checkbox"
            checked={purchaseSequenceEnabled}
            onChange={async (e) => {
              try {
                await updateCompanySettings({
                  orderSettings: { ...orderSettings, purchaseSequenceEnabled: e.target.checked },
                }).unwrap();
                toast.success(`Sequential purchase numbering ${e.target.checked ? 'enabled' : 'disabled'}`);
              } catch (err) {
                handleApiError(err, 'Failed to update numbering setting');
              }
            }}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
          />
        </div>

        {purchaseSequenceEnabled && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-100">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Prefix</label>
              <input
                type="text"
                value={purchaseSequencePrefix}
                onChange={async (e) => {
                  try {
                    await updateCompanySettings({
                      orderSettings: { ...orderSettings, purchaseSequencePrefix: e.target.value },
                    }).unwrap();
                  } catch (err) { /* silent */ }
                }}
                placeholder="PUR-"
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Next Number</label>
              <input
                type="number"
                min="1"
                value={purchaseSequenceNext}
                onChange={async (e) => {
                  const val = parseInt(e.target.value) || 1;
                  try {
                    await updateCompanySettings({
                      orderSettings: { ...orderSettings, purchaseSequenceNext: val },
                    }).unwrap();
                  } catch (err) { /* silent */ }
                }}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Padding (Digits)</label>
              <select
                value={purchaseSequencePadding}
                onChange={async (e) => {
                  const val = parseInt(e.target.value);
                  try {
                    await updateCompanySettings({
                      orderSettings: { ...orderSettings, purchaseSequencePadding: val },
                    }).unwrap();
                  } catch (err) { /* silent */ }
                }}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
              >
                <option value={1}>1 (1)</option>
                <option value={2}>2 (01)</option>
                <option value={3}>3 (001)</option>
                <option value={4}>4 (0001)</option>
                <option value={5}>5 (00001)</option>
                <option value={6}>6 (000001)</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
