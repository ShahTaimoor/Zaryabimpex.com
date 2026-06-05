const { toTitleCase } = require('./titleCase');

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
const PRODUCT_KEYS = ['name', 'description', 'unit', 'brand', 'countryOfOrigin', 'country_of_origin'];
const CATEGORY_KEYS = ['name', 'description'];
const BANK_KEYS = ['bankName', 'bank_name', 'accountName', 'account_name', 'branchName', 'branch_name', 'description', 'notes'];
const CITY_KEYS = ['name', 'state', 'country'];
const VARIANT_KEYS = ['variantName', 'variant_name', 'displayName', 'display_name', 'variantValue', 'variant_value', 'description'];
const WAREHOUSE_KEYS = ['name', 'description', 'city', 'address'];
const INVESTOR_KEYS = ['name', 'description'];
const EMPLOYEE_NAME_KEYS = ['firstName', 'first_name', 'lastName', 'last_name', 'name', 'department', 'designation', 'city'];

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
    for (const key of ['productName', 'product_name', 'name', 'description', 'notes']) {
      if (next[key]) next[key] = toTitleCase(next[key]);
    }
    if (next.product) next.product = formatProductEntity(next.product);
    return next;
  });
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
    p.includes('/purchase-returns') ||
    p.includes('/sale-returns') ||
    p.includes('/drop-shipping')
  ) {
    return normalizeOrderInput(body);
  }

  return body;
}

module.exports = {
  toTitleCase,
  formatAddressEntity,
  formatCustomerEntity,
  formatSupplierEntity,
  formatProductEntity,
  formatCategoryEntity,
  formatBankEntity,
  formatLineItems,
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
