const BaseRepository = require('./BaseRepository');
const Inventory = require('../models/Inventory');

class InventoryRepository extends BaseRepository {
  constructor() {
    super(Inventory);
  }

  /**
   * Find inventory by product ID
   * @param {string} productId - Product ID
   * @param {object} options - Query options
   * @returns {Promise<Inventory|null>}
   */
  async findByProduct(productId, options = {}) {
    return await this.findOne({ product: productId }, options);
  }

  /**
   * Find inventory with aggregation (for complex queries with product joins)
   * @param {Array} pipeline - Aggregation pipeline
   * @returns {Promise<Array>}
   */
  async aggregate(pipeline) {
    return await this.Model.aggregate(pipeline);
  }

  /**
   * Find low stock items
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findLowStock(options = {}) {
    const filter = {
      $expr: { $lte: ['$currentStock', '$reorderPoint'] },
      status: 'active'
    };
    return await this.findAll(filter, options);
  }

  /**
   * Find inventory by warehouse
   * @param {string} warehouse - Warehouse name
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByWarehouse(warehouse, options = {}) {
    return await this.findAll({ 'location.warehouse': warehouse }, options);
  }

  /**
   * Find inventory by status
   * @param {string} status - Inventory status
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByStatus(status, options = {}) {
    return await this.findAll({ status }, options);
  }

  /**
   * Update stock level
   * @param {string} productId - Product ID
   * @param {number} quantity - Quantity change (positive for increase, negative for decrease)
   * @returns {Promise<Inventory>}
   */
  async updateStock(productId, quantity) {
    const inventory = await this.findByProduct(productId);
    if (!inventory) {
      throw new Error('Inventory record not found');
    }
    inventory.currentStock += quantity;
    if (inventory.currentStock < 0) {
      inventory.currentStock = 0;
    }
    inventory.availableStock = inventory.currentStock - inventory.reservedStock;
    inventory.lastUpdated = new Date();
    return await inventory.save();
  }
}

module.exports = new InventoryRepository();

