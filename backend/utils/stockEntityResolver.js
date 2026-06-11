const ProductRepository = require('../repositories/ProductRepository');
const ProductVariantRepository = require('../repositories/postgres/ProductVariantRepository');
const InventoryRepository = require('../repositories/InventoryRepository');

function parsePricing(raw) {
  if (raw == null) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function parseInventoryData(raw) {
  if (raw == null) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Resolve a stock entity ID to either a Product or ProductVariant row.
 * @returns {Promise<{ id: string, productModel: 'Product'|'ProductVariant', name: string, sku: string|null, unitCost: number, baseProductId?: string }|null>}
 */
async function resolveStockEntity(productId, options = {}) {
  if (!productId) return null;
  if (typeof productId === 'string' && productId.startsWith('manual_')) return null;

  const id = String(productId);

  let product = await ProductRepository.findById(id, options.includeDeleted === true);
  if (product) {
    const pricing = parsePricing(product.pricing);
    const unitCost =
      Number(product.cost_price ?? product.costPrice ?? pricing.cost ?? pricing.cost_price ?? 0) || 0;
    return {
      id: product.id || product._id || id,
      productModel: 'Product',
      name: product.name || product.productName || 'Product',
      sku: product.sku || null,
      unitCost,
    };
  }

  const variant = await ProductVariantRepository.findById(id, options.includeDeleted === true);
  if (!variant) return null;

  const pricing = parsePricing(variant.pricing);
  const invData = parseInventoryData(variant.inventory_data ?? variant.inventoryData);
  const unitCost =
    Number(pricing.cost ?? pricing.cost_price ?? variant.transformation_cost ?? variant.transformationCost ?? 0) || 0;

  return {
    id: variant.id || variant._id || id,
    productModel: 'ProductVariant',
    name:
      variant.display_name ||
      variant.displayName ||
      variant.variant_name ||
      variant.variantName ||
      'Variant',
    sku: variant.sku || null,
    unitCost,
    baseProductId: variant.base_product_id || variant.baseProductId || null,
  };
}

async function getEntityCurrentStock(productId, productModel = 'Product') {
  const inv = await InventoryRepository.findByProduct(productId);
  if (inv) {
    return Number(inv.current_stock ?? inv.currentStock ?? 0);
  }

  if (productModel === 'ProductVariant') {
    const variant = await ProductVariantRepository.findById(productId, true);
    const invData = parseInventoryData(variant?.inventory_data ?? variant?.inventoryData);
    return Number(invData.currentStock ?? invData.current_stock ?? 0);
  }

  const product = await ProductRepository.findById(productId, true);
  return Number(product?.stock_quantity ?? product?.stockQuantity ?? 0);
}

module.exports = {
  resolveStockEntity,
  getEntityCurrentStock,
};
