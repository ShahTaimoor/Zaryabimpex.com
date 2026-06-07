const ShopRepository = require('../repositories/ShopRepository');
const ShopStockRepository = require('../repositories/ShopStockRepository');
const productRepository = require('../repositories/ProductRepository');
const locationStockService = require('./locationStockService');

class ShopService {
  async getShops(queryParams = {}) {
    const { search, isActive, page = 1, limit = 20 } = queryParams;
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true' || isActive === true;
    const result = await ShopRepository.findWithPagination(filter, {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
    });
    return {
      shops: result.shops.map(this.toApiShop),
      pagination: result.pagination,
    };
  }

  async getShopById(id) {
    const shop = await ShopRepository.findById(id);
    if (!shop) throw new Error('Shop not found');
    return this.toApiShop(shop);
  }

  async createShop(data, userId) {
    const existing = await ShopRepository.findByCode(data.code);
    if (existing) throw new Error('Shop code already exists');
    if (data.isPrimary) await ShopRepository.unsetAllPrimary();
    const shop = await ShopRepository.create({ ...data, createdBy: userId });
    return this.toApiShop(shop);
  }

  async updateShop(id, data, userId) {
    const shop = await ShopRepository.findById(id);
    if (!shop) throw new Error('Shop not found');
    if (data.code && data.code.toUpperCase() !== shop.code) {
      const existing = await ShopRepository.findByCode(data.code);
      if (existing && existing.id !== id) throw new Error('Shop code already exists');
    }
    const updated = await ShopRepository.updateById(id, { ...data, updatedBy: userId });
    return this.toApiShop(updated);
  }

  async deleteShop(id) {
    const shop = await ShopRepository.findById(id);
    if (!shop) throw new Error('Shop not found');
    if (shop.is_primary) throw new Error('Cannot delete the primary shop');
    await ShopRepository.softDelete(id);
    return { message: 'Shop deleted successfully' };
  }

  async getShopStock(shopId, queryParams = {}) {
    const shop = shopId ? await ShopRepository.findById(shopId) : await locationStockService.resolvePrimaryShop();
    if (!shop) throw new Error('Shop not found');
    const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(queryParams.limit, 10) || 50));
    const search = queryParams.search || undefined;
    const allProducts =
      queryParams.allProducts === true ||
      queryParams.allProducts === 'true' ||
      queryParams.allProducts === '1';
    const [rows, total] = await Promise.all([
      ShopStockRepository.listByShop(shop.id, { search, page, limit, allProducts }),
      ShopStockRepository.countByShop(shop.id, search, allProducts),
    ]);
    return {
      shop: this.toApiShop(shop),
      stock: rows.map((r) => ({
        productId: r.product_id,
        productName: r.product_name,
        productSku: r.product_sku,
        quantity: Number(r.quantity),
        reservedQuantity: Number(r.reserved_quantity || 0),
        availableQuantity: Math.max(0, Number(r.quantity) - Number(r.reserved_quantity || 0)),
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    };
  }

  async getShopProducts(shopId, queryParams = {}) {
    const result = await this.getShopStock(shopId, queryParams);
    return {
      shop: result.shop,
      products: result.stock.map((s) => ({
        id: s.productId,
        name: s.productName,
        sku: s.productSku,
        inventory: {
          currentStock: s.quantity,
          availableStock: s.availableQuantity,
          reservedStock: s.reservedQuantity,
        },
      })),
      pagination: result.pagination,
    };
  }

  toApiShop(row) {
    if (!row) return null;
    return {
      id: row.id,
      shopId: row.id,
      name: row.name,
      code: row.code,
      description: row.description,
      address: row.address,
      contact: row.contact,
      notes: row.notes,
      isPrimary: row.is_primary,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

module.exports = new ShopService();
