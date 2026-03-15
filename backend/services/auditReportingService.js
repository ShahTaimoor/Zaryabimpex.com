const FinancialStatementExport = require('../models/FinancialStatementExport');
const JournalVoucher = require('../models/JournalVoucher');
const ChartOfAccounts = require('../models/ChartOfAccounts');
const AccountingPeriod = require('../models/AccountingPeriod');
const trialBalanceService = require('./trialBalanceService');

/**
 * Audit & Reporting Service
 * Provides dashboards and reports for audit compliance
 */
class AuditReportingService {
  /**
   * Get pending approvals dashboard
   * @returns {Promise<Object>} Pending approvals summary
   */
  async getPendingApprovals() {
    try {
      const pendingVouchers = await JournalVoucher.find({
        'approvalWorkflow.status': 'pending',
        status: { $in: ['pending_approval', 'draft'] }
      })
        .populate('createdBy', 'firstName lastName email')
        .populate('approvalWorkflow.approvers.user', 'firstName lastName email role')
        .sort({ createdAt: -1 });

      // Group by approver
      const byApprover = {};
      const overdue = [];
      const now = new Date();

      pendingVouchers.forEach(voucher => {
        if (voucher.approvalWorkflow.approvers && voucher.approvalWorkflow.approvers.length > 0) {
          const currentApprover = voucher.approvalWorkflow.approvers[voucher.approvalWorkflow.currentApproverIndex];
          if (currentApprover && currentApprover.user) {
            const approverId = currentApprover.user._id.toString();
            if (!byApprover[approverId]) {
              byApprover[approverId] = {
                approver: currentApprover.user,
                vouchers: []
              };
            }
            byApprover[approverId].vouchers.push(voucher);

            // Check if overdue (more than 3 days)
            const daysPending = Math.floor((now - voucher.createdAt) / (1000 * 60 * 60 * 24));
            if (daysPending > 3) {
              overdue.push({
                voucher,
                daysPending,
                approver: currentApprover.user
              });
            }
          }
        }
      });

      return {
        totalPending: pendingVouchers.length,
        byApprover: Object.values(byApprover),
        overdue: overdue,
        overdueCount: overdue.length,
        summary: {
          totalAmount: pendingVouchers.reduce((sum, v) => sum + (v.totalDebit || 0), 0),
          averageAmount: pendingVouchers.length > 0 
            ? pendingVouchers.reduce((sum, v) => sum + (v.totalDebit || 0), 0) / pendingVouchers.length 
            : 0,
          oldestPending: pendingVouchers.length > 0 
            ? Math.floor((now - pendingVouchers[pendingVouchers.length - 1].createdAt) / (1000 * 60 * 60 * 24))
            : 0
        }
      };
    } catch (error) {
      console.error('Error getting pending approvals:', error);
      throw error;
    }
  }

  /**
   * Get reconciliation discrepancies
   * @returns {Promise<Object>} Reconciliation discrepancies summary
   */
  async getReconciliationDiscrepancies() {
    try {
      const accounts = await ChartOfAccounts.find({
        'reconciliationStatus.status': 'discrepancy'
      })
        .populate('reconciliationStatus.reconciledBy', 'firstName lastName email')
        .populate('reconciliationStatus.lockedBy', 'firstName lastName email');

      const inProgress = await ChartOfAccounts.find({
        'reconciliationStatus.status': 'in_progress',
        'reconciliationStatus.lockedBy': { $exists: true },
        'reconciliationStatus.lockExpiresAt': { $gt: new Date() }
      })
        .populate('reconciliationStatus.lockedBy', 'firstName lastName email');

      const overdue = [];
      const now = new Date();

      inProgress.forEach(account => {
        if (account.reconciliationStatus.lockedAt) {
          const hoursLocked = (now - account.reconciliationStatus.lockedAt) / (1000 * 60 * 60);
          if (hoursLocked > 2) { // More than 2 hours
            overdue.push({
              account,
              hoursLocked: Math.floor(hoursLocked)
            });
          }
        }
      });

      return {
        discrepancies: accounts.map(acc => ({
          accountCode: acc.accountCode,
          accountName: acc.accountName,
          discrepancyAmount: acc.reconciliationStatus.discrepancyAmount,
          discrepancyReason: acc.reconciliationStatus.discrepancyReason,
          reconciledBy: acc.reconciliationStatus.reconciledBy,
          reconciledAt: acc.reconciliationStatus.reconciledAt
        })),
        inProgress: inProgress.map(acc => ({
          accountCode: acc.accountCode,
          accountName: acc.accountName,
          lockedBy: acc.reconciliationStatus.lockedBy,
          lockedAt: acc.reconciliationStatus.lockedAt,
          lockExpiresAt: acc.reconciliationStatus.lockExpiresAt
        })),
        overdue: overdue,
        summary: {
          totalDiscrepancies: accounts.length,
          totalInProgress: inProgress.length,
          totalOverdue: overdue.length,
          totalDiscrepancyAmount: accounts.reduce((sum, acc) => 
            sum + (acc.reconciliationStatus.discrepancyAmount || 0), 0
          )
        }
      };
    } catch (error) {
      console.error('Error getting reconciliation discrepancies:', error);
      throw error;
    }
  }

