import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ErrorProvider } from './contexts/ErrorContext';
import { TabProvider } from './contexts/TabContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { MultiTabLayout } from './components/MultiTabLayout';
import ErrorBoundary from './components/ErrorBoundary';
import NetworkStatus from './components/NetworkStatus';
import OfflineIndicator from './components/OfflineIndicator';
import { LoadingPage } from './components/LoadingSpinner';
import { PERMISSIONS } from './config/rbacConfig';
import SyncManager from './services/SyncManager';

// Critical components - load immediately (small, frequently used)
import { Login } from './pages/Login';

// Lazy load all pages for code splitting (Dashboard lazy so ComponentRegistry/componentUtils dynamic imports work)
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));

const SalesOrders = lazy(() => import('./pages/SalesOrders'));
const Sales = lazy(() => import('./pages/Sales').then(m => ({ default: m.Sales })));
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders').then(m => ({ default: m.PurchaseOrders })));
const PurchaseInvoices = lazy(() => import('./pages/PurchaseInvoices').then(m => ({ default: m.PurchaseInvoices })));
const Purchase = lazy(() => import('./pages/Purchase').then(m => ({ default: m.Purchase })));
const Products = lazy(() => import('./pages/Products'));
const Customers = lazy(() => import('./pages/Customers').then(m => ({ default: m.Customers })));
const Suppliers = lazy(() => import('./pages/Suppliers').then(m => ({ default: m.Suppliers })));
const SalesInvoices = lazy(() => import('./pages/Orders').then(m => ({ default: m.Orders })));
const Inventory = lazy(() => import('./pages/Inventory').then(m => ({ default: m.Inventory })));
const InventoryAlerts = lazy(() => import('./pages/InventoryAlerts'));
const CustomerAnalytics = lazy(() => import('./pages/CustomerAnalytics'));
const AnomalyDetection = lazy(() => import('./pages/AnomalyDetection'));
const Warehouses = lazy(() => import('./pages/Warehouses'));

