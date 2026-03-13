const NoteRepository = require('../repositories/NoteRepository');
const UserRepository = require('../repositories/UserRepository');

/** Normalize note row from Postgres (snake_case) to camelCase for API */
function toNote(row) {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    content: row.content,
    htmlContent: row.html_content || row.content,
    isPrivate: row.is_private,
    createdBy: row.created_by,
    mentions: row.mentions || [],
    tags: row.tags || [],
    history: row.history || [],
    isPinned: row.is_pinned,
    status: row.status,
    attachments: row.attachments || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/** Extract @username mentions from content; match users by username, name, or email. Returns mentions array. */
function extractMentions(content, users) {
  if (!content || !Array.isArray(users)) return [];
  const mentionRegex = /@(\w+)/g;
  const mentions = [];
  let match;
  while ((match = mentionRegex.exec(content)) !== null) {
    const word = match[1];
    const user = users.find(u => {
      const un = (u.username || u.email || '').toLowerCase();
      const name = (u.name || (u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : '') || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return un === word.toLowerCase() || name.includes(word.toLowerCase()) || email.startsWith(word.toLowerCase());
    });
    if (user) {
      mentions.push({
        userId: user.id || user._id,
        username: user.username || user.email || user.name || (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : ''),
        position: match.index
      });
    }
  }
  return mentions;
}

/** Build new history array with one more entry (last 50 kept). */
function addHistoryEntry(history, content, htmlContent, userId, changeReason) {
  const h = Array.isArray(history) ? [...history] : [];
  h.push({
    content,
    htmlContent: htmlContent || content,
    editedBy: userId,
    editedAt: new Date(),
    changeReason: changeReason || 'Note updated'
  });
  return h.slice(-50);
}

class NoteService {
  /**
   * Get notes with filters
   */
  async getNotes(queryParams, userId) {
    const { entityType, entityId, isPrivate, search, tags, limit = 50, page = 1 } = queryParams;

    const filter = { status: 'active' };
    if (entityType && entityId) {
      filter.entityType = entityType;
      filter.entityId = entityId;
    }
    if (isPrivate !== undefined) {
      filter.isPrivate = isPrivate === 'true';
    } else {
      filter.userId = userId;
    }
    if (search) filter.search = search;
    if (tags) {
      filter.tags = tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    }

    const result = await NoteRepository.findWithPagination(filter, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    });

    const notes = (result.notes || []).map(toNote);
    return { notes, pagination: result.pagination };
  }

  /**
   * Get single note by ID
   */
  async getNoteById(id, userId) {
    const row = await NoteRepository.findById(id);
    if (!row) throw new Error('Note not found');

    const note = toNote(row);
    const createdById = String(note.createdBy || row.created_by);
    if (note.isPrivate && createdById !== String(userId)) {
      throw new Error('Access denied to private note');
    }

    const creator = await UserRepository.findById(createdById);
    if (creator) {
      note.createdBy = { _id: creator.id, id: creator.id, name: [creator.firstName, creator.lastName].filter(Boolean).join(' '), username: creator.email, email: creator.email };
    }
    return note;
  }

  /**
   * Create note
   */
  async createNote(noteData, userId) {
    const { entityType, entityId, content, htmlContent, isPrivate, tags, isPinned } = noteData;

    const users = await UserRepository.findAll({}, { limit: 5000 });
    const userList = users.map(u => ({ id: u.id, _id: u.id, username: u.email, name: [u.firstName, u.lastName].filter(Boolean).join(' '), email: u.email }));
    const mentions = extractMentions(content || '', userList);

    const tagList = tags == null ? [] : (Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [].concat(tags)));
    const created = await NoteRepository.create({
      entityType,
      entityId,
      content: content || '',
      htmlContent: htmlContent || content || '',
      isPrivate: isPrivate || false,
      tags: tagList,
      isPinned: isPinned || false,
      createdBy: userId,
      mentions,
      status: 'active'
    });

    const note = toNote(created);
    const creator = await UserRepository.findById(created.created_by);
    if (creator) {
      note.createdBy = { _id: creator.id, id: creator.id, name: [creator.firstName, creator.lastName].filter(Boolean).join(' '), username: creator.email, email: creator.email };
    }
    return note;
  }

  /**
   * Update note
   */
  async updateNote(id, updateData, userId) {
    const row = await NoteRepository.findById(id);
    if (!row) throw new Error('Note not found');

    const createdByStr = String(row.created_by);
    if (createdByStr !== String(userId)) {
      throw new Error('Only the note creator can edit this note');
    }

    const history = addHistoryEntry(row.history || [], row.content, row.html_content, userId, updateData.changeReason);

    const content = updateData.content !== undefined ? updateData.content : row.content;
    const htmlContent = updateData.htmlContent !== undefined ? updateData.htmlContent : row.html_content;
    const users = await UserRepository.findAll({}, { limit: 5000 });
    const userList = users.map(u => ({ id: u.id, _id: u.id, username: u.email, name: [u.firstName, u.lastName].filter(Boolean).join(' '), email: u.email }));
    const mentions = extractMentions(content, userList);

    const data = {
      content,
      htmlContent,
      history,
      mentions
    };
    if (updateData.isPrivate !== undefined) data.isPrivate = updateData.isPrivate;
    if (updateData.tags !== undefined) data.tags = Array.isArray(updateData.tags) ? updateData.tags : [].concat(updateData.tags);
    if (updateData.isPinned !== undefined) data.isPinned = updateData.isPinned;

    const updated = await NoteRepository.updateById(id, data);
    const note = toNote(updated);
    const creator = await UserRepository.findById(updated.created_by);
    if (creator) {
      note.createdBy = { _id: creator.id, id: creator.id, name: [creator.firstName, creator.lastName].filter(Boolean).join(' '), username: creator.email, email: creator.email };
    }
    return note;
  }

  /**
   * Delete note (soft delete)
   */
  async deleteNote(id, userId) {
    const row = await NoteRepository.findById(id);
    if (!row) throw new Error('Note not found');
    if (String(row.created_by) !== String(userId)) {
      throw new Error('Only the note creator can delete this note');
    }
    await NoteRepository.updateById(id, { status: 'deleted' });
    return { message: 'Note deleted successfully' };
  }

  /**
   * Get note history
   */
  async getNoteHistory(id, userId) {
    const row = await NoteRepository.findById(id);
    if (!row) throw new Error('Note not found');
    if (row.is_private && String(row.created_by) !== String(userId)) {
      throw new Error('Access denied');
    }
    return row.history || [];
  }

  /**
   * Search users for mentions
   */
  async searchUsers(searchTerm) {
    return UserRepository.findSearch(searchTerm, 10);
  }
}

module.exports = new NoteService();
