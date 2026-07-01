const fifoService = require('./fifoService');
const saleBatchAllocationRepository = require('../repositories/postgres/SaleBatchAllocationRepository');

/**
 * COGS derived from FIFO batch consumption at sale time.
 */
class COGSService {
  async calculateSaleLineCOGS(productId, quantity, client = null) {
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

  async getSaleCOGSFromAllocations(saleId, client = null) {
    const allocations = await saleBatchAllocationRepository.findBySale(saleId, client);
    const totalCost = allocations.reduce((sum, a) => sum + (a.totalCost || 0), 0);
    return { totalCost, allocations, method: 'FIFO' };
  }
}

module.exports = new COGSService();