const PLStatements = lazy(() => import('./pages/PLStatements').then(m => ({ default: m.PLStatements })));
const BalanceSheetStatement = lazy(() => import('./pages/BalanceSheetStatement').then(m => ({ default: m.BalanceSheetStatement })));
const SaleReturns = lazy(() => import('./pages/SaleReturns'));
const PurchaseReturns = lazy(() => import('./pages/PurchaseReturns'));
const PurchaseBySupplierReport = lazy(() => import('./pages/PurchaseBySupplierReport'));
const Discounts = lazy(() => import('./pages/Discounts'));
const SalesPerformanceReports = lazy(() => import('./pages/SalesPerformanceReports'));
const InventoryReports = lazy(() => import('./pages/InventoryReports'));
const CashReceipts = lazy(() => import('./pages/CashReceipts'));
const CashReceiving = lazy(() => import('./pages/CashReceiving'));
const CashPayments = lazy(() => import('./pages/CashPayments'));
const Cities = lazy(() => import('./pages/Cities'));
const Expenses = lazy(() => import('./pages/Expenses'));
const BankReceipts = lazy(() => import('./pages/BankReceipts'));
const BankPayments = lazy(() => import('./pages/BankPayments'));
const Reports = lazy(() => import('./pages/Reports').then(m => ({ default: m.Reports })));
const Settings2 = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings2 })));
const StockMovements = lazy(() => import('./pages/StockMovements').then(m => ({ default: m.StockMovements })));
const ChartOfAccounts = lazy(() => import('./pages/ChartOfAccounts'));
const AccountLedgerSummary = lazy(() => import('./pages/AccountLedgerSummary'));
const Migration = lazy(() => import('./pages/Migration'));
const BackdateReport = lazy(() => import('./pages/BackdateReport'));
const Categories = lazy(() => import('./pages/Categories'));
const Investors = lazy(() => import('./pages/Investors'));
const Help = lazy(() => import('./pages/Help').then(m => ({ default: m.Help })));
const DropShipping = lazy(() => import('./pages/DropShipping'));
const JournalVouchers = lazy(() => import('./pages/JournalVouchers'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Employees = lazy(() => import('./pages/Employees'));
const ProductVariants = lazy(() => import('./pages/ProductVariants'));
const ProductTransformations = lazy(() => import('./pages/ProductTransformations'));
const CCTVAccess = lazy(() => import('./pages/CCTVAccess'));

function App() {
  useEffect(() => {
    // Initialize offline sync manager
    SyncManager.init();
  }, []);

  return (
    <ErrorBoundary>
      <ErrorProvider>
        <TabProvider>
          <NetworkStatus />
          <OfflineIndicator />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <MultiTabLayout>
                    <Routes>
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      <Route path="/dashboard" element={<Suspense fallback={<LoadingPage />}><Dashboard /></Suspense>} />
                      <Route path="/sales-orders" element={<Suspense fallback={<LoadingPage />}><SalesOrders /></Suspense>} />
                      <Route path="/sales" element={<Suspense fallback={<LoadingPage />}><Sales /></Suspense>} />
                      <Route path="/purchase-orders" element={<Suspense fallback={<LoadingPage />}><PurchaseOrders /></Suspense>} />
                      <Route path="/purchase-invoices" element={<Suspense fallback={<LoadingPage />}><PurchaseInvoices /></Suspense>} />
                      <Route path="/purchase" element={<Suspense fallback={<LoadingPage />}><Purchase /></Suspense>} />
                      <Route path="/products" element={<ProtectedRoute permission={PERMISSIONS.VIEW_PRODUCTS}><Suspense fallback={<LoadingPage />}><Products /></Suspense></ProtectedRoute>} />
                      <Route path="/product-variants" element={<ProtectedRoute permission={PERMISSIONS.VIEW_PRODUCTS}><Suspense fallback={<LoadingPage />}><ProductVariants /></Suspense></ProtectedRoute>} />
                      <Route path="/product-transformations" element={<ProtectedRoute permission={PERMISSIONS.VIEW_PRODUCTS}><Suspense fallback={<LoadingPage />}><ProductTransformations /></Suspense></ProtectedRoute>} />
                      <Route path="/categories" element={<ProtectedRoute permission={PERMISSIONS.VIEW_PRODUCTS}><Suspense fallback={<LoadingPage />}><Categories /></Suspense></ProtectedRoute>} />
                      <Route path="/customers" element={<ProtectedRoute permission={PERMISSIONS.VIEW_PRODUCTS}><Suspense fallback={<LoadingPage />}><Customers /></Suspense></ProtectedRoute>} />
                      <Route path="/suppliers" element={<ProtectedRoute permission={PERMISSIONS.VIEW_PRODUCTS}><Suspense fallback={<LoadingPage />}><Suppliers /></Suspense></ProtectedRoute>} />
                      <Route path="/investors" element={<ProtectedRoute permission={PERMISSIONS.VIEW_REPORTS}><Suspense fallback={<LoadingPage />}><Investors /></Suspense></ProtectedRoute>} />
                      <Route path="/drop-shipping" element={<ProtectedRoute permission={PERMISSIONS.VIEW_SALES}><Suspense fallback={<LoadingPage />}><DropShipping /></Suspense></ProtectedRoute>} />
                      <Route path="/sales-invoices" element={<ProtectedRoute permission={PERMISSIONS.VIEW_SALES}><Suspense fallback={<LoadingPage />}><SalesInvoices /></Suspense></ProtectedRoute>} />
                      <Route path="/inventory" element={<ProtectedRoute permission={PERMISSIONS.VIEW_INVENTORY}><Suspense fallback={<LoadingPage />}><Inventory /></Suspense></ProtectedRoute>} />
                      <Route path="/inventory-alerts" element={<ProtectedRoute permission={PERMISSIONS.VIEW_INVENTORY}><Suspense fallback={<LoadingPage />}><InventoryAlerts /></Suspense></ProtectedRoute>} />
                      <Route path="/customer-analytics" element={<ProtectedRoute permission={PERMISSIONS.VIEW_REPORTS}><Suspense fallback={<LoadingPage />}><CustomerAnalytics /></Suspense></ProtectedRoute>} />
                      <Route path="/anomaly-detection" element={<ProtectedRoute permission={PERMISSIONS.VIEW_REPORTS}><Suspense fallback={<LoadingPage />}><AnomalyDetection /></Suspense></ProtectedRoute>} />
                      <Route path="/warehouses" element={<ProtectedRoute permission={PERMISSIONS.VIEW_INVENTORY}><Suspense fallback={<LoadingPage />}><Warehouses /></Suspense></ProtectedRoute>} />
                      <Route path="/stock-movements" element={<ProtectedRoute permission={PERMISSIONS.VIEW_INVENTORY}><Suspense fallback={<LoadingPage />}><StockMovements /></Suspense></ProtectedRoute>} />

                      <Route path="/pl-statements" element={<ProtectedRoute permission={PERMISSIONS.VIEW_FINANCIAL_DATA}><Suspense fallback={<LoadingPage />}><PLStatements /></Suspense></ProtectedRoute>} />
                      <Route path="/balance-sheet-statement" element={<ProtectedRoute permission={PERMISSIONS.VIEW_FINANCIAL_DATA}><Suspense fallback={<LoadingPage />}><BalanceSheetStatement /></Suspense></ProtectedRoute>} />
                      <Route path="/sale-returns" element={<ProtectedRoute permission={PERMISSIONS.MANAGE_SALES}><Suspense fallback={<LoadingPage />}><SaleReturns /></Suspense></ProtectedRoute>} />
                      <Route path="/purchase-returns" element={<ProtectedRoute permission={PERMISSIONS.MANAGE_INVENTORY}><Suspense fallback={<LoadingPage />}><PurchaseReturns /></Suspense></ProtectedRoute>} />
                      <Route path="/purchase-by-supplier" element={<ProtectedRoute permission={PERMISSIONS.VIEW_REPORTS}><Suspense fallback={<LoadingPage />}><PurchaseBySupplierReport /></Suspense></ProtectedRoute>} />
                      <Route path="/discounts" element={<ProtectedRoute permission={PERMISSIONS.MANAGE_SETTINGS}><Suspense fallback={<LoadingPage />}><Discounts /></Suspense></ProtectedRoute>} />
                      <Route path="/sales-performance" element={<ProtectedRoute permission={PERMISSIONS.VIEW_REPORTS}><Suspense fallback={<LoadingPage />}><SalesPerformanceReports /></Suspense></ProtectedRoute>} />
                      <Route path="/inventory-reports" element={<ProtectedRoute permission={PERMISSIONS.VIEW_REPORTS}><Suspense fallback={<LoadingPage />}><InventoryReports /></Suspense></ProtectedRoute>} />
                      <Route path="/cash-receipts" element={<ProtectedRoute permission={PERMISSIONS.VIEW_ACCOUNTING}><Suspense fallback={<LoadingPage />}><CashReceipts /></Suspense></ProtectedRoute>} />
                      <Route path="/cash-receiving" element={<ProtectedRoute permission={PERMISSIONS.VIEW_ACCOUNTING}><Suspense fallback={<LoadingPage />}><CashReceiving /></Suspense></ProtectedRoute>} />
                      <Route path="/cash-payments" element={<ProtectedRoute permission={PERMISSIONS.VIEW_ACCOUNTING}><Suspense fallback={<LoadingPage />}><CashPayments /></Suspense></ProtectedRoute>} />
                      <Route path="/cities" element={<ProtectedRoute permission={PERMISSIONS.MANAGE_SETTINGS}><Suspense fallback={<LoadingPage />}><Cities /></Suspense></ProtectedRoute>} />
                      <Route path="/expenses" element={<ProtectedRoute permission={PERMISSIONS.VIEW_ACCOUNTING}><Suspense fallback={<LoadingPage />}><Expenses /></Suspense></ProtectedRoute>} />
                      <Route path="/bank-receipts" element={<ProtectedRoute permission={PERMISSIONS.VIEW_ACCOUNTING}><Suspense fallback={<LoadingPage />}><BankReceipts /></Suspense></ProtectedRoute>} />
                      <Route path="/bank-payments" element={<ProtectedRoute permission={PERMISSIONS.VIEW_ACCOUNTING}><Suspense fallback={<LoadingPage />}><BankPayments /></Suspense></ProtectedRoute>} />
                      <Route path="/journal-vouchers" element={<ProtectedRoute permission={PERMISSIONS.VIEW_ACCOUNTING}><Suspense fallback={<LoadingPage />}><JournalVouchers /></Suspense></ProtectedRoute>} />
                      <Route path="/chart-of-accounts" element={<ProtectedRoute permission={PERMISSIONS.VIEW_ACCOUNTING}><Suspense fallback={<LoadingPage />}><ChartOfAccounts /></Suspense></ProtectedRoute>} />
                      <Route path="/account-ledger" element={<ProtectedRoute permission={PERMISSIONS.VIEW_ACCOUNTING}><Suspense fallback={<LoadingPage />}><AccountLedgerSummary /></Suspense></ProtectedRoute>} />
                      <Route path="/reports" element={<ProtectedRoute permission={PERMISSIONS.VIEW_REPORTS}><Suspense fallback={<LoadingPage />}><Reports /></Suspense></ProtectedRoute>} />
                      <Route path="/backdate-report" element={<Suspense fallback={<LoadingPage />}><BackdateReport /></Suspense>} />
                      <Route path="/settings" element={<Suspense fallback={<LoadingPage />}><Settings2 /></Suspense>} />
                      <Route path="/migration" element={<Suspense fallback={<LoadingPage />}><Migration /></Suspense>} />
                      <Route path="/settings2" element={<Suspense fallback={<LoadingPage />}><Settings2 /></Suspense>} />
                      <Route path="/attendance" element={<Suspense fallback={<LoadingPage />}><Attendance /></Suspense>} />
                      <Route path="/employees" element={<Suspense fallback={<LoadingPage />}><Employees /></Suspense>} />
                      <Route path="/cctv-access" element={<Suspense fallback={<LoadingPage />}><CCTVAccess /></Suspense>} />
                      <Route path="/help" element={<Suspense fallback={<LoadingPage />}><Help /></Suspense>} />
                    </Routes>
                  </MultiTabLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </TabProvider>
      </ErrorProvider>
    </ErrorBoundary>
  );
}

export default App;

