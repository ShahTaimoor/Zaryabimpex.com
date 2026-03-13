const { Pool } = require('pg');
const logger = require('../utils/logger');

// Explicitly load .env here to ensure variables are available before poolConfig is defined
require('dotenv').config();

/**
 * PRODUCTION POSTGRESQL POOL CONFIGURATION
 * Optimized for Accounting Systems (Double-Entry Ledger)
 */
// pg SCRAM auth requires password to be a string (not undefined/number)
const safePassword = process.env.POSTGRES_PASSWORD != null
  ? String(process.env.POSTGRES_PASSWORD)
  : '';

const poolConfig = {
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: safePassword,
  
  // 1. Connection Limits
  // A safe limit for most PostgreSQL installations. 
  // 2000 was causing crashes; 20 is a robust starting point for Node.js.
  max: 20, 
  min: 2, // Keep at least 2 connections ready
  
  // 2. Timeouts
  connectionTimeoutMillis: 5000, // Wait 5s for a connection before failing
  idleTimeoutMillis: 60000,     // Close idle connections after 60s
  
  // 3. Keepalive (Fixes the 2-minute "Connection Terminated" error)
  // Sends small packets to keep the connection active through firewalls
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000, // Start keepalive after 10s of idleness
};

const pool = new Pool(poolConfig);

// --- ERROR HANDLING ---

/**
 * IMPORTANT: Removed process.exit(-1).
 * This event fires when an IDLE client in the pool has a network error.
 * The pool automatically removes the bad client. We just need to log it.
 */
pool.on('error', (err, client) => {
  logger.error('PostgreSQL: Unexpected error on idle client', {
    error: err.message,
    stack: err.stack
  });
});

pool.on('connect', (client) => {
  logger.debug('PostgreSQL: New client checked out from pool');
});

// --- HELPER WRAPPERS ---

/**
 * Enhanced Query Helper
 * Includes slow query detection for accounting performance monitoring.
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log slow queries (taking more than 1 second)
    if (duration > 1000) {
      logger.warn('Slow Query Detected', { text, duration, rows: res.rowCount });
    }
    
    return res;
  } catch (error) {
    logger.error('Query execution error', { text, error: error.message });
    throw error;
  }
};

/**
 * Transaction Helper
 * Ensures BEGIN/COMMIT/ROLLBACK are handled correctly.
 * Uses READ COMMITTED (default) to avoid "could not serialize access due to read/write
 * dependencies" errors when concurrent transactions touch the same rows (inventory, ledger).
 * Atomicity and durability are preserved; only isolation is relaxed so the return/sale
 * flow does not conflict with other concurrent operations.
 */
const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction failed - Rolled back', { 
      error: error.message,
      code: error.code // Useful for detecting serialization failures
    });
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Startup Connection Check
 */
const connectDB = async () => {
  try {
    const res = await query('SELECT NOW()');
    logger.info(`PostgreSQL Connected: ${poolConfig.host} (Pool Max: ${poolConfig.max})`);
    return pool;
  } catch (error) {
    logger.error(`PostgreSQL Initial Connection Failed: ${error.message}`);
    // Only exit on initial startup failure
    process.exit(1);
  }
};

module.exports = {
  pool,
  query,
  transaction,
  connectDB
};
