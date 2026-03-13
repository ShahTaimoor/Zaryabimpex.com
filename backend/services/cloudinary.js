const cloudinary = require('cloudinary').v2;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const logger = require('../utils/logger');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timeout: 60000, // 60 seconds timeout for slow networks
  secure: true
});

/**
 * Check if Cloudinary environment variables are configured
 * @returns {Object} - { isConfigured: boolean, missing: string[], config: Object }
 */
const checkCloudinaryConfig = () => {
  const requiredVars = [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);
  const isConfigured = missing.length === 0;

  return {
    isConfigured,
    missing,
    config: {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? '***configured***' : 'missing',
      api_key: process.env.CLOUDINARY_API_KEY ? '***configured***' : 'missing',
      api_secret: process.env.CLOUDINARY_API_SECRET ? '***configured***' : 'missing'
    }
  };
};

/**
 * Test Cloudinary connection by making a simple API call
 * @returns {Promise<Object>} - { connected: boolean, message: string, error?: string }
 */
const testCloudinaryConnection = async () => {
  try {
    const configCheck = checkCloudinaryConfig();
    
    if (!configCheck.isConfigured) {
      return {
        connected: false,
        message: 'Cloudinary not configured',
        error: `Missing environment variables: ${configCheck.missing.join(', ')}`,
        config: configCheck.config
      };
    }

    // Test connection by getting account details
    const result = await cloudinary.api.ping();
    
    return {
      connected: true,
      message: 'Cloudinary connection successful',
      status: result.status || 'ok'
    };
  } catch (error) {
    return {
      connected: false,
      message: 'Cloudinary connection failed',
      error: error.message,
      stack: error.stack
    };
  }
};

const uploadImageOnCloudinary = async (buffer, folderName, options = {}) => {
  try {
    const { convertToWebP, getImageMetadata } = require('./imageProcessor');

    // Check if the image is already WebP format
    let metadata;
    let webpBuffer;

    try {
      metadata = await getImageMetadata(buffer);
      const isAlreadyWebP = metadata.format === 'webp';

      if (isAlreadyWebP) {
        if (process.env.NODE_ENV !== 'production') {
          logger.debug(`Image is already WebP format: ${(buffer.length / 1024).toFixed(2)}KB`);
        }
        webpBuffer = buffer;
      } else {
        // Convert to WebP with optimization
        webpBuffer = await convertToWebP(buffer, {
          quality: 80,
          width: 1200,
          height: 1200,
          fit: 'inside',
          ...options
        });

        if (process.env.NODE_ENV !== 'production') {
          logger.debug(`Converting image to WebP: ${(buffer.length / 1024).toFixed(2)}KB → ${(webpBuffer.length / 1024).toFixed(2)}KB`);
        }
      }
    } catch (metadataError) {
      // If metadata extraction fails, assume it needs conversion
      logger.warn('Could not determine image format, attempting conversion...');
      webpBuffer = await convertToWebP(buffer, {
        quality: 80,
        width: 1200,
        height: 1200,
        fit: 'inside',
        ...options
      });
    }

    const base64String = `data:image/webp;base64,${webpBuffer.toString('base64')}`;

    const result = await cloudinary.uploader.upload(base64String, {
      folder: folderName,
      format: 'webp',
      quality: 'auto:good',
      fetch_format: 'auto',
      flags: 'lossy',
      timeout: 60000 // 60 seconds timeout for slow networks
    });

    logger.info('WebP upload successful', { url: result.secure_url });

    return {
      secure_url: result.secure_url,
      public_id: result.public_id
    };
  } catch (error) {
    logger.error('Cloudinary upload error:', { error: error.message, stack: error.stack });
    throw new Error('Cloudinary upload failed');
  }
};

const uploadResponsiveWebP = async (buffer, folderName, options = {}) => {
  try {
    const { generateResponsiveWebP } = require('./imageProcessor');
    const responsiveImages = await generateResponsiveWebP(buffer);

    const uploadResults = {};

    for (const [size, webpBuffer] of Object.entries(responsiveImages)) {
      const base64String = `data:image/webp;base64,${webpBuffer.toString('base64')}`;

      const result = await cloudinary.uploader.upload(base64String, {
        folder: `${folderName}/${size}`,
        format: 'webp',
        quality: 'auto:good',
        fetch_format: 'auto',
        flags: 'lossy',
        timeout: 60000 // 60 seconds timeout for slow networks
      });

      uploadResults[size] = {
        secure_url: result.secure_url,
        public_id: result.public_id
      };
    }

    logger.info('Responsive WebP images uploaded successfully');
    return uploadResults;
  } catch (error) {
    logger.error('Responsive WebP upload error:', { error: error.message, stack: error.stack });
    throw new Error('Responsive WebP upload failed');
  }
};

const deleteImageOnCloudinary = async (public_id) => {
  try {
    return await cloudinary.uploader.destroy(public_id, { timeout: 30000 });
  } catch (error) {
    logger.error('Cloudinary delete error:', { error: error.message, stack: error.stack });
    throw new Error('Cloudinary deletion failed');
  }
};

module.exports = {
  uploadImageOnCloudinary,
  uploadResponsiveWebP,
  deleteImageOnCloudinary,
  checkCloudinaryConfig,
  testCloudinaryConnection
};
