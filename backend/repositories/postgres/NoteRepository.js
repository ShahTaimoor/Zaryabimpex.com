const { query } = require('../../config/postgres');

class NoteRepository {
  async findById(id) {
    const result = await query(
      'SELECT * FROM notes WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findAll(filters = {}, options = {}) {
    let sql = 'SELECT * FROM notes WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filters.entityType) {
      sql += ` AND entity_type = $${paramCount++}`;
      params.push(filters.entityType);
    }
    if (filters.entityId) {
      sql += ` AND entity_id = $${paramCount++}`;
      params.push(filters.entityId);
    }
    if (filters.status) {
      sql += ` AND status = $${paramCount++}`;
      params.push(filters.status);
    }
    if (filters.createdBy) {
      sql += ` AND created_by = $${paramCount++}`;
      params.push(filters.createdBy);
    }
    if (filters.isPrivate !== undefined) {
      sql += ` AND is_private = $${paramCount++}`;
      params.push(filters.isPrivate);
    }
    // Access: show public notes OR private notes by this user
    if (filters.userId != null) {
      sql += ` AND (is_private = FALSE OR (is_private = TRUE AND created_by = $${paramCount++}))`;
      params.push(filters.userId);
    }
    if (filters.search) {
      const searchVal = '%' + String(filters.search).replace(/%/g, '\\%') + '%';
      sql += ` AND (content ILIKE $${paramCount} OR html_content ILIKE $${paramCount})`;
      params.push(searchVal);
      paramCount++;
    }
    if (filters.tags && (Array.isArray(filters.tags) ? filters.tags.length : 0) > 0) {
      sql += ` AND tags && $${paramCount++}::text[]`;
      params.push(filters.tags);
    }

    sql += ' ORDER BY is_pinned DESC, created_at DESC';
    if (options.limit) {
      sql += ` LIMIT $${paramCount++}`;
      params.push(options.limit);
    }
    if (options.offset) {
      sql += ` OFFSET $${paramCount++}`;
      params.push(options.offset);
    }

    const result = await query(sql, params);
    return result.rows;
  }

  async findWithPagination(filter = {}, options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;
    const getAll = options.getAll === true;
    const countFilter = { ...filter };
    let countSql = 'SELECT COUNT(*) FROM notes WHERE 1=1';
    const countParams = [];
    let paramCount = 1;
    if (countFilter.entityType) {
      countSql += ` AND entity_type = $${paramCount++}`;
      countParams.push(countFilter.entityType);
    }
    if (countFilter.entityId) {
      countSql += ` AND entity_id = $${paramCount++}`;
      countParams.push(countFilter.entityId);
    }
    if (countFilter.status) {
      countSql += ` AND status = $${paramCount++}`;
      countParams.push(countFilter.status);
    }
    if (countFilter.isPrivate !== undefined) {
      countSql += ` AND is_private = $${paramCount++}`;
      countParams.push(countFilter.isPrivate);
    }
    if (countFilter.userId != null) {
      countSql += ` AND (is_private = FALSE OR (is_private = TRUE AND created_by = $${paramCount++}))`;
      countParams.push(countFilter.userId);
    }
    if (countFilter.search) {
      const searchVal = '%' + String(countFilter.search).replace(/%/g, '\\%') + '%';
      countSql += ` AND (content ILIKE $${paramCount} OR html_content ILIKE $${paramCount})`;
      countParams.push(searchVal);
      paramCount++;
    }
    if (countFilter.tags && (Array.isArray(countFilter.tags) ? countFilter.tags.length : 0) > 0) {
      countSql += ` AND tags && $${paramCount++}::text[]`;
      countParams.push(countFilter.tags);
    }
    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count, 10);

    const notes = await this.findAll(filter, {
      limit: getAll ? total : limit,
      offset: getAll ? 0 : offset
    });

    return {
      notes,
      total,
      pagination: {
        page: getAll ? 1 : page,
        limit: getAll ? total : limit,
        pages: Math.ceil(total / limit) || 1,
        hasNext: !getAll && page * limit < total,
        hasPrev: page > 1
      }
    };
  }

  async findByEntity(entityType, entityId, options = {}) {
    return this.findAll({ entityType, entityId, status: 'active' }, options);
  }

  async findByTags(tags, options = {}) {
    if (!Array.isArray(tags) || tags.length === 0) return [];
    const result = await query(
      'SELECT * FROM notes WHERE status = $1 AND tags && $2::text[] ORDER BY created_at DESC LIMIT $3',
      ['active', tags, options.limit || 100]
    );
    return result.rows;
  }

  async create(data) {
    const result = await query(
      `INSERT INTO notes (entity_type, entity_id, content, html_content, is_private, created_by, mentions, tags, history, is_pinned, status, attachments, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        data.entityType || data.entity_type,
        data.entityId || data.entity_id,
        data.content,
        data.htmlContent || data.html_content || '',
        data.isPrivate === true,
        data.createdBy || data.created_by,
        data.mentions ? JSON.stringify(data.mentions) : '[]',
        data.tags ? (Array.isArray(data.tags) ? data.tags : []) : [],
        data.history ? JSON.stringify(data.history) : '[]',
        data.isPinned === true,
        data.status || 'active',
        data.attachments ? JSON.stringify(data.attachments) : '[]'
      ]
    );
    return result.rows[0];
  }

  async updateById(id, data) {
    const updates = [];
    const params = [];
    let paramCount = 1;
    const map = {
      content: 'content', htmlContent: 'html_content', isPrivate: 'is_private',
      mentions: 'mentions', tags: 'tags', history: 'history', isPinned: 'is_pinned',
      status: 'status', attachments: 'attachments'
    };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) {
        updates.push(`${col} = $${paramCount++}`);
        const val = data[k];
        if (col === 'tags' && Array.isArray(val)) params.push(val);
        else if (['mentions', 'history', 'attachments'].includes(col) && (typeof val === 'object' || Array.isArray(val))) params.push(JSON.stringify(val));
        else params.push(val);
      }
    }
    if (updates.length === 0) return this.findById(id);
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    const result = await query(
      `UPDATE notes SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }
}

module.exports = new NoteRepository();
