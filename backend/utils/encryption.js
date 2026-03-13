const crypto = require('crypto');

/**
 * Encryption utility for sensitive data like database URLs
 * Uses AES-256-GCM encryption
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Get encryption key from environment variable
 * Falls back to JWT_SECRET if ENCRYPTION_KEY is not set
 */
function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!key) {
    throw new Error('ENCRYPTION_KEY or JWT_SECRET must be set for encryption');
  }
  // Derive a 32-byte key from the secret
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypt text
 * @param {string} text - Text to encrypt
 * @returns {string} - Encrypted text (base64 encoded)
 */
function encrypt(text) {
  if (!text) {
    return null;
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const tag = cipher.getAuthTag();

    // Combine iv + tag + encrypted data
    const combined = Buffer.concat([
      iv,
      tag,
      Buffer.from(encrypted, 'base64')
    ]);

    return combined.toString('base64');
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypt text
 * @param {string} encryptedText - Encrypted text (base64 encoded)
 * @returns {string} - Decrypted text
 */
function decrypt(encryptedText) {
  if (!encryptedText) {
    return null;
  }

  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(encryptedText, 'base64');

    // Extract iv, tag, and encrypted data
    const iv = combined.slice(0, IV_LENGTH);
    const tag = combined.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = combined.slice(IV_LENGTH + TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, null, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

module.exports = {
  encrypt,
  decrypt
};
