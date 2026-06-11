import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import {
  useGetCompanySettingsQuery,
  useUpdateCompanySettingsMutation,
} from '../store/services/settingsApi';
import { useFetchCompanyQuery } from '../store/services/companyApi';
import { loadSidebarConfig, loadBottomNavConfig } from '../config/navigation';
import { loadTopBarConfig } from '../config/topBarConfig';
import { loadDashboardWidgetsConfig } from '../config/dashboardConfig';
import { handleApiError } from '../utils/errorHandler';
import { useAuth } from '../contexts/AuthContext';
import { PageLayout } from '@/components/layout/PageLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  SETTINGS_TABS,
  SettingsTabBar,
  CompanySettingsTab,
  SidebarSettingsTab,
  TopBarSettingsTab,
  MobileNavSettingsTab,
  DashboardSettingsTab,
  ProductSettingsTab,
  CustomerSettingsTab,
  SupplierSettingsTab,
  AdvancedSettingsTab,
  PrintSettingsTab,
  UsersSettingsTab,
} from './settings/index';

export const Settings2 = () => {
  const { hasPermission } = useAuth();

  const sidebarDefaultHiddenItems = useMemo(
    () =>
      new Set([
        'Import Purchase',
        'Current Purchase Market Prices',
        'Stock Transfers',
        'Daily Cash Closing',
      ]),
    []
  );

  const [activeTab, setActiveTab] = useState('company');

  const [companyData, setCompanyData] = useState({
    companyName: '',
    address: '',
    contactNumber: '',
    email: '',
    taxRegistrationNumber: '',
  });
  const [isSavingPrintSettings, setIsSavingPrintSettings] = useState(false);
  const [printSettings, setPrintSettings] = useState({
    showLogo: true,
    showCompanyDetails: true,
    showDiscount: true,
    showTax: false,
    showDate: true,
    showFooter: true,
    showCameraTime: false,
    showDescription: false,
    showEmail: false,
    showPrintBusinessName: true,
    showPrintContactName: false,
    showPrintAddress: true,
    showPrintCity: true,
    showPrintState: false,
    showPrintPostalCode: false,
    showPrintInvoiceNumber: true,
    showPrintInvoiceDate: true,
    showPrintInvoiceStatus: false,
    showPrintInvoiceType: false,
    showPrintPaymentStatus: true,
    showPrintPaymentMethod: true,
    showPrintPaymentAmount: false,
    showPrintLedgerBalance: true,
    autoPrintAfterSale: true,
    autoCompleteSaleAfterPrint: true,
    mobilePrintPreview: false,
    printSize: 'standard',
    headerText: '',
    footerText: '',
    receiptFooterText: '',
    invoiceLayout: 'standard',
    logoSize: 100,
    showThermalCustomerName: true,
    showThermalPaidBy: true,
    showThermalBarcode: true,
    showThermalBarcodeValue: true,
    showThermalFooter: true,
    showThermalPrintDate: true,
  });

  const sampleOrderData = useMemo(
    () => ({
      invoiceNumber: 'INV-PREVIEW',
      createdAt: new Date(),
      customer: {
        name: 'Walk-in Customer',
        displayName: 'Jane Smith',
        businessName: 'Sample Business Ltd',
        phone: '555-0123',
        email: 'jane@example.com',
        address: '123 Main Street',
        currentBalance: 15450.75,
        addresses: [
          {
            street: '123 Main Street',
            city: 'New York',
            state: 'NY',
            country: 'US',
            zipCode: '10001',
            isDefault: true,
          },
        ],
      },
      customerInfo: {
        name: 'Jane Smith',
        businessName: 'Sample Business Ltd',
        phone: '555-0123',
        email: 'jane@example.com',
        address: '123 Main Street, New York, NY, US, 10001',
      },
      items: [
        {
          name: 'Sample Item 1',
          quantity: 2,
          unitPrice: 50.0,
          total: 100.0,
          discount: 5.0,
          description: 'Premium quality item',
        },
        {
          name: 'Sample Item 2',
          quantity: 1,
          unitPrice: 25.0,
          total: 25.0,
          discount: 0,
          description: 'Standard item',
        },
      ],
      subtotal: 125.0,
      tax: 12.5,
      discount: 5.0,
      total: 132.5,
      payment: {
        method: 'Cash',
        status: 'Paid',
        amountPaid: 132.5,
      },
      billStartTime: new Date(Date.now() - 300000),
      billEndTime: new Date(),
    }),
    []
  );

  const [sidebarConfig, setSidebarConfig] = useState(() => loadSidebarConfig());
  const [topBarConfig, setTopBarConfig] = useState(() => loadTopBarConfig());
  const [dashboardWidgetsConfig, setDashboardWidgetsConfig] = useState(() =>
    loadDashboardWidgetsConfig()
  );
  const [bottomNavConfig, setBottomNavConfig] = useState(() => loadBottomNavConfig());

  const isSidebarItemEnabled = (itemName) => {
    const current = sidebarConfig?.[itemName];
    if (itemName === 'Dashboard' && current === undefined) {
      return false;
    }
    if (current === undefined && sidebarDefaultHiddenItems.has(itemName)) {
      return false;
    }
    return current !== false;
  };

  const { data: settingsResponse, refetch: refetchSettings } = useGetCompanySettingsQuery();
  const { data: companyApiResponse } = useFetchCompanyQuery();
  const [updateCompanySettings] = useUpdateCompanySettingsMutation();
  const settings = settingsResponse?.data || settingsResponse;
  const companyProfile = companyApiResponse?.data || {};

  useEffect(() => {
    if (!settings) return;

    setCompanyData({
      companyName: settings.companyName || '',
      address: settings.address || '',
      contactNumber: settings.contactNumber || '',
      email: settings.email || '',
      taxRegistrationNumber: settings.taxId || '',
    });

    if (settings.printSettings) {
      const ps = settings.printSettings;
      setPrintSettings((prev) => ({
        ...prev,
        showLogo: ps.showLogo ?? true,
        showCompanyDetails: ps.showCompanyDetails ?? true,
        showTax: ps.showTax ?? false,
        showDiscount: ps.showDiscount ?? true,
        showDate: ps.showDate ?? true,
        showFooter: ps.showFooter ?? true,
        showEmail: ps.showEmail ?? false,
        showCameraTime: ps.showCameraTime ?? false,
        showDescription: ps.showDescription ?? false,
        showProductImages: ps.showProductImages ?? true,
        showPrintBusinessName: ps.showPrintBusinessName ?? true,
        showPrintContactName: ps.showPrintContactName ?? false,
        showPrintAddress: ps.showPrintAddress ?? true,
        showPrintCity: ps.showPrintCity ?? true,
        showPrintState: ps.showPrintState ?? false,
        showPrintPostalCode: ps.showPrintPostalCode ?? false,
        showPrintInvoiceNumber: ps.showPrintInvoiceNumber ?? true,
        showPrintInvoiceDate: ps.showPrintInvoiceDate ?? true,
        showPrintInvoiceStatus: ps.showPrintInvoiceStatus ?? false,
        showPrintInvoiceType: ps.showPrintInvoiceType ?? false,
        showPrintPaymentStatus: ps.showPrintPaymentStatus ?? true,
        showPrintPaymentMethod: ps.showPrintPaymentMethod ?? true,
        showPrintPaymentAmount: ps.showPrintPaymentAmount ?? false,
        showPrintLedgerBalance: ps.showPrintLedgerBalance ?? true,
        autoPrintAfterSale: ps.autoPrintAfterSale ?? true,
        autoCompleteSaleAfterPrint: ps.autoCompleteSaleAfterPrint ?? true,
        mobilePrintPreview: ps.mobilePrintPreview ?? false,
        invoiceLayout: ps.invoiceLayout || 'standard',
        printSize: (ps.invoiceLayout || 'standard') === 'compact' ? '80mm' : 'standard',
        headerText: ps.headerText || '',
        footerText: ps.footerText || '',
        receiptFooterText: ps.receiptFooterText || '',
        logoSize: ps.logoSize ?? prev.logoSize ?? 100,
        showThermalCustomerName: ps.showThermalCustomerName ?? true,
        showThermalPaidBy: ps.showThermalPaidBy ?? true,
        showThermalBarcode: ps.showThermalBarcode ?? true,
        showThermalBarcodeValue: ps.showThermalBarcodeValue ?? true,
        showThermalFooter: ps.showThermalFooter ?? true,
        showThermalPrintDate: ps.showThermalPrintDate ?? true,
      }));
    }
  }, [settings]);

  useEffect(() => {
    refetchSettings();
  }, [refetchSettings]);

  const handlePrintSettingsChange = (e) => {
    const { name, value, type, checked } = e.target;
    const raw =
      type === 'checkbox'
        ? checked
        : type === 'number' || type === 'range'
          ? Number(value)
          : value;
    setPrintSettings((prev) => {
      const next = { ...prev, [name]: raw };
      if (name === 'invoiceLayout') {
        next.printSize = raw === 'compact' ? '80mm' : 'standard';
      }
      if (name === 'printSize' && raw === '80mm') {
        next.invoiceLayout = 'compact';
      }
      return next;
    });
  };

  const handleSavePrintSettings = async () => {
    setIsSavingPrintSettings(true);
    try {
      await updateCompanySettings({
        companyName: companyData.companyName,
        contactNumber: companyData.contactNumber,
        address: companyData.address,
        email: companyData.email,
        taxId: companyData.taxRegistrationNumber,
        printSettings,
      }).unwrap();
      toast.success('Print settings saved successfully!');
      refetchSettings();
    } catch (error) {
      handleApiError(error, 'Save Print Settings');
    } finally {
      setIsSavingPrintSettings(false);
    }
  };

  const tabs = SETTINGS_TABS.filter((tab) => !tab.permission || hasPermission(tab.permission));

  return (
    <PageLayout className="overflow-x-hidden">
      <PageHeader title="Settings" />

      <SettingsTabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="mt-6 w-full overflow-x-hidden">
        {activeTab === 'company' && <CompanySettingsTab />}

        {activeTab === 'users' && hasPermission('manage_users') && <UsersSettingsTab />}

        {activeTab === 'print' && hasPermission('manage_print_settings') && (
          <PrintSettingsTab
            printSettings={printSettings}
            handlePrintSettingsChange={handlePrintSettingsChange}
            handleSavePrintSettings={handleSavePrintSettings}
            isSavingPrintSettings={isSavingPrintSettings}
            companyData={companyData}
            companyProfile={companyProfile}
            sampleOrderData={sampleOrderData}
          />
        )}

        {activeTab === 'other' && hasPermission('manage_advanced_settings') && (
          <AdvancedSettingsTab setSidebarConfig={setSidebarConfig} />
        )}

        {activeTab === 'products' && hasPermission('manage_product_settings') && (
          <ProductSettingsTab />
        )}

        {activeTab === 'customers' && hasPermission('manage_customer_settings') && (
          <CustomerSettingsTab />
        )}

        {activeTab === 'suppliers' && hasPermission('manage_supplier_settings') && (
          <SupplierSettingsTab />
        )}

        {activeTab === 'dashboard' && (
          <DashboardSettingsTab
            sidebarConfig={sidebarConfig}
            setSidebarConfig={setSidebarConfig}
            isSidebarItemEnabled={isSidebarItemEnabled}
            dashboardWidgetsConfig={dashboardWidgetsConfig}
            setDashboardWidgetsConfig={setDashboardWidgetsConfig}
          />
        )}

        {activeTab === 'sidebar' && (
          <SidebarSettingsTab
            sidebarConfig={sidebarConfig}
            setSidebarConfig={setSidebarConfig}
            isSidebarItemEnabled={isSidebarItemEnabled}
          />
        )}

        {activeTab === 'topbar' && (
          <TopBarSettingsTab topBarConfig={topBarConfig} setTopBarConfig={setTopBarConfig} />
        )}

        {activeTab === 'mobile-nav' && (
          <MobileNavSettingsTab
            bottomNavConfig={bottomNavConfig}
            setBottomNavConfig={setBottomNavConfig}
          />
        )}
      </div>
    </PageLayout>
  );
};

export default Settings2;
