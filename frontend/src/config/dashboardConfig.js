export const DASHBOARD_CONFIG_CHANGED = 'dashboardConfigChanged';

export const DASHBOARD_WIDGET_SECTIONS = [
  {
    id: 'revenue',
    label: 'Revenue, Cost & Discounts',
    widgets: [
      { key: 'salesRevenue', label: 'Sales (Revenue)', description: 'Sales orders and invoices (SO | SI)' },
      { key: 'purchaseCogs', label: 'Total Purchases', description: 'Purchase orders and invoices (PO | PI)' },
      { key: 'discountGiven', label: 'Discount Given', description: 'Total discounts in the period' },
      { key: 'pendingSalesOrders', label: 'Pending Sales Orders', description: 'Open sales orders count' },
      { key: 'pendingPurchaseOrders', label: 'Pending Purchase Orders', description: 'Open purchase orders count' },
    ],
  },
  {
    id: 'profitability',
    label: 'Profitability & Cash Flow',
    widgets: [
      { key: 'grossProfit', label: 'Gross Profit', description: 'Revenue minus COGS', defaultOff: true },
      { key: 'netCashFlow', label: 'Net Cash Flow', description: 'Receipts minus payments' },
      { key: 'dailyCash', label: 'Daily Cash', description: 'Today expected cash and closing status', defaultOff: true },
      { key: 'totalTransactions', label: 'Total Transactions', description: 'Total orders in the period' },
    ],
  },
  {
    id: 'receipts',
    label: 'Receipts — Combined or Split',
    widgets: [
      { key: 'totalReceipts', label: 'Total Receipts (Combined)', description: 'Cash + bank + sales in one card' },
      { key: 'cashReceipts', label: 'Cash Receipts', description: 'Cash receipts only', defaultOff: true },
      { key: 'bankReceipts', label: 'Bank Receipts', description: 'Bank receipts only', defaultOff: true },
      { key: 'salesReceipts', label: 'Sales Receipts', description: 'Sales invoice payments', defaultOff: true },
    ],
  },
  {
    id: 'payments',
    label: 'Payments — Combined or Split',
    widgets: [
      { key: 'totalPayments', label: 'Total Payments (Combined)', description: 'Cash + bank payments in one card' },
      { key: 'cashPayments', label: 'Cash Payments', description: 'Cash payments only', defaultOff: true },
      { key: 'bankPayments', label: 'Bank Payments', description: 'Bank payments only', defaultOff: true },
    ],
  },
];

/** Flat list for backward compatibility */
export const DASHBOARD_WIDGETS = DASHBOARD_WIDGET_SECTIONS.flatMap((section) =>
  section.widgets.map((w) => ({ ...w, section: section.id, sectionLabel: section.label }))
);

const WIDGETS_STORAGE_KEY = 'dashboardWidgetsConfig';
const DATA_HIDDEN_KEY = 'dashboardDataHidden';

const LEGACY_WIDGET_KEY_MAP = {
  totalSales: 'salesRevenue',
  totalPurchases: 'purchaseCogs',
};

export const RECEIPT_COMBINED_KEY = 'totalReceipts';
export const RECEIPT_SPLIT_KEYS = ['cashReceipts', 'bankReceipts', 'salesReceipts'];
export const PAYMENT_COMBINED_KEY = 'totalPayments';
export const PAYMENT_SPLIT_KEYS = ['cashPayments', 'bankPayments'];

/** Set receipts to combined (one card) or split (cash / bank / sales cards). */
export function applyReceiptsDisplayMode(config, mode) {
  const next = { ...config };
  if (mode === 'combined') {
    next[RECEIPT_COMBINED_KEY] = true;
    RECEIPT_SPLIT_KEYS.forEach((key) => {
      next[key] = false;
    });
  } else {
    next[RECEIPT_COMBINED_KEY] = false;
    RECEIPT_SPLIT_KEYS.forEach((key) => {
      next[key] = true;
    });
  }
  return next;
}

/** Set payments to combined (one card) or split (cash / bank cards). */
export function applyPaymentsDisplayMode(config, mode) {
  const next = { ...config };
  if (mode === 'combined') {
    next[PAYMENT_COMBINED_KEY] = true;
    PAYMENT_SPLIT_KEYS.forEach((key) => {
      next[key] = false;
    });
  } else {
    next[PAYMENT_COMBINED_KEY] = false;
    PAYMENT_SPLIT_KEYS.forEach((key) => {
      next[key] = true;
    });
  }
  return next;
}

export function isReceiptsCombined(config) {
  return config?.[RECEIPT_COMBINED_KEY] !== false;
}

export function isPaymentsCombined(config) {
  return config?.[PAYMENT_COMBINED_KEY] !== false;
}

export const DEFAULT_DASHBOARD_WIDGETS = DASHBOARD_WIDGETS.reduce((acc, widget) => {
  acc[widget.key] = widget.defaultOff !== true;
  return acc;
}, {});

function dispatchDashboardConfigChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(DASHBOARD_CONFIG_CHANGED));
  }
}

function normalizeWidgetsConfig(parsed) {
  const merged = { ...DEFAULT_DASHBOARD_WIDGETS };
  if (!parsed || typeof parsed !== 'object') return merged;

  Object.entries(parsed).forEach(([key, value]) => {
    const mappedKey = LEGACY_WIDGET_KEY_MAP[key] || key;
    if (Object.prototype.hasOwnProperty.call(merged, mappedKey)) {
      merged[mappedKey] = value !== false;
    }
  });
  return merged;
}

export function loadDashboardWidgetsConfig() {
  try {
    const saved = localStorage.getItem(WIDGETS_STORAGE_KEY);
    if (!saved) return { ...DEFAULT_DASHBOARD_WIDGETS };
    return normalizeWidgetsConfig(JSON.parse(saved));
  } catch {
    return { ...DEFAULT_DASHBOARD_WIDGETS };
  }
}

export function saveDashboardWidgetsConfig(config) {
  const normalized = normalizeWidgetsConfig(config);
  localStorage.setItem(WIDGETS_STORAGE_KEY, JSON.stringify(normalized));
  dispatchDashboardConfigChanged();
}

export function isDashboardWidgetVisible(widgetKey, config = null) {
  const cfg = config ?? loadDashboardWidgetsConfig();
  return cfg[widgetKey] !== false;
}

export function isDashboardSectionVisible(sectionId, config = null) {
  const section = DASHBOARD_WIDGET_SECTIONS.find((s) => s.id === sectionId);
  if (!section) return true;
  const cfg = config ?? loadDashboardWidgetsConfig();
  return section.widgets.some((w) => cfg[w.key] !== false);
}

export function loadDashboardDataHidden() {
  try {
    return localStorage.getItem(DATA_HIDDEN_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveDashboardDataHidden(hidden) {
  localStorage.setItem(DATA_HIDDEN_KEY, String(!!hidden));
  window.dispatchEvent(
    new CustomEvent('dashboardVisibilityChanged', { detail: { hidden: !!hidden } })
  );
  dispatchDashboardConfigChanged();
}
