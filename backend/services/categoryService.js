const categoryRepository = require('../repositories/CategoryRepository');
const productRepository = require('../repositories/ProductRepository');

class CategoryService {
  /**
   * Build filter query from request parameters
   * @param {object} queryParams - Request query parameters
   * @returns {object} - MongoDB filter object
   */
  buildFilter(queryParams) {
    const filter = {};

    // Active status filter
    if (queryParams.isActive !== undefined) {
      filter.isActive = queryParams.isActive === 'true' || queryParams.isActive === true;
    }

    // Search filter
    if (queryParams.search) {
      filter.$or = [
        { name: { $regex: queryParams.search, $options: 'i' } },
        { description: { $regex: queryParams.search, $options: 'i' } }
      ];
    }

    return filter;
  }

  /**
   * Get categories with filtering and pagination
   * @param {object} queryParams - Query parameters
   * @returns {Promise<object>}
   */
  async getCategories(queryParams) {
    const page = parseInt(queryParams.page) || 1;
    const limit = parseInt(queryParams.limit) || 50;
    const isActive = queryParams.isActive !== undefined 
      ? (queryParams.isActive === 'true' || queryParams.isActive === true)
      : true;

    const filter = this.buildFilter({ ...queryParams, isActive });

    const result = await categoryRepository.findWithPagination(filter, {
      page,
      limit,
      sort: { sortOrder: 1, name: 1 },
      populate: [{ path: 'parentCategory', select: 'name' }]
    });

    return result;
  }

  /**
   * Get category tree
   * @returns {Promise<Array>}
   */
  async getCategoryTree() {
    return await categoryRepository.getCategoryTree();
  }

  /**
   * Get single category by ID
   * @param {string} id - Category ID
   * @returns {Promise<Category>}
   */
  async getCategoryById(id) {
    const category = await categoryRepository.findById(id);
    
    if (!category) {
      throw new Error('Category not found');
    }

    // Populate related fields
    await category.populate([
      { path: 'parentCategory', select: 'name' },
      { path: 'subcategories', select: 'name description' }
    ]);

    return category;
  }

  /**
   * Create new category
   * @param {object} categoryData - Category data
   * @param {string} userId - User ID creating the category
   * @returns {Promise<{category: Category, message: string}>}
   */
  async createCategory(categoryData, userId) {
    // Check if name already exists
    const nameExists = await categoryRepository.nameExists(categoryData.name);
    if (nameExists) {
      throw new Error('Category name already exists');
    }

    const dataWithUser = {
      ...categoryData,
      createdBy: userId
    };

    const category = await categoryRepository.create(dataWithUser);

    return {
      category,
      message: 'Category created successfully'
    };
  }

  /**
   * Update category
   * @param {string} id - Category ID
   * @param {object} updateData - Data to update
   * @returns {Promise<{category: Category, message: string}>}
   */
  async updateCategory(id, updateData) {
    // Check if name already exists (excluding current category)
    if (updateData.name) {
      const nameExists = await categoryRepository.nameExists(updateData.name, id);
      if (nameExists) {
        throw new Error('Category name already exists');
      }
    }

    const category = await categoryRepository.update(id, updateData, {
      new: true,
      runValidators: true
    });

    if (!category) {
      throw new Error('Category not found');
    }

    return {
      category,
      message: 'Category updated successfully'
    };
  }

  /**
   * Delete category
   * @param {string} id - Category ID
   * @returns {Promise<{message: string}>}
   */
  async deleteCategory(id) {
    const category = await categoryRepository.findById(id);
    if (!category) {
      throw new Error('Category not found');
    }

    // Check if category has products
    const productCount = await productRepository.count({ category: id });
    if (productCount > 0) {
      throw new Error(`Cannot delete category. It has ${productCount} associated products.`);
    }

    // Check if category has subcategories
    const subcategoryCount = await categoryRepository.countSubcategories(id);
    if (subcategoryCount > 0) {
      throw new Error(`Cannot delete category. It has ${subcategoryCount} subcategories.`);
    }

    await categoryRepository.softDelete(id);

    return {
      message: 'Category deleted successfully'
    };
  }

  /**
   * Get category statistics
   * @returns {Promise<object>}
   */
  async getStats() {
    return await categoryRepository.getStats();
  }
}

module.exports = new CategoryService();

