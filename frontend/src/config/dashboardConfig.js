export const DASHBOARD_CONFIG_CHANGED = 'dashboardConfigChanged';

export const DASHBOARD_WIDGET_SECTIONS = [
  {
    id: 'revenue',
    label: 'Revenue, Cost & Discounts',
    widgets: [
      { key: 'salesRevenue', label: 'Sales (Revenue)', description: 'Sales orders and invoices (SO | SI)' },
      { key: 'purchaseCogs', label: 'Purchase (COGS)', description: 'Purchase orders and invoices (PO | PI)' },
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
      { key: 'totalReceipts', label: 'Total Receipts', description: 'Cash, bank, and sales receipts' },
      { key: 'totalPayments', label: 'Total Payments', description: 'Cash and bank payments' },
      { key: 'netCashFlow', label: 'Net Cash Flow', description: 'Receipts minus payments' },
      { key: 'totalTransactions', label: 'Total Transactions', description: 'Total orders in the period' },
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
