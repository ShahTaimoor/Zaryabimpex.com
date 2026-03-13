/**
 * Voucher Code Generator Utility
 * Centralized voucher code generation to remove duplication across models
 */

/**
 * Generate a date-based voucher code with sequence
 * Format: PREFIX-YYYYMMDDXXX
 * 
 * @param {Object} options - Generation options
 * @param {string} options.prefix - Voucher code prefix (e.g., 'CP', 'BP', 'BR')
 * @param {Object} options.Model - Mongoose model to query for last voucher
 * @param {Date} options.date - Date to use (defaults to today)
 * @returns {Promise<string>} Generated voucher code
 */
const generateDateBasedVoucherCode = async ({ prefix, Model, date = new Date() }) => {
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  
  // Find the last voucher for today
  const lastVoucher = await Model.findOne({
    voucherCode: new RegExp(`^${prefix}-${dateStr}`)
  }).sort({ voucherCode: -1 });
  
  let sequence = 1;
  if (lastVoucher) {
    // Extract sequence number from voucher code (format: PREFIX-YYYYMMDDXXX)
    // Split by '-' to get ["PREFIX", "YYYYMMDDXXX"], then extract sequence after 8-char date
    const parts = lastVoucher.voucherCode.split('-');
    if (parts.length >= 2) {
      const dateAndSequence = parts[1]; // "YYYYMMDDXXX"
      if (dateAndSequence.length > 8) {
        // Extract all digits after the 8-character date (YYYYMMDD)
        const lastSequenceStr = dateAndSequence.substring(8);
        const lastSequence = parseInt(lastSequenceStr, 10);
        // Validate that sequence is a valid positive number
        if (!isNaN(lastSequence) && lastSequence > 0) {
          sequence = lastSequence + 1;
        }
      }
    }
  }
  
  // Format sequence with minimum 3 digits, but allow more if needed
  const sequenceStr = sequence.toString().padStart(3, '0');
  return `${prefix}-${dateStr}${sequenceStr}`;
};

/**
 * Generate a counter-based voucher code
 * Format: PREFIX-XXXXXX (6-digit sequence)
 * 
 * @param {Object} options - Generation options
 * @param {string} options.prefix - Voucher code prefix (e.g., 'CR', 'JV')
 * @param {string} options.counterId - Counter ID for the sequence
 * @param {Object} options.Counter - Counter model
 * @returns {Promise<string>} Generated voucher code
 */
const generateCounterBasedVoucherCode = async ({ prefix, counterId, Counter }) => {
  const counter = await Counter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return `${prefix}-${String(counter.seq).padStart(6, '0')}`;
};

/**
 * Extract sequence from voucher code
 * @param {string} voucherCode - Voucher code to parse
 * @returns {number|null} Sequence number or null if invalid
 */
const extractSequence = (voucherCode) => {
  if (!voucherCode) return null;
  
  const parts = voucherCode.split('-');
  if (parts.length < 2) return null;
  
  const dateAndSequence = parts[1];
  if (dateAndSequence.length > 8) {
    const sequenceStr = dateAndSequence.substring(8);
    const sequence = parseInt(sequenceStr, 10);
    return !isNaN(sequence) && sequence > 0 ? sequence : null;
  }
  
  return null;
};

module.exports = {
  generateDateBasedVoucherCode,
  generateCounterBasedVoucherCode,
  extractSequence
};

