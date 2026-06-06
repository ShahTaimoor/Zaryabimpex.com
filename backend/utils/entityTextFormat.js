const { toTitleCase } = require('./titleCase');
const { formatProductNameBrackets, formatProductDisplayName } = require('./productNameFormat');

const EMAIL_FIELDS = new Set(['email']);
const SKIP_FIELDS = new Set([
  'password',
  'sku',
  'barcode',
  'hsCode',
  'hs_code',
  'accountCode',
  'account_code',
  'employeeId',
  'employee_id',
  'id',
  '_id',
  'status',
  'type',
  'role',
  'url',
  'imageUrl',
  'image_url',
]);

function formatAddressEntity(address) {
  if (!address || typeof address !== 'object') return address;
  const a = { ...address };
  for (const key of ['street', 'addressLine1', 'address_line1', 'addressLine2', 'address_line2', 'city', 'state', 'province', 'country', 'area', 'landmark']) {
    if (a[key]) a[key] = toTitleCase(a[key]);
  }
  return a;
}

function applyTitleCaseToKeys(obj, keys) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = { ...obj };
  for (const key of keys) {
    if (out[key] != null && typeof out[key] === 'string' && !SKIP_FIELDS.has(key) && !EMAIL_FIELDS.has(key)) {
      out[key] = toTitleCase(out[key]);
    }
  }
  return out;
}

const CUSTOMER_KEYS = ['name', 'businessName', 'business_name', 'firstName', 'first_name', 'lastName', 'last_name', 'displayName', 'display_name', 'city', 'notes', 'description'];
const SUPPLIER_KEYS = ['name', 'companyName', 'company_name', 'businessName', 'business_name', 'contactPerson', 'contact_person', 'city', 'notes', 'description'];
const PRODUCT_KEYS = ['description', 'brand', 'countryOfOrigin', 'country_of_origin'];

