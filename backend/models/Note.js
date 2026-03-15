const mongoose = require('mongoose');

// Note history schema for version tracking
const noteHistorySchema = new mongoose.Schema({
  content: {
    type: String,
    required: true
  },
  editedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  editedAt: {
    type: Date,
    default: Date.now
  },
  changeReason: {
    type: String,
    trim: true
  }
}, { _id: false });

// Mention schema
const mentionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  position: {
    type: Number, // Position in the content where @mention appears
    required: true
  }
}, { _id: false });

const noteSchema = new mongoose.Schema({
  // Entity reference (polymorphic)
  entityType: {
    type: String,
    required: true,
    enum: ['Customer', 'Product', 'SalesOrder', 'PurchaseOrder', 'Supplier', 'Sale', 'PurchaseInvoice', 'SalesInvoice'],
    index: true
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  
  // Note content
  content: {
    type: String,
    required: true,
    trim: true
  },
  
  // Rich text content (HTML)
  htmlContent: {
    type: String,
    default: ''
  },
  
  // Privacy settings
  isPrivate: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Author information
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Mentions
  mentions: [mentionSchema],
  
  // Tags for categorization
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  
  // Note history for version tracking
  history: [noteHistorySchema],
  
  // Pinned note (important notes)
  isPinned: {
    type: Boolean,
    default: false
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted'],
    default: 'active',
    index: true
  },
  
  // Attachments (future enhancement)
  attachments: [{
    filename: String,
    url: String,
    type: String,
    size: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound index for efficient queries
noteSchema.index({ entityType: 1, entityId: 1, status: 1 });
noteSchema.index({ createdBy: 1, isPrivate: 1 });
noteSchema.index({ tags: 1 });
noteSchema.index({ createdAt: -1 });

// Text search index
noteSchema.index({ content: 'text', htmlContent: 'text' });

// Virtual for author name
noteSchema.virtual('author', {
  ref: 'User',
  localField: 'createdBy',
  foreignField: '_id',
  justOne: true
});

// Method to add history entry
noteSchema.methods.addHistoryEntry = function(userId, changeReason) {
  this.history.push({
    content: this.content,
    htmlContent: this.htmlContent,
    editedBy: userId,
    editedAt: new Date(),
    changeReason: changeReason || 'Note updated'
  });
  
  // Keep only last 50 history entries
  if (this.history.length > 50) {
    this.history = this.history.slice(-50);
  }
};

// Method to extract mentions from content
noteSchema.methods.extractMentions = function(users) {
  const mentionRegex = /@(\w+)/g;
  const mentions = [];
  let match;
  
  while ((match = mentionRegex.exec(this.content)) !== null) {
    const username = match[1];
    const user = users.find(u => 
      u.username?.toLowerCase() === username.toLowerCase() ||
      u.name?.toLowerCase() === username.toLowerCase()
    );
    
    if (user) {
      mentions.push({
        userId: user._id,
        username: user.username || user.name,
        position: match.index
      });
    }
  }
  
  this.mentions = mentions;
  return mentions;
};

module.exports = mongoose.model('Note', noteSchema);

