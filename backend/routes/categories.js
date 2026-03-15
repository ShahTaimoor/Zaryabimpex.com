const express = require('express');
const { body, param, query } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors, sanitizeRequest } = require('../middleware/validation');
const categoryService = require('../services/categoryService');

const router = express.Router();

// @route   GET /api/categories
// @desc    Get list of categories
// @access  Private (requires 'view_products' permission)
router.get('/', [
  auth,
  requirePermission('view_products'),
  sanitizeRequest,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().trim(),
  query('isActive').optional().isBoolean(),
  handleValidationErrors,
], async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      isActive = true
    } = req.query;

    // Call service to get categories
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

// @route   GET /api/categories/:categoryId
// @desc    Get detailed category information
// @access  Private (requires 'view_products' permission)
router.get('/:categoryId', [
  auth,
  requirePermission('view_products'),
  sanitizeRequest,
  param('categoryId').isMongoId().withMessage('Valid Category ID is required'),
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
  body('parentCategory').optional().isMongoId().withMessage('Valid parent category ID is required'),
  body('sortOrder').optional().isInt({ min: 0 }).withMessage('Sort order must be a non-negative integer'),
  body('isActive').optional().isBoolean().withMessage('Active status must be a boolean'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const result = await categoryService.createCategory(req.body, req.user._id);
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
  param('categoryId').isMongoId().withMessage('Valid Category ID is required'),
  body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Name must be 1-100 characters'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
  body('parentCategory').optional().isMongoId().withMessage('Valid parent category ID is required'),
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
  param('categoryId').isMongoId().withMessage('Valid Category ID is required'),
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

// @route   GET /api/categories/stats
// @desc    Get category statistics
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

// @route   GET /api/categories/export/csv
// @desc    Export categories to CSV
// @access  Private
router.get('/export/csv', [
  auth,
  requirePermission('view_products'),
  sanitizeRequest,
], async (req, res) => {
  try {
    const csvData = await categoryService.exportToCSV(req.query);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=categories_export.csv');
    res.send(csvData);
  } catch (error) {
    console.error('Error exporting categories to CSV:', error);
    res.status(500).json({ message: 'Server error exporting categories', error: error.message });
  }
});

// @route   GET /api/categories/export/excel
// @desc    Export categories to Excel
// @access  Private
router.get('/export/excel', [
  auth,
  requirePermission('view_products'),
  sanitizeRequest,
], async (req, res) => {
  try {
    const buffer = await categoryService.exportToExcel(req.query);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=categories_export.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting categories to Excel:', error);
    res.status(500).json({ message: 'Server error exporting categories', error: error.message });
  }
});

// @route   POST /api/categories/import/csv
// @desc    Import categories from CSV
// @access  Private
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
router.post('/import/csv', [
  auth,
  requirePermission('manage_products'),
  upload.single('file'),
], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a CSV file' });
    }
    const results = await categoryService.importFromCSV(req.file.buffer, req.user._id);
    res.json({ results });
  } catch (error) {
    console.error('Error importing categories from CSV:', error);
    res.status(500).json({ message: 'Server error importing categories', error: error.message });
  }
});

// @route   POST /api/categories/import/excel
// @desc    Import categories from Excel
// @access  Private
router.post('/import/excel', [
  auth,
  requirePermission('manage_products'),
  upload.single('file'),
], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an Excel file' });
    }
    const results = await categoryService.importFromExcel(req.file.buffer, req.user._id);
    res.json({ results });
  } catch (error) {
    console.error('Error importing categories from Excel:', error);
    res.status(500).json({ message: 'Server error importing categories', error: error.message });
  }
});

// @route   GET /api/categories/import/template
// @desc    Download category import template
// @access  Private
router.get('/import/template', [
  auth,
  requirePermission('manage_products'),
], async (req, res) => {
  try {
    const template = await categoryService.getImportTemplate();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=category_template.csv');
    res.send(template);
  } catch (error) {
    console.error('Error downloading category template:', error);
    res.status(500).json({ message: 'Server error downloading template', error: error.message });
  }
});

module.exports = router;
