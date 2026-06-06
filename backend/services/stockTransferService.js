const { transaction } = require('../config/postgres');
const warehouseRepository = require('../repositories/WarehouseRepository');
const shopRepository = require('../repositories/ShopRepository');
const stockTransferRepository = require('../repositories/StockTransferRepository');
const productRepository = require('../repositories/ProductRepository');
const locationStockService = require('./locationStockService');

class StockTransferService {
  async createTransfer(payload, userId) {
    const {
      fromWarehouseId,
      toShopId,
      lines,
      notes,
    } = payload;

    if (!Array.isArray(lines) || lines.length === 0) {
      throw new Error('At least one transfer line is required');
    }

    const warehouse = fromWarehouseId
      ? await warehouseRepository.findById(fromWarehouseId)
      : await locationStockService.resolvePrimaryWarehouse();
    if (!warehouse) throw new Error('Source warehouse not found');

    const shop = toShopId
      ? await shopRepository.findById(toShopId)
      : await locationStockService.resolvePrimaryShop();
    if (!shop) throw new Error('Destination shop not found');

    const normalizedLines = [];
    for (const line of lines) {
      const productId = line.productId || line.product;
      const quantity = Number(line.quantity);
      if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
        throw new Error('Each line requires a product and positive quantity');
      }
      const product = await productRepository.findById(productId, true);
      if (!product) throw new Error(`Product not found: ${productId}`);
      normalizedLines.push({
        productId,
        quantity,
        unitCost: line.unitCost != null ? Number(line.unitCost) : parseFloat(product.cost_price || 0),
      });
    }

    return transaction(async (client) => {
      const transferNumber = await stockTransferRepository.nextTransferNumber(client);
      const header = await stockTransferRepository.createHeader({
        transferNumber,
        fromWarehouseId: warehouse.id,
        toShopId: shop.id,
        status: 'completed',
        notes,
        transferredBy: userId,
      }, client);

      const lineResults = [];
      for (const line of normalizedLines) {
        await locationStockService.issueFromWarehouse({
          productId: line.productId,
          quantity: line.quantity,
          warehouseId: warehouse.id,
          reason: 'Stock transfer to shop',
          referenceId: header.id,
          referenceNumber: transferNumber,
          performedBy: userId,
          notes: `Transfer to ${shop.name}`,
        }, { client });

        await locationStockService.receiveAtShop({
          productId: line.productId,
          quantity: line.quantity,
          shopId: shop.id,
          unitCost: line.unitCost,
          reason: 'Stock transfer from warehouse',
          referenceId: header.id,
          referenceNumber: transferNumber,
          performedBy: userId,
          notes: `Transfer from ${warehouse.name}`,
        }, { client });

        const savedLine = await stockTransferRepository.createLine({
          transferId: header.id,
          productId: line.productId,
          quantity: line.quantity,
          unitCost: line.unitCost,
        }, client);
        lineResults.push(savedLine);
      }

      const full = await stockTransferRepository.findById(header.id, client);
      return {
        transfer: this.toApiTransfer(full, lineResults),
      };
    });
  }

  async getTransfers(queryParams = {}) {
    const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit, 10) || 20));
    const filters = {};
    if (queryParams.warehouseId) filters.warehouseId = queryParams.warehouseId;
    if (queryParams.shopId) filters.shopId = queryParams.shopId;
    if (queryParams.status) filters.status = queryParams.status;

    const [transfers, total] = await Promise.all([
      stockTransferRepository.findAll(filters, { page, limit }),
      stockTransferRepository.count(filters),
    ]);

    return {
      transfers: transfers.map((t) => this.toApiTransfer(t)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getTransferById(id) {
    const transfer = await stockTransferRepository.findById(id);
    if (!transfer) throw new Error('Transfer not found');
    const lines = await stockTransferRepository.findLinesByTransferId(id);
    return { transfer: this.toApiTransfer(transfer, lines) };
  }

  toApiTransfer(row, lines = null) {
    if (!row) return null;
    return {
      id: row.id,
      transferNumber: row.transfer_number,
      fromWarehouseId: row.from_warehouse_id,
      toShopId: row.to_shop_id,
      warehouseName: row.warehouse_name,
      warehouseCode: row.warehouse_code,
      shopName: row.shop_name,
      shopCode: row.shop_code,
      status: row.status,
      notes: row.notes,
      transferredBy: row.transferred_by,
      transferredAt: row.transferred_at,
      createdAt: row.created_at,
      lines: (lines || row.lines || []).map((l) => ({
        id: l.id,
        productId: l.product_id,
        productName: l.product_name,
        productSku: l.product_sku,
        quantity: Number(l.quantity),
        unitCost: l.unit_cost != null ? Number(l.unit_cost) : null,
      })),
    };
  }
}

module.exports = new StockTransferService();