function normalizeProductUnit(value) {
  if (value == null || typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed ? trimmed.toUpperCase() : trimmed;
}
const CATEGORY_KEYS = ['name', 'description'];
const BANK_KEYS = ['bankName', 'bank_name', 'accountName', 'account_name', 'branchName', 'branch_name', 'description', 'notes'];
const CITY_KEYS = ['name', 'state', 'country'];
const VARIANT_KEYS = ['variantName', 'variant_name', 'displayName', 'display_name', 'variantValue', 'variant_value', 'description'];
const WAREHOUSE_KEYS = ['name', 'description', 'city', 'address'];
const INVESTOR_KEYS = ['name', 'description'];
const EMPLOYEE_NAME_KEYS = ['firstName', 'first_name', 'lastName', 'last_name', 'name', 'department', 'designation', 'city'];
const SETTINGS_KEYS = ['companyName', 'company_name', 'address', 'contactNumber', 'contact_number'];
const DISCOUNT_KEYS = ['name', 'description'];
const EXPENSE_KEYS = ['description', 'notes', 'category', 'vendor', 'payee'];
const RECEIPT_PAYMENT_KEYS = ['particular', 'description', 'notes', 'payee', 'payer', 'receivedFrom', 'received_from', 'paidTo', 'paid_to'];
const NOTE_KEYS = ['title', 'content'];
const SHOP_KEYS = ['name', 'description', 'city', 'address'];
const USER_NAME_KEYS = ['firstName', 'first_name', 'lastName', 'last_name', 'name'];
const MARKET_PRICE_KEYS = ['productName', 'product_name', 'supplierName', 'supplier_name', 'notes'];
const RETURN_KEYS = ['reason', 'notes', 'description'];
const JV_KEYS = ['description', 'notes', 'particular'];

const TEXT_FIELD_KEYS = new Set([
  ...CUSTOMER_KEYS,
  ...SUPPLIER_KEYS,
  ...PRODUCT_KEYS,
  ...CATEGORY_KEYS,
  ...BANK_KEYS,
  ...CITY_KEYS,
  ...VARIANT_KEYS,
  ...WAREHOUSE_KEYS,
  ...INVESTOR_KEYS,
  ...EMPLOYEE_NAME_KEYS,
  ...SETTINGS_KEYS,
  ...DISCOUNT_KEYS,
  ...EXPENSE_KEYS,
  ...RECEIPT_PAYMENT_KEYS,
  ...NOTE_KEYS,
  ...SHOP_KEYS,
  ...USER_NAME_KEYS,
  ...MARKET_PRICE_KEYS,
  ...RETURN_KEYS,
  ...JV_KEYS,
  'productName', 'product_name', 'supplierName', 'supplier_name', 'customerName', 'customer_name',
  'warehouseName', 'warehouse_name', 'shopName', 'shop_name', 'brandName', 'brand_name',
  'contactPerson', 'contact_person', 'particular', 'title', 'label', 'location', 'area', 'landmark',
  'street', 'state', 'province', 'country', 'companyAddress', 'company_address',
]);

const SKIP_RECURSE_KEYS = new Set([
  'pagination', 'meta', 'permissions', 'stats', 'totals', 'summary', 'balances', 'entries',
  'token', 'accessToken', 'refreshToken', 'logo', 'image', 'imageUrl', 'image_url', 'printSettings',
  'orderSettings', 'preferences', 'items', 'lineItems', 'products', 'customers', 'suppliers',
]);

function formatCustomerEntity(customer) {
  if (!customer || typeof customer !== 'object') return customer;
  let c = applyTitleCaseToKeys(customer, CUSTOMER_KEYS);
  if (c.contactPerson && typeof c.contactPerson === 'object') {
    c = { ...c, contactPerson: applyTitleCaseToKeys(c.contactPerson, ['name']) };
  }
  if (Array.isArray(c.addresses)) {
    c = { ...c, addresses: c.addresses.map(formatAddressEntity) };
  }
  if (typeof c.address === 'object' && c.address) {
    c = { ...c, address: formatAddressEntity(c.address) };
  }
  const display = c.businessName || c.business_name || c.name;
  if (display) {
    const formatted = toTitleCase(display);
    c.displayName = formatted;
    c.display_name = formatted;
  }
  return c;
}

function formatSupplierEntity(supplier) {
  if (!supplier || typeof supplier !== 'object') return supplier;
  let s = applyTitleCaseToKeys(supplier, SUPPLIER_KEYS);
  if (s.contactPerson && typeof s.contactPerson === 'object') {
    s = { ...s, contactPerson: applyTitleCaseToKeys(s.contactPerson, ['name']) };
  } else if (typeof s.contact_person === 'string') {
    s.contact_person = toTitleCase(s.contact_person);
  }
  if (Array.isArray(s.addresses)) {
    s = { ...s, addresses: s.addresses.map(formatAddressEntity) };
  }
  if (typeof s.address === 'object' && s.address) {
    s = { ...s, address: formatAddressEntity(s.address) };
  }
  return s;
}

function formatProductEntity(product) {
  if (!product || typeof product !== 'object') return product;
  let p = applyTitleCaseToKeys(product, PRODUCT_KEYS);
  if (p.name != null && typeof p.name === 'string') {
    p = { ...p, name: formatProductDisplayName(p.name) };
  }
  if (p.unit != null && typeof p.unit === 'string') {
    p = { ...p, unit: normalizeProductUnit(p.unit) };
  }
  if (p.displayName) p.displayName = toTitleCase(p.displayName);
  if (p.display_name) p.display_name = toTitleCase(p.display_name);
  if (p.variantName) p.variantName = toTitleCase(p.variantName);
  if (p.variant_name) p.variant_name = toTitleCase(p.variant_name);
  if (p.variantValue) p.variantValue = toTitleCase(p.variantValue);
  if (p.variant_value) p.variant_value = toTitleCase(p.variant_value);
  if (p.category && typeof p.category === 'object' && p.category.name) {
    p = { ...p, category: { ...p.category, name: toTitleCase(p.category.name) } };
  }
  return p;
}

function formatCategoryEntity(category) {
  return applyTitleCaseToKeys(category, CATEGORY_KEYS);
}

function formatBankEntity(bank) {
  return applyTitleCaseToKeys(bank, BANK_KEYS);
}

function formatLineItems(items) {
  if (!Array.isArray(items)) return items;
  return items.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const next = { ...item };
    for (const key of ['productName', 'product_name', 'description', 'notes']) {
      if (next[key]) next[key] = toTitleCase(next[key]);
    }
    if (next.name && !next.product) next.name = formatProductDisplayName(next.name);
    if (next.product) next.product = formatProductEntity(next.product);
    return next;
  });
}

function formatOrderEntity(order) {
  if (!order || typeof order !== 'object') return order;
  let o = { ...order };
  if (o.notes) o.notes = toTitleCase(o.notes);
  if (o.description) o.description = toTitleCase(o.description);
  if (o.customer) o.customer = formatCustomerEntity(o.customer);
  if (o.supplier) o.supplier = formatSupplierEntity(o.supplier);
  if (Array.isArray(o.items)) o.items = formatLineItems(o.items);
  if (Array.isArray(o.lineItems)) o.lineItems = formatLineItems(o.lineItems);
  if (o.customerInfo && typeof o.customerInfo === 'object') {
    o.customerInfo = applyTitleCaseToKeys(o.customerInfo, ['name', 'displayName', 'display_name', 'address', 'city']);
  }
  if (o.supplierInfo && typeof o.supplierInfo === 'object') {
    o.supplierInfo = applyTitleCaseToKeys(o.supplierInfo, ['name', 'companyName', 'company_name', 'address', 'city']);
  }
  return o;
}

