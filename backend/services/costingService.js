const Inventory = require('../models/Inventory');
const Product = require('../models/Product');

class CostingService {
  /**
   * Calculate cost using FIFO method
   * @param {string} productId - Product ID
   * @param {number} quantity - Quantity to calculate cost for
   * @returns {Promise<{unitCost: number, totalCost: number, batches: Array}>}
   */
  async calculateFIFOCost(productId, quantity) {
    const inventory = await Inventory.findOne({ product: productId });
    
    if (!inventory || !inventory.cost?.fifo || inventory.cost.fifo.length === 0) {
      // Fallback to average or standard cost
      const product = await Product.findById(productId);
      const fallbackCost = inventory?.cost?.average || product?.pricing?.cost || 0;
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
      // Not enough stock in FIFO batches, use average cost for remaining
      const avgCost = inventory.cost.average || 0;
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
    const inventory = await Inventory.findOne({ product: productId });
    
    if (!inventory || !inventory.cost?.fifo || inventory.cost.fifo.length === 0) {
      // Fallback to average or standard cost
      const product = await Product.findById(productId);
      const fallbackCost = inventory?.cost?.average || product?.pricing?.cost || 0;
      return {
        unitCost: fallbackCost,
        totalCost: fallbackCost * quantity,
        batches: [],
        method: 'fallback'
      };
    }

    // Sort LIFO batches by date (newest first)
    const lifoBatches = [...inventory.cost.fifo]
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
      // Not enough stock in LIFO batches, use average cost for remaining
      const avgCost = inventory.cost.average || 0;
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
    const inventory = await Inventory.findOne({ product: productId });
    const product = await Product.findById(productId);
    
    const avgCost = inventory?.cost?.average || product?.pricing?.cost || 0;
    
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
    const product = await Product.findById(productId);
    
    if (!product) {
      throw new Error('Product not found');
    }

    const costingMethod = product.costingMethod || 'standard';

    switch (costingMethod) {
      case 'fifo':
        return await this.calculateFIFOCost(productId, quantity);
      case 'lifo':
        return await this.calculateLIFOCost(productId, quantity);
      case 'average':
        return await this.calculateAverageCost(productId, quantity);
      case 'standard':
      default:
        // Use product.pricing.cost directly
        return {
          unitCost: product.pricing.cost,
          totalCost: product.pricing.cost * quantity,
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
    const inventory = await Inventory.findOne({ product: productId });
    
    if (!inventory) {
      throw new Error('Inventory record not found');
    }

    const currentStock = inventory.currentStock || 0;
    const currentAvg = inventory.cost?.average || 0;
    
    // Calculate new average: (currentValue + newValue) / totalQuantity
    const currentValue = (currentStock - newQuantity) * currentAvg;
    const newValue = newQuantity * newCost;
    const totalQuantity = currentStock;
    
    const newAverage = totalQuantity > 0 
      ? (currentValue + newValue) / totalQuantity 
      : newCost;

    // Update inventory average cost
    if (!inventory.cost) {
      inventory.cost = {};
    }
    inventory.cost.average = newAverage;
    await inventory.save();

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
    const inventory = await Inventory.findOne({ product: productId });
    
    if (!inventory) {
      throw new Error('Inventory record not found');
    }

    if (!inventory.cost) {
      inventory.cost = {};
    }
    
    if (!inventory.cost.fifo) {
      inventory.cost.fifo = [];
    }

    // Add new batch
    inventory.cost.fifo.push({
      quantity,
      cost,
      date: date || new Date(),
      purchaseOrder: purchaseOrderId
    });

    // Update average cost
    await this.updateAverageCost(productId, quantity, cost);
    
    await inventory.save();
  }

  /**
   * Consume FIFO batches when stock is sold
   * @param {string} productId - Product ID
   * @param {number} quantity - Quantity to consume
   * @returns {Promise<{totalCost: number, batches: Array}>}
   */
  async consumeFIFOBatches(productId, quantity) {
    const inventory = await Inventory.findOne({ product: productId });
    
    if (!inventory || !inventory.cost?.fifo) {
      throw new Error('FIFO batches not found');
    }

    // Sort by date (oldest first)
    const batches = inventory.cost.fifo
      .filter(batch => batch.quantity > 0)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

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

    // Remove empty batches
    inventory.cost.fifo = inventory.cost.fifo.filter(batch => batch.quantity > 0);
    
    await inventory.save();

    return {
      totalCost,
      batches: consumedBatches,
      remainingQty // If > 0, not enough stock in FIFO batches
    };
  }
}

module.exports = new CostingService();

