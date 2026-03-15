const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const { connectDB: connectPostgres } = require('./config/postgres');
const logger = require('./utils/logger');
const { v4: uuidv4 } = require('uuid');

// Load environment variables
require('dotenv').config();

// Global error handlers - prevents app crash on unhandled async errors
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', {
    promise,
    reason: reason instanceof Error ? {
      message: reason.message,
      stack: reason.stack,
      code: reason.code
    } : reason
  });
  // In production, you might want to restart the process gracefully
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', {
    message: error.message,
    stack: error.stack,
    code: error.code
  });
  // CRITICAL: Always exit on uncaughtException to avoid undefined state
  process.exit(1);
});



const app = express();

// Security middleware
app.use(helmet());

// Compression middleware (compress responses)
app.use(compression());

// Request ID middleware (add unique ID to each request for tracking)
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Request logging middleware (should be early in the middleware chain)
const requestLogger = require('./middleware/requestLogger');
app.use(requestLogger);

// Global rate limiting - protect all API endpoints
const { createRateLimiter } = require('./middleware/rateLimit');
// General API rate limiter: 100 requests per minute per IP
app.use('/api', createRateLimiter({
  windowMs: 60000, // 1 minute
  max: 100 // 100 requests per minute
}));
// Auth endpoints: allow normal use (user list, profile, update). Login brute-force still limited by global /api limit.
app.use('/api/auth', createRateLimiter({
  windowMs: 60000, // 1 minute
  max: 120 // 120 per minute so loading/updating users and profile don't hit 429
}));


// CORS configuration - include env origins plus local dev defaults
const defaultOrigins = [
  'https://sa.wiserconsulting.info',
  'http://localhost:3000', // Allow local development
  'http://localhost:5173', // Allow Vite dev server
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  process.env.FRONTEND_URL // Allow from environment variable if set
].filter(Boolean);

const envOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
  : [];

const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));
// CORS configuration - use environment variable for allowed origins

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key', 'Idempotency-Key', 'idempotency-key'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
// Cookie parsing middleware (for HTTP-only cookies)
app.use(cookieParser());

// Idempotency key middleware - prevents duplicate requests
// Note: This middleware uses in-memory storage - consider Redis for production scaling
const { preventDuplicates } = require('./middleware/duplicatePrevention');
app.use(preventDuplicates({
  windowMs: 60000, // 60 second window for idempotency
  requireIdempotencyKey: false // Auto-generate if not provided, but allow explicit keys
}));

// Database check uses PostgreSQL only (MongoDB removed)

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'POS Backend Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 5000
  });
});

// Connect to PostgreSQL (primary database; MongoDB removed)
(async () => {
  try {
    await connectPostgres();
    logger.info('PostgreSQL connected');
  } catch (err) {
    logger.error('PostgreSQL connection failed:', err);
    process.exit(1);
  }
})();

// Serve static files for exports (if needed)
const path = require('path');
app.use('/exports', express.static(path.join(__dirname, 'exports')));

