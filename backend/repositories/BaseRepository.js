/**
 * Base Repository
 * Provides common database operations for all repositories
 * Implements soft delete pattern (isDeleted flag)
 */
class BaseRepository {
  constructor(Model) {
    this.Model = Model;
  }

  /**
   * Find all documents matching the query
   * Automatically filters out soft-deleted documents (if isDeleted field exists)
   */
  async findAll(query = {}, options = {}) {
    const { skip, limit, sort, populate, select, lean, includeDeleted = false } = options;

    // Add soft delete filter (only if model supports soft delete)
    const finalQuery = { ...query };
    if (!includeDeleted && this.Model.schema.paths.isDeleted) {
      finalQuery.isDeleted = { $ne: true };
    }

    let queryBuilder = this.Model.find(finalQuery);

    if (populate) {
      if (Array.isArray(populate)) {
        populate.forEach(pop => queryBuilder = queryBuilder.populate(pop));
      } else {
        queryBuilder = queryBuilder.populate(populate);
      }
    }

    if (select) {
      queryBuilder = queryBuilder.select(select);
    }

    // Validate and apply sort - only if sort is a valid value
    if (sort !== undefined && sort !== null) {
      // Ensure sort is a valid type (string, object, array, or map)
      // Empty strings, empty objects {}, null, undefined are invalid for sort
      const isValidSort =
        (typeof sort === 'string' && sort.trim().length > 0) ||
        (typeof sort === 'object' && sort !== null && !Array.isArray(sort) && Object.keys(sort).length > 0) ||
        (Array.isArray(sort) && sort.length > 0);

      if (isValidSort) {
        try {
          queryBuilder = queryBuilder.sort(sort);
        } catch (error) {
          console.warn('Error applying sort, skipping:', error.message, 'sort value:', sort);
        }
      } else {
        console.warn('Invalid sort parameter provided, skipping sort. Type:', typeof sort, 'Value:', sort);
      }
    }

    if (skip !== undefined) {
      queryBuilder = queryBuilder.skip(skip);
    }

    if (limit !== undefined) {
      queryBuilder = queryBuilder.limit(limit);
    }

    if (lean) {
      queryBuilder = queryBuilder.lean();
    }

    return await queryBuilder.exec();
  }

  /**
   * Find one document matching the query
   * Automatically filters out soft-deleted documents (if isDeleted field exists)
   */
  async findOne(query = {}, options = {}) {
    const { populate, select, lean, includeDeleted = false } = options;

    // Add soft delete filter (only if model supports soft delete)
    const finalQuery = { ...query };
    if (!includeDeleted && this.Model.schema.paths.isDeleted) {
      finalQuery.isDeleted = { $ne: true };
    }

    let queryBuilder = this.Model.findOne(finalQuery);

    if (populate) {
      if (Array.isArray(populate)) {
        populate.forEach(pop => queryBuilder = queryBuilder.populate(pop));
      } else {
        queryBuilder = queryBuilder.populate(populate);
      }
    }

    if (select) {
      queryBuilder = queryBuilder.select(select);
    }

    if (lean) {
      queryBuilder = queryBuilder.lean();
    }

    return await queryBuilder.exec();
  }

  /**
   * Find document by ID
   * Automatically filters out soft-deleted documents (if isDeleted field exists)
   */
  async findById(id, options = {}) {
    if (!id) return null;

    return await this.findOne({ _id: id }, options);
  }

  /**
   * Count documents matching the query
   * Automatically filters out soft-deleted documents (if isDeleted field exists)
   */
  async count(query = {}, options = {}) {
    const { includeDeleted = false } = options;
    const finalQuery = { ...query };
    if (!includeDeleted && this.Model.schema.paths.isDeleted) {
      finalQuery.isDeleted = { $ne: true };
    }
    return await this.Model.countDocuments(finalQuery);
  }

  /**
   * Create a new document
   */
  async create(data) {
    const document = new this.Model(data);
    return await document.save();
  }

  /**
   * Create multiple documents
   */
  async createMany(dataArray) {
    return await this.Model.insertMany(dataArray);
  }

  /**
   * Update a document by ID
   * Automatically filters out soft-deleted documents (if isDeleted field exists)
   */
  async updateById(id, updateData, options = {}) {
    const { new: returnNew = true, runValidators = true, includeDeleted = false } = options;

    const query = { _id: id };
    if (!includeDeleted && this.Model.schema.paths.isDeleted) {
      query.isDeleted = { $ne: true };
    }

    return await this.Model.findOneAndUpdate(
      query,
      updateData,
      { new: returnNew, runValidators }
    );
  }

