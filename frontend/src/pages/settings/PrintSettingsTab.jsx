import React, { memo } from 'react';
import {
  Printer,
  Building,
  Mail,
  FileText,
  Eye,
  Clock,
  BarChart3,
  Users,
  Save,
} from 'lucide-react';
import { LoadingButton } from '../../components/LoadingSpinner';
import PrintDocument from '../../components/PrintDocument';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export const PrintSettingsTab = memo(function PrintSettingsTab({
  printSettings,
  handlePrintSettingsChange,
  handleSavePrintSettings,
  isSavingPrintSettings,
  companyData,
  companyProfile,
  sampleOrderData,
}) {
  return (
<div className="card">
  <div className="card-header">
    <div className="flex items-center space-x-2">
      <Printer className="h-5 w-5 text-gray-600" />
      <h2 className="text-lg font-semibold">Print Preview Settings</h2>
    </div>
    <p className="text-sm text-gray-600 mt-1">
      Customize how your invoices and receipts appear when printed
    </p>
  </div>

  <div className="card-content">
    <div className="space-y-6">
      {/* Print Layout Selection */}
      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-3">
          Print Layout
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className={`flex items-center p-3.5 border rounded-xl cursor-pointer transition-all ${printSettings.invoiceLayout === 'standard' ? 'border-gray-900 bg-gray-900/5' : 'border-gray-200 hover:bg-gray-50'}`}>
            <input
              type="radio"
              name="invoiceLayout"
              value="standard"
              checked={printSettings.invoiceLayout === 'standard'}
              onChange={handlePrintSettingsChange}
              className="mr-3 h-4 w-4 accent-gray-900"
            />
            <div>
              <div className="text-sm font-semibold text-gray-900">Print 1 (Professional)</div>
              
            </div>
          </label>

          <label className={`flex items-center p-3.5 border rounded-xl cursor-pointer transition-all ${printSettings.invoiceLayout === 'layout2' ? 'border-gray-900 bg-gray-900/5' : 'border-gray-200 hover:bg-gray-50'}`}>
            <input
              type="radio"
              name="invoiceLayout"
              value="layout2"
              checked={printSettings.invoiceLayout === 'layout2'}
              onChange={handlePrintSettingsChange}
              className="mr-3 h-4 w-4 accent-gray-900"
            />
            <div>
              <div className="text-sm font-semibold text-gray-900">Print 2 (Standard)</div>
            </div>
          </label>

          <label className={`flex items-center p-3.5 border rounded-xl cursor-pointer transition-all ${printSettings.invoiceLayout === 'compact' ? 'border-gray-900 bg-gray-900/5' : 'border-gray-200 hover:bg-gray-50'}`}>
            <input
              type="radio"
              name="invoiceLayout"
              value="compact"
              checked={printSettings.invoiceLayout === 'compact'}
              onChange={handlePrintSettingsChange}
              className="mr-3 h-4 w-4 accent-gray-900"
            />
            <div>
              <div className="text-sm font-semibold text-gray-900">Print 3 (80mm Thermal)</div>
            </div>
          </label>
        </div>
      </div>

      {/* Header and Footer Customization - Hidden for Layout 2 */}
      {printSettings.invoiceLayout !== 'layout2' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Header Text (Optional)
            </label>
            <Textarea
              name="headerText"
              value={printSettings.headerText}
              onChange={handlePrintSettingsChange}
              placeholder="Enter custom header text"
              rows={3}
            />
            <p className="text-xs text-gray-500 mt-1">
              This text will appear at the top of printed documents
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Footer Text (Optional)
            </label>
            <Textarea
              name="footerText"
              value={printSettings.footerText}
              onChange={handlePrintSettingsChange}
              placeholder="Enter custom footer text"
              rows={3}
            />
            <p className="text-xs text-gray-500 mt-1">
              This text will appear at the bottom of printed documents
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Receipt Footer Message (Optional)
            </label>
            <Textarea
              name="receiptFooterText"
              value={printSettings.receiptFooterText}
              onChange={handlePrintSettingsChange}
              placeholder={"Example:\nThank you for shopping!\nPlease come again."}
              rows={3}
            />
            <p className="text-xs text-gray-500 mt-1">
              Multiline message shown at the bottom of printed receipts
            </p>
          </div>
        </div>
      )}

      {/* Display Options - these apply to all print previews and printed documents (Sales/Purchase Invoice, Sales/Purchase Order) */}
      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-2">
          Display Options
        </label>
        <p className="text-xs text-gray-500 mb-6">
          Control what appears on printed invoices and receipts. Uncheck to hide elements anywhere print is used.
        </p>

        <div className="space-y-8">
          {/* General Header Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 border-b border-gray-100 pb-2">
              <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600"><Printer className="h-4 w-4" /></div>
              <h4 className="text-sm font-bold text-gray-700">General Header & Layout</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Logo Size Control (Special) */}
              <div className="col-span-1 sm:col-span-2 p-4 border border-blue-100 rounded-xl bg-blue-50/20 shadow-sm flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                    Logo Scale
                  </div>
                  <div className="text-xs font-black text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full">{printSettings.logoSize || 100}px</div>
                </div>
                <input
                  type="range"
                  name="logoSize"
                  min="30"
                  max="350"
                  step="5"
                  value={printSettings.logoSize || 100}
                  onChange={handlePrintSettingsChange}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                  <span>Min</span>
                  <span>Balanced</span>
                  <span>Max</span>
                </div>
              </div>

              {/* Standard Toggle Boxes — filtered per layout */}
              {[
                { id: 'showLogo', label: 'Display Logo', icon: <Printer className="h-3.5 w-3.5" />, layouts: ['standard', 'layout2'] },
                { id: 'showCompanyDetails', label: 'Company Header', icon: <Building className="h-3.5 w-3.5" />, layouts: ['standard', 'layout2'] },
                { id: 'showEmail', label: 'Show Email', icon: <Mail className="h-3.5 w-3.5" />, layouts: ['standard', 'layout2'] },
                { id: 'showFooter', label: 'Show Footer', icon: <FileText className="h-3.5 w-3.5" />, layouts: ['standard', 'layout2'] },
                { id: 'mobilePrintPreview', label: 'Mobile View', icon: <Eye className="h-3.5 w-3.5" />, layouts: ['standard'] },
                { id: 'showDate', label: 'Doc Date', icon: <Clock className="h-3.5 w-3.5" />, layouts: ['standard', 'layout2'] },
              ].filter(item => !item.layouts || item.layouts.includes(printSettings.invoiceLayout)).map(item => (
                <div key={item.id} className="flex items-center space-x-3 p-3.5 border border-gray-200 rounded-xl bg-white hover:border-blue-300 hover:shadow-md transition-all duration-200 group">
                  <Checkbox
                    id={item.id}
                    className="w-5 h-5 rounded-md border-2 border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    checked={printSettings[item.id]}
                    onCheckedChange={(checked) => handlePrintSettingsChange({ target: { name: item.id, type: 'checkbox', checked } })}
                  />
                  <Label htmlFor={item.id} className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer group-hover:text-blue-700">
                    <div className="p-1.5 bg-gray-50 rounded-lg text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">{item.icon}</div>
                    {item.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Table & Financial Details Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 border-b border-gray-100 pb-2">
              <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600"><BarChart3 className="h-4 w-4" /></div>
              <h4 className="text-sm font-bold text-gray-700">Financials & Table Info</h4>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { id: 'showTax', label: 'Tax Breakdown', layouts: ['standard'] },
                { id: 'showDiscount', label: 'Discounts', layouts: ['standard', 'layout2'] },
                { id: 'showDescription', label: 'Item Desc', layouts: ['standard', 'layout2'] },
                { id: 'showCameraTime', label: 'Cam Timestamp', layouts: ['standard'] },
              ].filter(item => !item.layouts || item.layouts.includes(printSettings.invoiceLayout)).map(item => (
                <div key={item.id} className="flex items-center space-x-3 p-3.5 border border-gray-200 rounded-xl bg-white hover:border-emerald-300 hover:shadow-md transition-all duration-200 group">
                  <Checkbox
                    id={item.id}
                    className="w-5 h-5 rounded-md border-2 border-gray-300 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                    checked={printSettings[item.id]}
                    onCheckedChange={(checked) => handlePrintSettingsChange({ target: { name: item.id, type: 'checkbox', checked } })}
                  />
                  <Label htmlFor={item.id} className="text-sm font-semibold text-gray-700 cursor-pointer group-hover:text-emerald-700">
                    {item.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Party Details Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 border-b border-gray-100 pb-2">
              <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600"><Users className="h-4 w-4" /></div>
              <h4 className="text-sm font-bold text-gray-700">Party / Billing Details</h4>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { id: 'showPrintBusinessName', label: 'Business Name', layouts: ['standard', 'layout2'] },
                { id: 'showPrintContactName', label: 'Contact Name', layouts: ['standard'] },
                { id: 'showPrintAddress', label: 'Full Address', layouts: ['standard', 'layout2'] },
                { id: 'showPrintCity', label: 'City', layouts: ['standard', 'layout2'] },
                { id: 'showPrintState', label: 'State / Prov', layouts: ['standard'] },
                { id: 'showPrintPostalCode', label: 'Postal Code', layouts: ['standard'] },
              ].filter(item => !item.layouts || item.layouts.includes(printSettings.invoiceLayout)).map(item => (
                <div key={item.id} className="flex items-center space-x-3 p-3.5 border border-gray-200 rounded-xl bg-white hover:border-amber-300 hover:shadow-md transition-all duration-200 group">
                  <Checkbox
                    id={item.id}
                    className="w-5 h-5 rounded-md border-2 border-gray-300 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                    checked={printSettings[item.id]}
                    onCheckedChange={(checked) => handlePrintSettingsChange({ target: { name: item.id, type: 'checkbox', checked } })}
                  />
                  <Label htmlFor={item.id} className="text-sm font-semibold text-gray-700 cursor-pointer group-hover:text-amber-700">
                    {item.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Invoice Meta Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 border-b border-gray-100 pb-2">
              <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600"><FileText className="h-4 w-4" /></div>
              <h4 className="text-sm font-bold text-gray-700">Invoice Meta & Payment</h4>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { id: 'showPrintInvoiceNumber', label: 'Invoice #', layouts: ['standard', 'layout2'] },
                { id: 'showPrintInvoiceDate', label: 'Inv Date', layouts: ['standard', 'layout2'] },
                { id: 'showPrintInvoiceStatus', label: 'Doc Status', layouts: ['standard'] },
                { id: 'showPrintInvoiceType', label: 'Doc Type', layouts: ['standard'] },
                { id: 'showPrintPaymentStatus', label: 'Pay Status', layouts: ['standard'] },
                { id: 'showPrintPaymentMethod', label: 'Pay Method', layouts: ['standard'] },
                { id: 'showPrintPaymentAmount', label: 'Pay Amount', layouts: ['standard'] },
                { id: 'showPrintLedgerBalance', label: 'Ledger balance on invoice', layouts: ['standard', 'layout2'] },
              ].filter(item => !item.layouts || item.layouts.includes(printSettings.invoiceLayout)).map(item => (
                <div key={item.id} className="flex items-center space-x-3 p-3.5 border border-gray-200 rounded-xl bg-white hover:border-indigo-300 hover:shadow-md transition-all duration-200 group">
                  <Checkbox
                    id={item.id}
                    className="w-5 h-5 rounded-md border-2 border-gray-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                    checked={printSettings[item.id]}
                    onCheckedChange={(checked) => handlePrintSettingsChange({ target: { name: item.id, type: 'checkbox', checked } })}
                  />
                  <Label htmlFor={item.id} className="text-sm font-semibold text-gray-700 cursor-pointer group-hover:text-indigo-700">
                    {item.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Thermal Receipt (80mm) Options */}
          {printSettings.invoiceLayout === 'compact' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 border-b border-gray-100 pb-2">
                <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600"><Printer className="h-4 w-4" /></div>
                <h4 className="text-sm font-bold text-gray-700">Thermal Receipt (80mm) Options</h4>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { id: 'showThermalCustomerName', label: 'Customer Name' },
                  { id: 'showThermalPaidBy', label: 'Date Paid / Paid By' },
                  { id: 'showThermalBarcode', label: 'Barcode' },
                  { id: 'showThermalBarcodeValue', label: 'Barcode Value' },
                  { id: 'showThermalFooter', label: 'Thank You for Shopping' },
                  { id: 'showThermalPrintDate', label: 'Print Date' },
                ].map(item => (
                  <div key={item.id} className="flex items-center space-x-3 p-3.5 border border-gray-200 rounded-xl bg-white hover:border-blue-300 hover:shadow-md transition-all duration-200 group">
                    <Checkbox
                      id={item.id}
                      className="w-5 h-5 rounded-md border-2 border-gray-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      checked={printSettings[item.id] !== false}
                      onCheckedChange={(checked) => handlePrintSettingsChange({ target: { name: item.id, type: 'checkbox', checked } })}
                    />
                    <Label htmlFor={item.id} className="text-sm font-semibold text-gray-700 cursor-pointer group-hover:text-blue-700">
                      {item.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Post-Print Behavior */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 border-b border-gray-100 pb-2">
              <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600"><Save className="h-4 w-4" /></div>
              <h4 className="text-sm font-bold text-gray-700">Post-Print Behavior</h4>
            </div>
            <div className="flex items-start space-x-3 p-3.5 border border-gray-200 rounded-xl bg-white hover:border-emerald-300 hover:shadow-md transition-all duration-200 group">
              <Checkbox
                id="autoPrintAfterSale"
                className="mt-0.5 w-5 h-5 rounded-md border-2 border-gray-300 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                checked={printSettings.autoPrintAfterSale}
                onCheckedChange={(checked) => handlePrintSettingsChange({ target: { name: 'autoPrintAfterSale', type: 'checkbox', checked } })}
              />
              <Label htmlFor="autoPrintAfterSale" className="flex flex-col cursor-pointer">
                <span className="text-sm font-semibold text-gray-700 group-hover:text-emerald-700">Auto-print after sale</span>
                <span className="text-xs text-gray-500 mt-1">
                  If checked, the print dialog opens automatically after sale completion. If unchecked, no automatic print dialog will appear.
                </span>
              </Label>
            </div>

          </div>
        </div>
      </div>

      {/* Print Preview */}
      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-2">
          Live Receipt Preview
        </label>
        <p className="text-xs text-gray-500 mb-4">
          Preview changes by selected layout: Standard, Compact (80mm thermal), or Layout 2 (Professional).
          {(!companyData.companyName && !companyData.address && !companyData.contactNumber) && (
            <span className="text-orange-600 font-medium"> Please save your company information first to see the preview.</span>
          )}
        </p>

        {printSettings.invoiceLayout === 'compact' ? (
          <div className="bg-gray-200 border border-gray-300 rounded-2xl p-3 sm:p-6 overflow-auto flex justify-center items-start min-h-[460px] shadow-inner">
            <div
              style={{ width: '80mm', maxWidth: '100%' }}
              className="bg-white text-black border border-black/30 rounded-md shadow-lg mx-auto transition-all duration-300 overflow-hidden"
            >
              <PrintDocument
                companySettings={{ ...companyData, logo: companyProfile.logo || companyData.logo }}
                orderData={sampleOrderData}
                printSettings={printSettings}
                documentTitle="Receipt Preview"
              />
            </div>
          </div>
        ) : (
          <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-4 md:p-8 overflow-auto flex justify-center items-start min-h-[420px] max-h-[80dvh] shadow-inner">
            <div
              style={printSettings.mobilePrintPreview ? { maxWidth: 420, width: '100%' } : { maxWidth: 900, width: '100%' }}
              className="transition-all duration-300 ease-in-out"
            >
              <PrintDocument
                companySettings={{ ...companyData, logo: companyProfile.logo || companyData.logo }}
                orderData={sampleOrderData}
                printSettings={printSettings}
                documentTitle="Receipt Preview"
              />
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t">
        <LoadingButton
          type="button"
          isLoading={isSavingPrintSettings}
          onClick={(e) => {
            e.preventDefault();
            handleSavePrintSettings();
          }}
          variant="default"
        >
          <Save className="h-4 w-4 mr-2" />
          Save Print Settings
        </LoadingButton>
      </div>
    </div>
  </div>
</div>
  );
});

export default PrintSettingsTab;
