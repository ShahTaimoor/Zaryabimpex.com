const express = require('express');
const { body, param, query } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const { handleValidationErrors, sanitizeRequest } = require('../middleware/validation');
const employeeService = require('../services/employeeService');
const EmployeeRepository = require('../repositories/EmployeeRepository');

const router = express.Router();

// @route   GET /api/employees
// @desc    Get all employees with filters
// @access  Private (requires 'manage_users' or 'view_team_attendance' permission)
router.get('/', [
  auth,
  requirePermission('manage_users'),
  sanitizeRequest,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
  query('status').optional().isIn(['active', 'inactive', 'terminated', 'on_leave']),
  query('department').optional().isString(),
  query('position').optional().isString(),
  handleValidationErrors, // Use as middleware
], async (req, res) => {
  try {
    console.log('GET /api/employees - Request received');
    console.log('Query params:', req.query);

    // Call service to get employees
    const result = await employeeService.getEmployees(req.query);
    
    res.json({
      success: true,
      data: {
        employees: result.employees,
        pagination: result.pagination
      }
    });
  } catch (error) {
    console.error('========================================');
    console.error('Get employees ERROR:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    if (error.code) console.error('Error code:', error.code);
    if (error.keyPattern) console.error('Key pattern:', error.keyPattern);
    if (error.keyValue) console.error('Key value:', error.keyValue);
    console.error('========================================');
    res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      details: process.env.NODE_ENV === 'development' ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    });
  }
});

// @route   GET /api/employees/:id
// @desc    Get single employee
// @access  Private
router.get('/:id', [
  auth,
  requirePermission('manage_users'),
  param('id').isUUID(4).withMessage('Invalid employee ID'),
  handleValidationErrors, // Use as middleware
], async (req, res) => {
  try {
    const employee = await employeeService.getEmployeeById(req.params.id);

    res.json({
      success: true,
      data: { employee }
    });
  } catch (error) {
    console.error('Get employee error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/employees
// @desc    Create new employee
// @access  Private (Admin/Manager only)
router.post('/', [
  auth,
  requirePermission('manage_users'),
  sanitizeRequest,
  body('firstName').trim().isLength({ min: 1 }).withMessage('First name is required'),
  body('lastName').trim().isLength({ min: 1 }).withMessage('Last name is required'),
  body('employeeId').optional().trim().isString(),
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').optional().isString(),
  body('position').trim().isLength({ min: 1 }).withMessage('Position is required'),
  body('department').optional().isString(),
  body('hireDate').optional().isISO8601().withMessage('Valid hire date is required'),
  body('employmentType').optional().isIn(['full_time', 'part_time', 'contract', 'temporary', 'intern']),
  body('status').optional().isIn(['active', 'inactive', 'terminated', 'on_leave']),
  body('userAccount').optional().isUUID(4).withMessage('Invalid user account ID'),
  handleValidationErrors, // Use as middleware
], async (req, res) => {
  try {
    const employee = await employeeService.createEmployee(req.body);

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: { employee }
    });
  } catch (error) {
    console.error('Create employee error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Employee ID or email already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/employees/:id
// @desc    Update employee
// @access  Private
router.put('/:id', [
  auth,
  requirePermission('manage_users'),
  sanitizeRequest,
  param('id').isUUID(4).withMessage('Invalid employee ID'),
  body('firstName').optional().trim().isLength({ min: 1 }),
  body('lastName').optional().trim().isLength({ min: 1 }),
  body('employeeId').optional().trim().isString(),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().isString(),
  body('position').optional().trim().isLength({ min: 1 }),
  body('department').optional().isString(),
  body('status').optional().isIn(['active', 'inactive', 'terminated', 'on_leave']),
  body('userAccount').optional().isUUID(4),
  handleValidationErrors, // Use as middleware
], async (req, res) => {
  try {
    const updatedEmployee = await employeeService.updateEmployee(req.params.id, req.body);

    res.json({
      success: true,
      message: 'Employee updated successfully',
      data: { employee: updatedEmployee }
    });
  } catch (error) {
    if (error.message === 'Employee not found') {
      return res.status(404).json({ message: error.message });
    }
    if (error.message.includes('already exists') || error.message.includes('not found') || error.message.includes('already linked')) {
      return res.status(400).json({ message: error.message });
    }
    console.error('Update employee error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   DELETE /api/employees/:id
// @desc    Delete employee
// @access  Private
router.delete('/:id', [
  auth,
  requirePermission('manage_users'),
  param('id').isUUID(4).withMessage('Invalid employee ID'),
  handleValidationErrors, // Use as middleware
], async (req, res) => {
  try {
    const result = await employeeService.deleteEmployee(req.params.id);

    res.json({
      success: true,
      message: result.message,
      ...(result.employee && { data: { employee: result.employee } })
    });
  } catch (error) {
    if (error.message === 'Employee not found') {
      return res.status(404).json({ message: error.message });
    }
    console.error('Delete employee error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/employees/departments/list
// @desc    Get list of all departments
// @access  Private
router.get('/departments/list', auth, async (req, res) => {
  try {
    const departments = await Employee.distinct('department', { department: { $ne: null, $ne: '' } });
    res.json({
      success: true,
      data: { departments: departments.sort() }
    });
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/employees/positions/list
// @desc    Get list of all positions
// @access  Private
router.get('/positions/list', auth, async (req, res) => {
  try {
    const positions = await EmployeeRepository.getDistinctPositions();
    res.json({
      success: true,
      data: { positions: positions.sort() }
    });
  } catch (error) {
    console.error('Get positions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

