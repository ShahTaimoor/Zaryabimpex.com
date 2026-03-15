import React, { Suspense, lazy } from 'react';
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

// Critical components - load immediately (small, frequently used)
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';

// Lazy load all other pages for code splitting
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
const Backups = lazy(() => import('./pages/Backups').then(m => ({ default: m.Backups })));
const PLStatements = lazy(() => import('./pages/PLStatements').then(m => ({ default: m.PLStatements })));
const Returns = lazy(() => import('./pages/Returns'));
const SaleReturns = lazy(() => import('./pages/SaleReturns'));
const PurchaseReturns = lazy(() => import('./pages/PurchaseReturns'));
const BalanceSheets = lazy(() => import('./pages/BalanceSheets'));
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
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/sales-orders" element={<Suspense fallback={<LoadingPage />}><SalesOrders /></Suspense>} />
                      <Route path="/sales" element={<Suspense fallback={<LoadingPage />}><Sales /></Suspense>} />
                      <Route path="/purchase-orders" element={<Suspense fallback={<LoadingPage />}><PurchaseOrders /></Suspense>} />
                      <Route path="/purchase-invoices" element={<Suspense fallback={<LoadingPage />}><PurchaseInvoices /></Suspense>} />
                      <Route path="/purchase" element={<Suspense fallback={<LoadingPage />}><Purchase /></Suspense>} />
                      <Route path="/products" element={<Suspense fallback={<LoadingPage />}><Products /></Suspense>} />
                      <Route path="/product-variants" element={<Suspense fallback={<LoadingPage />}><ProductVariants /></Suspense>} />
                      <Route path="/product-transformations" element={<Suspense fallback={<LoadingPage />}><ProductTransformations /></Suspense>} />
                      <Route path="/categories" element={<Suspense fallback={<LoadingPage />}><Categories /></Suspense>} />
                      <Route path="/customers" element={<Suspense fallback={<LoadingPage />}><Customers /></Suspense>} />
                      <Route path="/suppliers" element={<Suspense fallback={<LoadingPage />}><Suppliers /></Suspense>} />
                      <Route path="/investors" element={<Suspense fallback={<LoadingPage />}><Investors /></Suspense>} />
                      <Route path="/drop-shipping" element={<Suspense fallback={<LoadingPage />}><DropShipping /></Suspense>} />
                      <Route path="/sales-invoices" element={<Suspense fallback={<LoadingPage />}><SalesInvoices /></Suspense>} />
                      <Route path="/inventory" element={<Suspense fallback={<LoadingPage />}><Inventory /></Suspense>} />
                      <Route path="/inventory-alerts" element={<Suspense fallback={<LoadingPage />}><InventoryAlerts /></Suspense>} />
                      <Route path="/customer-analytics" element={<Suspense fallback={<LoadingPage />}><CustomerAnalytics /></Suspense>} />
                      <Route path="/anomaly-detection" element={<Suspense fallback={<LoadingPage />}><AnomalyDetection /></Suspense>} />
                      <Route path="/warehouses" element={<Suspense fallback={<LoadingPage />}><Warehouses /></Suspense>} />
                      <Route path="/stock-movements" element={<Suspense fallback={<LoadingPage />}><StockMovements /></Suspense>} />
                      <Route path="/backups" element={<Suspense fallback={<LoadingPage />}><Backups /></Suspense>} />
                      <Route path="/pl-statements" element={<Suspense fallback={<LoadingPage />}><PLStatements /></Suspense>} />
                      <Route path="/returns" element={<Suspense fallback={<LoadingPage />}><Returns /></Suspense>} />
                      <Route path="/sale-returns" element={<Suspense fallback={<LoadingPage />}><SaleReturns /></Suspense>} />
                      <Route path="/purchase-returns" element={<Suspense fallback={<LoadingPage />}><PurchaseReturns /></Suspense>} />
                      <Route path="/balance-sheets" element={<Suspense fallback={<LoadingPage />}><BalanceSheets /></Suspense>} />
                      <Route path="/discounts" element={<Suspense fallback={<LoadingPage />}><Discounts /></Suspense>} />
                      <Route path="/sales-performance" element={<Suspense fallback={<LoadingPage />}><SalesPerformanceReports /></Suspense>} />
                      <Route path="/inventory-reports" element={<Suspense fallback={<LoadingPage />}><InventoryReports /></Suspense>} />
                      <Route path="/cash-receipts" element={<Suspense fallback={<LoadingPage />}><CashReceipts /></Suspense>} />
                      <Route path="/cash-receiving" element={<Suspense fallback={<LoadingPage />}><CashReceiving /></Suspense>} />
                      <Route path="/cash-payments" element={<Suspense fallback={<LoadingPage />}><CashPayments /></Suspense>} />
                      <Route path="/cities" element={<Suspense fallback={<LoadingPage />}><Cities /></Suspense>} />
                      <Route path="/expenses" element={<Suspense fallback={<LoadingPage />}><Expenses /></Suspense>} />
                      <Route path="/bank-receipts" element={<Suspense fallback={<LoadingPage />}><BankReceipts /></Suspense>} />
                      <Route path="/bank-payments" element={<Suspense fallback={<LoadingPage />}><BankPayments /></Suspense>} />
                      <Route path="/journal-vouchers" element={<Suspense fallback={<LoadingPage />}><JournalVouchers /></Suspense>} />
                      <Route path="/chart-of-accounts" element={<Suspense fallback={<LoadingPage />}><ChartOfAccounts /></Suspense>} />
                      <Route path="/account-ledger" element={<Suspense fallback={<LoadingPage />}><AccountLedgerSummary /></Suspense>} />
                      <Route path="/reports" element={<Suspense fallback={<LoadingPage />}><Reports /></Suspense>} />
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
