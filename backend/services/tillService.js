const TillSessionRepository = require('../repositories/TillSessionRepository');

class TillService {
  /**
   * Open a till session
   * @param {object} sessionData - Session data
   * @param {string} userId - User ID
   * @returns {Promise<object>}
   */
  async openTill(sessionData, userId) {
    // Check if user already has an open session
    const existingSession = await TillSessionRepository.findOpenSessionByUser(userId);
    if (existingSession) {
      throw new Error('Till already open for this user');
    }

    const processedData = {
      user: userId,
      storeId: sessionData.storeId || null,
      deviceId: sessionData.deviceId || null,
      openedAt: new Date(),
      openingAmount: Number(sessionData.openingAmount),
      notesOpen: sessionData.notesOpen || '',
      status: 'open'
    };

    try {
      return await TillSessionRepository.create(processedData);
    } catch (err) {
      if (err.code === 11000) {
        throw new Error('Duplicate entry detected');
      }
      throw err;
    }
  }

  /**
   * Close a till session
   * @param {object} closeData - Close data
   * @param {string} userId - User ID
   * @returns {Promise<object>}
   */
  async closeTill(closeData, userId) {
    const session = await TillSessionRepository.findOpenSessionByUser(userId);
    if (!session) {
      throw new Error('No open till to close');
    }

    // Use the model's closeTill method
    session.closeTill(
      Number(closeData.closingDeclaredAmount),
      typeof closeData.expectedAmount !== 'undefined' ? Number(closeData.expectedAmount) : undefined,
      closeData.notesClose
    );

    await session.save();
    return session;
  }

  /**
   * Get variance/sessions for a user
   * @param {string} userId - User ID
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async getSessionsByUser(userId, options = {}) {
    const { limit = 20 } = options;
    return await TillSessionRepository.findSessionsByUser(userId, { limit, sort: { createdAt: -1 } });
  }
}

module.exports = new TillService();

