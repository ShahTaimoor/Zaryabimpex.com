const fifoService = require('./fifoService');
const inventoryBatchRepository = require('../repositories/postgres/InventoryBatchRepository');

/**
 * Inventory valuation from FIFO batch layers (not weighted average).
 */
class InventoryValuationService {
  async getProductValuation(productId, client = null) {
    return fifoService.getProductValuation(productId, client);
  }

  async getValuationMap(productIds = null, client = null) {
    return fifoService.getValuationMap(productIds, client);
  }

  async getTotalInventoryValue(client = null) {
    const rows = await inventoryBatchRepository.getValuationSummary(null, client);
    return rows.reduce(
      (acc, row) => ({
        totalQty: acc.totalQty + row.totalQty,
        totalValue: acc.totalValue + row.totalValue,
      }),
      { totalQty: 0, totalValue: 0 }
    );
  }
}

module.exports = new InventoryValuationService();
