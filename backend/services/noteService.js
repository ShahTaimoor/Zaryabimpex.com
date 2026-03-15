const NoteRepository = require('../repositories/NoteRepository');
const UserRepository = require('../repositories/UserRepository');
const Note = require('../models/Note'); // Still needed for model methods like extractMentions

class NoteService {
  /**
   * Get notes with filters
   * @param {object} queryParams - Query parameters
   * @param {string} userId - Current user ID
   * @returns {Promise<{notes: Array, pagination: object}>}
   */
  async getNotes(queryParams, userId) {
    const { entityType, entityId, isPrivate, search, tags, limit = 50, page = 1 } = queryParams;

    // Build query
    const filter = { status: 'active' };

    if (entityType && entityId) {
      filter.entityType = entityType;
      filter.entityId = entityId;
    }

    // Privacy filter: show public notes or private notes created by current user
    if (isPrivate !== undefined) {
      filter.isPrivate = isPrivate === 'true';
    } else {
      // Default: show all notes user has access to
      filter.$or = [
        { isPrivate: false },
        { isPrivate: true, createdBy: userId }
      ];
    }

    // Search filter
    if (search) {
      filter.$text = { $search: search };
    }

    // Tags filter
    if (tags) {
      const tagArray = tags.split(',').map(t => t.trim().toLowerCase());
      filter.tags = { $in: tagArray };
    }

    const populate = [
      { path: 'createdBy', select: 'name username email' },
      { path: 'mentions.userId', select: 'name username email' }
    ];

    return await NoteRepository.findWithPagination(filter, {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { isPinned: -1, createdAt: -1 },
      populate
    });
  }

  /**
   * Get single note by ID
   * @param {string} id - Note ID
   * @param {string} userId - Current user ID
   * @returns {Promise<object>}
   */
  async getNoteById(id, userId) {
    const populate = [
      { path: 'createdBy', select: 'name username email' },
      { path: 'mentions.userId', select: 'name username email' },
      { path: 'history.editedBy', select: 'name username email' }
    ];

    const note = await NoteRepository.findById(id, populate);
    if (!note) {
      throw new Error('Note not found');
    }

    // Check access: private notes only visible to creator
    if (note.isPrivate && note.createdBy._id.toString() !== userId) {
      throw new Error('Access denied to private note');
    }

    return note;
  }

  /**
   * Create note
   * @param {object} noteData - Note data
   * @param {string} userId - User ID
   * @returns {Promise<object>}
   */
  async createNote(noteData, userId) {
    const { entityType, entityId, content, htmlContent, isPrivate, tags, isPinned } = noteData;

    // Create note
    const note = new Note({
      entityType,
      entityId,
      content,
      htmlContent: htmlContent || content,
      isPrivate: isPrivate || false,
      tags: tags || [],
      isPinned: isPinned || false,
      createdBy: userId
    });

    // Extract mentions
    const users = await UserRepository.findAll({}, { select: 'name username email' });
    note.extractMentions(users);

    await note.save();

    // Populate before returning
    return await NoteRepository.findById(note._id, [
      { path: 'createdBy', select: 'name username email' },
      { path: 'mentions.userId', select: 'name username email' }
    ]);
  }

  /**
   * Update note
   * @param {string} id - Note ID
   * @param {object} updateData - Update data
   * @param {string} userId - User ID
   * @returns {Promise<object>}
   */
  async updateNote(id, updateData, userId) {
    const note = await NoteRepository.findById(id);
    if (!note) {
      throw new Error('Note not found');
    }

    // Check permissions: only creator can edit
    if (note.createdBy.toString() !== userId) {
      throw new Error('Only the note creator can edit this note');
    }

    // Add to history before updating
    note.addHistoryEntry(userId, updateData.changeReason);

    // Update fields
    if (updateData.content !== undefined) note.content = updateData.content;
    if (updateData.htmlContent !== undefined) note.htmlContent = updateData.htmlContent;
    if (updateData.isPrivate !== undefined) note.isPrivate = updateData.isPrivate;
    if (updateData.tags !== undefined) note.tags = updateData.tags;
    if (updateData.isPinned !== undefined) note.isPinned = updateData.isPinned;

    // Re-extract mentions
    const users = await UserRepository.findAll({}, { select: 'name username email' });
    note.extractMentions(users);

    await note.save();

    // Populate before returning
    return await NoteRepository.findById(id, [
      { path: 'createdBy', select: 'name username email' },
      { path: 'mentions.userId', select: 'name username email' },
      { path: 'history.editedBy', select: 'name username email' }
    ]);
  }

  /**
   * Delete note (soft delete)
   * @param {string} id - Note ID
   * @param {string} userId - User ID
   * @returns {Promise<object>}
   */
  async deleteNote(id, userId) {
    const note = await NoteRepository.findById(id);
    if (!note) {
      throw new Error('Note not found');
    }

    // Check permissions: only creator can delete
    if (note.createdBy.toString() !== userId) {
      throw new Error('Only the note creator can delete this note');
    }

    // Soft delete
    note.status = 'deleted';
    await note.save();

    return { message: 'Note deleted successfully' };
  }

  /**
   * Get note history
   * @param {string} id - Note ID
   * @param {string} userId - Current user ID
   * @returns {Promise<Array>}
   */
  async getNoteHistory(id, userId) {
    const note = await NoteRepository.findById(id, [
      { path: 'history.editedBy', select: 'name username email' }
    ]);
    if (!note) {
      throw new Error('Note not found');
    }

    // Check access
    if (note.isPrivate && note.createdBy.toString() !== userId) {
      throw new Error('Access denied');
    }

    return note.history;
  }

  /**
   * Search users for mentions
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>}
   */
  async searchUsers(searchTerm) {
    if (!searchTerm || searchTerm.length < 2) {
      return [];
    }

    const filter = {
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { username: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } }
      ],
      role: { $ne: 'deleted' }
    };

    const users = await UserRepository.findAll(filter, {
      select: 'name username email',
      limit: 10,
      lean: true
    });

    return users;
  }
}

module.exports = new NoteService();

