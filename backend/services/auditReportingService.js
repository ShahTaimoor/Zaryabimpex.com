const ChartOfAccountsRepository = require('../repositories/ChartOfAccountsRepository');
const UserRepository = require('../repositories/UserRepository');
const JournalVoucherRepository = require('../repositories/JournalVoucherRepository');
const AccountingPeriodRepository = require('../repositories/AccountingPeriodRepository');
const FinancialStatementExportRepository = require('../repositories/FinancialStatementExportRepository');

/**
 * Audit & Reporting Service (Postgres)
 * Uses ChartOfAccountsRepository, JournalVoucherRepository, AccountingPeriodRepository,
 * FinancialStatementExportRepository. trialBalanceService not in Postgres – failed validations stay empty.
 */
class AuditReportingService {
  /**
   * Get pending approvals dashboard (JournalVoucherRepository)
   */
  async getPendingApprovals() {
    const pendingVouchers = await JournalVoucherRepository.findAll(
      { statusIn: ['pending_approval', 'draft'] },
      { limit: 200 }
    );
    const now = new Date();
    const overdue = pendingVouchers
      .filter(v => v.createdAt && (now - new Date(v.createdAt)) / (1000 * 60 * 60 * 24) > 3)
      .map(v => ({ voucher: v, daysPending: Math.floor((now - new Date(v.createdAt)) / (1000 * 60 * 60 * 24)), approver: null }));
    const totalAmount = pendingVouchers.reduce((sum, v) => sum + (v.totalDebit || 0), 0);
    return {
      totalPending: pendingVouchers.length,
      byApprover: pendingVouchers.length ? [{ approver: null, vouchers: pendingVouchers }] : [],
      overdue,
      overdueCount: overdue.length,
      summary: {
        totalAmount,
        averageAmount: pendingVouchers.length ? totalAmount / pendingVouchers.length : 0,
        oldestPending: overdue.length ? Math.max(...overdue.map(o => o.daysPending)) : 0
      }
    };
  }

  /**
   * Get reconciliation discrepancies (ChartOfAccountsRepository)
   */
  async getReconciliationDiscrepancies() {
    const discrepancyAccounts = await ChartOfAccountsRepository.findAll({
      reconciliationStatus: 'discrepancy'
    });
    const inProgressAccounts = await ChartOfAccountsRepository.findAll({
      reconciliationStatus: 'in_progress'
    });

    const overdue = [];
    const now = new Date();
    for (const acc of inProgressAccounts) {
      const lockedAt = acc.reconciliationStatus?.lockedAt || acc.lastReconciliationDate;
      if (lockedAt) {
        const locked = lockedAt instanceof Date ? lockedAt : new Date(lockedAt);
        const hoursLocked = (now - locked) / (1000 * 60 * 60);
        if (hoursLocked > 2) {
          overdue.push({
            account: acc,
            hoursLocked: Math.floor(hoursLocked)
          });
        }
      }
    }

    const withUser = async (row) => {
      const reconciledBy = row.reconciledBy || row.reconciled_by;
      if (!reconciledBy) return null;
      return UserRepository.findById(reconciledBy);
    };

    const discrepancies = await Promise.all(
      discrepancyAccounts.map(async (acc) => ({
        accountCode: acc.accountCode,
        accountName: acc.accountName,
        discrepancyAmount: acc.reconciliationStatus?.discrepancyAmount ?? 0,
        discrepancyReason: acc.reconciliationStatus?.discrepancyReason ?? null,
        reconciledBy: await withUser(acc),
        reconciledAt: acc.reconciledAt || acc.reconciled_at
      }))
    );

    const inProgress = await Promise.all(
      inProgressAccounts.map(async (acc) => ({
        accountCode: acc.accountCode,
        accountName: acc.accountName,
        lockedBy: acc.reconciliationStatus?.lockedBy ? await UserRepository.findById(acc.reconciliationStatus.lockedBy) : null,
        lockedAt: acc.reconciliationStatus?.lockedAt ?? null,
        lockExpiresAt: acc.reconciliationStatus?.lockExpiresAt ?? null
      }))
    );

    return {
      discrepancies,
      inProgress,
      overdue,
      summary: {
        totalDiscrepancies: discrepancyAccounts.length,
        totalInProgress: inProgressAccounts.length,
        totalOverdue: overdue.length,
        totalDiscrepancyAmount: discrepancyAccounts.reduce(
          (sum, acc) => sum + (acc.reconciliationStatus?.discrepancyAmount || 0),
          0
        )
      }
    };
  }

  /**
   * Get failed trial balance validations (AccountingPeriodRepository; trialBalanceService not in Postgres – no balance check)
   */
  async getFailedTrialBalanceValidations(startDate, endDate) {
    const periods = await AccountingPeriodRepository.findAll(
      { statusIn: ['open', 'closing'], periodEndGte: startDate, periodEndLte: endDate },
      { limit: 100 }
    );
    return {
      failed: [],
      count: 0,
      summary: {
        totalPeriods: periods.length,
        failedCount: 0,
        successCount: periods.length
      }
    };
  }

  /**
   * Get export audit report (FinancialStatementExportRepository)
   */
  async getExportAuditReport(startDate, endDate) {
    const exports = await FinancialStatementExportRepository.findAll(
      { exportedAtGte: startDate, exportedAtLte: endDate },
      { limit: 500 }
    );
    const byUser = {};
    const byFormat = {};
    const byStatementType = {};
    for (const exp of exports) {
      const uid = (exp.exportedBy || exp.exported_by)?.toString?.() ?? exp.exportedBy;
      if (!byUser[uid]) byUser[uid] = { user: exp.exportedBy, count: 0, totalSize: 0, formats: {} };
      byUser[uid].count++;
      byUser[uid].totalSize += exp.fileSize || 0;
      byUser[uid].formats[exp.format] = (byUser[uid].formats[exp.format] || 0) + 1;
      byFormat[exp.format] = (byFormat[exp.format] || 0) + 1;
      byStatementType[exp.statementType || exp.statement_type] = (byStatementType[exp.statementType || exp.statement_type] || 0) + 1;
    }
    return {
      exports,
      summary: {
        totalExports: exports.length,
        totalSize: exports.reduce((sum, e) => sum + (e.fileSize || 0), 0),
        byUser: Object.values(byUser),
        byFormat,
        byStatementType,
        dateRange: { startDate, endDate }
      }
    };
  }

  /**
   * Get audit dashboard summary
   */
  async getAuditDashboard() {
    const [pendingApprovals, reconciliationDiscrepancies, exportSummary] = await Promise.all([
      this.getPendingApprovals(),
      this.getReconciliationDiscrepancies(),
      this.getExportAuditReport(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
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
  }
}

module.exports = new AuditReportingService();
