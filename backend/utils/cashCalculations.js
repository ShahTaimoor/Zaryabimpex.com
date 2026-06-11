/** Movement types excluded from cash-in / cash-out totals. */
const EXCLUDED_FROM_TOTALS = new Set(['opening']);

const CASH_IN_TYPES = new Set([
  'cash_sale',
  'customer_payment',
  'cash_receipt',
]);

const CASH_OUT_TYPES = new Set([
  'expense',
  'cash_withdrawal',
  'supplier_payment',
  'refund',
]);

function calculateCashIn(movements = []) {
  return movements.reduce((sum, m) => {
    if (m.status && m.status !== 'active') return sum;
    const type = m.movement_type || m.movementType;
    if (EXCLUDED_FROM_TOTALS.has(type)) return sum;
    const amount = Number(m.amount) || 0;
    if (m.direction === 'in' || CASH_IN_TYPES.has(type)) {
      return sum + amount;
    }
    return sum;
  }, 0);
}

function calculateCashOut(movements = []) {
  return movements.reduce((sum, m) => {
    if (m.status && m.status !== 'active') return sum;
    const type = m.movement_type || m.movementType;
    if (EXCLUDED_FROM_TOTALS.has(type)) return sum;
    const amount = Number(m.amount) || 0;
    if (m.direction === 'out' || CASH_OUT_TYPES.has(type)) {
      return sum + amount;
    }
    return sum;
  }, 0);
}

function calculateExpectedCash(openingCash, cashIn, cashOut) {
  const opening = Number(openingCash) || 0;
  const totalIn = Number(cashIn) || 0;
  const totalOut = Number(cashOut) || 0;
  return Math.round((opening + totalIn - totalOut) * 100) / 100;
}

function calculateCashDifference(actualCash, expectedCash) {
  const actual = Number(actualCash) || 0;
  const expected = Number(expectedCash) || 0;
  const difference = Math.round((actual - expected) * 100) / 100;
  let varianceType = 'exact';
  if (difference > 0) varianceType = 'over';
  else if (difference < 0) varianceType = 'short';
  return { difference, varianceType, varianceAmount: Math.abs(difference) };
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

module.exports = {
  EXCLUDED_FROM_TOTALS,
  CASH_IN_TYPES,
  CASH_OUT_TYPES,
  calculateCashIn,
  calculateCashOut,
  calculateExpectedCash,
  calculateCashDifference,
  calculateTillDifference: calculateCashDifference,
  roundMoney,
};
