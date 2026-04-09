const express = require('express');
const { body, param, query } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors, sanitizeRequest } = require('../middleware/validation');
const categoryService = require('../services/categoryServicePostgres');
const fs = require('fs');
const path = require('path');

const router = express.Router();


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
