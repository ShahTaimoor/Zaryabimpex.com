/**
 * Image Processor Service (buffer-based)
 * Used by Cloudinary upload: getImageMetadata, convertToWebP, generateResponsiveWebP
 */

const sharp = require('sharp');

const RESPONSIVE_SIZES = {
  thumbnail: { width: 150, height: 150 },
  small: { width: 300, height: 300 },
  medium: { width: 600, height: 600 },
  large: { width: 1200, height: 1200 }
};

/**
 * Get image metadata from buffer
 * @param {Buffer} buffer - Image buffer
 * @returns {Promise<Object>} - { format, width, height, ... }
 */
const getImageMetadata = async (buffer) => {
  const metadata = await sharp(buffer).metadata();
  return {
    format: metadata.format,
    width: metadata.width,
    height: metadata.height,
    ...metadata
  };
};

/**
 * Convert image buffer to WebP buffer
 * @param {Buffer} buffer - Image buffer
 * @param {Object} options - { quality, width, height, fit, ... }
 * @returns {Promise<Buffer>} - WebP buffer
 */
const convertToWebP = async (buffer, options = {}) => {
  const {
    quality = 80,
    width = 1200,
    height = 1200,
    fit = 'inside',
    ...rest
  } = options;

  let pipeline = sharp(buffer);

  if (width || height) {
    pipeline = pipeline.resize(width, height, {
      fit,
      withoutEnlargement: true,
      ...rest
    });
  }

  return pipeline
    .webp({ quality })
    .toBuffer();
};

/**
 * Generate responsive WebP buffers (thumbnail, small, medium, large)
 * @param {Buffer} buffer - Image buffer
 * @returns {Promise<Object>} - { thumbnail: Buffer, small: Buffer, medium: Buffer, large: Buffer }
 */
const generateResponsiveWebP = async (buffer) => {
  const result = {};

  for (const [sizeName, dimensions] of Object.entries(RESPONSIVE_SIZES)) {
    result[sizeName] = await sharp(buffer)
      .resize(dimensions.width, dimensions.height, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 80 })
      .toBuffer();
  }

  return result;
};

module.exports = {
  getImageMetadata,
  convertToWebP,
  generateResponsiveWebP,
  RESPONSIVE_SIZES
};
