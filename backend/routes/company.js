/**
 * Company Settings API
 * GET /api/company, PUT /api/company, POST /api/company/logo
 */

const express = require('express');
const multer = require('multer');
const { auth } = require('../middleware/auth');
const Company = require('../models/Company');
const { uploadImageOnCloudinary } = require('../services/cloudinary');
const logger = require('../utils/logger');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP are allowed.'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

const CLOUDINARY_FOLDER = 'company_logos';

// @route   GET /api/company
// @desc    Fetch company settings
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const company = await Company.getCompany();
    res.json({
      success: true,
      data: {
        companyName: company.companyName || '',
        phone: company.phone || '',
        address: company.address || '',
        logo: company.logo || ''
      }
    });
  } catch (error) {
    logger.error('Get company error:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch company settings',
      error: error.message
    });
  }
});

// @route   PUT /api/company
// @desc    Update company settings
// @access  Private
router.put('/', auth, async (req, res) => {
  try {
    const { companyName, phone, address } = req.body;
    const updates = {};
    if (companyName !== undefined) updates.companyName = String(companyName).trim();
    if (phone !== undefined) updates.phone = String(phone).trim();
    if (address !== undefined) updates.address = String(address).trim();

    const company = await Company.updateCompany(updates);
    res.json({
      success: true,
      message: 'Company settings updated successfully',
      data: {
        companyName: company.companyName || '',
        phone: company.phone || '',
        address: company.address || '',
        logo: company.logo || ''
      }
    });
  } catch (error) {
    logger.error('Update company error:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to update company settings',
      error: error.message
    });
  }
});

// @route   POST /api/company/logo
// @desc    Upload company logo (Multer + Cloudinary), save secure_url in MongoDB
// @access  Private
router.post('/logo', auth, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: 'No logo file uploaded'
      });
    }

    const { secure_url } = await uploadImageOnCloudinary(
      req.file.buffer,
      CLOUDINARY_FOLDER
    );

    const company = await Company.updateCompany({ logo: secure_url });

    res.json({
      success: true,
      message: 'Logo uploaded successfully',
      data: {
        companyName: company.companyName || '',
        phone: company.phone || '',
        address: company.address || '',
        logo: company.logo || ''
      }
    });
  } catch (error) {
    logger.error('Upload company logo error:', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload logo',
      error: error.message
    });
  }
});

module.exports = router;
