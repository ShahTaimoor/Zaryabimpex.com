/**
 * Segregation of Duties Middleware
 * CRITICAL: Prevents single user from completing entire transaction cycle
 * Required for SOX Section 404 compliance
 */

/**
 * Check if user is trying to approve their own work
 * @param {String} operation - The operation being performed
 * @param {String} approvalOperation - The approval operation
 * @returns {Function} Express middleware
 */
const checkSegregationOfDuties = (operation, approvalOperation) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }
      
      // Check if user has both create and approve permissions
      const hasCreatePermission = user.permissions && user.permissions.includes(operation);
      const hasApprovePermission = user.permissions && user.permissions.includes(approvalOperation);
      
      // If user has both permissions, check if they're trying to approve their own work
      if (hasCreatePermission && hasApprovePermission) {
        // Check if this is an approval request
        const isApprovalRequest = req.method === 'POST' && 
          (req.path.includes('/approve') || req.body.action === 'approve');
        
        if (isApprovalRequest) {
          // Get the document being approved
          const documentId = req.params.id || req.body.id || req.body.documentId;
          
          if (documentId) {
            // Determine model based on route
            let Model;
            if (req.path.includes('journal-vouchers')) {
              Model = require('../models/JournalVoucher');
            } else if (req.path.includes('balance-sheets')) {
              Model = require('../models/BalanceSheet');
            } else if (req.path.includes('pl-statements')) {
              Model = require('../models/FinancialStatement');
            }
            
            if (Model) {
              const document = await Model.findById(documentId);
              
              if (document) {
                // Check if user created this document
                const createdBy = document.createdBy || document.generatedBy;
                
                if (createdBy && createdBy.toString() === user._id.toString()) {
                  return res.status(403).json({
                    success: false,
                    message: 'Segregation of duties violation: Cannot approve own work. Please have another authorized user approve this.',
                    code: 'SOD_VIOLATION'
                  });
                }
              }
            }
          }
          
          // Also check request body for createdBy
          if (req.body.createdBy && req.body.createdBy.toString() === user._id.toString()) {
            return res.status(403).json({
              success: false,
              message: 'Segregation of duties violation: Cannot approve own work',
              code: 'SOD_VIOLATION'
            });
          }
        }
      }
      
      next();
    } catch (error) {
      console.error('Segregation of duties check error:', error);
      // Don't block on error, but log it
      next();
    }
  };
};

/**
 * Check if user can perform conflicting operations
 * @param {Array} conflictingOperations - Array of operation pairs that conflict
 * @returns {Function} Express middleware
 */
const checkConflictingOperations = (conflictingOperations) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user || !user.permissions) {
        return next();
      }
      
      // Check if user has conflicting permissions
      for (const [op1, op2] of conflictingOperations) {
        if (user.permissions.includes(op1) && user.permissions.includes(op2)) {
          // Check if user is trying to perform both operations
          const isOp1 = req.path.includes(op1) || req.body.operation === op1;
          const isOp2 = req.path.includes(op2) || req.body.operation === op2;
          
          if (isOp1 && isOp2) {
            return res.status(403).json({
              success: false,
              message: `Segregation of duties violation: Cannot perform both ${op1} and ${op2} operations`,
              code: 'SOD_CONFLICT'
            });
          }
        }
      }
      
      next();
    } catch (error) {
      console.error('Conflicting operations check error:', error);
      next();
    }
  };
};

module.exports = {
  checkSegregationOfDuties,
  checkConflictingOperations
};

