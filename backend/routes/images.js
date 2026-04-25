/**
 * Image Upload and Optimization Routes
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { auth, requirePermission } = require('../middleware/auth');
const { optimizeImage } = require('../services/imageOptimization');

const router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/images/temp');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `img-${uniqueSuffix}${ext}`);
  }
});

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
// @desc    Upload and optimize image
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

    const inputPath = req.file.path;
    const outputDir = path.join(__dirname, '../uploads/images/optimized');
    const baseUrl = '/api/images/';

    // Optimize image
    const optimized = await optimizeImage(inputPath, outputDir, {
      generateSizes: true,
      generateWebP: true,
      keepOriginal: false,
      maxWidth: 2000,
      maxHeight: 2000
    });

    // Clean up temp file
    fs.unlinkSync(inputPath);

    // Generate URLs
    const filename = path.basename(optimized.optimized, path.extname(optimized.optimized));
    const urls = {
      optimized: `${baseUrl}${path.basename(optimized.optimized)}`,
      webp: optimized.webp ? `${baseUrl}${path.basename(optimized.webp)}` : null,
      sizes: {}
    };

    // Add size URLs
    for (const [sizeName, paths] of Object.entries(optimized.sizes)) {
      urls.sizes[sizeName] = {
        jpeg: `${baseUrl}${path.basename(paths.jpeg)}`,
        webp: paths.webp ? `${baseUrl}${path.basename(paths.webp)}` : null
      };
    }

    res.json({
      message: 'Image uploaded and optimized successfully',
      urls,
      basePath: filename
    });
  } catch (error) {
    console.error('Image upload error:', error);
    
    // Clean up temp file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ 
      message: 'Image upload failed',
      error: error.message 
    });
  }
});

// @route   GET /api/images/:filename
// @desc    Serve optimized images
// @access  Public (or Private if needed)
router.get('/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const imagePath = path.join(__dirname, '../uploads/images/optimized', filename);

    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ message: 'Image not found' });
    }

    // Set appropriate content type
    const ext = path.extname(filename).toLowerCase();
    const contentType = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    }[ext] || 'image/jpeg';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache

    const fileStream = fs.createReadStream(imagePath);
    fileStream.pipe(res);

    fileStream.on('error', (err) => {
      console.error('Image stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to serve image' });
      }
    });
  } catch (error) {
    console.error('Serve image error:', error);
    res.status(500).json({ message: 'Failed to serve image' });
  }
});

module.exports = router;

