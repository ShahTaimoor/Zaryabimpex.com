const SettingsRepository = require('../repositories/SettingsRepository');
const UserRepository = require('../repositories/UserRepository');

class SettingsService {
  /**
   * Get company settings
   * @returns {Promise<object>}
   */
  async getCompanySettings() {
    return await SettingsRepository.getSettings();
  }

  /**
   * Update company settings
   * @param {object} updateData - Update data
   * @returns {Promise<object>}
   */
  async updateCompanySettings(updateData) {
    // Collect only the fields provided in the updateData to avoid overwriting with defaults
    const dataToUpdate = { ...updateData };
    
    // Explicitly handle mapping for required fields if they are provided
    if (updateData.companyName !== undefined || updateData.company_name !== undefined) {
      dataToUpdate.companyName = updateData.companyName ?? updateData.company_name;
    }
    if (updateData.contactNumber !== undefined || updateData.contact_number !== undefined) {
      dataToUpdate.contactNumber = updateData.contactNumber ?? updateData.contact_number;
    }
    
    // Address is usually just 'address'
    if (updateData.address !== undefined) {
      dataToUpdate.address = updateData.address;
    }

    return await SettingsRepository.updateSettings(dataToUpdate);
  }

  /**
   * Get user preferences
   * @param {string} userId - User ID
   * @returns {Promise<object>}
   */
  async getUserPreferences(userId) {
    const user = await UserRepository.findById(userId, { select: 'preferences' });
    if (!user) {
      throw new Error('User not found');
    }
    return user.preferences || {};
  }

  /**
   * Update user preferences
   * @param {string} userId - User ID
   * @param {object} preferences - Preferences data
   * @returns {Promise<object>}
   */
  async updateUserPreferences(userId, preferences) {
    const { theme, language, timezone } = preferences;

    const updates = {};
    if (theme) updates['preferences.theme'] = theme;
    if (language) updates['preferences.language'] = language;
    if (timezone) updates['preferences.timezone'] = timezone;

    const user = await UserRepository.update(userId, updates);
    if (!user) {
      throw new Error('User not found');
    }

    return user.preferences || {};
  }
}

module.exports = new SettingsService();

