const warehouseRepository = require('../repositories/WarehouseRepository');
const warehouseStockRepository = require('../repositories/WarehouseStockRepository');
const locationStockService = require('./locationStockService');

class WarehouseStockService {
  async getWarehouseStock(warehouseId, queryParams = {}) {
    const warehouse = warehouseId
      ? await warehouseRepository.findById(warehouseId)
      : await locationStockService.resolvePrimaryWarehouse();
    if (!warehouse) throw new Error('Warehouse not found');

    const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(queryParams.limit, 10) || 50));
    const search = queryParams.search || undefined;
    const allProducts =
      queryParams.allProducts === true ||
      queryParams.allProducts === 'true' ||
      queryParams.allProducts === '1';

    const [rows, total] = await Promise.all([
      warehouseStockRepository.listByWarehouse(warehouse.id, { search, page, limit, allProducts }),
      warehouseStockRepository.countByWarehouse(warehouse.id, search, allProducts),
    ]);

    return {
      warehouse: {
        id: warehouse.id,
        name: warehouse.name,
        code: warehouse.code,
      },
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
}

module.exports = new WarehouseStockService();
