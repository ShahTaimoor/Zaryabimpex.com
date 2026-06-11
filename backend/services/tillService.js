/**
 * @deprecated Use dailyCashService. Kept as a thin delegate for legacy imports.
 */
const dailyCashService = require('./dailyCashService');

module.exports = {
  MOVEMENT_TYPES: dailyCashService.MOVEMENT_TYPES,

  getActiveShopTill: () => dailyCashService.getTodaySummary(),
  getOpenSessionForUser: () => dailyCashService.getTodaySummary(),
  buildSessionSummary: (session) => dailyCashService.buildDailySummary(session?.business_date || session?.businessDate),
  ensureDefaultShopTill: async () => dailyCashService.getTodaySummary(),
  openTill: async () => {
    throw Object.assign(new Error('Till open is no longer used. Use daily cash closing instead.'), { code: 'DEPRECATED_TILL' });
  },
  closeTill: async (data, userId) => dailyCashService.closeDay({
    actualCash: data.closingDeclaredAmount,
    notes: data.notesClose,
    openingCash: data.openingAmount,
  }, userId),
  recordMovementForUser: (userId, payload, client) => dailyCashService.recordMovement(userId, payload, client),
  recordCashSale: (userId, data, client) => dailyCashService.recordCashSale(userId, data, client),
  recordSalePaymentDelta: (userId, data, client) => dailyCashService.recordSalePaymentDelta(userId, data, client),
  recordCashReceipt: (userId, receipt, client) => dailyCashService.recordCashReceipt(userId, receipt, client),
  recordCashPayment: (userId, payment, opts, client) => dailyCashService.recordCashPayment(userId, payment, opts, client),
  recordRefund: (userId, data, client) => dailyCashService.recordRefund(userId, data, client),
  recordWithdrawal: (userId, data, client) => dailyCashService.recordWithdrawal(userId, data, client),
  getSessionsByUser: () => dailyCashService.getClosingReport({ limit: 50 }),
  getSessionById: () => null,
  listSessions: (filters) => dailyCashService.getClosingReport(filters),
  getMovementReport: (filters) => dailyCashService.getMovementReport(filters),
  getDailySummary: (range) => dailyCashService.getDailySummaryReport(range),
  getCashierSummary: (range) => dailyCashService.getUserActivityReport(range),
  getVarianceReport: (range) => dailyCashService.getVarianceReport(range),
  getDashboardStats: (range) => dailyCashService.getDashboardStats(range),
};
