const BaseRepository = require('./BaseRepository');
const InventoryReport = require('../models/InventoryReport');

class InventoryReportRepository extends BaseRepository {
  constructor() {
    super(InventoryReport);
  }

  /**
   * Find inventory report by reportId
   * @param {string} reportId - Report ID
   * @param {object} options - Query options
   * @returns {Promise<InventoryReport|null>}
   */
  async findByReportId(reportId, options = {}) {
    return await this.findOne({ reportId }, options);
  }
}

module.exports = new InventoryReportRepository();

