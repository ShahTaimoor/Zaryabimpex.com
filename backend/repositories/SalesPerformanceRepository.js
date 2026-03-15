const BaseRepository = require('./BaseRepository');
const SalesPerformance = require('../models/SalesPerformance');

class SalesPerformanceRepository extends BaseRepository {
  constructor() {
    super(SalesPerformance);
  }

  /**
   * Find sales performance report by reportId
   * @param {string} reportId - Report ID
   * @param {object} options - Query options
   * @returns {Promise<SalesPerformance|null>}
   */
  async findByReportId(reportId, options = {}) {
    return await this.findOne({ reportId }, options);
  }
}

module.exports = new SalesPerformanceRepository();

