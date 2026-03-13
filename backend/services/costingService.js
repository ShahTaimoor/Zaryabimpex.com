const inventoryRepository = require('../repositories/InventoryRepository');
const productRepository = require('../repositories/ProductRepository');

class CostingService {
  /**
   * Calculate cost using FIFO method
   * @param {string} productId - Product ID
   * @param {number} quantity - Quantity to calculate cost for
   * @returns {Promise<{unitCost: number, totalCost: number, batches: Array}>}
   */
  async calculateFIFOCost(productId, quantity) {
    const inventory = await inventoryRepository.findOne({ product: productId });
    const cost = inventory?.cost && typeof inventory.cost === 'object' ? inventory.cost : (inventory?.cost ? (typeof inventory.cost === 'string' ? JSON.parse(inventory.cost) : inventory.cost) : {});
    const fifo = cost?.fifo && Array.isArray(cost.fifo) ? cost.fifo : [];

    if (!inventory || fifo.length === 0) {
      const product = await productRepository.findById(productId);
      const fallbackCost = cost?.average ?? product?.cost_price ?? product?.costPrice ?? product?.pricing?.cost ?? 0;
      return {
        unitCost: fallbackCost,
        totalCost: fallbackCost * quantity,
        batches: [],
        method: 'fallback'
      };
    }

    // Sort FIFO batches by date (oldest first)
    const fifoBatches = [...inventory.cost.fifo]
      .filter(batch => batch.quantity > 0)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    let remainingQty = quantity;
    let totalCost = 0;
    const batchesUsed = [];

    for (const batch of fifoBatches) {
      if (remainingQty <= 0) break;

      const qtyToUse = Math.min(remainingQty, batch.quantity);
      const batchCost = qtyToUse * batch.cost;
      
      totalCost += batchCost;
      batchesUsed.push({
        batchId: batch._id,
        quantity: qtyToUse,
        unitCost: batch.cost,
        totalCost: batchCost,
        date: batch.date
      });

      remainingQty -= qtyToUse;
    }

    if (remainingQty > 0) {
      const avgCost = cost.average || 0;
      totalCost += remainingQty * avgCost;
      batchesUsed.push({
        quantity: remainingQty,
        unitCost: avgCost,
        totalCost: remainingQty * avgCost,
        note: 'Insufficient FIFO batches, used average cost'
      });
    }

    return {
      unitCost: quantity > 0 ? totalCost / quantity : 0,
      totalCost,
      batches: batchesUsed,
      method: 'FIFO'
    };
  }

  /**
   * Calculate cost using LIFO method
   * @param {string} productId - Product ID
   * @param {number} quantity - Quantity to calculate cost for
   * @returns {Promise<{unitCost: number, totalCost: number, batches: Array}>}
   */
  async calculateLIFOCost(productId, quantity) {
    const inventory = await inventoryRepository.findOne({ product: productId });
    const cost = inventory?.cost && typeof inventory.cost === 'object' ? inventory.cost : (inventory?.cost ? (typeof inventory.cost === 'string' ? JSON.parse(inventory.cost) : inventory.cost) : {});
    const fifo = cost?.fifo && Array.isArray(cost.fifo) ? cost.fifo : [];

    if (!inventory || fifo.length === 0) {
      const product = await productRepository.findById(productId);
      const fallbackCost = cost?.average ?? product?.cost_price ?? product?.costPrice ?? product?.pricing?.cost ?? 0;
      return {
        unitCost: fallbackCost,
        totalCost: fallbackCost * quantity,
        batches: [],
        method: 'fallback'
      };
    }

    // Sort LIFO batches by date (newest first)
    const lifoBatches = [...fifo]
      .filter(batch => batch.quantity > 0)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    let remainingQty = quantity;
    let totalCost = 0;
    const batchesUsed = [];

    for (const batch of lifoBatches) {
      if (remainingQty <= 0) break;

      const qtyToUse = Math.min(remainingQty, batch.quantity);
      const batchCost = qtyToUse * batch.cost;
      
      totalCost += batchCost;
      batchesUsed.push({
        batchId: batch._id,
        quantity: qtyToUse,
        unitCost: batch.cost,
        totalCost: batchCost,
        date: batch.date
      });

      remainingQty -= qtyToUse;
    }

    if (remainingQty > 0) {
      const avgCost = cost.average || 0;
      totalCost += remainingQty * avgCost;
      batchesUsed.push({
        quantity: remainingQty,
        unitCost: avgCost,
        totalCost: remainingQty * avgCost,
        note: 'Insufficient LIFO batches, used average cost'
      });
    }

    return {
      unitCost: quantity > 0 ? totalCost / quantity : 0,
      totalCost,
      batches: batchesUsed,
      method: 'LIFO'
    };
  }

  /**
   * Calculate cost using Average Cost method
   * @param {string} productId - Product ID
   * @param {number} quantity - Quantity to calculate cost for
   * @returns {Promise<{unitCost: number, totalCost: number}>}
   */
  async calculateAverageCost(productId, quantity) {
    const inventory = await inventoryRepository.findOne({ product: productId });
    const product = await productRepository.findById(productId);
    const cost = inventory?.cost && typeof inventory.cost === 'object' ? inventory.cost : (inventory?.cost ? (typeof inventory.cost === 'string' ? JSON.parse(inventory.cost) : inventory.cost) : {});
    const avgCost = cost?.average ?? product?.cost_price ?? product?.costPrice ?? product?.pricing?.cost ?? 0;
    
    return {
      unitCost: avgCost,
      totalCost: avgCost * quantity,
      method: 'AVERAGE'
    };
  }

