/**
 * Utility to add soft delete fields to models
 * This can be used as a Mongoose plugin or applied manually
 */

const softDeleteFields = {
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: {
    type: Date,
    default: null
  }
};

/**
 * Mongoose plugin to add soft delete fields
 */
function softDeletePlugin(schema) {
  schema.add(softDeleteFields);
}

module.exports = {
  softDeleteFields,
  softDeletePlugin
};

