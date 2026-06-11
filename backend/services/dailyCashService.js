const DailyCashClosingRepository = require('../repositories/DailyCashClosingRepository');
const CashMovementRepository = require('../repositories/CashMovementRepository');
const {
  calculateCashIn,
  calculateCashOut,
  calculateExpectedCash,
  calculateCashDifference,
  roundMoney,
} = require('../utils/cashCalculations');
const { getCurrentDatePakistan, isValidDateString, formatDatePakistan } = require('../utils/dateFilter');
const { isDailyCashClosingEnabled } = require('../utils/dailyCashSettings');

function parseBusinessDateFromTransaction(dateValue) {
  if (!dateValue) return getCurrentDatePakistan();
  if (typeof dateValue === 'string' && isValidDateString(dateValue)) return dateValue;
  return formatDatePakistan(new Date(dateValue));
}

function isCashPaymentMethod(payment) {
  const method = String(
    payment?.paymentMethod || payment?.payment_method || 'cash'
  ).toLowerCase();
  return method === 'cash';
}

const MOVEMENT_TYPES = {
  CASH_SALE: 'cash_sale',
  CUSTOMER_PAYMENT: 'customer_payment',
  CASH_RECEIPT: 'cash_receipt',
  EXPENSE: 'expense',
  CASH_WITHDRAWAL: 'cash_withdrawal',
  SUPPLIER_PAYMENT: 'supplier_payment',
  REFUND: 'refund',
  ADJUSTMENT: 'adjustment',
};

class DailyCashService {
  resolveBusinessDate(date) {
    if (date && isValidDateString(date)) return date;
    return getCurrentDatePakistan();
  }

  async getDefaultOpeningCash() {
    const settingsService = require('./settingsService');
    const settings = await settingsService.getCompanySettings();
    return roundMoney(settings?.orderSettings?.defaultDailyOpeningCash ?? 0);
  }

  async resolveOpeningCash(businessDate, client = null) {
    const existing = await DailyCashClosingRepository.findByBusinessDate(businessDate, client);
    if (existing) return roundMoney(existing.opening_cash);

    const previous = await DailyCashClosingRepository.findLatestClosedBefore(businessDate, client);
    if (previous?.actual_cash != null) {
      return roundMoney(previous.actual_cash);
    }

    return await this.getDefaultOpeningCash();
  }

  async assertDayNotClosed(businessDate, client = null) {
    if (!(await isDailyCashClosingEnabled())) {
      return;
    }

    const closing = await DailyCashClosingRepository.findByBusinessDate(businessDate, client);
    if (closing?.status === 'closed') {
      const err = new Error(`Cash for ${businessDate} is already closed. Reopen is not allowed.`);
      err.code = 'DAY_ALREADY_CLOSED';
      err.statusCode = 400;
      throw err;
    }
  }

  buildBreakdown(movements = []) {
    const breakdown = {};
    for (const row of movements) {
      const type = row.movement_type;
      if (!breakdown[type]) breakdown[type] = { in: 0, out: 0, count: 0 };
      breakdown[type].count += 1;
      if (row.direction === 'in') breakdown[type].in += Number(row.amount) || 0;
      else breakdown[type].out += Number(row.amount) || 0;
    }
    return breakdown;
  }

  async buildDailySummary(businessDate, client = null) {
    const date = this.resolveBusinessDate(businessDate);
    const movements = await CashMovementRepository.findByBusinessDate(date, {}, client);
    const openingCash = await this.resolveOpeningCash(date, client);
    const cashIn = calculateCashIn(movements);
    const cashOut = calculateCashOut(movements);
    const expectedCash = calculateExpectedCash(openingCash, cashIn, cashOut);
    const closing = await DailyCashClosingRepository.findByBusinessDate(date, client);

    return {
      businessDate: date,
      openingCash,
      cashIn: roundMoney(cashIn),
      cashOut: roundMoney(cashOut),
      expectedCash,
      actualCash: closing?.actual_cash != null ? roundMoney(closing.actual_cash) : null,
      difference: closing?.difference != null ? roundMoney(closing.difference) : null,
      varianceType: closing?.variance_type || null,
      status: closing?.status || 'open',
      closedAt: closing?.closed_at || null,
      closedBy: closing?.closed_by || null,
      closedByName: closing?.closed_by_name || null,
      notes: closing?.notes || '',
      movementCount: movements.length,
      breakdown: this.buildBreakdown(movements),
      movements,
    };
  }

