const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const settingsService = require('../services/settingsService');

// @route   GET /api/settings/company
// @desc    Get company settings
// @access  Private
router.get('/company', auth, async (req, res) => {
  try {
    const settings = await settingsService.getCompanySettings();
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Get company settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch company settings',
      error: error.message
    });
  }
});

// @route   PUT /api/settings/company
// @desc    Update company settings
// @access  Private (Admin only)
router.put('/company', auth, async (req, res) => {
  try {
    
    const {
      companyName,
      contactNumber,
      address,
      email,
      website,
      taxId,
      registrationNumber,
      currency,
      dateFormat,
      timeFormat,
      fiscalYearStart,
      defaultTaxRate
    } = req.body;

    const settings = await settingsService.updateCompanySettings(req.body);

    res.json({
      success: true,
      message: 'Company settings updated successfully',
      data: settings
    });
  } catch (error) {
    if (error.message === 'Company name, contact number, and address are required') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    console.error('Update company settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update company settings',
      error: error.message
    });
  }
});

// @route   GET /api/settings/preferences
// @desc    Get user preferences
// @access  Private
router.get('/preferences', auth, async (req, res) => {
  try {
    const preferences = await settingsService.getUserPreferences(req.user.id);
    
    res.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    if (error.message === 'User not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    console.error('Get user preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user preferences',
      error: error.message
    });
  }
});

// @route   PUT /api/settings/preferences
// @desc    Update user preferences
// @access  Private
router.put('/preferences', auth, async (req, res) => {
  try {
    const preferences = await settingsService.updateUserPreferences(req.user.id, req.body);

    res.json({
      success: true,
      message: 'User preferences updated successfully',
      data: preferences
    });
  } catch (error) {
    if (error.message === 'User not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    console.error('Update user preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user preferences',
      error: error.message
    });
  }
});

module.exports = router;

