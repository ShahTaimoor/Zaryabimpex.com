const express = require('express');
const { body, param, query } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors, sanitizeRequest } = require('../middleware/validation');
const categoryService = require('../services/categoryServicePostgres');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

const router = express.Router();

// @route   POST /api/categories/import/excel
// @desc    Import categories from Excel
// @access  Private (requires 'manage_products' permission)
router.post('/import/excel', [
  auth,
  requirePermission('manage_products'),
  upload.single('file')
], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    const results = {
      total: 0,
      success: 0,
      errors: []
    };
    
    // Read Excel file
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const categories = XLSX.utils.sheet_to_json(worksheet);
    
    console.log('Importing categories, first row sample:', categories[0]);
    
    results.total = categories.length;
    
    for (let i = 0; i < categories.length; i++) {
      try {
        const rawRow = categories[i];
        // Normalize keys to handle spaces and case sensitivity
        const row = {};
        Object.keys(rawRow).forEach(key => {
          row[key.trim()] = rawRow[key];
        });
        
        // Map Excel columns to our format
        const categoryData = {
          name: row['Name'] || row['name'] || row['Category Name'] || row['category name'] || row.name,
          description: row['Description'] || row['description'] || row.description || '',
          parentCategoryName: row['Parent Category'] || row['parentCategory'] || row['ParentCategory'] || row.parentCategory,
          sortOrder: parseInt(row['Sort Order'] || row['sortOrder'] || row['SortOrder'] || row.sortOrder) || 0,
          isActive: row['Status'] || row['status'] ? (row['Status'] || row['status']).toString().toLowerCase() === 'active' : true
        };
        
        // Validate required fields
        if (!categoryData.name) {
          results.errors.push({
            row: i + 2,
            error: 'Missing required field: Name is required'
          });
          continue;
        }
        
        // Resolve parent category ID if name provided
        let parentCategoryId = null;
        if (categoryData.parentCategoryName) {
          const parentCategory = await categoryService.getCategoryByName(categoryData.parentCategoryName);
          if (parentCategory) {
            parentCategoryId = parentCategory.id;
          }
        }
        
        // Check if category already exists
        const categoryExists = await categoryService.checkNameExists(categoryData.name);
        
        if (categoryExists) {
          results.errors.push({
            row: i + 2,
            error: `Category already exists with name: ${categoryData.name}`
          });
          continue;
        }
        
        // Create category
        await categoryService.createCategory({
          name: categoryData.name.toString().trim(),
          description: categoryData.description.toString().trim(),
          parentCategory: parentCategoryId,
          sortOrder: categoryData.sortOrder,
          isActive: categoryData.isActive
        }, req.user?.id || req.user?._id);
        
        results.success++;
        
      } catch (error) {
        results.errors.push({
          row: i + 2,
          error: error.message
        });
      }
    }
    
    // Clean up uploaded file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.json({
      message: 'Import completed',
      results: results
    });
    
  } catch (error) {
    console.error('Category Excel import error:', error);
    res.status(500).json({ message: 'Import failed', error: error.message });
  }
});

// @route   POST /api/categories/export/excel
// @desc    Export categories to Excel
// @access  Private (requires 'view_products' permission)
router.post('/export/excel', [auth, requirePermission('view_products')], async (req, res) => {
  try {
    const { filters = {} } = req.body;
    
    // Get all categories for export (no pagination)
    const result = await categoryService.getCategories({ ...filters, limit: 10000 });
    const categories = result.categories;
    
    // Prepare Excel data
    const excelData = categories.map(cat => ({
      'Name': cat.name,
      'Description': cat.description || '',
      'Parent Category': cat.parentCategory ? cat.parentCategory.name : '',
      'Sort Order': cat.sortOrder || 0,
      'Status': cat.isActive ? 'active' : 'inactive'
    }));
    
    // Create Excel workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Set column widths
    const columnWidths = [
      { wch: 25 }, // Name
      { wch: 40 }, // Description
      { wch: 25 }, // Parent Category
      { wch: 12 }, // Sort Order
      { wch: 12 }  // Status
    ];
    worksheet['!cols'] = columnWidths;
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Categories');
    
    // Ensure exports directory exists
    if (!fs.existsSync('exports')) {
      fs.mkdirSync('exports');
    }
    
    const filename = `categories_${Date.now()}.xlsx`;
    const filepath = path.join('exports', filename);
    XLSX.writeFile(workbook, filepath);
    
    res.json({
      message: 'Categories exported successfully',
      filename: filename,
      recordCount: excelData.length,
      downloadUrl: `/api/categories/download/${filename}`
    });
    
  } catch (error) {
    console.error('Category Excel export error:', error);
    res.status(500).json({ message: 'Export failed', error: error.message });
  }
});

// @route   GET /api/categories/download/:filename
// @desc    Download exported file
// @access  Private (requires 'view_products' permission)
router.get('/download/:filename', [auth, requirePermission('view_products')], (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join('exports', filename);
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('File download error:', err);
      }
    });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ message: 'Download failed' });
  }
});

