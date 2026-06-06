import {
  Receipt,
  ArrowDown,
  ArrowUp,
  Wallet,
} from 'lucide-react';

export const TOP_BAR_CONFIG_KEY = 'topBarConfig';
export const TOP_BAR_CONFIG_CHANGED = 'topBarConfigChanged';

/** Quick-action buttons shown in the app top bar (independent from sidebarConfig). */
export const TOP_BAR_ACTION_ITEMS = [
  {
    name: 'Multi Cash Receipt',
    href: '/cash-receiving',
    permission: 'view_cash_receiving',
    icon: Receipt,
    desktopLabel: 'Multi Cash Receipt',
    mobileLabel: 'Multi Cash Receipt',
    mobilePrimary: false,
  },
  {
    name: 'Cash Receipts',
    href: '/cash-receipts',
    permission: 'view_cash_receipts',
    icon: ArrowDown,
    desktopLabel: 'Cash Receipt',
    desktopLabelShort: 'Cash R.',
    mobileLabel: 'Receiving',
    mobilePrimary: true,
  },
  {
    name: 'Bank Receipts',
    href: '/bank-receipts',
    permission: 'view_bank_receipts',
    icon: ArrowDown,
    desktopLabel: 'Bank Receipt',
    desktopLabelShort: 'Bank R.',
  },
  {
    name: 'Cash Payments',
    href: '/cash-payments',
    permission: 'view_cash_payments',
    icon: ArrowUp,
    desktopLabel: 'Cash Payment',
    desktopLabelShort: 'Cash P.',
  },
  {
    name: 'Bank Payments',
    href: '/bank-payments',
    permission: 'view_bank_payments',
    icon: ArrowUp,
    desktopLabel: 'Bank Payment',
    desktopLabelShort: 'Bank P.',
  },
  {
    name: 'Record Expense',
    href: '/expenses',
    permission: 'view_expenses',
    icon: Wallet,
    desktopLabel: 'Record Expense',
    desktopLabelShort: 'Expense',
    mobileLabel: 'Expense',
  },
];

export function isTopBarItemEnabled(config, itemName) {
  return config?.[itemName] !== false;
}

export function loadTopBarConfig() {
  const saved = localStorage.getItem(TOP_BAR_CONFIG_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      /* fall through */
    }
  }

  // One-time seed from sidebar so existing users keep current visibility.
  let sidebar = {};
  try {
    const raw = localStorage.getItem('sidebarConfig');
    if (raw) sidebar = JSON.parse(raw) || {};
  } catch {
    sidebar = {};
  }

  const config = {};
  TOP_BAR_ACTION_ITEMS.forEach((item) => {
    config[item.name] = sidebar[item.name] !== false;
  });
  localStorage.setItem(TOP_BAR_CONFIG_KEY, JSON.stringify(config));
  return config;
}

export function saveTopBarConfig(config) {
  localStorage.setItem(TOP_BAR_CONFIG_KEY, JSON.stringify(config));
  window.dispatchEvent(new Event(TOP_BAR_CONFIG_CHANGED));
}