  /**
   * Calculate cost based on product's costing method
   * @param {string} productId - Product ID
   * @param {number} quantity - Quantity to calculate cost for
   * @returns {Promise<{unitCost: number, totalCost: number, batches: Array}>}
   */
  async calculateCost(productId, quantity) {
    const product = await productRepository.findById(productId);
    if (!product) {
      throw new Error('Product not found');
    }
    const costingMethod = product.costing_method ?? product.costingMethod ?? 'standard';
    const standardCost = Number(product.cost_price ?? product.costPrice ?? product.pricing?.cost ?? 0);
    switch (costingMethod) {
      case 'fifo':
        return await this.calculateFIFOCost(productId, quantity);
      case 'lifo':
        return await this.calculateLIFOCost(productId, quantity);
      case 'average':
        return await this.calculateAverageCost(productId, quantity);
      case 'standard':
      default:
        return {
          unitCost: standardCost,
          totalCost: standardCost * quantity,
          method: 'STANDARD'
        };
    }
  }

  /**
   * Update average cost when new stock is received
   * @param {string} productId - Product ID
   * @param {number} newQuantity - New quantity received
   * @param {number} newCost - Cost per unit of new stock
   * @returns {Promise<number>} Updated average cost
   */
  async updateAverageCost(productId, newQuantity, newCost) {
    const inventory = await inventoryRepository.findOne({ product: productId });
    if (!inventory) {
      throw new Error('Inventory record not found');
    }
    const currentStock = Number(inventory.current_stock ?? inventory.currentStock ?? 0);
    const cost = inventory.cost && typeof inventory.cost === 'object' ? inventory.cost : (typeof inventory.cost === 'string' ? JSON.parse(inventory.cost || '{}') : {});
    const currentAvg = cost.average || 0;
    const currentValue = (currentStock - newQuantity) * currentAvg;
    const newValue = newQuantity * newCost;
    const totalQuantity = currentStock;
    const newAverage = totalQuantity > 0 ? (currentValue + newValue) / totalQuantity : newCost;
    const updatedCost = { ...cost, average: newAverage };
    await inventoryRepository.updateByProductId(productId, { cost: updatedCost });
    return newAverage;
  }

  /**
   * Add FIFO batch when stock is received
   * @param {string} productId - Product ID
   * @param {number} quantity - Quantity received
   * @param {number} cost - Cost per unit
   * @param {Date} date - Purchase date
   * @param {string} purchaseOrderId - Purchase order ID (optional)
   * @returns {Promise<void>}
   */
  async addFIFOBatch(productId, quantity, cost, date = new Date(), purchaseOrderId = null) {
    const inventory = await inventoryRepository.findOne({ product: productId });
    if (!inventory) {
      throw new Error('Inventory record not found');
    }
    const costObj = inventory.cost && typeof inventory.cost === 'object' ? inventory.cost : (typeof inventory.cost === 'string' ? JSON.parse(inventory.cost || '{}') : {});
    if (!costObj.fifo) costObj.fifo = [];
    costObj.fifo.push({
      quantity,
      cost,
      date: date || new Date(),
      purchaseOrder: purchaseOrderId
    });
    await this.updateAverageCost(productId, quantity, cost);
    await inventoryRepository.updateByProductId(productId, { cost: costObj });
  }

  /**
   * Consume FIFO batches when stock is sold
   * @param {string} productId - Product ID
   * @param {number} quantity - Quantity to consume
   * @returns {Promise<{totalCost: number, batches: Array}>}
   */
  async consumeFIFOBatches(productId, quantity) {
    const inventory = await inventoryRepository.findOne({ product: productId });
    const costObj = inventory?.cost && typeof inventory.cost === 'object' ? inventory.cost : (inventory?.cost ? (typeof inventory.cost === 'string' ? JSON.parse(inventory.cost || '{}') : inventory.cost) : {});
    const fifo = costObj?.fifo && Array.isArray(costObj.fifo) ? costObj.fifo : [];
    if (!inventory || fifo.length === 0) {
      throw new Error('FIFO batches not found');
    }
    const batches = fifo.filter(batch => batch.quantity > 0).sort((a, b) => new Date(a.date) - new Date(b.date));
    let remainingQty = quantity;
    let totalCost = 0;
    const consumedBatches = [];
    for (let i = 0; i < batches.length && remainingQty > 0; i++) {
      const batch = batches[i];
      const qtyToConsume = Math.min(remainingQty, batch.quantity);
      totalCost += qtyToConsume * batch.cost;
      batch.quantity -= qtyToConsume;
      remainingQty -= qtyToConsume;
      consumedBatches.push({
        batchId: batch._id,
        quantity: qtyToConsume,
        unitCost: batch.cost,
        totalCost: qtyToConsume * batch.cost
      });
    }
    costObj.fifo = fifo.filter(batch => batch.quantity > 0);
    await inventoryRepository.updateByProductId(productId, { cost: costObj });
    return {
      totalCost,
      batches: consumedBatches,
      remainingQty
    };
  }
}

module.exports = new CostingService();