// @route   GET /api/categories/template/excel
// @desc    Download Excel template for category import
// @access  Private (requires 'manage_products' permission)
router.get('/template/excel', [auth, requirePermission('manage_products')], (req, res) => {
  try {
    const templateData = [
      {
        'Name': 'Electronics',
        'Description': 'Electronic items and gadgets',
        'Parent Category': '',
        'Sort Order': '1',
        'Status': 'active'
      },
      {
        'Name': 'Smartphones',
        'Description': 'Mobile phones and accessories',
        'Parent Category': 'Electronics',
        'Sort Order': '1',
        'Status': 'active'
      }
    ];
    
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    
    const columnWidths = [
      { wch: 25 },
      { wch: 40 },
      { wch: 25 },
      { wch: 12 },
      { wch: 12 }
    ];
    worksheet['!cols'] = columnWidths;
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
    
    if (!fs.existsSync('exports')) {
      fs.mkdirSync('exports');
    }
    
    const filename = 'category_import_template.xlsx';
    const filepath = path.join('exports', filename);
    XLSX.writeFile(workbook, filepath);
    
    res.download(filepath, filename);
  } catch (error) {
    console.error('Template generation error:', error);
    res.status(500).json({ message: 'Failed to generate template' });
  }
});

// @route   GET /api/categories
// @desc    Get list of categories
// @access  Private (requires 'view_products' permission)
router.get('/', [
  auth,
  requirePermission('view_products'),
  sanitizeRequest,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 999999 }),
  query('search').optional().trim(),
  query('isActive').optional().isBoolean(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const result = await categoryService.getCategories(req.query);
    
    res.json({
      categories: result.categories,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Server error fetching categories', error: error.message });
  }
});

// @route   GET /api/categories/tree
// @desc    Get category tree structure
// @access  Private (requires 'view_products' permission)
router.get('/tree', [
  auth,
  requirePermission('view_products'),
  sanitizeRequest,
], async (req, res) => {
  try {
    const categoryTree = await categoryService.getCategoryTree();
    res.json(categoryTree);
  } catch (error) {
    console.error('Error fetching category tree:', error);
    res.status(500).json({ message: 'Server error fetching category tree', error: error.message });
  }
});

// @route   GET /api/categories/stats
// @desc    Get category statistics (must be before /:categoryId)
// @access  Private (requires 'view_products' permission)
router.get('/stats', [
  auth,
  requirePermission('view_products'),
  sanitizeRequest,
], async (req, res) => {
  try {
    const stats = await categoryService.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching category stats:', error);
    res.status(500).json({ message: 'Server error fetching category stats', error: error.message });
  }
});

// @route   GET /api/categories/:categoryId
// @desc    Get detailed category information
// @access  Private (requires 'view_products' permission)
router.get('/:categoryId', [
  auth,
  requirePermission('view_products'),
  sanitizeRequest,
  param('categoryId').isUUID().withMessage('Valid Category ID is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { categoryId } = req.params;
    const category = await categoryService.getCategoryById(categoryId);
    res.json(category);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ message: 'Server error fetching category', error: error.message });
  }
});

// @route   POST /api/categories
// @desc    Create a new category
// @access  Private (requires 'manage_products' permission)
router.post('/', [
  auth,
  requirePermission('manage_products'),
  sanitizeRequest,
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name is required and must be 1-100 characters'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
  body('parentCategory').optional().isUUID().withMessage('Valid parent category ID is required'),
  body('sortOrder').optional().isInt({ min: 0 }).withMessage('Sort order must be a non-negative integer'),
  body('isActive').optional().isBoolean().withMessage('Active status must be a boolean'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const result = await categoryService.createCategory(req.body, req.user?.id || req.user?._id);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating category:', error);
    if (error.message === 'Category name already exists') {
      res.status(400).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Server error creating category', error: error.message });
    }
  }
});

// @route   PUT /api/categories/:categoryId
// @desc    Update category
// @access  Private (requires 'manage_products' permission)
router.put('/:categoryId', [
  auth,
  requirePermission('manage_products'),
  sanitizeRequest,
  param('categoryId').isUUID().withMessage('Valid Category ID is required'),
  body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Name must be 1-100 characters'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
  body('parentCategory').optional().isUUID().withMessage('Valid parent category ID is required'),
  body('sortOrder').optional().isInt({ min: 0 }).withMessage('Sort order must be a non-negative integer'),
  body('isActive').optional().isBoolean().withMessage('Active status must be a boolean'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { categoryId } = req.params;
    const result = await categoryService.updateCategory(categoryId, req.body);
    res.json(result);
  } catch (error) {
    console.error('Error updating category:', error);
    if (error.message === 'Category not found') {
      return res.status(404).json({ message: 'Category not found' });
    }
    if (error.message === 'Category name already exists') {
      res.status(400).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Server error updating category', error: error.message });
    }
  }
});

// @route   DELETE /api/categories/:categoryId
// @desc    Delete category
// @access  Private (requires 'manage_products' permission)
router.delete('/:categoryId', [
  auth,
  requirePermission('manage_products'),
  sanitizeRequest,
  param('categoryId').isUUID().withMessage('Valid Category ID is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { categoryId } = req.params;
    const result = await categoryService.deleteCategory(categoryId);
    res.json(result);
  } catch (error) {
    console.error('Error deleting category:', error);
    if (error.message === 'Category not found') {
      return res.status(404).json({ message: 'Category not found' });
    }
    if (error.message.includes('Cannot delete category')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error deleting category', error: error.message });
  }
});

module.exports = router;