  async getTodaySummary(client = null) {
    return this.buildDailySummary(getCurrentDatePakistan(), client);
  }

  async recordMovement(userId, payload, client = null, options = {}) {
    if (!(await isDailyCashClosingEnabled())) {
      return null;
    }

    const businessDate = this.resolveBusinessDate(payload.businessDate);
    if (!options.allowClosedDay) {
      await this.assertDayNotClosed(businessDate, client);
    }

    const amount = roundMoney(payload.amount);
    if (amount <= 0) return null;

    return CashMovementRepository.create({
      businessDate,
      movementType: payload.movementType,
      direction: payload.direction,
      amount,
      referenceType: payload.referenceType || null,
      referenceId: payload.referenceId ? String(payload.referenceId) : null,
      referenceNumber: payload.referenceNumber || null,
      description: payload.description || '',
      createdBy: userId,
    }, client);
  }

  async recordCashSale(userId, { saleId, orderNumber, amount, businessDate }, client = null) {
    return this.recordMovement(userId, {
      businessDate,
      movementType: MOVEMENT_TYPES.CASH_SALE,
      direction: 'in',
      amount,
      referenceType: 'sale',
      referenceId: saleId,
      referenceNumber: orderNumber,
      description: `Cash sale ${orderNumber || saleId}`,
    }, client);
  }

  async recordSalePaymentDelta(userId, { saleId, orderNumber, delta, isIncrease, businessDate }, client = null) {
    const amount = Math.abs(Number(delta) || 0);
    if (amount <= 0) return null;
    return this.recordMovement(userId, {
      businessDate,
      movementType: isIncrease ? MOVEMENT_TYPES.CASH_SALE : MOVEMENT_TYPES.REFUND,
      direction: isIncrease ? 'in' : 'out',
      amount,
      referenceType: 'sale_payment',
      referenceId: `${saleId}:${Date.now()}`,
      referenceNumber: orderNumber,
      description: isIncrease
        ? `Additional cash received for ${orderNumber || saleId}`
        : `Cash payment reversal for ${orderNumber || saleId}`,
    }, client);
  }

  async recordCashReceipt(userId, receipt, client = null) {
    if (!isCashPaymentMethod(receipt)) return null;
    const movementType = receipt.customer_id || receipt.customerId
      ? MOVEMENT_TYPES.CUSTOMER_PAYMENT
      : MOVEMENT_TYPES.CASH_RECEIPT;
    const businessDate = parseBusinessDateFromTransaction(
      receipt.date || receipt.receipt_date || receipt.receiptDate
    );
    return this.recordMovement(userId, {
      businessDate,
      movementType,
      direction: 'in',
      amount: receipt.amount,
      referenceType: 'cash_receipt',
      referenceId: receipt.id,
      referenceNumber: receipt.receipt_number || receipt.receiptNumber,
      description: receipt.particular || 'Cash receipt',
    }, client);
  }

  async recordCashPayment(userId, payment, { isExpense = false, isRefund = false } = {}, client = null) {
    if (!isCashPaymentMethod(payment)) return null;
    let movementType = MOVEMENT_TYPES.SUPPLIER_PAYMENT;
    if (isExpense) movementType = MOVEMENT_TYPES.EXPENSE;
    else if (isRefund || payment.customer_id || payment.customerId) movementType = MOVEMENT_TYPES.REFUND;
    else if (payment.particular?.toLowerCase().includes('withdraw')) movementType = MOVEMENT_TYPES.CASH_WITHDRAWAL;

    const businessDate = parseBusinessDateFromTransaction(
      payment.date || payment.payment_date || payment.paymentDate
    );
    return this.recordMovement(userId, {
      businessDate,
      movementType,
      direction: 'out',
      amount: payment.amount,
      referenceType: 'cash_payment',
      referenceId: payment.id,
      referenceNumber: payment.payment_number || payment.paymentNumber,
      description: payment.particular || 'Cash payment',
    }, client);
  }

  async recordRefund(userId, { returnId, returnNumber, amount, businessDate }, client = null) {
    return this.recordMovement(userId, {
      businessDate,
      movementType: MOVEMENT_TYPES.REFUND,
      direction: 'out',
      amount,
      referenceType: 'sale_return',
      referenceId: returnId,
      referenceNumber: returnNumber,
      description: `Refund for return ${returnNumber || returnId}`,
    }, client);
  }

