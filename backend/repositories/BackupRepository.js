const BaseRepository = require('./BaseRepository');
const Backup = require('../models/Backup');

class BackupRepository extends BaseRepository {
  constructor() {
    super(Backup);
  }

  /**
   * Find backups with pagination and filtering
   * @param {object} filter - Filter query
   * @param {object} options - Pagination and sorting options
   * @returns {Promise<{backups: Array, total: number, pagination: object}>}
   */
  async findWithPagination(filter = {}, options = {}) {
    const {
      page = 1,
      limit = 10,
      sort = { createdAt: -1 },
      populate = [
        { path: 'triggeredBy', select: 'firstName lastName email' }
      ]
    } = options;

    const skip = (page - 1) * limit;

    const [backups, total] = await Promise.all([
      this.model.find(filter)
        .populate(populate)
        .sort(sort)
        .skip(skip)
        .limit(limit),
      this.model.countDocuments(filter)
    ]);

    return {
      backups,
      total,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    };
  }
}

module.exports = new BackupRepository();

