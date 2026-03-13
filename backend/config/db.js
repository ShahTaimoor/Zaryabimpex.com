/**
 * MongoDB connection removed - app uses PostgreSQL only.
 * This file is kept so any code that require('./config/db') does not break.
 * connectDB is a no-op.
 */
const connectDB = async () => {
  return null;
};

module.exports = connectDB;