  /**
   * Get failed trial balance validations
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Failed validations
   */
  async getFailedTrialBalanceValidations(startDate, endDate) {
    try {
      // Get periods that failed to close due to trial balance
      const periods = await AccountingPeriod.find({
        status: { $in: ['open', 'closing'] },
        periodEnd: { $gte: startDate, $lte: endDate }
      })
        .populate('createdBy', 'firstName lastName email');

      const failed = [];

      for (const period of periods) {
        try {
          const trialBalance = await trialBalanceService.generateTrialBalance(period.periodEnd, period._id);
          if (!trialBalance.isBalanced) {
            failed.push({
              period,
              trialBalance: {
                totalDebits: trialBalance.totals.totalDebits,
                totalCredits: trialBalance.totals.totalCredits,
                difference: trialBalance.totals.difference,
                message: trialBalance.validation.message
              }
            });
          }
        } catch (error) {
          // If validation throws error, it's likely unbalanced
          failed.push({
            period,
            error: error.message
          });
        }
      }

      return {
        failed: failed,
        count: failed.length,
        summary: {
          totalPeriods: periods.length,
          failedCount: failed.length,
          successCount: periods.length - failed.length
        }
      };
    } catch (error) {
      console.error('Error getting failed trial balance validations:', error);
      throw error;
    }
  }

  /**
   * Get export audit report
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Export audit report
   */
  async getExportAuditReport(startDate, endDate) {
    try {
      const exports = await FinancialStatementExport.find({
        exportedAt: { $gte: startDate, $lte: endDate }
      })
        .populate('exportedBy', 'firstName lastName email')
        .populate('statementId', 'statementId type period')
        .sort({ exportedAt: -1 });

      // Group by user
      const byUser = {};
      const byFormat = {};
      const byStatementType = {};

      exports.forEach(exp => {
        // By user
        const userId = exp.exportedBy._id.toString();
        if (!byUser[userId]) {
          byUser[userId] = {
            user: exp.exportedBy,
            count: 0,
            totalSize: 0,
            formats: {}
          };
        }
        byUser[userId].count++;
        byUser[userId].totalSize += exp.fileSize || 0;
        byUser[userId].formats[exp.format] = (byUser[userId].formats[exp.format] || 0) + 1;

        // By format
        byFormat[exp.format] = (byFormat[exp.format] || 0) + 1;

        // By statement type
        byStatementType[exp.statementType] = (byStatementType[exp.statementType] || 0) + 1;
      });

      return {
        exports: exports,
        summary: {
          totalExports: exports.length,
          totalSize: exports.reduce((sum, exp) => sum + (exp.fileSize || 0), 0),
          byUser: Object.values(byUser),
          byFormat: byFormat,
          byStatementType: byStatementType,
          dateRange: {
            startDate,
            endDate
          }
        }
      };
    } catch (error) {
      console.error('Error getting export audit report:', error);
      throw error;
    }
  }

  /**
   * Get audit dashboard summary
   * @returns {Promise<Object>} Complete audit dashboard
   */
  async getAuditDashboard() {
    try {
      const [pendingApprovals, reconciliationDiscrepancies, exportSummary] = await Promise.all([
        this.getPendingApprovals(),
        this.getReconciliationDiscrepancies(),
        this.getExportAuditReport(
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          new Date()
        )
      ]);

      return {
        pendingApprovals: {
          total: pendingApprovals.totalPending,
          overdue: pendingApprovals.overdueCount,
          byApprover: pendingApprovals.byApprover.length
        },
        reconciliation: {
          discrepancies: reconciliationDiscrepancies.summary.totalDiscrepancies,
          inProgress: reconciliationDiscrepancies.summary.totalInProgress,
          overdue: reconciliationDiscrepancies.summary.totalOverdue
        },
        exports: {
          last30Days: exportSummary.summary.totalExports,
          totalSize: exportSummary.summary.totalSize
        },
        alerts: [
          ...(pendingApprovals.overdueCount > 0 ? [{
            type: 'warning',
            message: `${pendingApprovals.overdueCount} journal vouchers pending approval for more than 3 days`,
            count: pendingApprovals.overdueCount
          }] : []),
          ...(reconciliationDiscrepancies.summary.totalDiscrepancies > 0 ? [{
            type: 'error',
            message: `${reconciliationDiscrepancies.summary.totalDiscrepancies} accounts have reconciliation discrepancies`,
            count: reconciliationDiscrepancies.summary.totalDiscrepancies
          }] : []),
          ...(reconciliationDiscrepancies.summary.totalOverdue > 0 ? [{
            type: 'warning',
            message: `${reconciliationDiscrepancies.summary.totalOverdue} accounts locked for reconciliation for more than 2 hours`,
            count: reconciliationDiscrepancies.summary.totalOverdue
          }] : [])
        ]
      };
    } catch (error) {
      console.error('Error getting audit dashboard:', error);
      throw error;
    }
  }
}

module.exports = new AuditReportingService();

