const BaseRepository = require('./BaseRepository');
const Note = require('../models/Note');

class NoteRepository extends BaseRepository {
  constructor() {
    super(Note);
  }

  /**
   * Find notes with advanced filtering and pagination
   * @param {object} filter - Filter query
   * @param {object} options - Pagination and sorting options
   * @returns {Promise<{notes: Array, total: number, pagination: object}>}
   */
  async findWithPagination(filter = {}, options = {}) {
    const {
      page = 1,
      limit = 50,
      sort = { isPinned: -1, createdAt: -1 },
      populate = [
        { path: 'createdBy', select: 'name username email' },
        { path: 'mentions.userId', select: 'name username email' }
      ],
      getAll = false
    } = options;

    const query = this.hasSoftDelete ? { ...filter, isDeleted: false } : filter;

    const skip = getAll ? 0 : (page - 1) * limit;
    const finalLimit = getAll ? 0 : limit;

    const [notes, total] = await Promise.all([
      this.model.find(query)
        .populate(populate)
        .sort(sort)
        .skip(skip)
        .limit(finalLimit)
        .lean(),
      this.model.countDocuments(query)
    ]);

    return {
      notes,
      total,
      pagination: {
        page,
        limit,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Find notes by entity
   * @param {string} entityType - Entity type
   * @param {string} entityId - Entity ID
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByEntity(entityType, entityId, options = {}) {
    const query = { entityType, entityId, status: 'active' };
    if (this.hasSoftDelete) query.isDeleted = false;
    return this.model.find(query, null, options);
  }

  /**
   * Find notes by tags
   * @param {Array} tags - Array of tags
   * @param {object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByTags(tags, options = {}) {
    const query = { tags: { $in: tags }, status: 'active' };
    if (this.hasSoftDelete) query.isDeleted = false;
    return this.model.find(query, null, options);
  }
}

module.exports = new NoteRepository();

