const BaseRepository = require('./BaseRepository');
const Settings = require('../models/Settings');

class SettingsRepository extends BaseRepository {
  constructor() {
    super(Settings);
  }

  /**
   * Get settings (singleton pattern - only one settings document exists)
   * @returns {Promise<object>}
   */
  async getSettings() {
    // Settings is a singleton - use the static method from the model
    return Settings.getSettings();
  }

  /**
   * Update settings (singleton pattern)
   * @param {object} updates - Update data
   * @returns {Promise<object>}
   */
  async updateSettings(updates) {
    // Settings is a singleton - use the static method from the model
    return Settings.updateSettings(updates);
  }
}

module.exports = new SettingsRepository();