function formatTextFieldByKey(key, value) {
  if (value == null || typeof value !== 'string') return value;
  if (EMAIL_FIELDS.has(key)) return value.trim().toLowerCase();
  if (SKIP_FIELDS.has(key)) return value;
  if (key === 'name' || key === 'productName' || key === 'product_name') {
    return formatProductDisplayName(value);
  }
  if (TEXT_FIELD_KEYS.has(key)) return toTitleCase(value);
  return value;
}

function formatResponseBody(body, depth = 0) {
  if (body == null || depth > 12) return body;
  if (Array.isArray(body)) {
    return body.map((item) => formatResponseBody(item, depth + 1));
  }
  if (typeof body !== 'object' || body instanceof Date) return body;

  const out = Array.isArray(body) ? [...body] : { ...body };

  if (out.product && typeof out.product === 'object') {
    out.product = formatProductEntity(out.product);
  }
  if (out.customer && typeof out.customer === 'object') {
    out.customer = formatCustomerEntity(out.customer);
  }
  if (out.supplier && typeof out.supplier === 'object') {
    out.supplier = formatSupplierEntity(out.supplier);
  }
  if (out.category && typeof out.category === 'object' && out.category.name) {
    out.category = formatCategoryEntity(out.category);
  }

  const collectionFormatters = {
    products: (arr) => arr.map(formatProductEntity),
    customers: (arr) => arr.map(formatCustomerEntity),
    suppliers: (arr) => arr.map(formatSupplierEntity),
    categories: (arr) => arr.map(formatCategoryEntity),
    banks: (arr) => arr.map(formatBankEntity),
    warehouses: (arr) => arr.map((w) => applyTitleCaseToKeys(w, WAREHOUSE_KEYS)),
    cities: (arr) => arr.map((c) => applyTitleCaseToKeys(c, CITY_KEYS)),
    investors: (arr) => arr.map((i) => applyTitleCaseToKeys(i, INVESTOR_KEYS)),
    employees: (arr) => arr.map((e) => applyTitleCaseToKeys(e, EMPLOYEE_NAME_KEYS)),
    items: formatLineItems,
    lineItems: formatLineItems,
    salesOrders: (arr) => arr.map(formatOrderEntity),
    sales: (arr) => arr.map(formatOrderEntity),
    orders: (arr) => arr.map(formatOrderEntity),
    purchases: (arr) => arr.map(formatOrderEntity),
    returns: (arr) => arr.map((r) => applyTitleCaseToKeys(r, RETURN_KEYS)),
    inventory: (arr) => arr.map((row) => {
      if (!row || typeof row !== 'object') return row;
      const next = { ...row };
      if (next.product) next.product = formatProductEntity(next.product);
      return next;
    }),
  };

  for (const [key, value] of Object.entries(out)) {
    if (collectionFormatters[key] && Array.isArray(value)) {
      out[key] = collectionFormatters[key](value);
      continue;
    }
    if (typeof value === 'string' && TEXT_FIELD_KEYS.has(key)) {
      out[key] = formatTextFieldByKey(key, value);
      continue;
    }
    if (key === 'address' || key === 'billingAddress' || key === 'shippingAddress') {
      if (typeof value === 'string') {
        out[key] = toTitleCase(value);
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        out[key] = formatAddressEntity(value);
      } else if (Array.isArray(value)) {
        out[key] = value.map((a) => (typeof a === 'object' ? formatAddressEntity(a) : toTitleCase(String(a))));
      }
      continue;
    }
    if (value && typeof value === 'object' && !SKIP_RECURSE_KEYS.has(key)) {
      out[key] = formatResponseBody(value, depth + 1);
    }
  }

  return out;
}

function normalizeEmailFields(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = { ...obj };
  for (const key of EMAIL_FIELDS) {
    if (typeof out[key] === 'string') out[key] = out[key].trim().toLowerCase();
  }
  return out;
}

function normalizeCustomerInput(data) {
  if (!data || typeof data !== 'object') return data;
  let d = formatCustomerEntity(data);
  d = normalizeEmailFields(d);
  return d;
}

function normalizeSupplierInput(data) {
  if (!data || typeof data !== 'object') return data;
  let d = formatSupplierEntity(data);
  d = normalizeEmailFields(d);
  return d;
}

function normalizeProductInput(data) {
  if (!data || typeof data !== 'object') return data;
  return formatProductEntity(data);
}

