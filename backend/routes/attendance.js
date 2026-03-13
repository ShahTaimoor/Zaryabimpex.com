const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { auth, requireAnyPermission } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { validateDateParams, processDateFilter } = require('../middleware/dateFilter');
const attendanceRepository = require('../repositories/postgres/AttendanceRepository');
const employeeRepository = require('../repositories/postgres/EmployeeRepository');
const logger = require('../utils/logger');

const router = express.Router();

// Clock in
router.post('/clock-in', [
  auth,
  requireAnyPermission(['clock_attendance', 'clock_in']),
  body('storeId').optional().isString(),
  body('deviceId').optional().isString(),
  body('notesIn').optional().isString(),
  body('employeeId').optional().isUUID(4), // For managers clocking in other employees
], async (req, res) => {
  try {
    let employee;
    
    // If employeeId is provided (manager clocking in someone else)
    if (req.body.employeeId) {
      employee = await employeeRepository.findById(req.body.employeeId);
      if (!employee) {
        return res.status(404).json({ message: 'Employee not found' });
      }
      if (employee.status !== 'active') {
        return res.status(400).json({ message: 'Employee is not active' });
      }
    } else {
      // Find employee linked to current user
      employee = await employeeRepository.findByUserAccount(req.user._id);
      if (!employee) {
        return res.status(400).json({ 
          message: 'No employee record found. Please contact administrator to link your user account to an employee record.' 
        });
      }
      if (employee.status !== 'active') {
        return res.status(400).json({ message: 'Your employee account is not active' });
      }
    }
    
    const employeeId = employee.id || employee._id;
    const open = await attendanceRepository.findOpenSession(employeeId);
    if (open) {
      return res.status(400).json({ message: 'Employee is already clocked in' });
    }

    try {
      const session = await attendanceRepository.create({
        employee: employeeId,
        user: req.body.employeeId ? null : (req.user.id || req.user._id),
        clockedInBy: req.body.employeeId ? (req.user.id || req.user._id) : null,
        storeId: req.body.storeId || null,
        deviceId: req.body.deviceId || null,
        clockInAt: new Date(),
        notesIn: req.body.notesIn || '',
        status: 'open'
      });
      const withEmployee = await attendanceRepository.findByIdWithEmployee(session.id);
      res.json({ success: true, data: withEmployee || session });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(400).json({
          success: false,
          message: 'Duplicate entry detected'
        });
      }
      throw err;
    }
  } catch (err) {
    logger.error('Clock in error:', { error: err.message, stack: err.stack });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Clock out
router.post('/clock-out', [
  auth,
  requireAnyPermission(['clock_attendance', 'clock_out']),
  body('notesOut').optional().isString(),
  body('employeeId').optional().isUUID(4), // For managers clocking out other employees
], async (req, res) => {
  try {
    let employee;
    
    if (req.body.employeeId) {
      employee = await employeeRepository.findById(req.body.employeeId);
      if (!employee) {
        return res.status(404).json({ message: 'Employee not found' });
      }
    } else {
      employee = await employeeRepository.findByUserAccount(req.user.id || req.user._id);
      if (!employee) {
        return res.status(400).json({ message: 'No employee record found' });
      }
    }
    
    const employeeId = employee.id || employee._id;
    const session = await attendanceRepository.findOpenSession(employeeId);
    if (!session) {
      return res.status(400).json({ message: 'Employee is not clocked in' });
    }
    const updated = await attendanceRepository.closeSession(session.id, req.body.notesOut);
    const withEmployee = updated ? await attendanceRepository.findByIdWithEmployee(updated.id) : null;
    res.json({ success: true, data: withEmployee || updated });
  } catch (err) {
    logger.error('Clock out error:', { error: err.message, stack: err.stack });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Start break
router.post('/breaks/start', [
  auth,
  requireAnyPermission(['manage_attendance_breaks', 'clock_attendance']),
  body('type').optional().isIn(['break', 'lunch', 'other'])
], async (req, res) => {
  try {
    const employee = await employeeRepository.findByUserAccount(req.user._id);
    if (!employee) {
      return res.status(400).json({ message: 'No employee record found' });
    }
    
    const employeeId = employee.id || employee._id;
    const session = await attendanceRepository.findOpenSession(employeeId);
    if (!session) {
      return res.status(400).json({ message: 'You are not clocked in' });
    }
    const updated = await attendanceRepository.startBreak(session.id, req.body.type || 'break');
    if (!updated) {
      return res.status(400).json({ message: 'Active break already in progress or session closed' });
    }
    const withEmployee = await attendanceRepository.findByIdWithEmployee(updated.id);
    res.json({ success: true, data: withEmployee || updated });
  } catch (err) {
    logger.error('Start break error:', { error: err.message, stack: err.stack });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// End break
router.post('/breaks/end', [
  auth,
  requireAnyPermission(['manage_attendance_breaks', 'clock_attendance']),
], async (req, res) => {
  try {
    const employee = await employeeRepository.findByUserAccount(req.user._id);
    if (!employee) {
      return res.status(400).json({ message: 'No employee record found' });
    }
    
    const session = await attendanceRepository.findOpenSession(employee.id || employee._id);
    if (!session) {
      return res.status(400).json({ message: 'You are not clocked in' });
    }
    const updated = await attendanceRepository.endBreak(session.id);
    if (!updated) {
      return res.status(400).json({ message: 'No active break to end' });
    }
    const withEmployee = await attendanceRepository.findByIdWithEmployee(updated.id);
    res.json({ success: true, data: withEmployee || updated });
  } catch (err) {
    logger.error('End break error:', { error: err.message, stack: err.stack });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get current status
router.get('/status', [
  auth,
  requireAnyPermission(['view_own_attendance', 'clock_attendance']),
], async (req, res) => {
  try {
    const employee = await employeeRepository.findByUserAccount(req.user._id);
    if (!employee) {
      return res.json({ success: true, data: null }); // No employee record, no attendance
    }
    
    const session = await attendanceRepository.findOpenSession(employee.id || employee._id);
    const data = session ? await attendanceRepository.findByIdWithEmployee(session.id) : null;
    res.json({ success: true, data });
  } catch (err) {
    logger.error('Get status error:', { error: err.message, stack: err.stack });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// My attendance list
router.get('/me', [
  auth,
  requireAnyPermission(['view_own_attendance', 'clock_attendance']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  ...validateDateParams,
  handleValidationErrors,
  processDateFilter('createdAt'),
], async (req, res) => {
  try {
    const employee = await employeeRepository.findByUserAccount(req.user._id);
    if (!employee) {
      return res.json({ success: true, data: [] }); // No employee record, no attendance
    }
    
    const limit = parseInt(req.query.limit || '30');
    const filter = { employeeId: employee.id || employee._id };
    if (req.dateFilter && req.dateFilter.createdAt) {
      if (req.dateFilter.createdAt.$gte) filter.createdAtFrom = req.dateFilter.createdAt.$gte;
      if (req.dateFilter.createdAt.$lte) filter.createdAtTo = req.dateFilter.createdAt.$lte;
    }
    const result = await attendanceRepository.findWithPagination(filter, { page: 1, limit });
    const rows = result.attendances;
    res.json({ success: true, data: rows });
  } catch (err) {
    logger.error('Get my attendance error:', { error: err.message, stack: err.stack });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Team attendance (for managers)
router.get('/team', [
  auth,
  (req, res, next) => {
    // Allow admins or users with view_team_attendance permission
    if (req.user.role === 'admin' || req.user.hasPermission('view_team_attendance')) {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: 'Access denied. You need "view_team_attendance" permission to view team attendance.'
    });
  },
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('employeeId').optional().isUUID(4),
  ...validateDateParams,
  query('status').optional().isIn(['open', 'closed']),
  handleValidationErrors,
  processDateFilter('createdAt'),
], async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '50');
    const filterQuery = {};
    if (req.query.employeeId) filterQuery.employeeId = req.query.employeeId;
    if (req.query.status) filterQuery.status = req.query.status;
    if (req.dateFilter && req.dateFilter.createdAt) {
      if (req.dateFilter.createdAt.$gte) filterQuery.createdAtFrom = req.dateFilter.createdAt.$gte;
      if (req.dateFilter.createdAt.$lte) filterQuery.createdAtTo = req.dateFilter.createdAt.$lte;
    }

    const result = await attendanceRepository.findWithPagination(filterQuery, {
      page: 1,
      limit
    });
    
    const rows = result?.attendances || [];
    
    logger.info('Team attendance fetched successfully', {
      count: rows.length,
      total: result?.total || 0
    });
    
    res.json({ success: true, data: rows });
  } catch (err) {
    logger.error('Get team attendance error:', {
      error: err.message,
      stack: err.stack,
      query: req.query,
      name: err.name
    });
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch team attendance',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;