// Serve optimized images
app.use('/api/images', express.static(path.join(__dirname, 'uploads/images/optimized')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/auth/users', require('./routes/users'));


app.use('/api/products', require('./routes/products'));
app.use('/api/product-variants', require('./routes/productVariants'));
app.use('/api/product-transformations', require('./routes/productTransformations'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/customer-transactions', require('./routes/customerTransactions'));
app.use('/api/customer-merges', require('./routes/customerMerges'));
app.use('/api/reconciliation', require('./routes/reconciliation'));
// accounting-periods route removed (file no longer exists)
app.use('/api/disputes', require('./routes/disputes'));
app.use('/api/customer-analytics', require('./routes/customerAnalytics'));
app.use('/api/anomaly-detection', require('./routes/anomalyDetection'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/cities', require('./routes/cities'));
app.use('/api/purchase-orders', require('./routes/purchaseOrders'));
app.use('/api/inventory-alerts', require('./routes/inventoryAlerts'));
app.use('/api/purchase-invoices', require('./routes/purchaseInvoices'));
app.use('/api/purchase-returns', require('./routes/purchaseReturns'));
app.use('/api/sale-returns', require('./routes/saleReturns'));
app.use('/api/sales-orders', require('./routes/salesOrders'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/migration', require('./routes/migration'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/recommendations', require('./routes/recommendations'));
app.use('/api/backups', require('./routes/backups'));
app.use('/api/pl-statements', require('./routes/plStatements')); // New P&L statements routes
app.use('/api/reports', require('./routes/reports'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/returns', require('./routes/returns')); // Legacy route - kept for backward compatibility
app.use('/api/recurring-expenses', require('./routes/recurringExpenses'));
app.use('/api/balance-sheets', require('./routes/balanceSheets'));
app.use('/api/chart-of-accounts', require('./routes/chartOfAccounts'));
app.use('/api/account-ledger', require('./routes/accountLedger'));
app.use('/api/journal-vouchers', require('./routes/journalVouchers'));
app.use('/api/discounts', require('./routes/discounts'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/sales-performance', require('./routes/salesPerformance'));
app.use('/api/inventory-reports', require('./routes/inventoryReports'));
app.use('/api/cash-receipts', require('./routes/cashReceipts'));
app.use('/api/cash-payments', require('./routes/cashPayments'));
app.use('/api/bank-receipts', require('./routes/bankReceipts'));
app.use('/api/bank-payments', require('./routes/bankPayments'));
app.use('/api/banks', require('./routes/banks'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/company', require('./routes/company'));
app.use('/api/images', require('./routes/images'));
app.use('/api/backdate-report', require('./routes/backdateReport'));
app.use('/api/stock-movements', require('./routes/stockMovements'));
app.use('/api/stock-ledger', require('./routes/stockLedger'));
app.use('/api/warehouses', require('./routes/warehouses'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/tills', require('./routes/tills'));
app.use('/api/investors', require('./routes/investors'));
app.use('/api/drop-shipping', require('./routes/dropShipping'));
app.use('/api/customer-balances', require('./routes/customerBalances'));
app.use('/api/supplier-balances', require('./routes/supplierBalances'));
app.use('/api/pl-statements', require('./routes/plStatements'));

// Health check endpoint (API version) - PostgreSQL only
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: 'PostgreSQL',
    uptime: process.uptime()
  });
});

// Security middleware for financial operations
const securityMiddleware = require('./middleware/securityMiddleware');
app.use(securityMiddleware.sanitizeInput.bind(securityMiddleware));
app.use(securityMiddleware.auditFinancialOperation());

// Performance monitoring middleware
const performanceMonitoringService = require('./services/performanceMonitoringService');
app.use(performanceMonitoringService.trackAPIMetrics());

// Global error handling middleware (must be after all routes)
const { errorHandler } = require('./middleware/errorHandler');
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Export for Vercel serverless functions
module.exports = app;

// Only start server and scheduler in non-serverless environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => {
    logger.info(`POS Server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);

    // Initialize scheduled jobs
    try {
      // Data integrity validation (daily at 2 AM)
      const dataIntegrityService = require('./services/dataIntegrityService');
      const cron = require('node-cron');
      cron.schedule('0 2 * * *', async () => {
        try {
          logger.info('Running scheduled data integrity validation...');
          const results = await dataIntegrityService.runAllValidations();
          if (results.hasIssues) {
            logger.warn(`Data integrity issues detected: ${results.totalIssues} total issues`);
          } else {
            logger.info('Data integrity validation passed');
          }
        } catch (error) {
          logger.error('Error in scheduled data integrity validation:', error);
        }
      });

      // Financial validation (hourly) - stub, original removed with MongoDB migration
      const financialValidationService = require('./services/financialValidationService');
      financialValidationService.scheduleValidation();
      logger.info('Financial validation scheduler started');

      // Backup verification (daily at 3 AM)
      const backupVerificationService = require('./services/backupVerificationService');
      backupVerificationService.scheduleVerification();
      logger.info('Backup verification scheduler started');

      // Performance monitoring
      const perfMonitoringService = require('./services/performanceMonitoringService');
      perfMonitoringService.scheduleMonitoring();
      logger.info('Performance monitoring scheduler started');

      // Reconciliation jobs (if exists)
      try {
        const reconciliationJobs = require('./jobs/reconciliationJobs');
        if (reconciliationJobs && typeof reconciliationJobs.start === 'function') {
          reconciliationJobs.start();
          logger.info('Reconciliation jobs started');
        }
      } catch (error) {
        logger.warn('Reconciliation jobs not available:', error.message);
      }

      // Maintenance jobs (if exists)
      try {
        const maintenanceJobs = require('./jobs/maintenanceJobs');
        if (maintenanceJobs && typeof maintenanceJobs.start === 'function') {
          maintenanceJobs.start();
          logger.info('Maintenance jobs started');
        }
      } catch (error) {
        logger.warn('Maintenance jobs not available:', error.message);
      }
    } catch (error) {
      logger.error('Error initializing scheduled jobs:', error);
    }
  });

  // Handle port already in use error
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`ERROR: Port ${PORT} is already in use!`);
      logger.error('Solutions:');
      logger.error(`  1. Kill the process using port ${PORT}:`);
      logger.error(`     Windows: netstat -ano | findstr :${PORT}`);
      logger.error(`     Then: taskkill /PID <PID> /F`);
      logger.error(`  2. Or use a different port:`);
      logger.error(`     PORT=5001 npm start`);
      logger.info(`Finding process on port ${PORT}...`);

      // Try to find and suggest killing the process
      const { exec } = require('child_process');
      exec(`netstat -ano | findstr :${PORT}`, (err, stdout) => {
        if (!err && stdout) {
          const lines = stdout.split('\n');
          const listeningLine = lines.find(line => line.includes('LISTENING'));
          if (listeningLine) {
            const pid = listeningLine.trim().split(/\s+/).pop();
            if (pid && pid !== '0') {
              logger.error(`Found process PID: ${pid}`);
              logger.error(`Kill it with: taskkill /PID ${pid} /F`);
            }
          }
        }
      });

      process.exit(1);
    } else {
      logger.error('Server error:', error);
      process.exit(1);
    }
  });

  // Start backup scheduler (only in non-serverless environments)
  const backupScheduler = require('./services/backupScheduler');
  backupScheduler.start();

  // Start reconciliation jobs
  const { startReconciliationJobs } = require('./jobs/reconciliationJobs');
  startReconciliationJobs();

  // Ledger automation jobs removed (file no longer exists - using PostgreSQL)
  // Balance rebuild jobs removed (file no longer exists - using PostgreSQL)

  // Initialize production critical features scheduled jobs
  try {
    // Data integrity validation (daily at 2 AM)
    const dataIntegrityService = require('./services/dataIntegrityService');
    const cron = require('node-cron');
    cron.schedule('0 2 * * *', async () => {
      try {
        logger.info('Running scheduled data integrity validation...');
        const results = await dataIntegrityService.runAllValidations();
        if (results.hasIssues) {
          logger.warn(`Data integrity issues detected: ${results.totalIssues} total issues`);
        } else {
          logger.info('Data integrity validation passed');
        }
      } catch (error) {
        logger.error('Error in scheduled data integrity validation:', error);
      }
    });

    // Financial validation (hourly) - stub, original removed with MongoDB migration
    const financialValidationService = require('./services/financialValidationService');
    financialValidationService.scheduleValidation();
    logger.info('Financial validation scheduler started');

    // Backup verification (daily at 3 AM)
    const backupVerificationService = require('./services/backupVerificationService');
    backupVerificationService.scheduleVerification();
    logger.info('Backup verification scheduler started');

    // Performance monitoring
    const performanceMonitoringService = require('./services/performanceMonitoringService');
    performanceMonitoringService.scheduleMonitoring();
    logger.info('Performance monitoring scheduler started');
  } catch (error) {
    logger.error('Error initializing production critical features:', error);
  }
}
