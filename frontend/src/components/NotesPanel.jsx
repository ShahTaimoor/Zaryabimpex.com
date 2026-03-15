import React, { useState, useEffect, useRef } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import {
  MessageSquare,
  Plus,
  Edit,
  Trash2,
  Lock,
  Unlock,
  Pin,
  Search,
  History,
  X,
  User,
  Tag
} from 'lucide-react';
import {
  useGetNotesQuery,
  useCreateNoteMutation,
  useUpdateNoteMutation,
  useDeleteNoteMutation,
  useGetNoteHistoryQuery,
  useSearchUsersQuery,
} from '../store/services/notesApi';
import { handleApiError, showSuccessToast, showErrorToast } from '../utils/errorHandler';
import toast from 'react-hot-toast';
import { LoadingSpinner } from './LoadingSpinner';

/**
 * Notes Panel Component
 * Supports rich text editing, @mentions, history, privacy, and search
 */
const NotesPanel = ({ 
  entityType, 
  entityId, 
  entityName,
  onClose 
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPrivate, setFilterPrivate] = useState(null);
  const [filterTags, setFilterTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  
  const [noteContent, setNoteContent] = useState('');
  const [noteHtmlContent, setNoteHtmlContent] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionPosition, setMentionPosition] = useState(null);
  const [mentionUsers, setMentionUsers] = useState([]);
  
  const quillRef = useRef(null);

  // Fetch notes
  const { data: notesData, isLoading: notesLoading, refetch } = useGetNotesQuery(
    {
      entityType,
      entityId,
      search: searchTerm || undefined,
      isPrivate: filterPrivate !== null ? filterPrivate : undefined
    },
    {
      skip: !entityType || !entityId,
    }
  );

  const notes = notesData?.notes || notesData?.data?.notes || [];

  // Fetch users for mentions
  const { data: usersData } = useSearchUsersQuery(
    mentionQuery,
    {
      skip: mentionQuery.length < 2,
    }
  );

  useEffect(() => {
    if (usersData) {
      setMentionUsers(usersData?.data || usersData || []);
      setShowMentions(mentionQuery.length >= 2);
    }
  }, [usersData, mentionQuery]);

  // Extract unique tags from notes
  useEffect(() => {
    const allTags = new Set();
    notes.forEach(note => {
      note.tags?.forEach(tag => allTags.add(tag));
    });
    setAvailableTags(Array.from(allTags));
  }, [notes]);

  // Create note mutation
  const [createNote, { isLoading: isCreatingNote }] = useCreateNoteMutation();

  // Update note mutation
  const [updateNote, { isLoading: isUpdatingNote }] = useUpdateNoteMutation();

  // Delete note mutation
  const [deleteNote, { isLoading: isDeletingNote }] = useDeleteNoteMutation();

  // Fetch note history
  const { data: historyData, isLoading: historyLoading } = useGetNoteHistoryQuery(
    selectedNoteId,
    {
      skip: !selectedNoteId || !showHistory
    }
  );

  const resetForm = () => {
    setNoteContent('');
    setNoteHtmlContent('');
    setIsPrivate(false);
    setIsPinned(false);
    setTags([]);
    setTagInput('');
    setIsCreating(false);
    setEditingNoteId(null);
  };

  const handleStartCreate = () => {
    resetForm();
    setIsCreating(true);
  };

  const handleEdit = (note) => {
    setNoteContent(note.content);
    setNoteHtmlContent(note.htmlContent || note.content);
    setIsPrivate(note.isPrivate);
    setIsPinned(note.isPinned);
    setTags(note.tags || []);
    setEditingNoteId(note._id);
    setIsCreating(true);
  };

  const handleSave = async () => {
    if (!noteContent.trim()) {
      toast.error('Note content cannot be empty');
      return;
    }

    const noteData = {
      entityType,
      entityId,
      content: noteContent,
      htmlContent: noteHtmlContent,
      isPrivate,
      isPinned,
      tags
    };

    try {
      if (editingNoteId) {
        await updateNote({ id: editingNoteId, ...noteData }).unwrap();
        showSuccessToast('Note updated successfully');
      } else {
        await createNote(noteData).unwrap();
        showSuccessToast('Note created successfully');
      }
      resetForm();
      refetch();
    } catch (error) {
      handleApiError(error, editingNoteId ? 'Update Note' : 'Create Note');
    }
  };

  const handleDelete = async (noteId) => {
    if (window.confirm('Are you sure you want to delete this note?')) {
      try {
        await deleteNote(noteId).unwrap();
        showSuccessToast('Note deleted successfully');
        refetch();
      } catch (error) {
        handleApiError(error, 'Delete Note');
      }
    }
  };

  const handleAddTag = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim().toLowerCase();
      if (!tags.includes(tag)) {
        setTags([...tags, tag]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  // Handle @mentions in editor
  const handleEditorChange = (content, delta, source, editor) => {
    setNoteHtmlContent(content);
    const text = editor.getText();
    setNoteContent(text);

    // Check for @mention on text change
    if (source === 'user' || source === 'api') {
      setTimeout(() => {
        try {
          const selection = editor.getSelection();
          if (selection) {
            const cursorPosition = selection.index;
            const textBeforeCursor = text.substring(0, cursorPosition);
            const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

            if (mentionMatch) {
              setMentionQuery(mentionMatch[1]);
              setMentionPosition(cursorPosition);
              setShowMentions(true);
            } else {
              setShowMentions(false);
              setMentionQuery('');
            }
          }
        } catch (error) {
          // Ignore selection errors
          setShowMentions(false);
        }
      }, 0);
    }
  };

  const handleInsertMention = (user) => {
    if (!quillRef.current) return;

    const editor = quillRef.current.getEditor();
    const selection = editor.getSelection();
    
    if (selection) {
      const text = editor.getText();
      const beforeCursor = text.substring(0, selection.index);
      const mentionMatch = beforeCursor.match(/@(\w*)$/);
      
      if (mentionMatch) {
        const startIndex = selection.index - mentionMatch[0].length;
        const mentionText = `@${user.username || user.name} `;
        editor.deleteText(startIndex, mentionMatch[0].length);
        editor.insertText(startIndex, mentionText);
        editor.setSelection(startIndex + mentionText.length);
      }
    }
    
    setShowMentions(false);
    setMentionQuery('');
  };

  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'color': [] }, { 'background': [] }],
      ['link'],
      ['clean']
    ]
  };

  const filteredNotes = notes.filter(note => {
    if (filterTags.length > 0) {
      const noteTags = note.tags || [];
      if (!filterTags.some(tag => noteTags.includes(tag))) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-75 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Notes for {entityName || `${entityType} #${entityId}`}
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 flex items-center space-x-1"
            >
              <History className="h-4 w-4" />
              <span>History</span>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Notes List */}
          <div className="w-1/3 border-r border-gray-200 flex flex-col">
            {/* Search and Filters */}
            <div className="p-3 border-b border-gray-200 space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search notes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => setFilterPrivate(filterPrivate === false ? null : false)}
                  className={`px-2 py-1 text-xs rounded ${
                    filterPrivate === false 
                      ? 'bg-primary-100 text-primary-700' 
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <Unlock className="h-3 w-3 inline mr-1" />
                  Public
                </button>
                <button
                  onClick={() => setFilterPrivate(filterPrivate === true ? null : true)}
                  className={`px-2 py-1 text-xs rounded ${
                    filterPrivate === true 
                      ? 'bg-primary-100 text-primary-700' 
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <Lock className="h-3 w-3 inline mr-1" />
                  Private
                </button>
              </div>

              {availableTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {availableTags.slice(0, 5).map(tag => (
                    <button
                      key={tag}
                      onClick={() => {
                        if (filterTags.includes(tag)) {
                          setFilterTags(filterTags.filter(t => t !== tag));
                        } else {
                          setFilterTags([...filterTags, tag]);
                        }
                      }}
                      className={`px-2 py-1 text-xs rounded ${
                        filterTags.includes(tag)
                          ? 'bg-primary-100 text-primary-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notes List */}
            <div className="flex-1 overflow-y-auto">
              {notesLoading ? (
                <div className="p-4 text-center">
                  <LoadingSpinner />
                </div>
              ) : filteredNotes.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <MessageSquare className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">No notes found</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredNotes.map(note => (
                    <div
                      key={note._id}
                      onClick={() => {
                        setSelectedNoteId(note._id);
                        setShowHistory(false);
                      }}
                      className={`p-3 cursor-pointer hover:bg-gray-50 ${
                        selectedNoteId === note._id ? 'bg-primary-50 border-l-4 border-primary-600' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex items-center space-x-2">
                          {note.isPinned && <Pin className="h-3 w-3 text-yellow-500" />}
                          {note.isPrivate && <Lock className="h-3 w-3 text-gray-400" />}
                          <span className="text-xs text-gray-500">
                            {note.createdBy?.name || 'Unknown'}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(note.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 line-clamp-2">
                        {note.content.substring(0, 100)}
                        {note.content.length > 100 ? '...' : ''}
                      </p>
                      {note.tags && note.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {note.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-1 rounded">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Create Button */}
            <div className="p-3 border-t border-gray-200">
              <button
                onClick={handleStartCreate}
                className="w-full btn btn-primary btn-sm flex items-center justify-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Note
              </button>
            </div>
          </div>

          {/* Note Detail / Editor */}
          <div className="flex-1 flex flex-col">
            {isCreating ? (
              <div className="flex-1 flex flex-col p-4 overflow-y-auto">
                <div className="space-y-4">
                  {/* Editor */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Note Content
                    </label>
                    <div className="relative">
                      <ReactQuill
                        ref={quillRef}
                        theme="snow"
                        value={noteHtmlContent}
                        onChange={handleEditorChange}
                        modules={quillModules}
                        placeholder="Type @ to mention someone..."
                        className="bg-white"
                      />
                      {showMentions && mentionUsers.length > 0 && (
                        <div className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto w-full">
                          {mentionUsers.map(user => (
                            <button
                              key={user._id}
                              onClick={() => handleInsertMention(user)}
                              className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-2"
                            >
                              <User className="h-4 w-4 text-gray-400" />
                              <span className="text-sm">{user.name || user.username}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tags
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {tags.map(tag => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2 py-1 rounded bg-primary-100 text-primary-700 text-sm"
                        >
                          #{tag}
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            className="ml-1 text-primary-500 hover:text-primary-700"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <input
                      type="text"
                      placeholder="Add tag (press Enter)"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleAddTag}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>

                  {/* Options */}
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={isPrivate}
                        onChange={(e) => setIsPrivate(e.target.checked)}
                        className="rounded border-gray-300 text-primary-600"
                      />
                      <span className="text-sm text-gray-700 flex items-center">
                        <Lock className="h-4 w-4 mr-1" />
                        Private
                      </span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={isPinned}
                        onChange={(e) => setIsPinned(e.target.checked)}
                        className="rounded border-gray-300 text-primary-600"
                      />
                      <span className="text-sm text-gray-700 flex items-center">
                        <Pin className="h-4 w-4 mr-1" />
                        Pin
                      </span>
                    </label>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end space-x-2 mt-4 pt-4 border-t">
                  <button
                    onClick={resetForm}
                    className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isCreatingNote || isUpdatingNote}
                    className="px-4 py-2 text-sm text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
                  >
                    {editingNoteId ? 'Update' : 'Create'} Note
                  </button>
                </div>
              </div>
            ) : selectedNoteId ? (
              <div className="flex-1 flex flex-col p-4 overflow-y-auto">
                {(() => {
                  const note = notes.find(n => n._id === selectedNoteId);
                  if (!note) return null;

                  return (
                    <>
                      {/* Note Header */}
                      <div className="flex items-start justify-between mb-4 pb-4 border-b">
                        <div>
                          <div className="flex items-center space-x-2 mb-2">
                            {note.isPinned && <Pin className="h-4 w-4 text-yellow-500" />}
                            {note.isPrivate && <Lock className="h-4 w-4 text-gray-400" />}
                            <span className="font-medium text-gray-900">
                              {note.createdBy?.name || 'Unknown'}
                            </span>
                            <span className="text-sm text-gray-500">
                              {new Date(note.createdAt).toLocaleString()}
                            </span>
                          </div>
                          {note.tags && note.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {note.tags.map(tag => (
                                <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEdit(note)}
                            className="p-2 text-gray-400 hover:text-gray-600"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(note._id)}
                            className="p-2 text-gray-400 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Note Content */}
                      <div 
                        className="prose max-w-none mb-4"
                        dangerouslySetInnerHTML={{ __html: note.htmlContent || note.content }}
                      />

                      {/* Mentions */}
                      {note.mentions && note.mentions.length > 0 && (
                        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm font-medium text-blue-900 mb-2">Mentioned:</p>
                          <div className="flex flex-wrap gap-2">
                            {note.mentions.map((mention, idx) => (
                              <span key={idx} className="text-sm text-blue-700">
                                @{mention.username}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* History */}
                      {showHistory && (
                        <div className="mt-4 pt-4 border-t">
                          <h4 className="font-medium text-gray-900 mb-3">History</h4>
                          {historyLoading ? (
                            <LoadingSpinner />
                          ) : historyData && historyData.length > 0 ? (
                            <div className="space-y-3">
                              {historyData.map((entry, idx) => (
                                <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium">
                                      {entry.editedBy?.name || 'Unknown'}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {new Date(entry.editedAt).toLocaleString()}
                                    </span>
                                  </div>
                                  {entry.changeReason && (
                                    <p className="text-xs text-gray-600 mb-2">{entry.changeReason}</p>
                                  )}
                                  <div 
                                    className="text-sm prose max-w-none"
                                    dangerouslySetInnerHTML={{ __html: entry.htmlContent || entry.content }}
                                  />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">No history available</p>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p>Select a note to view or create a new one</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotesPanel;
export { NotesPanel };

