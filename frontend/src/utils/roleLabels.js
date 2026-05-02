const LABELS = {
  admin: 'Admin',
  manager: 'Manager',
  cashier: 'Cashier',
  inventory: 'Inventory',
  viewer: 'Viewer',
  employee: 'Employee',
  sales_person: 'Sales',
};

export function getRoleLabel(role) {
  if (!role) return 'User';
  const key = String(role).toLowerCase();
  if (LABELS[key]) return LABELS[key];
  return String(role)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
