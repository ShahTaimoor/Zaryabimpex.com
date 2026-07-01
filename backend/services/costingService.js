const fifoService = require('./fifoService');

/**
 * Costing facade — all inventory costing uses FIFO.
 */
class CostingService {
  async calculateCost(productId, quantity, client = null) {
    return fifoService.calculateFIFOCost(productId, quantity, client);
  }

  async calculateFIFOCost(productId, quantity, client = null) {
    return fifoService.calculateFIFOCost(productId, quantity, client);
  }

  async consumeForSale(params, client = null) {
    return fifoService.consumeStock(
      {
        ...params,
        movementType: 'sale_out',
        referenceModel: params.referenceModel || 'Sale',
      },
      client
    );
  }

  async receiveStock(params, client = null) {
    return fifoService.receiveStock(params, client);
  }

  async restoreFromSaleAllocations(params, client = null) {
    return fifoService.restoreFromSaleAllocations(params, client);
  }

  async reduceFromPurchaseBatches(params, client = null) {
    return fifoService.reduceFromPurchaseBatches(params, client);
  }
}

module.exports = new CostingService();
