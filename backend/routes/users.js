const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, requirePermission } = require('../middleware/auth');
const userService = require('../services/userService');

const router = express.Router();

// @route   GET /api/auth/users
// @desc    Get all users
// @access  Private (Admin only)
router.get('/', auth, requirePermission('manage_users'), async (req, res) => {
  try {
    const users = await userService.getUsers();

    res.json({
      success: true,
      data: { users }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/users/:id
// @desc    Get single user
// @access  Private (Admin only)
router.get('/:id', auth, requirePermission('manage_users'), async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.id);

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    if (error.message === 'User not found') {
      return res.status(404).json({ message: 'User not found' });
    }
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/auth/users/:id
// @desc    Update user
// @access  Private (Admin only)
router.put('/:id', [
  auth,
  requirePermission('manage_users'),
  body('firstName').optional().trim().isLength({ min: 1 }).withMessage('First name is required'),
  body('lastName').optional().trim().isLength({ min: 1 }).withMessage('Last name is required'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('role').optional().isIn(['admin', 'manager', 'cashier', 'inventory', 'viewer']).withMessage('Invalid role'),
  body('status').optional().isIn(['active', 'inactive', 'suspended']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const updateData = {};
    const { firstName, lastName, email, role, status, permissions } = req.body;
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (status) updateData.status = status;
    if (permissions) updateData.permissions = permissions;

    const updatedUser = await userService.updateUser(req.params.id, updateData, req.user);

    res.json({
      success: true,
      message: 'User updated successfully',
      data: { user: updatedUser }
    });
  } catch (error) {
    if (error.message === 'User not found') {
      return res.status(404).json({ message: 'User not found' });
    }
    if (error.message === 'Email already exists') {
      return res.status(400).json({ message: 'Email already exists' });
    }
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

// @route   PATCH /api/auth/users/:id/reset-password
// @desc    Reset user password (Admin only)
// @access  Private (Admin only)
router.patch('/:id/reset-password', auth, requirePermission('manage_users'), async (req, res) => {
  try {
    const { newPassword } = req.body;
    const result = await userService.resetPassword(req.params.id, newPassword);

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    if (error.message === 'User not found') {
      return res.status(404).json({ message: 'User not found' });
    }
    if (error.message.includes('Password must be at least')) {
      return res.status(400).json({ message: error.message });
    }
    console.error('❌ Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/users/:id/activity
// @desc    Get user activity data
// @access  Private (Admin only)
router.get('/:id/activity', auth, requirePermission('manage_users'), async (req, res) => {
  try {
    const activity = await userService.getUserActivity(req.params.id);

    res.json({
      success: true,
      data: activity
    });
  } catch (error) {
    if (error.message === 'User not found') {
      return res.status(404).json({ message: 'User not found' });
    }
    console.error('Get user activity error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PATCH /api/auth/users/update-role-permissions
// @desc    Update permissions for all users with a specific role
// @access  Private (Admin only)
router.patch('/update-role-permissions', auth, requirePermission('manage_users'), async (req, res) => {
  try {
    const { role, permissions } = req.body;
    const result = await userService.updateRolePermissions(role, permissions);

    res.json({
      success: true,
      message: result.message,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    if (error.message === 'Role and permissions are required') {
      return res.status(400).json({ message: error.message });
    }
    console.error('Update role permissions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/auth/users/:id
// @desc    Delete user
// @access  Private (Admin only)
router.delete('/:id', auth, requirePermission('manage_users'), async (req, res) => {
  try {
    const result = await userService.deleteUser(req.params.id, req.user.userId || req.user._id);

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    if (error.message === 'User not found') {
      return res.status(404).json({ message: 'User not found' });
    }
    if (error.message === 'Cannot delete your own account') {
      return res.status(400).json({ message: error.message });
    }
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PATCH /api/auth/users/:id/toggle-status
// @desc    Toggle user status
// @access  Private (Admin only)
router.patch('/:id/toggle-status', auth, requirePermission('manage_users'), async (req, res) => {
  try {
    const result = await userService.toggleUserStatus(req.params.id, req.user.userId || req.user._id);

    res.json({
      success: true,
      message: result.message,
      data: { user: result.user }
    });
  } catch (error) {
    if (error.message === 'User not found') {
      return res.status(404).json({ message: 'User not found' });
    }
    if (error.message === 'Cannot modify your own account status') {
      return res.status(400).json({ message: error.message });
    }
    console.error('Toggle user status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
