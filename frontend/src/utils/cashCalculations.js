export function calculateCashIn(movements = []) {
  return movements.reduce((sum, m) => {
    if (m.status && m.status !== 'active') return sum;
    if (m.movement_type === 'opening' || m.movementType === 'opening') return sum;
    const amount = Number(m.amount) || 0;
    if (m.direction === 'in') return sum + amount;
    return sum;
  }, 0);
}

export function calculateCashOut(movements = []) {
  return movements.reduce((sum, m) => {
    if (m.status && m.status !== 'active') return sum;
    if (m.movement_type === 'opening' || m.movementType === 'opening') return sum;
    const amount = Number(m.amount) || 0;
    if (m.direction === 'out') return sum + amount;
    return sum;
  }, 0);
}

export function calculateExpectedCash(openingCash, cashIn, cashOut) {
  const opening = Number(openingCash) || 0;
  const totalIn = Number(cashIn) || 0;
  const totalOut = Number(cashOut) || 0;
  return Math.round((opening + totalIn - totalOut) * 100) / 100;
}

export function calculateCashDifference(actualCash, expectedCash) {
  const actual = Number(actualCash) || 0;
  const expected = Number(expectedCash) || 0;
  const difference = Math.round((actual - expected) * 100) / 100;
  let varianceType = 'exact';
  if (difference > 0) varianceType = 'over';
  else if (difference < 0) varianceType = 'short';
  return { difference, varianceType, varianceAmount: Math.abs(difference) };
}

export const calculateTillDifference = calculateCashDifference;

export const MOVEMENT_TYPE_LABELS = {
  cash_sale: 'Cash Sale',
  customer_payment: 'Customer Payment',
  cash_receipt: 'Cash Receipt',
  expense: 'Expense',
  cash_withdrawal: 'Cash Withdrawal',
  supplier_payment: 'Supplier Payment',
  refund: 'Refund',
  opening: 'Opening Float',
  adjustment: 'Adjustment',
};
