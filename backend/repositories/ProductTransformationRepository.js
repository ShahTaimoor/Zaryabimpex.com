const BaseRepository = require('./BaseRepository');
const ProductTransformation = require('../models/ProductTransformation');

class ProductTransformationRepository extends BaseRepository {
  constructor() {
    super(ProductTransformation);
  }

  /**
   * Find product transformations with filtering
   * @param {object} filter - Filter query
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findWithFilter(filter = {}, options = {}) {
    const {
      sort = { transformationDate: -1 },
      populate = [
        { path: 'baseProduct', select: 'name description pricing' },
        { path: 'targetVariant', select: 'variantName displayName pricing transformationCost' },
        { path: 'performedBy', select: 'firstName lastName' }
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
}

module.exports = new ProductTransformationRepository();

