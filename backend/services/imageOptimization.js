/**
 * Image Optimization Service
 * Handles image compression, WebP conversion, and multiple size generation
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Image size configurations
const IMAGE_SIZES = {
  thumbnail: { width: 150, height: 150 },
  small: { width: 300, height: 300 },
  medium: { width: 600, height: 600 },
  large: { width: 1200, height: 1200 }
};

// Compression quality settings
const QUALITY = {
  jpeg: 85,
  webp: 85,
  png: 90
};

/**
 * Optimize image - compress and convert to WebP
 * @param {string} inputPath - Path to input image
 * @param {string} outputDir - Directory to save optimized images
 * @param {Object} options - Optimization options
 * @returns {Promise<Object>} - Object with paths to optimized images
 */
const optimizeImage = async (inputPath, outputDir, options = {}) => {
  const {
    generateSizes = true,
    generateWebP = true,
    keepOriginal = false,
    maxWidth = 2000,
    maxHeight = 2000
  } = options;

  try {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = path.basename(inputPath, path.extname(inputPath));
    const results = {
      original: null,
      optimized: null,
      webp: null,
      sizes: {}
    };

    // Get image metadata
    const metadata = await sharp(inputPath).metadata();
    const format = metadata.format;

    // Resize if too large
    let image = sharp(inputPath);
    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      image = image.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Generate optimized original (JPEG/PNG)
    const optimizedPath = path.join(outputDir, `${filename}_optimized.${format}`);
    await image
      .toFormat(format, {
        quality: format === 'jpeg' ? QUALITY.jpeg : QUALITY.png,
        mozjpeg: format === 'jpeg',
        compressionLevel: format === 'png' ? 9 : undefined
      })
      .toFile(optimizedPath);

    results.optimized = optimizedPath;

    // Keep original if requested
    if (keepOriginal) {
      const originalPath = path.join(outputDir, `${filename}_original.${format}`);
      fs.copyFileSync(inputPath, originalPath);
      results.original = originalPath;
    }

    // Generate WebP version
    if (generateWebP) {
      const webpPath = path.join(outputDir, `${filename}.webp`);
      await image
        .toFormat('webp', {
          quality: QUALITY.webp
        })
        .toFile(webpPath);
      results.webp = webpPath;
    }

    // Generate multiple sizes
    if (generateSizes) {
      for (const [sizeName, dimensions] of Object.entries(IMAGE_SIZES)) {
        // JPEG version
        const jpegPath = path.join(outputDir, `${filename}_${sizeName}.jpg`);
        await sharp(inputPath)
          .resize(dimensions.width, dimensions.height, {
            fit: 'cover',
            position: 'center'
          })
          .jpeg({ quality: QUALITY.jpeg, mozjpeg: true })
          .toFile(jpegPath);
        results.sizes[sizeName] = {
          jpeg: jpegPath
        };

        // WebP version
        if (generateWebP) {
          const webpPath = path.join(outputDir, `${filename}_${sizeName}.webp`);
          await sharp(inputPath)
            .resize(dimensions.width, dimensions.height, {
              fit: 'cover',
              position: 'center'
            })
            .webp({ quality: QUALITY.webp })
            .toFile(webpPath);
          results.sizes[sizeName].webp = webpPath;
        }
      }
    }

    return results;
  } catch (error) {
    console.error('Image optimization error:', error);
    throw error;
  }
};

/**
 * Compress image without resizing
 * @param {string} inputPath - Path to input image
 * @param {string} outputPath - Path to save compressed image
 * @returns {Promise<string>} - Path to compressed image
 */
const compressImage = async (inputPath, outputPath) => {
  try {
    const metadata = await sharp(inputPath).metadata();
    const format = metadata.format;

    await sharp(inputPath)
      .toFormat(format, {
        quality: format === 'jpeg' ? QUALITY.jpeg : QUALITY.png,
        mozjpeg: format === 'jpeg',
        compressionLevel: format === 'png' ? 9 : undefined
      })
      .toFile(outputPath);

    return outputPath;
  } catch (error) {
    console.error('Image compression error:', error);
    throw error;
  }
};

/**
 * Convert image to WebP
 * @param {string} inputPath - Path to input image
 * @param {string} outputPath - Path to save WebP image
 * @returns {Promise<string>} - Path to WebP image
 */
const convertToWebP = async (inputPath, outputPath) => {
  try {
    await sharp(inputPath)
      .webp({ quality: QUALITY.webp })
      .toFile(outputPath);

    return outputPath;
  } catch (error) {
    console.error('WebP conversion error:', error);
    throw error;
  }
};

/**
 * Get image info
 * @param {string} imagePath - Path to image
 * @returns {Promise<Object>} - Image metadata
 */
const getImageInfo = async (imagePath) => {
  try {
    const metadata = await sharp(imagePath).metadata();
    const stats = fs.statSync(imagePath);

    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: stats.size,
      sizeKB: (stats.size / 1024).toFixed(2)
    };
  } catch (error) {
    console.error('Get image info error:', error);
    throw error;
  }
};

/**
 * Generate srcset string for responsive images
 * @param {string} basePath - Base path without extension
 * @param {string} baseUrl - Base URL for images
 * @returns {string} - srcset string
 */
const generateSrcSet = (basePath, baseUrl = '') => {
  const srcset = [];
  for (const [sizeName, dimensions] of Object.entries(IMAGE_SIZES)) {
    const webpUrl = `${baseUrl}${basePath}_${sizeName}.webp`;
    srcset.push(`${webpUrl} ${dimensions.width}w`);
  }
  return srcset.join(', ');
};

/**
 * Generate sizes attribute for responsive images
 * @returns {string} - sizes attribute
 */
const generateSizes = () => {
  return '(max-width: 640px) 300px, (max-width: 1024px) 600px, 1200px';
};

module.exports = {
  optimizeImage,
  compressImage,
  convertToWebP,
  getImageInfo,
  generateSrcSet,
  generateSizes,
  IMAGE_SIZES,
  QUALITY
};