  async recordWithdrawal(userId, { amount, description, referenceId, businessDate }, client = null) {
    return this.recordMovement(userId, {
      businessDate,
      movementType: MOVEMENT_TYPES.CASH_WITHDRAWAL,
      direction: 'out',
      amount,
      referenceType: 'cash_withdrawal',
      referenceId: referenceId || `wd-${Date.now()}`,
      description: description || 'Cash withdrawal',
    }, client);
  }

  async recordAdjustment(userId, { amount, direction, description, businessDate, referenceId }, client = null) {
    const normalizedDirection = direction === 'out' ? 'out' : 'in';
    return this.recordMovement(userId, {
      businessDate,
      movementType: MOVEMENT_TYPES.ADJUSTMENT,
      direction: normalizedDirection,
      amount,
      referenceType: 'cash_adjustment',
      referenceId: referenceId || `adj-${Date.now()}`,
      description: description || 'Manual cash adjustment',
    }, client);
  }

  async setOpeningCash(businessDate, openingCash, userId, client = null) {
    const date = this.resolveBusinessDate(businessDate);
    await this.assertDayNotClosed(date, client);
    const amount = roundMoney(openingCash);
    if (amount < 0) throw new Error('Opening cash must be zero or greater');

    await DailyCashClosingRepository.upsertOpenDay({
      businessDate: date,
      openingCash: amount,
    }, client);

    return this.buildDailySummary(date, client);
  }

  async closeDay({ businessDate, actualCash, notes, openingCash }, userId, client = null) {
    const date = this.resolveBusinessDate(businessDate);
    const existing = await DailyCashClosingRepository.findByBusinessDate(date, client);
    if (existing?.status === 'closed') {
      const err = new Error(`Cash for ${date} has already been closed.`);
      err.code = 'DAY_ALREADY_CLOSED';
      err.statusCode = 400;
      throw err;
    }

    if (openingCash != null) {
      await this.setOpeningCash(date, openingCash, userId, client);
    }

    const summary = await this.buildDailySummary(date, client);
    const actual = roundMoney(actualCash);
    if (actual < 0) throw new Error('Actual cash counted must be zero or greater');

    const { difference, varianceType } = calculateCashDifference(actual, summary.expectedCash);

    let closingRow = existing;
    if (!closingRow) {
      closingRow = await DailyCashClosingRepository.upsertOpenDay({
        businessDate: date,
        openingCash: summary.openingCash,
      }, client);
    }

    const closed = await DailyCashClosingRepository.closeDay(closingRow.id, {
      cashIn: summary.cashIn,
      cashOut: summary.cashOut,
      expectedCash: summary.expectedCash,
      actualCash: actual,
      difference,
      varianceType,
      notes,
      closedBy: userId,
    }, client);

    if (!closed) {
      const err = new Error(`Failed to close cash for ${date}`);
      err.code = 'DAY_ALREADY_CLOSED';
      throw err;
    }

    return {
      ...summary,
      ...closed,
      actualCash: actual,
      difference,
      varianceType,
      status: 'closed',
    };
  }

  async cancelMovement(movementId, userId, reason, client = null) {
    const movement = await CashMovementRepository.findById(movementId, client);
    if (!movement) throw new Error('Cash movement not found');
    if (movement.status === 'cancelled') return movement;

    await this.assertDayNotClosed(movement.business_date, client);

    return CashMovementRepository.cancelById(movementId, {
      cancelledBy: userId,
      reason,
    }, client);
  }

  async getMovementReport(filters = {}) {
    return CashMovementRepository.findForReport(filters);
  }

  async getClosingReport(filters = {}) {
    return DailyCashClosingRepository.findForReport(filters);
  }

  async getDailySummaryReport({ fromDate, toDate }) {
    return DailyCashClosingRepository.findForReport({
      fromDate,
      toDate,
      limit: 500,
    });
  }

  async getVarianceReport({ fromDate, toDate, varianceType }) {
    return DailyCashClosingRepository.getVarianceReport(fromDate, toDate, varianceType);
  }

  async getUserActivityReport({ fromDate, toDate }) {
    return CashMovementRepository.getUserActivitySummary(fromDate, toDate);
  }

  async getDashboardStats({ fromDate, toDate } = {}) {
    const stats = await DailyCashClosingRepository.getDashboardStats({ fromDate, toDate });
    const today = await this.getTodaySummary();
    return {
      ...stats,
      today,
    };
  }
}

module.exports = new DailyCashService();
module.exports.MOVEMENT_TYPES = MOVEMENT_TYPES;
