const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const cityService = require('../services/cityService');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

const router = express.Router();

// @route   POST /api/cities/import/excel
// @desc    Import cities from Excel
// @access  Private (requires 'manage_users' permission)
router.post('/import/excel', [
  auth,
  requirePermission('manage_users'),
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
    const cities = XLSX.utils.sheet_to_json(worksheet);
    
    results.total = cities.length;
    
    for (let i = 0; i < cities.length; i++) {
      try {
        const rawRow = cities[i];
        // Normalize keys to handle spaces and case sensitivity
        const row = {};
        Object.keys(rawRow).forEach(key => {
          row[key.trim()] = rawRow[key];
        });
        
        // Map Excel columns to our format
        const cityData = {
          name: row['Name'] || row['name'] || row['City Name'] || row['city name'] || row.name,
          state: row['State'] || row['state'] || row.state || '',
          country: row['Country'] || row['country'] || row.country || 'US',
          description: row['Description'] || row['description'] || row.description || '',
          isActive: row['Status'] || row['status'] ? (row['Status'] || row['status']).toString().toLowerCase() === 'active' : true
        };
        
        // Validate required fields
        if (!cityData.name) {
          results.errors.push({
            row: i + 2,
            error: 'Missing required field: City Name is required'
          });
          continue;
        }
        
        // Check if city already exists
        const cityExists = await cityService.checkNameExists(cityData.name);
        
        if (cityExists) {
          results.errors.push({
            row: i + 2,
            error: `City already exists with name: ${cityData.name}`
          });
          continue;
        }
        
        // Create city
        await cityService.createCity({
          name: cityData.name.toString().trim(),
          state: cityData.state.toString().trim(),
          country: cityData.country.toString().trim(),
          description: cityData.description.toString().trim(),
          isActive: cityData.isActive
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
      success: true,
      message: 'Import completed',
      results: results
    });
    
  } catch (error) {
    console.error('City Excel import error:', error);
    res.status(500).json({ success: false, message: 'Import failed', error: error.message });
  }
});

// @route   POST /api/cities/export/excel
// @desc    Export cities to Excel
// @access  Private (requires 'view_reports' permission)
router.post('/export/excel', [auth, requirePermission('view_reports')], async (req, res) => {
  try {
    const { filters = {} } = req.body;
    
    // Get all cities for export (no pagination)
    const result = await cityService.getCities({ ...filters, limit: 10000 });
    const cities = result.cities;
    
    // Prepare Excel data
    const excelData = cities.map(city => ({
      'Name': city.name,
      'State': city.state || '',
      'Country': city.country || '',
      'Description': city.description || '',
      'Status': city.isActive ? 'active' : 'inactive'
    }));
    
    // Create Excel workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Set column widths
    const columnWidths = [
      { wch: 25 }, // Name
      { wch: 20 }, // State
      { wch: 15 }, // Country
      { wch: 40 }, // Description
      { wch: 12 }  // Status
    ];
    worksheet['!cols'] = columnWidths;
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cities');
    
    // Ensure exports directory exists
    if (!fs.existsSync('exports')) {
      fs.mkdirSync('exports');
    }
    
    const filename = `cities_${Date.now()}.xlsx`;
    const filepath = path.join('exports', filename);
    XLSX.writeFile(workbook, filepath);
    
    res.json({
      success: true,
      message: 'Cities exported successfully',
      filename: filename,
      recordCount: excelData.length,
      downloadUrl: `/api/cities/download/${filename}`
    });
    
  } catch (error) {
    console.error('City Excel export error:', error);
    res.status(500).json({ success: false, message: 'Export failed', error: error.message });
  }
});

// @route   GET /api/cities/download/:filename
// @desc    Download exported file
// @access  Private (requires 'view_reports' permission)
router.get('/download/:filename', [auth, requirePermission('view_reports')], (req, res) => {
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

// @route   GET /api/cities/template/excel
// @desc    Download Excel template for city import
// @access  Private (requires 'manage_users' permission)
router.get('/template/excel', [auth, requirePermission('manage_users')], (req, res) => {
  try {
    const templateData = [
      {
        'Name': 'New York',
        'State': 'NY',
        'Country': 'USA',
        'Description': 'The Big Apple',
        'Status': 'active'
      },
      {
        'Name': 'London',
        'State': 'Greater London',
        'Country': 'UK',
        'Description': 'Capital of UK',
        'Status': 'active'
      }
    ];
    
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    
    const columnWidths = [
      { wch: 25 },
      { wch: 20 },
      { wch: 15 },
      { wch: 40 },
      { wch: 12 }
    ];
    worksheet['!cols'] = columnWidths;
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
    
    if (!fs.existsSync('exports')) {
      fs.mkdirSync('exports');
    }
    
    const filename = 'city_import_template.xlsx';
    const filepath = path.join('exports', filename);
    XLSX.writeFile(workbook, filepath);
    
    res.download(filepath, filename);
  } catch (error) {
    console.error('Template generation error:', error);
    res.status(500).json({ message: 'Failed to generate template' });
  }
});

// @route   GET /api/cities
// @desc    Get all cities with filtering and pagination
// @access  Private
router.get('/', [
  auth,
  requirePermission('view_reports'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().isString().trim().withMessage('Search must be a string'),
  query('isActive').optional().isIn(['true', 'false']).withMessage('isActive must be true or false'),
  query('state').optional().isString().trim().withMessage('State must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Call service to get cities
    const result = await cityService.getCities(req.query);
    
    res.json({
      success: true,
      data: {
        cities: result.cities,
        pagination: result.pagination
      }
    });
  } catch (error) {
    console.error('Get cities error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/cities/active
// @desc    Get all active cities (for dropdowns)
// @access  Private
router.get('/active', [
  auth,
  requirePermission('view_reports')
], async (req, res) => {
  try {
    const cities = await cityService.getActiveCities();
    res.json({
      success: true,
      data: cities
    });
  } catch (error) {
    console.error('Get active cities error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/cities/:id
// @desc    Get city by ID
// @access  Private
router.get('/:id', [
  auth,
  requirePermission('view_reports')
], async (req, res) => {
  try {
    const city = await cityService.getCityById(req.params.id);
    res.json({
      success: true,
      data: city
    });
  } catch (error) {
    console.error('Get city error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/cities
// @desc    Create new city
// @access  Private
router.post('/', [
  auth,
  requirePermission('manage_users'),
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('City name is required and must be less than 100 characters'),
  body('state').optional().trim().isLength({ max: 100 }).withMessage('State must be less than 100 characters'),
  body('country').optional().trim().isLength({ max: 100 }).withMessage('Country must be less than 100 characters'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Call service to create city
    const result = await cityService.createCity(req.body, req.user.id || req.user._id);
    
    res.status(201).json({
      success: true,
      message: result.message,
      data: result.city
    });
  } catch (error) {
    console.error('Create city error:', error);
    if (error.message === 'City with this name already exists') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/cities/:id
// @desc    Update city
// @access  Private
router.put('/:id', [
  auth,
  requirePermission('manage_users'),
  body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('City name must be less than 100 characters'),
  body('state').optional().trim().isLength({ max: 100 }).withMessage('State must be less than 100 characters'),
  body('country').optional().trim().isLength({ max: 100 }).withMessage('Country must be less than 100 characters'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Call service to update city
    const result = await cityService.updateCity(req.params.id, req.body, req.user.id || req.user._id);
    
    res.json({
      success: true,
      message: result.message,
      data: result.city
    });
  } catch (error) {
    console.error('Update city error:', error);
    if (error.message === 'City not found') {
      return res.status(404).json({
        success: false,
        message: 'City not found'
      });
    }
    if (error.message === 'City with this name already exists') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   DELETE /api/cities/:id
// @desc    Delete city
// @access  Private
router.delete('/:id', [
  auth,
  requirePermission('manage_users')
], async (req, res) => {
  try {
    // Call service to delete city
    const result = await cityService.deleteCity(req.params.id);
    
    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Delete city error:', error);
    if (error.message === 'City not found') {
      return res.status(404).json({
        success: false,
        message: 'City not found'
      });
    }
    if (error.message.includes('Cannot delete city')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
