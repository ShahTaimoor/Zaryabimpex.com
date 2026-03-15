const BaseRepository = require('./BaseRepository');
const Product = require('../models/Product');

class ProductRepository extends BaseRepository {
  constructor() {
    super(Product);
  }

  /**
   * Find products with advanced filtering and pagination
   * @param {object} filter - Filter query
   * @param {object} options - Pagination and sorting options
   * @returns {Promise<{products: Array, total: number, pagination: object}>}
   */
  async findWithPagination(filter = {}, options = {}) {
    const {
      page = 1,
      limit = 20,
      sort = { createdAt: -1 },
      populate = [
        { path: 'category', select: 'name' },
        { path: 'investors.investor', select: 'name email' }
      ],
      getAll = false
    } = options;

    const skip = getAll ? 0 : (page - 1) * limit;
    const finalLimit = getAll ? 999999 : limit;

    const [products, total] = await Promise.all([
      this.findAll(filter, { skip, limit: finalLimit, sort, populate }),
      this.count(filter)
    ]);

    return {
      products,
      total,
      pagination: getAll ? {
        current: 1,
        pages: 1,
        total,
        hasNext: false,
        hasPrev: false
      } : {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };
  }

  /**
   * Find product by SKU
   * @param {string} sku - Product SKU
   * @param {object} options - Query options
   * @returns {Promise<Product|null>}
   */
  async findBySku(sku, options = {}) {
    return await this.findOne({ sku }, options);
  }

  /**
   * Find product by barcode
   * @param {string} barcode - Product barcode
   * @param {object} options - Query options
   * @returns {Promise<Product|null>}
   */
  async findByBarcode(barcode, options = {}) {
    return await this.findOne({ barcode }, options);
  }

  /**
   * Find product by name
   * @param {string} name - Product name
   * @param {object} options - Query options
   * @returns {Promise<Product|null>}
   */
  async findByName(name, options = {}) {
    return await this.findOne({ name: { $regex: `^${name}$`, $options: 'i' } }, options);
  }

  /**
   * Find products by category
   * @param {string|Array} categoryIds - Category ID(s)
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByCategory(categoryIds, options = {}) {
    const filter = Array.isArray(categoryIds)
      ? { category: { $in: categoryIds } }
      : { category: categoryIds };
    return await this.findAll(filter, options);
  }

  /**
   * Find low stock products
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findLowStock(options = {}) {
    const filter = {
      $expr: { $lte: ['$inventory.currentStock', '$inventory.reorderPoint'] }
    };
    return await this.findAll(filter, options);
  }

  /**
   * Find out of stock products
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findOutOfStock(options = {}) {
    return await this.findAll({ 'inventory.currentStock': 0 }, options);
  }

  /**
   * Find products by IDs
   * @param {Array} productIds - Array of product IDs
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByIds(productIds, options = {}) {
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return [];
    }
    return await this.findAll({ _id: { $in: productIds } }, options);
  }

  /**
   * Search products by multiple fields
   * @param {string} searchTerm - Search term
   * @param {Array} searchFields - Fields to search in
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async search(searchTerm, searchFields = ['name', 'description'], options = {}) {
    const searchConditions = [];
    
    searchFields.forEach(field => {
      if (field === 'sku' || field === 'barcode') {
        // Exact match for SKU/barcode
        searchConditions.push({ [field]: { $regex: `^${searchTerm}$`, $options: 'i' } });
      } else {
        // Partial match for other fields
        searchConditions.push({ [field]: { $regex: searchTerm, $options: 'i' } });
      }
    });

    const filter = searchConditions.length > 0 ? { $or: searchConditions } : {};
    return await this.findAll(filter, options);
  }

  /**
   * Update product stock (atomic operation to prevent race conditions)
   * @param {string} id - Product ID
   * @param {number} quantity - Quantity to add/subtract (negative for subtraction)
   * @returns {Promise<Product>}
   */
  async updateStock(id, quantity) {
    // Use atomic update to prevent race conditions
    const updated = await this.Model.findOneAndUpdate(
      { _id: id },
      {
        $inc: { 'inventory.currentStock': quantity },
        $set: { 'inventory.lastUpdated': new Date() }
      },
      { new: true, runValidators: true }
    );
    
    if (!updated) {
      throw new Error('Product not found');
    }
    
    // Ensure stock doesn't go negative (post-update validation)
    if (updated.inventory.currentStock < 0) {
      // Rollback to 0 if negative
      updated.inventory.currentStock = 0;
      await updated.save();
    }
    
    return updated;
  }

  /**
   * Bulk update products
   * @param {Array} productIds - Array of product IDs
   * @param {object} updateData - Data to update
   * @returns {Promise<object>}
   */
  async bulkUpdate(productIds, updateData) {
    return await this.updateMany(
      { _id: { $in: productIds } },
      updateData
    );
  }

  /**
   * Bulk delete products (soft delete)
   * @param {Array} productIds - Array of product IDs
   * @returns {Promise<object>}
   */
  async bulkDelete(productIds) {
    return await this.updateMany(
      { _id: { $in: productIds } },
      { isDeleted: true, deletedAt: new Date() }
    );
  }

  /**
   * Check if product name exists
   * @param {string} name - Product name
   * @param {string} excludeId - Product ID to exclude from check
   * @returns {Promise<boolean>}
   */
  async nameExists(name, excludeId = null) {
    const query = { name: { $regex: `^${name}$`, $options: 'i' } };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    return await this.exists(query);
  }

  /**
   * Check if SKU exists
   * @param {string} sku - Product SKU
   * @param {string} excludeId - Product ID to exclude from check
   * @returns {Promise<boolean>}
   */
  async skuExists(sku, excludeId = null) {
    const query = { sku };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    return await this.exists(query);
  }

  /**
   * Check if barcode exists
   * @param {string} barcode - Product barcode
   * @param {string} excludeId - Product ID to exclude from check
   * @returns {Promise<boolean>}
   */
  async barcodeExists(barcode, excludeId = null) {
    const query = { barcode };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    return await this.exists(query);
  }

  /**
   * Run aggregation pipeline on products
   * @param {Array} pipeline - Aggregation pipeline
   * @returns {Promise<Array>}
   */
  async aggregate(pipeline) {
    return await this.Model.aggregate(pipeline);
  }
}

module.exports = new ProductRepository();