  /**
   * Alias for updateById
   */
  async update(id, updateData, options = {}) {
    return await this.updateById(id, updateData, options);
  }

  /**
   * Update multiple documents
   * Automatically filters out soft-deleted documents
   */
  async updateMany(query, updateData, options = {}) {
    const finalQuery = { ...query, isDeleted: { $ne: true } };
    return await this.Model.updateMany(finalQuery, updateData, options);
  }

  /**
   * Soft delete a document (set isDeleted flag)
   */
  async softDelete(id) {
    return await this.updateById(id, {
      isDeleted: true,
      deletedAt: new Date()
    });
  }

  /**
   * Hard delete a document (permanent removal)
   */
  async hardDelete(id) {
    return await this.Model.findByIdAndDelete(id);
  }

  /**
   * Restore a soft-deleted document
   */
  async restore(id) {
    return await this.updateById(id, {
      isDeleted: false,
      deletedAt: null
    }, { includeDeleted: true });
  }

  /**
   * Delete a document (defaults to soft delete)
   * For backward compatibility - use softDelete() explicitly for clarity
   */
  async delete(id) {
    return await this.softDelete(id);
  }

  /**
   * Find all deleted documents
   */
  async findDeleted(query = {}, options = {}) {
    const finalQuery = { ...query, isDeleted: true };
    return await this.findAll(finalQuery, { ...options, includeDeleted: true });
  }

  /**
   * Find one deleted document
   */
  async findOneDeleted(query = {}, options = {}) {
    const finalQuery = { ...query, isDeleted: true };
    return await this.findOne(finalQuery, { ...options, includeDeleted: true });
  }

  /**
   * Find deleted document by ID
   */
  async findDeletedById(id, options = {}) {
    if (!id) return null;
    return await this.findOneDeleted({ _id: id }, options);
  }

  /**
   * Count deleted documents
   */
  async countDeleted(query = {}) {
    const finalQuery = { ...query, isDeleted: true };
    return await this.Model.countDocuments(finalQuery);
  }

  /**
   * Bulk soft delete documents
   */
  async bulkSoftDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return { deletedCount: 0 };
    }

    const result = await this.Model.updateMany(
      { _id: { $in: ids } },
      {
        isDeleted: true,
        deletedAt: new Date()
      }
    );

    return { deletedCount: result.modifiedCount };
  }

  /**
   * Bulk restore documents
   */
  async bulkRestore(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return { restoredCount: 0 };
    }

    const result = await this.Model.updateMany(
      { _id: { $in: ids }, isDeleted: true },
      {
        isDeleted: false,
        deletedAt: null
      }
    );

    return { restoredCount: result.modifiedCount };
  }

  /**
   * Permanently delete all soft-deleted documents older than specified days
   * WARNING: This is irreversible!
   */
  async purgeOldDeleted(olderThanDays = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.Model.deleteMany({
      isDeleted: true,
      deletedAt: { $lt: cutoffDate }
    });

    return { deletedCount: result.deletedCount };
  }

  /**
   * Get statistics about deleted items
   */
  async getDeletedStats() {
    const totalDeleted = await this.Model.countDocuments({ isDeleted: true });
    const recentlyDeleted = await this.Model.countDocuments({
      isDeleted: true,
      deletedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    });

    return {
      totalDeleted,
      recentlyDeleted,
      olderThan30Days: await this.Model.countDocuments({
        isDeleted: true,
        deletedAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      })
    };
  }

  /**
   * Execute aggregation pipeline
   * Automatically filters out soft-deleted documents
   */
  async aggregate(pipeline) {
    // Add soft delete filter to the beginning of the pipeline
    const softDeleteFilter = { $match: { isDeleted: { $ne: true } } };

    // If pipeline already starts with $match, merge the conditions
    if (pipeline.length > 0 && pipeline[0].$match) {
      pipeline[0].$match = {
        ...pipeline[0].$match,
        isDeleted: { $ne: true }
      };
    } else {
      pipeline.unshift(softDeleteFilter);
    }

    return await this.Model.aggregate(pipeline);
  }

  /**
   * Check if document exists
   */
  async exists(query = {}, options = {}) {
    const { includeDeleted = false } = options;
    const finalQuery = { ...query };
    if (!includeDeleted && this.Model.schema.paths.isDeleted) {
      finalQuery.isDeleted = { $ne: true };
    }
    const count = await this.Model.countDocuments(finalQuery);
    return count > 0;
  }
}

module.exports = BaseRepository;