function normalizeCategoryInput(data) {
  if (!data || typeof data !== 'object') return data;
  return formatCategoryEntity(data);
}

function normalizeBankInput(data) {
  if (!data || typeof data !== 'object') return data;
  return formatBankEntity(data);
}

function normalizeVariantInput(data) {
  if (!data || typeof data !== 'object') return data;
  return applyTitleCaseToKeys(data, VARIANT_KEYS);
}

function normalizeCityInput(data) {
  if (!data || typeof data !== 'object') return data;
  return applyTitleCaseToKeys(data, CITY_KEYS);
}

function normalizeWarehouseInput(data) {
  if (!data || typeof data !== 'object') return data;
  return applyTitleCaseToKeys(data, WAREHOUSE_KEYS);
}

function normalizeOrderInput(data) {
  if (!data || typeof data !== 'object') return data;
  let d = { ...data };
  if (d.notes) d.notes = toTitleCase(d.notes);
  if (d.description) d.description = toTitleCase(d.description);
  if (Array.isArray(d.items)) d.items = formatLineItems(d.items);
  return d;
}

/**
 * Normalize request body based on API path (POST/PUT/PATCH).
 */
function normalizeRequestBodyByPath(path, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const p = String(path || '').toLowerCase();

  if (p.includes('/products') && !p.includes('/product-variants') && !p.includes('/product-transformations')) {
    return normalizeProductInput(body);
  }
  if (p.includes('/product-variants')) return normalizeVariantInput(body);
  if (p.includes('/customers')) return normalizeCustomerInput(body);
  if (p.includes('/suppliers')) return normalizeSupplierInput(body);
  if (p.includes('/categories')) return normalizeCategoryInput(body);
  if (p.includes('/banks')) return normalizeBankInput(body);
  if (p.includes('/cities')) return normalizeCityInput(body);
  if (p.includes('/warehouses')) return normalizeWarehouseInput(body);
  if (p.includes('/investors')) return applyTitleCaseToKeys(body, INVESTOR_KEYS);
  if (p.includes('/employees')) {
    return normalizeEmailFields(applyTitleCaseToKeys(body, EMPLOYEE_NAME_KEYS));
  }
  if (
    p.includes('/sales') ||
    p.includes('/sales-orders') ||
    p.includes('/purchase-orders') ||
    p.includes('/purchase-invoices') ||
    p.includes('/purchases') ||
    p.includes('/import-purchase') ||
    p.includes('/purchase-returns') ||
    p.includes('/sale-returns') ||
    p.includes('/returns') ||
    p.includes('/drop-shipping')
  ) {
    return normalizeOrderInput(body);
  }
  if (p.includes('/discounts')) return applyTitleCaseToKeys(body, DISCOUNT_KEYS);
  if (p.includes('/expenses')) return applyTitleCaseToKeys(body, EXPENSE_KEYS);
  if (p.includes('/market-prices') || p.includes('/market_prices')) {
    return applyTitleCaseToKeys(body, MARKET_PRICE_KEYS);
  }
  if (
    p.includes('/cash-receipts') ||
    p.includes('/cash-payments') ||
    p.includes('/bank-receipts') ||
    p.includes('/bank-payments')
  ) {
    return applyTitleCaseToKeys(body, RECEIPT_PAYMENT_KEYS);
  }
  if (p.includes('/journal-vouchers')) return applyTitleCaseToKeys(body, JV_KEYS);
  if (p.includes('/notes')) return applyTitleCaseToKeys(body, NOTE_KEYS);
  if (p.includes('/shops')) return applyTitleCaseToKeys(body, SHOP_KEYS);
  if (p.includes('/settings') || p.includes('/company')) {
    return applyTitleCaseToKeys(body, SETTINGS_KEYS);
  }
  if (p.includes('/users') && !p.includes('/password')) {
    return normalizeEmailFields(applyTitleCaseToKeys(body, USER_NAME_KEYS));
  }

  return body;
}

module.exports = {
  toTitleCase,
  formatProductNameBrackets,
  formatProductDisplayName,
  formatAddressEntity,
  formatCustomerEntity,
  formatSupplierEntity,
  formatProductEntity,
  formatCategoryEntity,
  formatBankEntity,
  formatLineItems,
  formatOrderEntity,
  formatResponseBody,
  normalizeCustomerInput,
  normalizeSupplierInput,
  normalizeProductInput,
  normalizeCategoryInput,
  normalizeBankInput,
  normalizeVariantInput,
  normalizeCityInput,
  normalizeWarehouseInput,
  normalizeOrderInput,
  normalizeRequestBodyByPath,
};
