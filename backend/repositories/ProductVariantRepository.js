const BaseRepository = require('./BaseRepository');
const ProductVariant = require('../models/ProductVariant');

class ProductVariantRepository extends BaseRepository {
  constructor() {
    super(ProductVariant);
  }

  /**
   * Find product variants with filtering
   * @param {object} filter - Filter query
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findWithFilter(filter = {}, options = {}) {
    const {
      sort = { createdAt: -1 },
      populate = [
        { path: 'baseProduct', select: 'name description pricing' },
        { path: 'createdBy', select: 'firstName lastName' },
        { path: 'lastModifiedBy', select: 'firstName lastName' }
      ]
    } = options;

    let queryBuilder = this.Model.find(filter);
    
    if (populate && populate.length > 0) {
      populate.forEach(pop => {
        queryBuilder = queryBuilder.populate(pop);
      });
    }
    
    if (sort) {
      queryBuilder = queryBuilder.sort(sort);
    }

    return await queryBuilder;
  }

  /**
   * Find variants by base product
   * @param {string} baseProductId - Base product ID
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByBaseProduct(baseProductId, options = {}) {
    const {
      sort = { variantType: 1, variantValue: 1 },
      populate = [
        { path: 'baseProduct', select: 'name description pricing' }
      ]
    } = options;

    return await this.findAll({ baseProduct: baseProductId, status: 'active' }, {
      sort,
      populate
    });
  }
}

module.exports = new ProductVariantRepository();

