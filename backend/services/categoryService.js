const categoryRepository = require('../repositories/CategoryRepository');
const productRepository = require('../repositories/ProductRepository');
const ExcelJS = require('exceljs');
const csv = require('csv-parser');
const { Readable } = require('stream');

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

  /**
   * Export categories to CSV
   * @param {object} queryParams - Filter parameters
   * @returns {Promise<string>}
   */
  async exportToCSV(queryParams) {
    const filter = this.buildFilter(queryParams);
    const categories = await categoryRepository.findAll(filter, {
      sort: { sortOrder: 1, name: 1 },
      populate: [{ path: 'parentCategory', select: 'name' }]
    });

    const fields = ['Category Name', 'Description', 'Parent Category', 'Sort Order', 'Status'];
    let csvContent = fields.join(',') + '\n';

    categories.forEach(cat => {
      const row = [
        `"${(cat.name || '').replace(/"/g, '""')}"`,
        `"${(cat.description || '').replace(/"/g, '""')}"`,
        `"${(cat.parentCategory ? cat.parentCategory.name : '').replace(/"/g, '""')}"`,
        cat.sortOrder || 0,
        cat.isActive ? 'Active' : 'Inactive'
      ];
      csvContent += row.join(',') + '\n';
    });

    return csvContent;
  }

  /**
   * Export categories to Excel
   * @param {object} queryParams - Filter parameters
   * @returns {Promise<Buffer>}
   */
  async exportToExcel(queryParams) {
    const filter = this.buildFilter(queryParams);
    const categories = await categoryRepository.findAll(filter, {
      sort: { sortOrder: 1, name: 1 },
      populate: [{ path: 'parentCategory', select: 'name' }]
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Categories');

    worksheet.columns = [
      { header: 'Category Name', key: 'name', width: 30 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Parent Category', key: 'parent', width: 30 },
      { header: 'Sort Order', key: 'sortOrder', width: 15 },
      { header: 'Status', key: 'status', width: 15 }
    ];

    categories.forEach(cat => {
      worksheet.addRow({
        name: cat.name,
        description: cat.description || '',
        parent: cat.parentCategory ? cat.parentCategory.name : '',
        sortOrder: cat.sortOrder || 0,
        status: cat.isActive ? 'Active' : 'Inactive'
      });
    });

    // Style the header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    return await workbook.xlsx.writeBuffer();
  }

  /**
   * Import categories from CSV
   * @param {Buffer} buffer - CSV file buffer
   * @param {string} userId - User ID performing the import
   * @returns {Promise<object>}
   */
  async importFromCSV(buffer, userId) {
    const results = {
      success: 0,
      errors: []
    };

    const stream = Readable.from(buffer.toString());
    const rows = [];

    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (data) => rows.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        await this.processImportRow(row, userId);
        results.success++;
      } catch (error) {
        results.errors.push({
          row: i + 2, // +1 for header, +1 for 1-based indexing
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Import categories from Excel
   * @param {Buffer} buffer - Excel file buffer
   * @param {string} userId - User ID performing the import
   * @returns {Promise<object>}
   */
  async importFromExcel(buffer, userId) {
    const results = {
      success: 0,
      errors: []
    };

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.getWorksheet(1);

    const rows = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const rowData = {
        'Category Name': row.getCell(1).value,
        'Description': row.getCell(2).value,
        'Parent Category': row.getCell(3).value,
        'Sort Order': row.getCell(4).value,
        'Status': row.getCell(5).value
      };
      rows.push({ data: rowData, number: rowNumber });
    });

    for (const rowObj of rows) {
      try {
        await this.processImportRow(rowObj.data, userId);
        results.success++;
      } catch (error) {
        results.errors.push({
          row: rowObj.number,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Process a single row from import
   * @param {object} row - Row data
   * @param {string} userId - User ID
   */
  async processImportRow(row, userId) {
    const name = row['Category Name'] || row['name'];
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new Error('Category Name is required');
    }

    const description = row['Description'] || row['description'] || '';
    const parentName = row['Parent Category'] || row['parent'] || '';
    const sortOrder = parseInt(row['Sort Order'] || row['sortOrder']) || 0;
    const status = (row['Status'] || row['status'] || 'Active').toString().toLowerCase();
    const isActive = status === 'active' || status === 'true' || status === '1';

    // Check if category already exists
    let category = await categoryRepository.findOne({ name: name.trim(), isDeleted: false });

    let parentId = undefined;
    if (parentName && typeof parentName === 'string' && parentName.trim()) {
      const parent = await categoryRepository.findOne({ name: parentName.trim(), isDeleted: false });
      if (parent) {
        parentId = parent._id;
      }
      // If parent doesn't exist, we could create it, but for now we'll just skip it or throw error
      // throw new Error(`Parent category '${parentName}' not found`);
    }

    const categoryData = {
      name: name.trim(),
      description: description.toString().trim(),
      parentCategory: parentId,
      sortOrder,
      isActive,
      lastModifiedBy: userId
    };

    if (category) {
      // Update existing
      await categoryRepository.update(category._id, categoryData);
    } else {
      // Create new
      await categoryRepository.create({
        ...categoryData,
        createdBy: userId
      });
    }
  }

  /**
   * Get import template CSV
   * @returns {string}
   */
  async getImportTemplate() {
    return 'Category Name,Description,Parent Category,Sort Order,Status\nElectronics,Electronic items and gadgets,,0,Active\nSmartphones,Mobile phones,Electronics,1,Active';
  }
}

module.exports = new CategoryService();

