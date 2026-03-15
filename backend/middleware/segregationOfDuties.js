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
          const documentId = req.params.id || req.body.id || req.body.documentId;
          const userIdStr = (user.id || user._id || '').toString();

          if (documentId) {
            let createdBy = null;
            if (req.path.includes('journal-vouchers')) {
              try {
                const JournalVoucherRepository = require('../repositories/JournalVoucherRepository');
                const doc = await JournalVoucherRepository.findById(documentId);
                createdBy = doc?.createdBy ?? doc?.created_by;
              } catch (_) {}
            }
            if (createdBy != null && (createdBy.toString?.() ?? String(createdBy)) === userIdStr) {
              return res.status(403).json({
                success: false,
                message: 'Segregation of duties violation: Cannot approve own work. Please have another authorized user approve this.',
                code: 'SOD_VIOLATION'
              });
            }
          }
          
          if (req.body.createdBy && (req.body.createdBy.toString?.() ?? String(req.body.createdBy)) === userIdStr) {
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

