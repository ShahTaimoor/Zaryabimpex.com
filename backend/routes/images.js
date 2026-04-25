/**
 * Image Upload and Optimization Routes
 */

const express = require('express');
const multer = require('multer');
const { auth, requirePermission } = require('../middleware/auth');
const { uploadImageOnCloudinary } = require('../services/cloudinary');
const logger = require('../utils/logger');

const router = express.Router();

// Configure multer for memory storage (bypasses disk issues on VPS)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
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
      cb(new Error('Invalid file type. Only image files (JPEG, PNG, GIF, WebP) are allowed.'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// @route   POST /api/images/upload
// @desc    Upload to Cloudinary
// @access  Private
router.post('/upload', [
  auth,
  requirePermission('create_products'),
  upload.single('image')
], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file uploaded' });
    }

    // Upload directly from buffer to Cloudinary
    const result = await uploadImageOnCloudinary(req.file.buffer, 'products', {
      width: 1200,
      height: 1200,
      fit: 'inside'
    });

    res.json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        urls: {
          optimized: result.secure_url
        },
        public_id: result.public_id
      }
    });
  } catch (error) {
    logger.error('Image upload error:', { 
      error: error.message, 
      stack: error.stack,
      requestId: req.id
    });
    
    res.status(500).json({ 
      success: false,
      message: 'Image upload failed',
      error: error.message 
    });
  }
});

module.exports = router;


