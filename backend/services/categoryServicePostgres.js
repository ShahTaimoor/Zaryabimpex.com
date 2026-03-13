const categoryRepository = require('../repositories/postgres/CategoryRepository');
const productRepository = require('../repositories/postgres/ProductRepository');

function toCamel(row) {
  if (!row) return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = v;
  }
  return out;
}

function mapTree(tree) {
  return tree.map(node => ({
    ...toCamel(node),
    subcategories: node.subcategories ? mapTree(node.subcategories) : []
  }));
}

class CategoryServicePostgres {
  async getCategories(queryParams) {
    const page = parseInt(queryParams.page) || 1;
    const limit = parseInt(queryParams.limit) || 50;
    const isActive = queryParams.isActive !== undefined
      ? (queryParams.isActive === 'true' || queryParams.isActive === true)
      : true;

    const filters = { isActive, search: queryParams.search };
    const result = await categoryRepository.findWithPagination(filters, { page, limit });

    return {
      categories: result.categories.map(toCamel),
      pagination: result.pagination
    };
  }

  async getCategoryTree() {
    const tree = await categoryRepository.getCategoryTree();
    return mapTree(tree);
  }

  async getCategoryById(id) {
    const category = await categoryRepository.findById(id);
    if (!category) {
      throw new Error('Category not found');
    }
    return toCamel(category);
  }

  async createCategory(categoryData, userId) {
    const nameExists = await categoryRepository.nameExists(categoryData.name);
    if (nameExists) {
      throw new Error('Category name already exists');
    }

    const category = await categoryRepository.create(categoryData);
    return {
      category: toCamel(category),
      message: 'Category created successfully'
    };
  }

  async updateCategory(id, updateData) {
    if (updateData.name) {
      const nameExists = await categoryRepository.nameExists(updateData.name, id);
      if (nameExists) {
        throw new Error('Category name already exists');
      }
    }

    const category = await categoryRepository.update(id, updateData);
    if (!category) {
      throw new Error('Category not found');
    }

    return {
      category: toCamel(category),
      message: 'Category updated successfully'
    };
  }

  async deleteCategory(id) {
    const category = await categoryRepository.findById(id);
    if (!category) {
      throw new Error('Category not found');
    }

    const productCount = await productRepository.countByCategory(id);
    if (productCount > 0) {
      throw new Error(`Cannot delete category. It has ${productCount} associated products.`);
    }

    const subcategoryCount = await categoryRepository.countSubcategories(id);
    if (subcategoryCount > 0) {
      throw new Error(`Cannot delete category. It has ${subcategoryCount} subcategories.`);
    }

    await categoryRepository.delete(id);
    return { message: 'Category deleted successfully' };
  }

  async getStats() {
    return await categoryRepository.getStats();
  }

  async getCategoryByName(name) {
    const category = await categoryRepository.findByName(name);
    return category ? toCamel(category) : null;
  }

  async checkNameExists(name, excludeId = null) {
    return await categoryRepository.nameExists(name, excludeId);
  }
}

module.exports = new CategoryServicePostgres();
